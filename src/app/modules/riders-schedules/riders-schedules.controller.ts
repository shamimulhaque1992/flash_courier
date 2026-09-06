import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { RiderScheduleServices } from "./riders-schedules.services";

const createSchedule = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await RiderScheduleServices.createSchedule(
			req.body,
			req.user!,
		);
		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Schedule created successfully",
			data: result,
		});
	},
);

const getMySchedules = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await RiderScheduleServices.getMySchedules(
			req.query,
			req.user!,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Schedules retrieved successfully",
			data,
			meta,
		});
	},
);

const getAllSchedules = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await RiderScheduleServices.getAllSchedules(req.query);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "All schedules retrieved successfully",
			data,
			meta,
		});
	},
);

const getTodaysSchedules = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const { data, meta } = await RiderScheduleServices.getTodaysSchedules(req.query);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Today's schedules retrieved successfully",
			data,
			meta,
		});
	},
);

const getScheduleById = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await RiderScheduleServices.getScheduleById(
			req.params.scheduleId as string,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Schedule retrieved successfully",
			data: result,
		});
	},
);

const updateSchedule = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await RiderScheduleServices.updateSchedule(
			req.params.scheduleId as string,
			req.body,
			req.user!,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Schedule updated successfully",
			data: result,
		});
	},
);

const publishSchedule = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await RiderScheduleServices.publishSchedule(
			req.params.scheduleId as string,
			req.user!,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Schedule published successfully",
			data: result,
		});
	},
);

const deleteSchedule = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const result = await RiderScheduleServices.deleteSchedule(
			req.params.scheduleId as string,
			req.user!,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Schedule deleted successfully",
			data: result,
		});
	},
);

export const RiderScheduleControllers = {
	createSchedule,
	getMySchedules,
	getAllSchedules,
	getTodaysSchedules,
	getScheduleById,
	updateSchedule,
	publishSchedule,
	deleteSchedule,
};
