import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import httpStatus from "http-status";
import {
  IApplyAsMerchantPayload,
  IApproveMerchantApplicationPayload,
  IVerifyMerchantEmailPayload,
} from "./merchants.interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { cloudinary } from "../../lib/cloudinary";
import config from "../../config";
import {
  MerchantVerificationStatus,
  Role,
  UserStatus,
} from "../../../generated/prisma/enums";
import { redisClient } from "../../lib/redis";
import { sendEmail } from "../../utils/sendEmail";
import { RequestUser } from "../../middleware/checkAuth";
import { IQuery } from "../../interfaces";
import { MerchantsWhereInput } from "../../../generated/prisma/models";

const applyAsMerchant = async (
  payload: IApplyAsMerchantPayload,
  businessLicenseDocument: Express.Multer.File | null,
  additionalDocuments: Express.Multer.File[],
) => {
  console.log("🚀 ~ applyAsMerchant ~ payload:", payload);
  const isUserExists = await prisma.users.findUnique({
    where: {
      email: payload.user.email,
    },
  });

  if (isUserExists)
    throw new AppError(
      httpStatus.CONFLICT,
      "User already exists withe this email!",
    );

  const businessLicenseLink = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "auto" }, async (error, result) => {
          if (error) {
            console.error(`Cloudinary upload failed: ${error.message}`);
            reject(error);
          }
          if (!result) {
            return reject(
              new AppError(
                httpStatus.INTERNAL_SERVER_ERROR,
                "Cloudinary upload returned no result",
              ),
            );
          }
          resolve(result);
        })
        .end(businessLicenseDocument?.buffer);
    },
  );

  const additionalDocumentsUploadResult = await Promise.all(
    additionalDocuments?.map((file) => {
      return new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: "auto" }, (error, result) => {
            if (error) {
              reject(error);
            }

            if (!result) {
              return reject(
                new AppError(
                  httpStatus.INTERNAL_SERVER_ERROR,
                  "Cloudinary upload returned no result",
                ),
              );
            }
            resolve(result);
          })
          .end(file.buffer);
      });
    }),
  );

  const hashedPassword = await bcrypt.hash(
    payload.user.password,
    Number(config.bcrypt_salt_rounds),
  );

  const merchantApplicationResponse = await prisma.users.create({
    data: {
      ...payload.user,
      password: hashedPassword,
      role: Role.MERCHANT,
      emailVerified: false,
      needPasswordChange: true,
      merchants: {
        create: {
          name: payload.user.name,
          email: payload.user.email,
          ...payload.merchant,
          businessLicenseDocument: businessLicenseLink.secure_url,
          businessLicenseDocumentPublicId: businessLicenseLink.public_id,
          additionalDocuments: additionalDocumentsUploadResult.map((file) => ({
            url: file.secure_url,
            publicId: file.public_id,
          })),
        },
      },
    },
    include: {
      merchants: true,
    },
  });

  const expirationSeconds = 60 * 60;
  const otpKey = `merchant-application-otp-${payload.user.email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templateData = {
    name: payload.user.name,
    email: payload.user.email,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
  };
  await sendEmail("verify-email.ejs", templateData, {
    from: config.email_sender,
    to: payload.user.email,
    subject: "Verify your email address",
  });
  return merchantApplicationResponse;
};

const verifyMerchantEmail = async (payload: IVerifyMerchantEmailPayload) => {
  const { otp } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExits = await prisma.users.findUnique({
    where: { email },
  });

  if (isUserExits?.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }
  if (isUserExits?.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "User is already verified");
  }

  const otpKey = `merchant-application-otp-${email}`;
  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP has expired or is invalid");
  }

  if (redisOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP did not match");
  }

  const verifiedUser = await prisma.users.update({
    where: {
      id: isUserExits?.id,
    },
    data: {
      emailVerified: true,
    },
    omit: {
      password: true,
    },
    include: { merchants: true },
  });
  return verifiedUser;
};

const approveMerchantApplication = async (
  payload: IApproveMerchantApplicationPayload,
  reviewer: RequestUser,
) => {
  const { merchantId, verificationStatus, rejectionReason } = payload;
  const existingMerchant = await prisma.merchants.findUnique({
    where: {
      id: merchantId,
    },
    include: { user: true },
  });

  if (!existingMerchant) {
    throw new AppError(httpStatus.NOT_FOUND, "Merchant Application Not Found");
  }

  if (existingMerchant.isDeleted) {
    throw new AppError(httpStatus.GONE, "Doctor Application Has Been Deleted");
  }

  if (!existingMerchant.user.emailVerified) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Doctor Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
    );
  }

  if (
    existingMerchant.verificationStatus !== MerchantVerificationStatus.PENDING
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Merchant Application Has Already Been ${existingMerchant.verificationStatus.toLowerCase()}`,
    );
  }

  if (
    verificationStatus === MerchantVerificationStatus.REJECTED &&
    !rejectionReason
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Rejection Reason Is Required When Rejecting A Merchant Application",
    );
  }

  const updatedMerchant = await prisma.merchants.update({
    where: { id: merchantId },
    data: {
      verificationStatus,
      rejectionReason:
        verificationStatus === MerchantVerificationStatus.REJECTED
          ? rejectionReason
          : null,
      reviewedBy: reviewer.userId,
      reviewedAt: new Date(),
    },
    include: { user: true },
  });

  const isVerified = verificationStatus === MerchantVerificationStatus.VERIFIED;
  const template = isVerified
    ? "merchant-application-approved.ejs"
    : "merchant-application-rejected.ejs";

  const templateData = {
    name: updatedMerchant.user.name,
    email: updatedMerchant.user.email,
    ...(isVerified ? {} : { rejectionReason }),
  };

  await sendEmail(template, templateData, {
    from: config.email_sender,
    to: updatedMerchant.user.email,
    subject: `Your Merchant Application Has Been ${
      isVerified ? "Approved" : "Rejected"
    }`,
  });

  return updatedMerchant;
};

