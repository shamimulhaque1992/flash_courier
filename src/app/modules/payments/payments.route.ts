import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { PaymentControllers } from "./payments.controller";

const router = Router();

// Merchant views their own payments
router.get(
	"/my-payments",
	auth(Role.MERCHANT),
	PaymentControllers.getMyPayments,
);

// Admin views all payments with filters
router.get(
	"/all",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	PaymentControllers.getAllPayments,
);

// Single payment — merchant (own only) or admin
router.get(
	"/:paymentId",
	auth(Role.MERCHANT, Role.ADMIN, Role.SUPER_ADMIN),
	PaymentControllers.getSinglePayment,
);

export const PaymentRoutes = router;
