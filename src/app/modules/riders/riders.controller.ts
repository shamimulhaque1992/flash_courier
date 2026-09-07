import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { RiderServices } from "./riders.services";
import { RiderValidations } from "./riders.validation";

const applyAsRider = catchAsync(async (req: Request, res: Response) => {
	const nidDocument =
		(req.files as Record<string, Express.Multer.File[]>)?.nidDocument?.[0] ??
		null;
	const additionalDocuments =
		(req.files as Record<string, Express.Multer.File[]>)?.additionalDocuments ??
		[];

	const zodValidationRequest =
		RiderValidations.RiderRegistrationZodSchema.safeParse(
			JSON.parse(req.body.data),
		);
	const payload = zodValidationRequest.data;
	if (!payload) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid payload");
	}

	const result = await RiderServices.applyAsRider(
		payload,
		nidDocument,
		additionalDocuments,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Rider application submitted. Verification email sent.",
		data: result,
	});
});

const verifyRiderEmail = catchAsync(async (req: Request, res: Response) => {
	const result = await RiderServices.verifyRiderEmail(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Email verified successfully",
		data: result,
	});
});

const approveRiderApplication = catchAsync(
	async (req: Request, res: Response) => {
		const result = await RiderServices.approveRiderApplication(
			req.body,
			req.user!,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: `Rider application ${result.verificationStatus.toLowerCase()} successfully`,
			data: result,
		});
	},
);

const getAllRiders = catchAsync(async (req: Request, res: Response) => {
	const result = await RiderServices.getAllRiders(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Riders fetched successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await RiderServices.getMyProfile(req.user!);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile fetched successfully",
		data: result,
	});
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await RiderServices.updateMyProfile(req.body, req.user!);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile updated successfully",
		data: result,
	});
});

export const RiderControllers = {
	applyAsRider,
	verifyRiderEmail,
	approveRiderApplication,
	getAllRiders,
	getMyProfile,
	updateMyProfile,
};
