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

const assignShipment = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await ShipmentServices.assignShipment(
			req.body.shipmentId,
			req.body.scheduleId,
			req.user!,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Shipment assigned to rider successfully",
			data: result,
		});
	},
);

const markShipmentDelivered = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await ShipmentServices.markShipmentDelivered(
			req.params.shipmentId as string,
			req.body.otp,
			req.user!,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: result.message,
			data: null,
		});
	},
);

export const ShipmentControllers = {
	createShipment,
	shipmentPaymentCallback,
	payForShipment,
	assignShipment,
	markShipmentDelivered,
};
