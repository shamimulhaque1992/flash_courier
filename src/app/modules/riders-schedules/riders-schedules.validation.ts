import { z } from "zod";
import { DayOfWeek } from "../../../generated/prisma/enums";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timeSchema = z
	.string()
	.regex(timeRegex, "Time must be in HH:MM format (e.g. 10:00)");

export const CreateRiderScheduleZodSchema = z.object({
	dayOfWeek: z.enum(Object.values(DayOfWeek) as [string, ...string[]], {
		message: "Invalid day of week",
	}),
	startTime: timeSchema,
	endTime: timeSchema,
});

export const UpdateRiderScheduleZodSchema = z.object({
	startTime: timeSchema.optional(),
	endTime: timeSchema.optional(),
});
