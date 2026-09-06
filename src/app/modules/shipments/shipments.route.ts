import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ShipmentControllers } from "./shipments.controller";
import { ShipmentValidations } from "./shipments.validation";

const router = Router();

router.post(
	"/create-shipment",
	auth(Role.MERCHANT),
	validateRequest(ShipmentValidations.CreateShipmentZodSchema),
	ShipmentControllers.createShipment,
);

router.post(
	"/re-pay",
	auth(Role.MERCHANT),
	ShipmentControllers.payForShipment,
);

router.get(
	"/payment/callback",
	ShipmentControllers.shipmentPaymentCallback,
);

// Admin assigns a shipment to a rider's schedule
router.post(
	"/assign",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	ShipmentControllers.assignShipment,
);

// Rider marks shipment as delivered using customer OTP
router.patch(
	"/deliver/:shipmentId",
	auth(Role.RIDER),
	ShipmentControllers.markShipmentDelivered,
);

export const ShipmentRoutes = router;
