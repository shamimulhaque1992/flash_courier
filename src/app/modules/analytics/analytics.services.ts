import httpStatus from "http-status";
import {
	MerchantVerificationStatus,
	PaymentStatus,
	RiderScheduleStatus,
	RiderVerificationStatus,
	ShipmentStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const getAdminAnalytics = async () => {
	const [
		totalMerchants,
		pendingMerchants,
		verifiedMerchants,
		rejectedMerchants,
		totalRiders,
		pendingRiders,
		verifiedRiders,
		rejectedRiders,
		totalShipments,
		deliveredShipments,
		cancelledShipments,
		inTransitShipments,
		totalSchedules,
		publishedSchedules,
		revenueResult,
		refundResult,
	] = await Promise.all([
		prisma.merchants.count({ where: { isDeleted: false } }),
		prisma.merchants.count({
			where: { isDeleted: false, verificationStatus: MerchantVerificationStatus.PENDING },
		}),
		prisma.merchants.count({
			where: { isDeleted: false, verificationStatus: MerchantVerificationStatus.VERIFIED },
		}),
		prisma.merchants.count({
			where: { isDeleted: false, verificationStatus: MerchantVerificationStatus.REJECTED },
		}),
		prisma.riders.count({ where: { isDeleted: false } }),
		prisma.riders.count({
			where: { isDeleted: false, verificationStatus: RiderVerificationStatus.PENDING },
		}),
		prisma.riders.count({
			where: { isDeleted: false, verificationStatus: RiderVerificationStatus.VERIFIED },
		}),
		prisma.riders.count({
			where: { isDeleted: false, verificationStatus: RiderVerificationStatus.REJECTED },
		}),
		prisma.shipments.count({ where: { isDeleted: false } }),
		prisma.shipments.count({
			where: { isDeleted: false, shipmentStatus: ShipmentStatus.DELIVERED },
		}),
		prisma.shipments.count({
			where: { isDeleted: false, shipmentStatus: ShipmentStatus.CANCELLED_BY_MERCHANT },
		}),
		prisma.shipments.count({
			where: { isDeleted: false, shipmentStatus: ShipmentStatus.IN_TRANSIT },
		}),
		prisma.riderSchedules.count({ where: { isDeleted: false } }),
		prisma.riderSchedules.count({
			where: { isDeleted: false, status: RiderScheduleStatus.PUBLISHED },
		}),
		prisma.payments.aggregate({
			where: { status: PaymentStatus.PAID },
			_sum: { amount: true },
		}),
		prisma.payments.aggregate({
			where: { status: PaymentStatus.REFUNDED },
			_sum: { amount: true },
		}),
	]);

	const totalRefunded = refundResult._sum.amount?.toNumber() ?? 0;
	const totalRevenue = (revenueResult._sum.amount?.toNumber() ?? 0) - totalRefunded;

	return {
		merchants: {
			total: totalMerchants,
			pending: pendingMerchants,
			verified: verifiedMerchants,
			rejected: rejectedMerchants,
		},
		riders: {
			total: totalRiders,
			pending: pendingRiders,
			verified: verifiedRiders,
			rejected: rejectedRiders,
		},
		shipments: {
			total: totalShipments,
			delivered: deliveredShipments,
			cancelled: cancelledShipments,
			inTransit: inTransitShipments,
		},
		schedules: { total: totalSchedules, published: publishedSchedules },
		financials: { totalRevenue, totalRefunded },
	};
};

const getMerchantAnalytics = async (user: RequestUser) => {
	const merchant = await prisma.merchants.findUnique({ where: { userId: user.userId } });
	if (!merchant) throw new AppError(httpStatus.NOT_FOUND, "Merchant profile not found");

	const [
		totalShipments,
		pendingPaymentShipments,
		paidShipments,
		inTransitShipments,
		deliveredShipments,
		cancelledShipments,
		revenueResult,
		refundResult,
		totalPayments,
	] = await Promise.all([
		prisma.shipments.count({ where: { merchantId: merchant.id, isDeleted: false } }),
		prisma.shipments.count({
			where: { merchantId: merchant.id, isDeleted: false, shipmentStatus: ShipmentStatus.PENDING_PAYMENT },
		}),
		prisma.shipments.count({
			where: { merchantId: merchant.id, isDeleted: false, shipmentStatus: ShipmentStatus.PAID },
		}),
		prisma.shipments.count({
			where: { merchantId: merchant.id, isDeleted: false, shipmentStatus: ShipmentStatus.IN_TRANSIT },
		}),
		prisma.shipments.count({
			where: { merchantId: merchant.id, isDeleted: false, shipmentStatus: ShipmentStatus.DELIVERED },
		}),
		prisma.shipments.count({
			where: { merchantId: merchant.id, isDeleted: false, shipmentStatus: ShipmentStatus.CANCELLED_BY_MERCHANT },
		}),
		prisma.payments.aggregate({
			where: { shipment: { merchantId: merchant.id }, status: PaymentStatus.PAID },
			_sum: { amount: true },
		}),
		prisma.payments.aggregate({
			where: { shipment: { merchantId: merchant.id }, status: PaymentStatus.REFUNDED },
			_sum: { amount: true },
		}),
		prisma.payments.count({ where: { shipment: { merchantId: merchant.id } } }),
	]);

	return {
		shipments: {
			total: totalShipments,
			pendingPayment: pendingPaymentShipments,
			paid: paidShipments,
			inTransit: inTransitShipments,
			delivered: deliveredShipments,
			cancelled: cancelledShipments,
		},
		financials: {
			totalRevenue:
				(revenueResult._sum.amount?.toNumber() ?? 0) -
				(refundResult._sum.amount?.toNumber() ?? 0),
			totalRefunded: refundResult._sum.amount?.toNumber() ?? 0,
			totalPayments,
		},
	};
};

const getRiderAnalytics = async (user: RequestUser) => {
	const rider = await prisma.riders.findUnique({ where: { userId: user.userId } });
	if (!rider) throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");

	const [
		totalSchedules,
		publishedSchedules,
		completedSchedules,
		totalShipments,
		acceptedShipments,
		pickedUpShipments,
		outForDeliveryShipments,
		deliveredShipments,
		rejectedShipments,
	] = await Promise.all([
		prisma.riderSchedules.count({ where: { riderId: rider.id, isDeleted: false } }),
		prisma.riderSchedules.count({
			where: { riderId: rider.id, isDeleted: false, status: RiderScheduleStatus.PUBLISHED },
		}),
		prisma.riderSchedules.count({
			where: { riderId: rider.id, isDeleted: false, status: RiderScheduleStatus.COMPLETED },
		}),
		prisma.shipments.count({ where: { riderId: rider.id, isDeleted: false } }),
		prisma.shipments.count({
			where: { riderId: rider.id, isDeleted: false, shipmentStatus: ShipmentStatus.ACCEPTED_BY_RIDER },
		}),
		prisma.shipments.count({
			where: { riderId: rider.id, isDeleted: false, shipmentStatus: ShipmentStatus.PICKED_UP },
		}),
		prisma.shipments.count({
			where: { riderId: rider.id, isDeleted: false, shipmentStatus: ShipmentStatus.OUT_FOR_DELIVERY },
		}),
		prisma.shipments.count({
			where: { riderId: rider.id, isDeleted: false, shipmentStatus: ShipmentStatus.DELIVERED },
		}),
		prisma.shipments.count({
			where: { riderId: rider.id, isDeleted: false, shipmentStatus: ShipmentStatus.REJECTED_BY_RIDER },
		}),
	]);

	return {
		schedules: { total: totalSchedules, published: publishedSchedules, completed: completedSchedules },
		shipments: {
			total: totalShipments,
			accepted: acceptedShipments,
			pickedUp: pickedUpShipments,
			outForDelivery: outForDeliveryShipments,
			delivered: deliveredShipments,
			rejected: rejectedShipments,
		},
	};
};

const getCustomerAnalytics = async (user: RequestUser) => {
	const customer = await prisma.customers.findUnique({ where: { userId: user.userId } });
	if (!customer) throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");

	const [
		totalShipments,
		inTransitShipments,
		outForDeliveryShipments,
		deliveredShipments,
		returnedShipments,
		totalSpentResult,
		totalRefundedResult,
	] = await Promise.all([
		prisma.shipments.count({ where: { customerId: customer.id, isDeleted: false } }),
		prisma.shipments.count({
			where: { customerId: customer.id, isDeleted: false, shipmentStatus: ShipmentStatus.IN_TRANSIT },
		}),
		prisma.shipments.count({
			where: { customerId: customer.id, isDeleted: false, shipmentStatus: ShipmentStatus.OUT_FOR_DELIVERY },
		}),
		prisma.shipments.count({
			where: { customerId: customer.id, isDeleted: false, shipmentStatus: ShipmentStatus.DELIVERED },
		}),
		prisma.shipments.count({
			where: { customerId: customer.id, isDeleted: false, shipmentStatus: ShipmentStatus.RETURNED_BY_CUSTOMER },
		}),
		prisma.payments.aggregate({
			where: { shipment: { customerId: customer.id }, status: PaymentStatus.PAID },
			_sum: { amount: true },
		}),
		prisma.payments.aggregate({
			where: { shipment: { customerId: customer.id }, status: PaymentStatus.REFUNDED },
			_sum: { amount: true },
		}),
	]);

	return {
		shipments: {
			total: totalShipments,
			inTransit: inTransitShipments,
			outForDelivery: outForDeliveryShipments,
			delivered: deliveredShipments,
			returned: returnedShipments,
		},
		financials: {
			totalAmountSpent: totalSpentResult._sum.amount?.toNumber() ?? 0,
			totalRefunded: totalRefundedResult._sum.amount?.toNumber() ?? 0,
		},
	};
};

export const AnalyticsServices = {
	getAdminAnalytics,
	getMerchantAnalytics,
	getRiderAnalytics,
	getCustomerAnalytics,
};
