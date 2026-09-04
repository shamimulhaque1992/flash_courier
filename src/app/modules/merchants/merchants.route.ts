import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { MerchantControllers } from "./merchants.controller";
import { MerchantValidations } from "./merchants.validation";

const router = Router();

router.post(
  "/apply",
  upload.fields([
    { name: "businessLicenseDocument", maxCount: 1 },
    { name: "additionalDocuments", maxCount: 5 },
  ]),
  validateRequest(MerchantValidations.MerchantRegistrationZodSchema),
  MerchantControllers.applyAsMerchant,
);

router.post(
  "/verify-email",
  validateRequest(MerchantValidations.MerchantEmailVerificationZodSchema),
  MerchantControllers.verifyMerchantEmail,
);

router.patch(
  "/approve",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(MerchantValidations.MerchantApplicationApprovalZodSchema),
  MerchantControllers.approveMerchantApplication,
);

router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  MerchantControllers.getAllMerchants,
);

export const MerchantRoutes = router;