const getAllMerchants = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: MerchantsWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { email: { contains: query.searchTerm, mode: "insensitive" } },
        { businessType: { contains: query.searchTerm, mode: "insensitive" } },
        { thana: { contains: query.searchTerm, mode: "insensitive" } },
        { district: { contains: query.searchTerm, mode: "insensitive" } },
        { division: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  //filtering
  if (query.specialization) {
    andConditions.push({
      businessType: { equals: query.specialization, mode: "insensitive" },
    });
  }

  if (query.email) {
    andConditions.push({
      email: { contains: query.email, mode: "insensitive" },
    });
  }

  if (query.tradeLicenseNumber) {
    andConditions.push({
      tradeLicenseNumber: {
        equals: query.tradeLicenseNumber,
        mode: "insensitive",
      },
    });
  }
  if (query.thana) {
    andConditions.push({
      thana: { equals: query.thana, mode: "insensitive" },
    });
  }
  if (query.district) {
    andConditions.push({
      district: { equals: query.district, mode: "insensitive" },
    });
  }
  if (query.division) {
    andConditions.push({
      division: { equals: query.division, mode: "insensitive" },
    });
  }

  if (query.verificationStatus) {
    andConditions.push({
      verificationStatus:
        query.verificationStatus as MerchantVerificationStatus,
    });
  }

  andConditions.push({ isDeleted: false });

  const allMerchants = await prisma.merchants.findMany({
    where: { AND: andConditions.length > 0 ? andConditions : undefined },

    take: limit,
    skip: skip,
    orderBy: {
      [sortBy]: sortOrder,
    },

    include: {
      user: {
        omit: {
          password: true,
        },
      },
    },
  });

  const totalMerchants = await prisma.merchants.count({
    where: { AND: andConditions.length > 0 ? andConditions : undefined },
  });
  return {
    data: allMerchants,
    meta: {
      page: page,
      limit: limit,
      total: totalMerchants,
      totalPages: Math.ceil(totalMerchants / limit),
    },
  };
};

export const MerchantServices = {
  applyAsMerchant,
  verifyMerchantEmail,
  approveMerchantApplication,
  getAllMerchants,
};
