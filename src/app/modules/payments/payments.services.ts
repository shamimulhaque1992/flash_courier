import httpStatus from "http-status";
import type { PaymentsWhereInput } from "../../../generated/prisma/models";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const getMyPayments = async (query: IQuery, user: RequestUser) => {
	const merchant = await prisma.merchants.findUnique({
		where: { userId: user.userId },
	});
	if (!merchant)
		throw new AppError(httpStatus.NOT_FOUND, "Merchant profile not found");

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ?? "createdAt";
	const sortOrder = query.sortOrder ?? "desc";

	const andConditions: PaymentsWhereInput[] = [
		{ shipment: { merchantId: merchant.id } },
	];

	if (query.status) andConditions.push({ status: query.status });

	const [data, total] = await Promise.all([
		prisma.payments.findMany({
			where: { AND: andConditions },
			take: limit,
			skip,
			orderBy: { [sortBy]: sortOrder },
			include: {
				shipment: {
					select: {
						trackingNumber: true,
						receiverName: true,
						receiverDistrict: true,
						receiverDivision: true,
						shipmentStatus: true,
					},
				},
			},
		}),
		prisma.payments.count({ where: { AND: andConditions } }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getAllPayments = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ?? "createdAt";
	const sortOrder = query.sortOrder ?? "desc";

	const andConditions: PaymentsWhereInput[] = [];

	if (query.status) andConditions.push({ status: query.status });
	if (query.merchantEmail)
		andConditions.push({
			shipment: {
				merchant: {
					email: { contains: query.merchantEmail, mode: "insensitive" },
				},
			},
		});
	if (query.searchTerm)
		andConditions.push({
			OR: [
				{ bkashTrxId: { contains: query.searchTerm, mode: "insensitive" } },
				{ payerReference: { contains: query.searchTerm, mode: "insensitive" } },
				{
					shipment: {
						trackingNumber: {
							contains: query.searchTerm,
							mode: "insensitive",
						},
					},
				},
			],
		});

	const [data, total] = await Promise.all([
		prisma.payments.findMany({
			where: { AND: andConditions },
			take: limit,
			skip,
			orderBy: { [sortBy]: sortOrder },
			include: {
				shipment: {
					select: {
						trackingNumber: true,
						receiverName: true,
						receiverDistrict: true,
						receiverDivision: true,
						shipmentStatus: true,
						merchant: { select: { name: true, email: true } },
					},
				},
			},
		}),
		prisma.payments.count({ where: { AND: andConditions } }),
	]);

	return {
		data,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getSinglePayment = async (paymentId: string, user: RequestUser) => {
	const payment = await prisma.payments.findUnique({
		where: { id: paymentId },
		include: {
			shipment: {
				include: {
					merchant: { select: { id: true, name: true, email: true, userId: true } },
				},
			},
		},
	});

	if (!payment)
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");

	if (user.role === "MERCHANT") {
		if (payment.shipment.merchant.userId !== user.userId)
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You are not allowed to view this payment",
			);
	}

	return payment;
};

export const PaymentServices = {
	getMyPayments,
	getAllPayments,
	getSinglePayment,
};
