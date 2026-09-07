import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ReviewServices } from "./reviews.services";

const createReview = catchAsync(async (req: Request, res: Response) => {
	const result = await ReviewServices.createReview(req.body, req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.CREATED,
		message: "Review submitted successfully",
		data: result,
	});
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
	const result = await ReviewServices.updateReview(req.params.reviewId, req.body, req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Review updated successfully",
		data: result,
	});
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
	const result = await ReviewServices.deleteReview(req.params.reviewId, req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: result.message,
		data: null,
	});
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ReviewServices.getMyReviews(req.query, req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Reviews retrieved successfully",
		data,
		meta,
	});
});

const getMerchantReviews = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ReviewServices.getMerchantReviews(req.query, req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Merchant reviews retrieved successfully",
		data,
		meta,
	});
});

const getRiderReviews = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ReviewServices.getRiderReviews(req.query, req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Rider reviews retrieved successfully",
		data,
		meta,
	});
});

const getAllReviews = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await ReviewServices.getAllReviews(req.query);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "All reviews retrieved successfully",
		data,
		meta,
	});
});

export const ReviewControllers = {
	createReview,
	updateReview,
	deleteReview,
	getMyReviews,
	getMerchantReviews,
	getRiderReviews,
	getAllReviews,
};
