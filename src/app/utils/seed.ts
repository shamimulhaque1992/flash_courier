import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "./AppError";

export const seedSupperAdmin = async () => {
	try {
		const isSupperAdminExists = await prisma.users.findFirst({
			where: {
				role: Role.SUPER_ADMIN,
			},
		});

		if (isSupperAdminExists) {
			console.log("Supper admin exists!!");
			return;
		}
		const name = config.super_admin_name;
		const email = config.super_admin_email;
		const password = config.super_admin_password;
		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Super admin credentials are not provided in the environment variables.",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const supperAdmin = await prisma.users.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.SUPER_ADMIN,
				emailVerified: true,
				needPasswordChange: false,
			},
		});

		console.log("Supper admin crated", supperAdmin);
	} catch (error) {
		await prisma.users.delete({
			where: {
				email: config.super_admin_email,
			},
		});
	}
};

export const seedTesterAdmin = async () => {
	try {
		const isTesterAdminExists = await prisma.users.findUnique({
			where: {
				email: config.tester_admin_email,
			},
		});

		if (isTesterAdminExists) {
			console.log("Tester admin exists!!");
			return;
		}
		const name = config.tester_admin_name;
		const email = config.tester_admin_email;
		const password = config.tester_admin_password;
		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester admin credentials are not provided in the environment variables.",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerAdmin = await prisma.users.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.ADMIN,
				emailVerified: true,
				needPasswordChange: false,
			},
		});

		console.log("Tester admin created", testerAdmin);
	} catch (error) {
		console.log("🚀 ~ seedTesterAdmin ~ error:", error);
		await prisma.users.delete({
			where: {
				email: config.tester_admin_email,
			},
		});
	}
};

export const seedTesterMerchant = async () => {
	try {
		const isTesterMerchantExists = await prisma.users.findFirst({
			where: {
				role: Role.MERCHANT,
			},
		});

		if (isTesterMerchantExists) {
			console.log("Tester merchant exists!!");
			return;
		}

		const name = config.tester_merchant_name;
		const email = config.tester_merchant_email;
		const password = config.tester_merchant_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester merchant credentials are not provided in the environment variables.",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerMerchant = await prisma.users.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.MERCHANT,
				emailVerified: true,
				needPasswordChange: false,
			},
		});

		console.log("Tester merchant created", testerMerchant);
	} catch (error) {
		await prisma.users.delete({
			where: {
				email: config.tester_merchant_email,
			},
		});
	}
};

export const seedTesterRider = async () => {
	try {
		const isTesterRiderExists = await prisma.users.findFirst({
			where: {
				role: Role.RIDER,
			},
		});

		if (isTesterRiderExists) {
			console.log("Tester rider exists!!");
			return;
		}

		const name = config.tester_rider_name;
		const email = config.tester_rider_email;
		const password = config.tester_rider_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester rider credentials are not provided in the environment variables.",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerRider = await prisma.users.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.RIDER,
				emailVerified: true,
				needPasswordChange: false,
			},
		});

		console.log("Tester rider created", testerRider);
	} catch (error) {
		await prisma.users.delete({
			where: {
				email: config.tester_rider_email,
			},
		});
	}
};

export const seedTesterCustomer = async () => {
	try {
		const isTesterCustomerExists = await prisma.users.findFirst({
			where: {
				role: Role.CUSTOMER,
			},
		});

		if (isTesterCustomerExists) {
			console.log("Tester customer exists!!");
			return;
		}

		const name = config.tester_customer_name;
		const email = config.tester_customer_email;
		const password = config.tester_customer_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Tester customer credentials are not provided in the environment variables.",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const testerCustomer = await prisma.users.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.CUSTOMER,
				emailVerified: true,
				needPasswordChange: false,
			},
		});

		console.log("Tester customer created", testerCustomer);
	} catch (error) {
		await prisma.users.delete({
			where: {
				email: config.tester_customer_email,
			},
		});
	}
};
