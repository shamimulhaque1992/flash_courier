import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentServices } from "./payments.services";

const getMyPayments = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await PaymentServices.getMyPayments(
			req.query,
			req.user!,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Payments retrieved successfully",
			data,
			meta,
		});
	},
);

const getAllPayments = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await PaymentServices.getAllPayments(req.query);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "All payments retrieved successfully",
			data,
			meta,
		});
	},
);

const getSinglePayment = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await PaymentServices.getSinglePayment(
			req.params.paymentId,
			req.user!,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Payment retrieved successfully",
			data: result,
		});
	},
);

export const PaymentControllers = {
	getMyPayments,
	getAllPayments,
	getSinglePayment,
};
