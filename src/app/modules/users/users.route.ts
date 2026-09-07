import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { userController } from "./users.controller";

const router = Router();

router.patch(
  "/profile-image",
  auth(Role.SUPER_ADMIN, Role.ADMIN, Role.MERCHANT, Role.RIDER, Role.CUSTOMER),
  upload.single("profileImage"),
  userController.uploadImage,
);

export const UserRoutes = router;
