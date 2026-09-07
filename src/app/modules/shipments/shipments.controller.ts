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

const respondToShipment = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await ShipmentServices.respondToShipment(
			req.params.shipmentId as string,
			req.body.status,
			req.user!,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Shipment response recorded successfully",
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

const cancelShipment = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await ShipmentServices.cancelShipment(req.body, req.user!);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Shipment cancelled successfully",
			data: result,
		});
	},
);

const updateShipmentStatus = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await ShipmentServices.updateShipmentStatus(
			req.params.shipmentId as string,
			req.body,
			req.user!,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Shipment status updated successfully",
			data: result,
		});
	},
);

const getMerchantShipments = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await ShipmentServices.getMerchantShipments(req.query, req.user!);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Shipments retrieved successfully",
			data,
			meta,
		});
	},
);

const getCustomerShipments = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await ShipmentServices.getCustomerShipments(req.query, req.user!);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Shipments retrieved successfully",
			data,
			meta,
		});
	},
);

const getRiderShipments = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await ShipmentServices.getRiderShipments(req.query, req.user!);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Shipments retrieved successfully",
			data,
			meta,
		});
	},
);

const getAllShipments = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await ShipmentServices.getAllShipments(req.query);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "All shipments retrieved successfully",
			data,
			meta,
		});
	},
);

const getSingleShipment = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await ShipmentServices.getSingleShipment(
			req.params.shipmentId as string,
			req.user!,
		);
		sendResponse(res, {
			success: true,
			statusCode: httpStatus.OK,
			message: "Shipment retrieved successfully",
			data: result,
		});
	},
);

export const ShipmentControllers = {
	createShipment,
	shipmentPaymentCallback,
	payForShipment,
	assignShipment,
	respondToShipment,
	markShipmentDelivered,
	cancelShipment,
	updateShipmentStatus,
	getMerchantShipments,
	getCustomerShipments,
	getRiderShipments,
	getAllShipments,
	getSingleShipment,
};
