import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ReviewControllers } from "./reviews.controller";
import { ReviewValidations } from "./reviews.validation";

const router = Router();

router.post(
	"/",
	auth(Role.CUSTOMER),
	validateRequest(ReviewValidations.CreateReviewZodSchema),
	ReviewControllers.createReview,
);

router.get("/my-reviews", auth(Role.CUSTOMER), ReviewControllers.getMyReviews);

router.get("/merchant-reviews", auth(Role.MERCHANT), ReviewControllers.getMerchantReviews);

router.get("/rider-reviews", auth(Role.RIDER), ReviewControllers.getRiderReviews);

router.get("/all", auth(Role.ADMIN, Role.SUPER_ADMIN), ReviewControllers.getAllReviews);

router.patch(
	"/:reviewId",
	auth(Role.CUSTOMER),
	validateRequest(ReviewValidations.UpdateReviewZodSchema),
	ReviewControllers.updateReview,
);

router.delete(
	"/:reviewId",
	auth(Role.CUSTOMER, Role.ADMIN, Role.SUPER_ADMIN),
	ReviewControllers.deleteReview,
);

export const ReviewRoutes = router;
