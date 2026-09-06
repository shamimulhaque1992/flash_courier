import type { DayOfWeek } from "../../../generated/prisma/enums";

export interface ICreateRiderSchedulePayload {
	dayOfWeek: DayOfWeek;
	startTime: string; // "HH:MM" e.g. "10:00"
	endTime: string;   // "HH:MM" e.g. "19:00"
}

export interface IUpdateRiderSchedulePayload {
	startTime?: string;
	endTime?: string;
}
