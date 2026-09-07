import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CustomerControllers } from "./customers.controller";
import { CustomerValidations } from "./customers.validation";

const router = Router();

router.get(
	"/my-profile",
	auth(Role.CUSTOMER),
	CustomerControllers.getMyProfile,
);

router.patch(
	"/my-profile",
	auth(Role.CUSTOMER),
	validateRequest(CustomerValidations.UpdateCustomerProfileZodSchema),
	CustomerControllers.updateMyProfile,
);

export const CustomerRoutes = router;
