import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { CustomerServices } from "./customers.services";

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await CustomerServices.getMyProfile(req.user!);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile fetched successfully",
		data: result,
	});
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await CustomerServices.updateMyProfile(req.body, req.user!);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile updated successfully",
		data: result,
	});
});

export const CustomerControllers = { getMyProfile, updateMyProfile };
