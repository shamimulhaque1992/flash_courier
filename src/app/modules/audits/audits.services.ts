import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { PaymentStatus, ShipmentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { generatePdf } from "../../utils/generatePdf";
import { sendEmail } from "../../utils/sendEmail";

const publishAudit = async (
	payload: { merchantId: string; startDate: string; endDate: string },
	user: RequestUser,
) => {
	const merchant = await prisma.merchants.findUnique({
		where: { id: payload.merchantId, isDeleted: false },
	});

	if (!merchant) throw new AppError(httpStatus.NOT_FOUND, "Merchant not found");

	const start = new Date(payload.startDate);
	const end = new Date(payload.endDate);

	if (start >= end)
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"startDate must be before endDate",
		);

	const dateFilter = { gte: start, lte: end };

	const [
		totalShipments,
		pendingPaymentShipments,
		paidShipments,
		inTransitShipments,
		deliveredShipments,
		cancelledShipments,
		returnedShipments,
		revenueResult,
		refundResult,
		totalReviews,
		avgRatingResult,
	] = await Promise.all([
		prisma.shipments.count({
			where: {
				merchantId: merchant.id,
				isDeleted: false,
				createdAt: dateFilter,
			},
		}),
		prisma.shipments.count({
			where: {
				merchantId: merchant.id,
				isDeleted: false,
				createdAt: dateFilter,
				shipmentStatus: ShipmentStatus.PENDING_PAYMENT,
			},
		}),
		prisma.shipments.count({
			where: {
				merchantId: merchant.id,
				isDeleted: false,
				createdAt: dateFilter,
				shipmentStatus: ShipmentStatus.PAID,
			},
		}),
		prisma.shipments.count({
			where: {
				merchantId: merchant.id,
				isDeleted: false,
				createdAt: dateFilter,
				shipmentStatus: ShipmentStatus.IN_TRANSIT,
			},
		}),
		prisma.shipments.count({
			where: {
				merchantId: merchant.id,
				isDeleted: false,
				createdAt: dateFilter,
				shipmentStatus: ShipmentStatus.DELIVERED,
			},
		}),
		prisma.shipments.count({
			where: {
				merchantId: merchant.id,
				isDeleted: false,
				createdAt: dateFilter,
				shipmentStatus: ShipmentStatus.CANCELLED_BY_MERCHANT,
			},
		}),
		prisma.shipments.count({
			where: {
				merchantId: merchant.id,
				isDeleted: false,
				createdAt: dateFilter,
				shipmentStatus: ShipmentStatus.RETURNED_BY_CUSTOMER,
			},
		}),
		prisma.payments.aggregate({
			where: {
				shipment: { merchantId: merchant.id, createdAt: dateFilter },
				status: PaymentStatus.PAID,
			},
			_sum: { amount: true },
		}),
		prisma.payments.aggregate({
			where: {
				shipment: { merchantId: merchant.id, createdAt: dateFilter },
				status: PaymentStatus.REFUNDED,
			},
			_sum: { amount: true },
		}),
		prisma.reviews.count({
			where: { merchantId: merchant.id, createdAt: dateFilter },
		}),
		prisma.reviews.aggregate({
			where: { merchantId: merchant.id, createdAt: dateFilter },
			_avg: { merchantRating: true },
		}),
	]);

	const totalRevenue =
		(revenueResult._sum.amount?.toNumber() ?? 0) -
		(refundResult._sum.amount?.toNumber() ?? 0);
	const totalRefunded = refundResult._sum.amount?.toNumber() ?? 0;
	const avgRating = avgRatingResult._avg.merchantRating?.toFixed(2) ?? "N/A";
	const deliveryRate =
		totalShipments > 0
			? ((deliveredShipments / totalShipments) * 100).toFixed(1)
			: "0.0";

	const fmt = (d: Date) => d.toDateString();

	// --- Build PDF ---
	const pdfBuffer = await generatePdf((doc) => {
		doc.fontSize(22).text("Flash Courier", { align: "center" });
		doc.fontSize(16).text("Merchant Audit Report", { align: "center" });
		doc.moveDown(0.5);
		doc
			.fontSize(11)
			.text(`Period: ${fmt(start)} — ${fmt(end)}`, { align: "center" });
		doc.moveDown(2);

		doc.fontSize(13).text("Merchant Information");
		doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
		doc.moveDown(0.5);
		doc.fontSize(11).text(`Name: ${merchant.name}`);
		doc.text(`Email: ${merchant.email}`);
		doc.text(`Business Type: ${merchant.businessType}`);
		doc.text(`Division: ${merchant.division}`);
		doc.text(`District: ${merchant.district}`);
		doc.moveDown(1.5);

		doc.fontSize(13).text("Shipment Summary");
		doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
		doc.moveDown(0.5);
		doc.fontSize(11);
		doc.text(`Total Shipments: ${totalShipments}`);
		doc.text(`Delivered: ${deliveredShipments}`);
		doc.text(`In Transit: ${inTransitShipments}`);
		doc.text(`Paid (Awaiting Pickup): ${paidShipments}`);
		doc.text(`Pending Payment: ${pendingPaymentShipments}`);
		doc.text(`Cancelled: ${cancelledShipments}`);
		doc.text(`Returned by Customer: ${returnedShipments}`);
		doc.text(`Delivery Success Rate: ${deliveryRate}%`);
		doc.moveDown(1.5);

		doc.fontSize(13).text("Financial Summary");
		doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
		doc.moveDown(0.5);
		doc.fontSize(11);
		doc.text(`Total Revenue (net): BDT ${totalRevenue.toFixed(2)}`);
		doc.text(`Total Refunded: BDT ${totalRefunded.toFixed(2)}`);
		doc.moveDown(1.5);

		doc.fontSize(13).text("Customer Feedback");
		doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
		doc.moveDown(0.5);
		doc.fontSize(11);
		doc.text(`Total Reviews: ${totalReviews}`);
		doc.text(`Average Merchant Rating: ${avgRating} / 5`);
		doc.moveDown(2);

		doc
			.fontSize(10)
			.fillColor("grey")
			.text(
				`Report generated on ${new Date().toDateString()} by Flash Courier Admin`,
				{
					align: "center",
				},
			);
	});

	// --- Upload to Cloudinary ---
	const uploadResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{ resource_type: "raw", format: "pdf" },
					(error, result) => {
						if (error) return reject(error);
						if (!result)
							return reject(
								new AppError(
									httpStatus.INTERNAL_SERVER_ERROR,
									"No result from Cloudinary",
								),
							);
						resolve(result);
					},
				)
				.end(pdfBuffer);
		},
	);

	// --- Save audit record ---
	const audit = await prisma.merchantAudits.create({
		data: {
			merchantId: merchant.id,
			startDate: start,
			endDate: end,
			reportUrl: uploadResult.secure_url,
			reportPublicId: uploadResult.public_id,
			publishedBy: user.userId,
		},
	});

	// --- Email merchant ---
	await sendEmail(
		"merchant-audit-report.ejs",
		{ name: merchant.name, startDate: fmt(start), endDate: fmt(end) },
		{
			from: config.email_sender,
			to: merchant.email,
			subject: `Audit Report — ${fmt(start)} to ${fmt(end)}`,
			attachments: [{ filename: "audit-report.pdf", content: pdfBuffer }],
		},
	);

	return audit;
};

const getMerchantAudits = async (merchantId: string) => {
	const merchant = await prisma.merchants.findUnique({
		where: { id: merchantId, isDeleted: false },
	});
	if (!merchant) throw new AppError(httpStatus.NOT_FOUND, "Merchant not found");

	return prisma.merchantAudits.findMany({
		where: { merchantId },
		orderBy: { createdAt: "desc" },
	});
};

export const AuditServices = { publishAudit, getMerchantAudits };
