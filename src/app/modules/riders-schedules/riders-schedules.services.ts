import {
  addMinutes,
  differenceInMinutes,
  getDay,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from "date-fns";
import httpStatus from "http-status";
import {
  DayOfWeek,
  RiderScheduleStatus,
  ShipmentStatus,
} from "../../../generated/prisma/enums";
import type { RiderSchedulesWhereInput } from "../../../generated/prisma/models";
import type { IQuery } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type {
  ICreateRiderSchedulePayload,
  IUpdateRiderSchedulePayload,
} from "./riders-schedules.interface";

const SLOT_DURATION_MINUTES = 40;
const MAX_SCHEDULE_HOURS = 12;

// Maps JS getDay() (0=Sun) to DayOfWeek enum
const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

const ENUM_TO_JS_DAY: Record<DayOfWeek, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  [DayOfWeek.SUNDAY]: 0,
  [DayOfWeek.MONDAY]: 1,
  [DayOfWeek.TUESDAY]: 2,
  [DayOfWeek.WEDNESDAY]: 3,
  [DayOfWeek.THURSDAY]: 4,
  [DayOfWeek.FRIDAY]: 5,
  [DayOfWeek.SATURDAY]: 6,
};

const getRiderOrThrow = async (userId: string) => {
  const rider = await prisma.riders.findUnique({ where: { userId } });
  if (!rider || rider.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");
  return rider;
};

// Parse "HH:MM" and apply to a given date, returns a Date
const applyTimeToDate = (date: Date, time: string): Date => {
  const [hours, minutes] = time.split(":").map(Number);
  return setSeconds(setMinutes(setHours(startOfDay(date), hours), minutes), 0);
};

export const getScheduleEndTime = (endTime: string, onDate: Date): Date =>
  applyTimeToDate(onDate, endTime);

const calculateTotalSlots = (startTime: string, endTime: string): number => {
  const base = new Date(2000, 0, 1); // fixed reference date for time math
  const start = applyTimeToDate(base, startTime);
  const end = applyTimeToDate(base, endTime);
  const durationMinutes = differenceInMinutes(end, start);
  return Math.floor(durationMinutes / SLOT_DURATION_MINUTES);
};

const validateTimeRange = (startTime: string, endTime: string) => {
  const base = new Date(2000, 0, 1);
  const start = applyTimeToDate(base, startTime);
  const end = applyTimeToDate(base, endTime);

  if (differenceInMinutes(end, start) <= 0)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Start time must be before end time",
    );

  const durationHours = differenceInMinutes(end, start) / 60;
  if (durationHours > MAX_SCHEDULE_HOURS)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Schedule duration cannot exceed ${MAX_SCHEDULE_HOURS} hours`,
    );

  const totalSlots = calculateTotalSlots(startTime, endTime);
  if (totalSlots < 1)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Schedule must be at least ${SLOT_DURATION_MINUTES} minutes long to have one slot`,
    );
};

export const getNextOccurrenceOfDay = (dayOfWeek: DayOfWeek): Date => {
  const today = startOfDay(new Date());
  const todayJsDay = getDay(today);
  const targetJsDay = ENUM_TO_JS_DAY[dayOfWeek];

  if (todayJsDay === targetJsDay) return today;
  // Advance day by day until we hit the target
  let candidate = today;
  while (getDay(candidate) !== targetJsDay) {
    candidate = addMinutes(candidate, 24 * 60);
  }
  return startOfDay(candidate);
};

