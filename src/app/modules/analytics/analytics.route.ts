import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AnalyticsControllers } from "./analytics.controller";

const router = Router();

router.get(
	"/admin",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	AnalyticsControllers.getAdminAnalytics,
);

router.get(
	"/merchant",
	auth(Role.MERCHANT),
	AnalyticsControllers.getMerchantAnalytics,
);

router.get(
	"/rider",
	auth(Role.RIDER),
	AnalyticsControllers.getRiderAnalytics,
);

router.get(
	"/customer",
	auth(Role.CUSTOMER),
	AnalyticsControllers.getCustomerAnalytics,
);

export const AnalyticsRoutes = router;
