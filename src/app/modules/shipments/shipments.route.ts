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

export const ShipmentRoutes = router;
