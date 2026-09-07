import cron from "node-cron";
import {
	MerchantVerificationStatus,
	PaymentStatus,
	RiderVerificationStatus,
	Role,
	ShipmentStatus,
} from "../../generated/prisma/enums";
import { prisma } from "./prisma";

const TWO_DAYS_AGO = () => new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
const TEN_DAYS_AGO = () => new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

// Runs every hour
// Deletes merchant users whose:
//   - email is not verified after 2 days, OR
//   - email is verified but merchant application was REJECTED for 2 days
export const deleteUnverifiedMerchants = () => {
	cron.schedule("0 * * * *", async () => {
		try {
			const deleted = await prisma.users.deleteMany({
				where: {
					role: Role.MERCHANT,
					OR: [
						// Email never verified after 2 days
						{
							emailVerified: false,
							createdAt: { lt: TWO_DAYS_AGO() },
						},
						// Email verified but application rejected for 2 days
						{
							emailVerified: true,
							merchant: {
								verificationStatus: MerchantVerificationStatus.REJECTED,
								reviewedAt: { lt: TWO_DAYS_AGO() },
							},
						},
					],
				},
			});

			if (deleted.count > 0)
				console.log(
					`Cron [merchants]: Deleted ${deleted.count} unverified/rejected merchant(s)`,
				);
		} catch (error) {
			console.error("Cron [merchants] error:", error);
		}
	});
};

// Runs every hour
// Deletes rider users whose:
//   - email is not verified after 2 days, OR
//   - email is verified but rider application was REJECTED for 2 days
export const deleteUnverifiedRiders = () => {
	cron.schedule("0 * * * *", async () => {
		try {
			const deleted = await prisma.users.deleteMany({
				where: {
					role: Role.RIDER,
					OR: [
						{
							emailVerified: false,
							createdAt: { lt: TWO_DAYS_AGO() },
						},
						{
							emailVerified: true,
							rider: {
								verificationStatus: RiderVerificationStatus.REJECTED,
								reviewedAt: { lt: TWO_DAYS_AGO() },
							},
						},
					],
				},
			});

			if (deleted.count > 0)
				console.log(
					`Cron [riders]: Deleted ${deleted.count} unverified/rejected rider(s)`,
				);
		} catch (error) {
			console.error("Cron [riders] error:", error);
		}
	});
};

// Runs every day at midnight
// Soft-deletes shipments that have been stuck in:
//   - PENDING_PAYMENT for 10 days
//   - CANCELLED_BY_MERCHANT for 10 days
export const deleteStalePendingShipments = () => {
	cron.schedule("0 0 * * *", async () => {
		try {
			const deleted = await prisma.shipments.updateMany({
				where: {
					isDeleted: false,
					OR: [
						{
							shipmentStatus: ShipmentStatus.PENDING_PAYMENT,
							paymentStatus: PaymentStatus.PENDING,
							createdAt: { lt: TEN_DAYS_AGO() },
						},
						{
							shipmentStatus: ShipmentStatus.CANCELLED_BY_MERCHANT,
							updatedAt: { lt: TEN_DAYS_AGO() },
						},
					],
				},
				data: {
					isDeleted: true,
					deletedAt: new Date(),
				},
			});

			if (deleted.count > 0)
				console.log(
					`Cron [shipments]: Soft-deleted ${deleted.count} stale shipment(s)`,
				);
		} catch (error) {
			console.error("Cron [shipments] error:", error);
		}
	});
};
