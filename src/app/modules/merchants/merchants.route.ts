import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { MerchantControllers } from "./merchants.controller";
import { MerchantValidations } from "./merchants.validation";

const router = Router();

router.post(
  "/apply-as-merchant",
  upload.fields([
    { name: "businessLicenseDocument", maxCount: 1 },
    { name: "additionalDocuments", maxCount: 5 },
  ]),
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
  "/my-profile",
  auth(Role.MERCHANT),
  MerchantControllers.getMyProfile,
);

router.patch(
  "/my-profile",
  auth(Role.MERCHANT),
  validateRequest(MerchantValidations.UpdateMerchantProfileZodSchema),
  MerchantControllers.updateMyProfile,
);

router.get(
  "/",
  auth(Role.ADMIN, Role.SUPER_ADMIN),
  MerchantControllers.getAllMerchants,
);

export const MerchantRoutes = router;
