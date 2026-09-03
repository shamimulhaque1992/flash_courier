import { RiderScheduleStatus } from "../../../generated/prisma";

export interface IRiderSchedule {
    id: string;
    startDateTime: Date;
    endDateTime: Date;
    totalSlots: number;
    availableSlots: number;
    status: RiderScheduleStatus;
    riderId: string;
}
