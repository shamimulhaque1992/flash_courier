import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(UserValidation.CustomerRegistrationZodSchema),
  AuthController.registerCustomer,
);
router.post(
  "/verify-email",
  validateRequest(UserValidation.VerifyEmailZodSchema),
  AuthController.verifyUserEmail,
);
router.post(
  "/login",
  validateRequest(UserValidation.LoginZodSchema),
  AuthController.loginUser,
);

router.post("/refresh-token", AuthController.refreshToken);
router.post("/google", AuthController.googleLogin);
router.post(
  "/forgot-password",
  validateRequest(UserValidation.ForgotPasswordZodSchema),
  AuthController.forgotPassword,
);
router.post(
  "/reset-password",
  validateRequest(UserValidation.ResetPasswordZodSchema),
  AuthController.resetPassword,
);
export const AuthRoutes = router;
