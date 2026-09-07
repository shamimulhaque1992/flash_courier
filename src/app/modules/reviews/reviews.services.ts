import httpStatus from "http-status";
import { ShipmentStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { IQuery } from "../../interfaces";

const createReview = async (
	payload: {
		shipmentId: string;
		merchantRating: number;
		riderRating: number;
		comment?: string;
	},
	user: RequestUser,
) => {
	const shipment = await prisma.shipments.findUnique({
		where: { id: payload.shipmentId },
		include: { reviews: true },
	});

	if (!shipment || shipment.isDeleted)
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");

	if (shipment.receiverEmail !== user.email)
		throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to review this shipment");

	if (shipment.shipmentStatus !== ShipmentStatus.DELIVERED)
		throw new AppError(httpStatus.BAD_REQUEST, "You can only review a delivered shipment");

	if (shipment.reviews)
		throw new AppError(httpStatus.CONFLICT, "You have already reviewed this shipment");

	if (!shipment.riderId)
		throw new AppError(httpStatus.BAD_REQUEST, "Shipment has no assigned rider to review");

	// Resolve customer profile (may be null — customer identified by email)
	const customer = await prisma.customers.findUnique({ where: { userId: user.userId } });
	if (!customer)
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");

	return prisma.reviews.create({
		data: {
			shipmentId: payload.shipmentId,
			merchantId: shipment.merchantId,
			riderId: shipment.riderId,
			customerId: customer.id,
			merchantRating: payload.merchantRating,
			riderRating: payload.riderRating,
			comment: payload.comment,
		},
		include: {
			shipment: { select: { trackingNumber: true, receiverName: true } },
			merchant: { select: { name: true } },
			rider: { select: { name: true } },
		},
	});
};

const updateReview = async (
	reviewId: string,
	payload: { merchantRating?: number; riderRating?: number; comment?: string },
	user: RequestUser,
) => {
	const customer = await prisma.customers.findUnique({ where: { userId: user.userId } });
	if (!customer)
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");

	const review = await prisma.reviews.findUnique({ where: { id: reviewId } });
	if (!review)
		throw new AppError(httpStatus.NOT_FOUND, "Review not found");

	if (review.customerId !== customer.id)
		throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to update this review");

	return prisma.reviews.update({
		where: { id: reviewId },
		data: payload,
		include: {
			shipment: { select: { trackingNumber: true } },
			merchant: { select: { name: true } },
			rider: { select: { name: true } },
		},
	});
};

const deleteReview = async (reviewId: string, user: RequestUser) => {
	const review = await prisma.reviews.findUnique({ where: { id: reviewId } });
	if (!review)
		throw new AppError(httpStatus.NOT_FOUND, "Review not found");

	if (user.role === "CUSTOMER") {
		const customer = await prisma.customers.findUnique({ where: { userId: user.userId } });
		if (!customer || review.customerId !== customer.id)
			throw new AppError(httpStatus.FORBIDDEN, "You are not allowed to delete this review");
	}

	await prisma.reviews.delete({ where: { id: reviewId } });
	return { message: "Review deleted successfully" };
};

const getMyReviews = async (query: IQuery, user: RequestUser) => {
	const customer = await prisma.customers.findUnique({ where: { userId: user.userId } });
	if (!customer)
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;

	const [data, total] = await Promise.all([
		prisma.reviews.findMany({
			where: { customerId: customer.id },
			take: limit,
			skip: (page - 1) * limit,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: { select: { trackingNumber: true, receiverName: true, receiverDistrict: true } },
				merchant: { select: { name: true } },
				rider: { select: { name: true } },
			},
		}),
		prisma.reviews.count({ where: { customerId: customer.id } }),
	]);

	return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getMerchantReviews = async (query: IQuery, user: RequestUser) => {
	const merchant = await prisma.merchants.findUnique({ where: { userId: user.userId } });
	if (!merchant)
		throw new AppError(httpStatus.NOT_FOUND, "Merchant profile not found");

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;

	const [data, total] = await Promise.all([
		prisma.reviews.findMany({
			where: { merchantId: merchant.id },
			take: limit,
			skip: (page - 1) * limit,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: { select: { trackingNumber: true, receiverName: true } },
				customer: { select: { name: true, email: true } },
				rider: { select: { name: true } },
			},
		}),
		prisma.reviews.count({ where: { merchantId: merchant.id } }),
	]);

	return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getRiderReviews = async (query: IQuery, user: RequestUser) => {
	const rider = await prisma.riders.findUnique({ where: { userId: user.userId } });
	if (!rider)
		throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");

	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;

	const [data, total] = await Promise.all([
		prisma.reviews.findMany({
			where: { riderId: rider.id },
			take: limit,
			skip: (page - 1) * limit,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: { select: { trackingNumber: true, receiverName: true } },
				customer: { select: { name: true, email: true } },
				merchant: { select: { name: true } },
			},
		}),
		prisma.reviews.count({ where: { riderId: rider.id } }),
	]);

	return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getAllReviews = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;

	const where: Record<string, unknown> = {};
	if (query.searchTerm)
		where.shipment = { trackingNumber: { contains: query.searchTerm, mode: "insensitive" } };

	const [data, total] = await Promise.all([
		prisma.reviews.findMany({
			where,
			take: limit,
			skip: (page - 1) * limit,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: { select: { trackingNumber: true, receiverName: true } },
				customer: { select: { name: true, email: true } },
				merchant: { select: { name: true, email: true } },
				rider: { select: { name: true, email: true } },
			},
		}),
		prisma.reviews.count({ where }),
	]);

	return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const ReviewServices = {
	createReview,
	updateReview,
	deleteReview,
	getMyReviews,
	getMerchantReviews,
	getRiderReviews,
	getAllReviews,
};
