import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ShipmentControllers } from "./shipments.controller";
import { ShipmentValidations } from "./shipments.validation";

const router = Router();

// Public — merchant can calculate delivery price without auth (for embedding in their own website)
router.post(
	"/calculate-price",
	validateRequest(ShipmentValidations.CalculateDeliveryPriceZodSchema),
	ShipmentControllers.calculateDeliveryPrice,
);

// Customer tracks their shipment by tracking number
router.post(
	"/track",
	auth(Role.CUSTOMER),
	validateRequest(ShipmentValidations.TrackShipmentZodSchema),
	ShipmentControllers.trackShipment,
);

router.post(
	"/create-shipment",
	auth(Role.MERCHANT),
	validateRequest(ShipmentValidations.CreateShipmentZodSchema),
	ShipmentControllers.createShipment,
);

router.post("/re-pay", auth(Role.MERCHANT), ShipmentControllers.payForShipment);

router.get("/payment/callback", ShipmentControllers.shipmentPaymentCallback);

// Admin assigns a shipment to a rider's schedule
router.post(
	"/assign",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	ShipmentControllers.assignShipment,
);

// Rider accepts or rejects an assigned shipment
router.patch(
	"/respond/:shipmentId",
	auth(Role.RIDER),
	ShipmentControllers.respondToShipment,
);

// Rider marks shipment as delivered using customer OTP
router.patch(
	"/deliver/:shipmentId",
	auth(Role.RIDER),
	ShipmentControllers.markShipmentDelivered,
);

// Merchant cancels shipment
router.patch(
	"/cancel",
	auth(Role.MERCHANT),
	ShipmentControllers.cancelShipment,
);

// Admin updates shipment status
router.patch(
	"/status/:shipmentId",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	ShipmentControllers.updateShipmentStatus,
);

// Merchant views their shipments
router.get(
	"/my-shipments",
	auth(Role.MERCHANT),
	ShipmentControllers.getMerchantShipments,
);

// Customer views shipments addressed to them
router.get(
	"/my-deliveries",
	auth(Role.CUSTOMER),
	ShipmentControllers.getCustomerShipments,
);

// Rider views their assigned shipments
router.get(
	"/my-assignments",
	auth(Role.RIDER),
	ShipmentControllers.getRiderShipments,
);

// Admin views all shipments
router.get(
	"/all",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	ShipmentControllers.getAllShipments,
);

// Single shipment — all authorized roles
router.get(
	"/:shipmentId",
	auth(Role.MERCHANT, Role.RIDER, Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN),
	ShipmentControllers.getSingleShipment,
);

export const ShipmentRoutes = router;
