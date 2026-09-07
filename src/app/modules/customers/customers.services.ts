import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";

const getMyProfile = async (user: RequestUser) => {
	const customer = await prisma.customers.findUnique({
		where: { userId: user.userId },
		include: { user: { omit: { password: true } } },
	});
	if (!customer)
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");
	return customer;
};

const updateMyProfile = async (
	payload: {
		name?: string;
		contactNumber?: string;
		thana?: string;
		district?: string;
		address?: string;
	},
	user: RequestUser,
) => {
	const customer = await prisma.customers.findUnique({
		where: { userId: user.userId },
	});
	if (!customer)
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found");

	const { name, ...customerFields } = payload;

	const updated = await prisma.customers.update({
		where: { userId: user.userId },
		data: {
			...customerFields,
			...(name ? { name } : {}),
			...(name ? { user: { update: { name } } } : {}),
		},
		include: { user: { omit: { password: true } } },
	});
	return updated;
};

export const CustomerServices = { getMyProfile, updateMyProfile };
