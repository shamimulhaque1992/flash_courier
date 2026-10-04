import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { UserValidation } from "./auth.validation";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

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
router.post(
	"/logout",
	AuthController.logoutUser,
);

router.get(
  "/me",
  auth(Role.ADMIN, Role.SUPER_ADMIN, Role.MERCHANT, Role.RIDER, Role.CUSTOMER),
  AuthController.getMe,
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
