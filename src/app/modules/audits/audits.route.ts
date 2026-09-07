import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuditControllers } from "./audits.controller";
import { CreateAuditZodSchema } from "./audits.validation";

const router = Router();

router.post(
	"/",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	validateRequest(CreateAuditZodSchema),
	AuditControllers.publishAudit,
);

router.get(
	"/:merchantId",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	AuditControllers.getMerchantAudits,
);

export const AuditRoutes = router;
