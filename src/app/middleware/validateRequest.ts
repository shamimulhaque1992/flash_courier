import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type z from "zod";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (zodSchema: z.ZodObject) => {
	return catchAsync((req: Request, res: Response, next: NextFunction) => {
		const payload = req.body ?? {};

		const result = zodSchema.safeParse(payload);
		if (!result.success) {
			console.log(result.error);
			console.log(result.error.issues);
			throw new AppError(
				httpStatus.UNPROCESSABLE_ENTITY,
				result.error.issues[0]?.message || "Validation error",
			);
		}
		req.body = result.data;
		next();
	});
};
