import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import httpStatus from "http-status";
import {
  IApplyAsRiderPayload,
  IApproveRiderApplicationPayload,
  IVerifyRiderEmailPayload,
} from "./riders.interface";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { cloudinary } from "../../lib/cloudinary";
import config from "../../config";
import {
  RiderVerificationStatus,
  Role,
  UserStatus,
} from "../../../generated/prisma/enums";
import { redisClient } from "../../lib/redis";
import { sendEmail } from "../../utils/sendEmail";
import { RequestUser } from "../../middleware/checkAuth";
import { IQuery } from "../../interfaces";
import { RidersWhereInput } from "../../../generated/prisma/models";

const applyAsRider = async (
  payload: IApplyAsRiderPayload,
  nidDocument: Express.Multer.File | null,
  additionalDocuments: Express.Multer.File[],
) => {
  const isUserExists = await prisma.users.findUnique({
    where: { email: payload.user.email },
  });

  if (isUserExists)
    throw new AppError(
      httpStatus.CONFLICT,
      "User already exists with this email!",
    );

  const nidDocumentLink = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "auto" }, (error, result) => {
          if (error) reject(error);
          if (!result)
            return reject(
              new AppError(
                httpStatus.INTERNAL_SERVER_ERROR,
                "Cloudinary upload returned no result",
              ),
            );
          resolve(result);
        })
        .end(nidDocument?.buffer);
    },
  );

  const additionalDocumentsUploadResult = await Promise.all(
    additionalDocuments?.map(
      (file) =>
        new Promise<UploadApiResponse>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ resource_type: "auto" }, (error, result) => {
              if (error) reject(error);
              if (!result)
                return reject(
                  new AppError(
                    httpStatus.INTERNAL_SERVER_ERROR,
                    "Cloudinary upload returned no result",
                  ),
                );
              resolve(result);
            })
            .end(file.buffer);
        }),
    ),
  );

  const hashedPassword = await bcrypt.hash(
    payload.user.password,
    Number(config.bcrypt_salt_rounds),
  );

  const riderApplicationResponse = await prisma.users.create({
    data: {
      ...payload.user,
      password: hashedPassword,
      role: Role.RIDER,
      emailVerified: false,
      needPasswordChange: true,
      riders: {
        create: {
          name: payload.user.name,
          email: payload.user.email,
          ...payload.rider,
          nidDocument: nidDocumentLink.secure_url,
          nidDocumentPublicId: nidDocumentLink.public_id,
          additionalDocuments: additionalDocumentsUploadResult.map((file) => ({
            url: file.secure_url,
            publicId: file.public_id,
          })),
        },
      },
    },
    include: { riders: true },
  });

  const expirationSeconds = 60 * 60;
  const otpKey = `rider-application-otp-${payload.user.email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKey, otpValue, {
    expiration: { type: "EX", value: expirationSeconds },
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

  return riderApplicationResponse;
};

const verifyRiderEmail = async (payload: IVerifyRiderEmailPayload) => {
  const { otp } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExits = await prisma.users.findUnique({ where: { email } });

  if (isUserExits?.status === UserStatus.BLOCKED)
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");

  if (isUserExits?.emailVerified)
    throw new AppError(httpStatus.CONFLICT, "User is already verified");

  const otpKey = `rider-application-otp-${email}`;
  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp)
    throw new AppError(httpStatus.BAD_REQUEST, "OTP has expired or is invalid");

  if (redisOtp !== otp)
    throw new AppError(httpStatus.BAD_REQUEST, "OTP did not match");

  const verifiedUser = await prisma.users.update({
    where: { id: isUserExits?.id },
    data: { emailVerified: true },
    omit: { password: true },
    include: { riders: true },
  });

  const templateData = {
    name: verifiedUser.name,
    email: verifiedUser.email,
  };
  await sendEmail("email-verified-success.ejs", templateData, {
    from: config.email_sender,
    to: verifiedUser.email,
    subject: "Your email has been verified",
  });

  return verifiedUser;
};

const approveRiderApplication = async (
  payload: IApproveRiderApplicationPayload,
  reviewer: RequestUser,
) => {
  const { riderId, verificationStatus, rejectionReason } = payload;

  const existingRider = await prisma.riders.findUnique({
    where: { id: riderId },
    include: { user: true },
  });

  if (!existingRider)
    throw new AppError(httpStatus.NOT_FOUND, "Rider Application Not Found");

  if (existingRider.isDeleted)
    throw new AppError(httpStatus.GONE, "Rider Application Has Been Deleted");

  if (!existingRider.user.emailVerified)
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Rider Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
    );

  if (existingRider.verificationStatus !== RiderVerificationStatus.PENDING)
    throw new AppError(
      httpStatus.CONFLICT,
      `Rider Application Has Already Been ${existingRider.verificationStatus.toLowerCase()}`,
    );

  if (
    verificationStatus === RiderVerificationStatus.REJECTED &&
    !rejectionReason
  )
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Rejection Reason Is Required When Rejecting A Rider Application",
    );

  const updatedRider = await prisma.riders.update({
    where: { id: riderId },
    data: {
      verificationStatus,
      rejectionReason:
        verificationStatus === RiderVerificationStatus.REJECTED
          ? rejectionReason
          : null,
      reviewedBy: reviewer.userId,
      reviewedAt: new Date(),
    },
    include: { user: true },
  });

  const isVerified = verificationStatus === RiderVerificationStatus.VERIFIED;

  await sendEmail(
    isVerified
      ? "rider-application-approved.ejs"
      : "rider-application-rejected.ejs",
    {
      name: updatedRider.user.name,
      email: updatedRider.user.email,
      ...(!isVerified ? { rejectionReason } : {}),
    },
    {
      from: config.email_sender,
      to: updatedRider.user.email,
      subject: `Your Rider Application Has Been ${isVerified ? "Approved" : "Rejected"}`,
    },
  );

  return updatedRider;
};

const getAllRiders = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const andConditions: RidersWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { email: { contains: query.searchTerm, mode: "insensitive" } },
        { vehicleType: { contains: query.searchTerm, mode: "insensitive" } },
        { thana: { contains: query.searchTerm, mode: "insensitive" } },
        { district: { contains: query.searchTerm, mode: "insensitive" } },
        { division: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.email)
    andConditions.push({
      email: { contains: query.email, mode: "insensitive" },
    });

  if (query.thana)
    andConditions.push({ thana: { equals: query.thana, mode: "insensitive" } });

  if (query.district)
    andConditions.push({
      district: { equals: query.district, mode: "insensitive" },
    });

  if (query.division)
    andConditions.push({
      division: { equals: query.division, mode: "insensitive" },
    });

  if (query.verificationStatus)
    andConditions.push({
      verificationStatus: query.verificationStatus as RiderVerificationStatus,
    });

  andConditions.push({ isDeleted: false });

  const whereClause =
    andConditions.length > 0 ? { AND: andConditions } : undefined;

  const [allRiders, totalRiders] = await Promise.all([
    prisma.riders.findMany({
      where: whereClause,
      take: limit,
      skip,
      orderBy: { [sortBy]: sortOrder },
      include: { user: { omit: { password: true } } },
    }),
    prisma.riders.count({ where: whereClause }),
  ]);

  return {
    data: allRiders,
    meta: {
      page,
      limit,
      total: totalRiders,
      totalPages: Math.ceil(totalRiders / limit),
    },
  };
};

export const RiderServices = {
  applyAsRider,
  verifyRiderEmail,
  approveRiderApplication,
  getAllRiders,
};
