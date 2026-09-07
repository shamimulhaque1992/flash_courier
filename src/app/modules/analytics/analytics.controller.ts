import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsServices } from "./analytics.services";

const getAdminAnalytics = catchAsync(async (_req: Request, res: Response) => {
	const result = await AnalyticsServices.getAdminAnalytics();
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Admin analytics retrieved successfully",
		data: result,
	});
});

const getMerchantAnalytics = catchAsync(async (req: Request, res: Response) => {
	const result = await AnalyticsServices.getMerchantAnalytics(req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Merchant analytics retrieved successfully",
		data: result,
	});
});

const getRiderAnalytics = catchAsync(async (req: Request, res: Response) => {
	const result = await AnalyticsServices.getRiderAnalytics(req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Rider analytics retrieved successfully",
		data: result,
	});
});

const getCustomerAnalytics = catchAsync(async (req: Request, res: Response) => {
	const result = await AnalyticsServices.getCustomerAnalytics(req.user!);
	sendResponse(res, {
		success: true,
		statusCode: httpStatus.OK,
		message: "Customer analytics retrieved successfully",
		data: result,
	});
});

export const AnalyticsControllers = {
	getAdminAnalytics,
	getMerchantAnalytics,
	getRiderAnalytics,
	getCustomerAnalytics,
};
