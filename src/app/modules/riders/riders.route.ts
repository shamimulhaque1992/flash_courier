import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RiderControllers } from "./riders.controller";
import { RiderValidations } from "./riders.validation";

const router = Router();

router.post(
  "/apply-as-rider",
  upload.fields([
    { name: "nidDocument", maxCount: 1 },
    { name: "additionalDocuments", maxCount: 5 },
  ]),
  RiderControllers.applyAsRider,
);

router.post(
  "/verify-email",
  validateRequest(RiderValidations.RiderEmailVerificationZodSchema),
  RiderControllers.verifyRiderEmail,
);

router.patch(
  "/approve",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(RiderValidations.RiderApplicationApprovalZodSchema),
  RiderControllers.approveRiderApplication,
);

router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  RiderControllers.getAllRiders,
);

export const RiderRoutes = router;
