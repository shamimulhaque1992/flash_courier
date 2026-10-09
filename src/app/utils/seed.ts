import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import {
  Division,
  RiderVerificationStatus,
  Role,
} from "../../generated/prisma/enums";
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
    const name = config.tester_rider_name;
    const email = config.tester_rider_email;
    const password = config.tester_rider_password;

    if (!name || !email || !password) {
      throw new AppError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Tester rider credentials are not provided in the environment variables.",
      );
    }

    const existingUser = await prisma.users.findUnique({
      where: { email },
      include: { riders: true },
    });

    if (existingUser && existingUser.role !== Role.RIDER) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Tester rider email belongs to a non-rider account.",
      );
    }

    if (existingUser?.riders) {
      console.log("Tester rider exists!!");
      return;
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    const createRiderProfile = (userId: string) => {
      const uniqueId = BigInt(`0x${userId.replaceAll("-", "")}`)
        .toString()
        .padStart(32, "0");
      return {
        name,
        email,
        contactNumber: `017${uniqueId.slice(-8)}`,
        nidNumber: uniqueId.slice(-10),
        nidDocument: "https://placehold.co/600x400?text=Test+Document",
        nidDocumentPublicId: `tester-rider-${uniqueId}`,
        additionalDocuments: [],
        thana: "Dhaka",
        district: "Dhaka",
        division: Division.DHAKA,
        vehicleType: "Motorcycle",
        verificationStatus: RiderVerificationStatus.VERIFIED,
      };
    };

    if (existingUser) {
      await prisma.riders.create({
        data: {
          ...createRiderProfile(existingUser.id),
          userId: existingUser.id,
        },
      });
      console.log("Tester rider profile created");
      return;
    }

    const testerRider = await prisma.$transaction(async (transaction) => {
      const user = await transaction.users.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: Role.RIDER,
          emailVerified: true,
          needPasswordChange: false,
        },
      });

      await transaction.riders.create({
        data: {
          ...createRiderProfile(user.id),
          userId: user.id,
        },
      });

      return user;
    });

    console.log("Tester rider created", testerRider);
  } catch (error) {
    console.error("Failed to seed tester rider:", error);
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
