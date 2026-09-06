import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ShipmentServices } from "./shipments.services";

const createShipment = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await ShipmentServices.createShipment(req.body, req.user!);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.CREATED,
			message: "Shipment created and payment initiated successfully",
			data: result,
		});
	},
);

const shipmentPaymentCallback = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { redirectUrl } = await ShipmentServices.shipmentPaymentCallback(
			req.query as Record<string, string>,
		);
		res.redirect(redirectUrl);
	},
);

const payForShipment = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await ShipmentServices.payForShipment(req.body, req.user!);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Payment initiated successfully",
			data: result,
		});
	},
);

export const ShipmentControllers = {
	createShipment,
	shipmentPaymentCallback,
	payForShipment,
};
