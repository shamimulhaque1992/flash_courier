import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RiderScheduleControllers } from "./riders-schedules.controller";
import {
	CreateRiderScheduleZodSchema,
	UpdateRiderScheduleZodSchema,
} from "./riders-schedules.validation";

const router = Router();

router.post(
	"/create-schedule",
	auth(Role.RIDER),
	validateRequest(CreateRiderScheduleZodSchema),
	RiderScheduleControllers.createSchedule,
);

router.get(
	"/my-schedules",
	auth(Role.RIDER),
	RiderScheduleControllers.getMySchedules,
);

router.get(
	"/all-schedules",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	RiderScheduleControllers.getAllSchedules,
);

router.get("/todays-schedule", RiderScheduleControllers.getTodaysSchedules);

router.patch(
	"/update-schedule/:scheduleId",
	auth(Role.RIDER),
	validateRequest(UpdateRiderScheduleZodSchema),
	RiderScheduleControllers.updateSchedule,
);

router.patch(
	"/publish-schedule/:scheduleId",
	auth(Role.RIDER),
	RiderScheduleControllers.publishSchedule,
);

router.get(
	"/:scheduleId/slots",
	auth(Role.RIDER, Role.ADMIN, Role.SUPER_ADMIN),
	RiderScheduleControllers.getScheduleSlots,
);

router.get(
	"/:scheduleId",
	auth(Role.RIDER, Role.ADMIN, Role.SUPER_ADMIN),
	RiderScheduleControllers.getScheduleById,
);

router.delete(
	"/:scheduleId",
	auth(Role.RIDER),
	RiderScheduleControllers.deleteSchedule,
);

export const RiderScheduleRoutes = router;