// Given a schedule and the actual assignment date, compute the probableDeliveryTime
// for the Nth slot (0-indexed). slotIndex = totalSlots - availableSlots (next to assign)
export const computeProbableDeliveryTime = (
  startTime: string,
  slotIndex: number,
  onDate: Date,
): Date => {
  const slotStart = applyTimeToDate(onDate, startTime);
  const assignedSlotStart = addMinutes(
    slotStart,
    slotIndex * SLOT_DURATION_MINUTES,
  );
  return addMinutes(assignedSlotStart, SLOT_DURATION_MINUTES);
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

const createSchedule = async (
  payload: ICreateRiderSchedulePayload,
  user: RequestUser,
) => {
  const rider = await getRiderOrThrow(user.userId);

  validateTimeRange(payload.startTime, payload.endTime);

  const existing = await prisma.riderSchedules.findFirst({
    where: {
      riderId: rider.id,
      dayOfWeek: payload.dayOfWeek,
      isDeleted: false,
    },
  });
  if (existing)
    throw new AppError(
      httpStatus.CONFLICT,
      `You already have a schedule for ${payload.dayOfWeek}`,
    );

  const totalSlots = calculateTotalSlots(payload.startTime, payload.endTime);

  return prisma.riderSchedules.create({
    data: {
      riderId: rider.id,
      dayOfWeek: payload.dayOfWeek,
      startTime: payload.startTime,
      endTime: payload.endTime,
      totalSlots,
      availableSlots: totalSlots,
    },
    include: { rider: { select: { name: true, email: true } } },
  });
};

const getMySchedules = async (query: IQuery, user: RequestUser) => {
  const rider = await getRiderOrThrow(user.userId);

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const andConditions: RiderSchedulesWhereInput[] = [
    { riderId: rider.id },
    { isDeleted: false },
  ];
  if (query.status) andConditions.push({ status: query.status });
  if (query.dayOfWeek) andConditions.push({ dayOfWeek: query.dayOfWeek });

  const [data, total] = await Promise.all([
    prisma.riderSchedules.findMany({
      where: { AND: andConditions },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip,
      include: {
        rider: { select: { name: true, email: true, division: true } },
      },
    }),
    prisma.riderSchedules.count({ where: { AND: andConditions } }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getAllSchedules = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const andConditions: RiderSchedulesWhereInput[] = [{ isDeleted: false }];

  if (query.status) andConditions.push({ status: query.status });
  if (query.riderId) andConditions.push({ riderId: query.riderId });
  if (query.dayOfWeek) andConditions.push({ dayOfWeek: query.dayOfWeek });
  if (query.searchTerm)
    andConditions.push({
      rider: {
        OR: [
          { name: { contains: query.searchTerm, mode: "insensitive" } },
          { email: { contains: query.searchTerm, mode: "insensitive" } },
        ],
      },
    });

  const [data, total] = await Promise.all([
    prisma.riderSchedules.findMany({
      where: { AND: andConditions },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip,
      include: {
        rider: {
          select: {
            name: true,
            email: true,
            division: true,
            district: true,
            vehicleType: true,
          },
        },
      },
    }),
    prisma.riderSchedules.count({ where: { AND: andConditions } }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getTodaysSchedules = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const todayEnum = JS_DAY_TO_ENUM[getDay(new Date())];

  const andConditions: RiderSchedulesWhereInput[] = [
    { isDeleted: false },
    { status: RiderScheduleStatus.PUBLISHED },
    { dayOfWeek: todayEnum },
  ];
  if (query.riderId) andConditions.push({ riderId: query.riderId });

  const [data, total] = await Promise.all([
    prisma.riderSchedules.findMany({
      where: { AND: andConditions },
      orderBy: { startTime: "asc" },
      take: limit,
      skip,
      include: {
        rider: {
          select: {
            name: true,
            email: true,
            division: true,
            district: true,
            vehicleType: true,
          },
        },
      },
    }),
    prisma.riderSchedules.count({ where: { AND: andConditions } }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getScheduleById = async (scheduleId: string) => {
  const schedule = await prisma.riderSchedules.findUnique({
    where: { id: scheduleId },
    include: {
      rider: {
        select: {
          name: true,
          email: true,
          division: true,
          district: true,
          vehicleType: true,
        },
      },
    },
  });

  if (!schedule || schedule.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");

  return schedule;
};

const updateSchedule = async (
  scheduleId: string,
  payload: IUpdateRiderSchedulePayload,
  user: RequestUser,
) => {
  const rider = await getRiderOrThrow(user.userId);

  const schedule = await prisma.riderSchedules.findUnique({
    where: { id: scheduleId, riderId: rider.id },
  });

  if (!schedule || schedule.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");

  if (
    schedule.status === RiderScheduleStatus.PUBLISHED &&
    schedule.totalSlots !== schedule.availableSlots
  )
    throw new AppError(
      httpStatus.METHOD_NOT_ALLOWED,
      "Cannot edit a schedule that already has assigned shipments",
    );

  if (schedule.status === RiderScheduleStatus.COMPLETED)
    throw new AppError(
      httpStatus.METHOD_NOT_ALLOWED,
      "Cannot edit a completed schedule",
    );

  if (schedule.status === RiderScheduleStatus.CANCELLED)
    throw new AppError(
      httpStatus.METHOD_NOT_ALLOWED,
      "Cannot edit a cancelled schedule",
    );

  const startTime = payload.startTime ?? schedule.startTime;
  const endTime = payload.endTime ?? schedule.endTime;

  validateTimeRange(startTime, endTime);

  const totalSlots = calculateTotalSlots(startTime, endTime);

  return prisma.riderSchedules.update({
    where: { id: scheduleId },
    data: { startTime, endTime, totalSlots, availableSlots: totalSlots },
    include: { rider: { select: { name: true, email: true } } },
  });
};

const publishSchedule = async (scheduleId: string, user: RequestUser) => {
  const rider = await getRiderOrThrow(user.userId);

  const schedule = await prisma.riderSchedules.findUnique({
    where: { id: scheduleId, riderId: rider.id },
  });

  if (!schedule || schedule.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");

  if (schedule.status === RiderScheduleStatus.PUBLISHED)
    throw new AppError(httpStatus.BAD_REQUEST, "Schedule is already published");

  if (schedule.status === RiderScheduleStatus.COMPLETED)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot publish a completed schedule",
    );

  if (schedule.status === RiderScheduleStatus.CANCELLED)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot publish a cancelled schedule",
    );

  return prisma.riderSchedules.update({
    where: { id: scheduleId },
    data: { status: RiderScheduleStatus.PUBLISHED },
  });
};

const getScheduleSlots = async (scheduleId: string, user: RequestUser) => {
  const schedule = await prisma.riderSchedules.findUnique({
    where: { id: scheduleId },
    include: {
      rider: {
        select: { name: true, email: true, contactNumber: true, userId: true },
      },
      shipments: {
        where: {
          shipmentStatus: {
            notIn: [
              ShipmentStatus.CANCELLED_BY_MERCHANT,
              ShipmentStatus.REJECTED_BY_RIDER,
            ],
          },
        },
        orderBy: { probableDeliveryTime: "asc" },
        select: {
          id: true,
          trackingNumber: true,
          receiverName: true,
          receiverDistrict: true,
          receiverDivision: true,
          shipmentStatus: true,
          probableDeliveryTime: true,
        },
      },
    },
  });

  if (!schedule || schedule.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");

  // Only admin or the owner rider can view slots
  if (user.role === "RIDER" && schedule.rider.userId !== user.userId)
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to view this schedule's slots",
    );

  const assignmentDate = getNextOccurrenceOfDay(schedule.dayOfWeek);

  const slots = Array.from({ length: schedule.totalSlots }, (_, slotIndex) => {
    const probableDeliveryTime = computeProbableDeliveryTime(
      schedule.startTime,
      slotIndex,
      assignmentDate,
    );
    const shipment = schedule.shipments[slotIndex] ?? null;
    return {
      slotIndex,
      probableDeliveryTime,
      shipment,
    };
  });

  return {
    scheduleId: schedule.id,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    status: schedule.status,
    totalSlots: schedule.totalSlots,
    availableSlots: schedule.availableSlots,
    rider: schedule.rider,
    slots,
  };
};

const deleteSchedule = async (scheduleId: string, user: RequestUser) => {
  const rider = await getRiderOrThrow(user.userId);

  const schedule = await prisma.riderSchedules.findUnique({
    where: { id: scheduleId, riderId: rider.id },
  });

  if (!schedule || schedule.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");

  if (schedule.status === RiderScheduleStatus.COMPLETED)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete a completed schedule",
    );

  if (
    schedule.status === RiderScheduleStatus.PUBLISHED &&
    schedule.totalSlots !== schedule.availableSlots
  )
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot delete a schedule that has already been assigned shipments",
    );

  return prisma.riderSchedules.update({
    where: { id: scheduleId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
};

export const RiderScheduleServices = {
  createSchedule,
  getMySchedules,
  getAllSchedules,
  getTodaysSchedules,
  getScheduleById,
  getScheduleSlots,
  updateSchedule,
  publishSchedule,
  deleteSchedule,
};
