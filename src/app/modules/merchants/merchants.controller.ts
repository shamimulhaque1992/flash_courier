import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { MerchantServices } from "./merchants.services";
import { MerchantValidations } from "./merchants.validation";
import { AppError } from "../../utils/AppError";

const applyAsMerchant = catchAsync(async (req: Request, res: Response) => {
  // const payload = req.body;
  const businessLicenseDocument =
    (req.files as Record<string, Express.Multer.File[]>)
      ?.businessLicenseDocument?.[0] ?? null;
  const additionalDocuments =
    (req.files as Record<string, Express.Multer.File[]>)?.additionalDocuments ??
    [];

  const zodValidationRequest =
    MerchantValidations.MerchantRegistrationZodSchema.safeParse(
      JSON.parse(req.body.data),
    );
  const payload = zodValidationRequest.data;
  if (!payload) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid payload");
  }

  const result = await MerchantServices.applyAsMerchant(
    payload,
    businessLicenseDocument,
    additionalDocuments,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Merchant application submitted. Verification email sent.",
    data: result,
  });
});

const verifyMerchantEmail = catchAsync(async (req: Request, res: Response) => {
  const result = await MerchantServices.verifyMerchantEmail(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Email verified successfully",
    data: result,
  });
});

const approveMerchantApplication = catchAsync(
  async (req: Request, res: Response) => {
    const result = await MerchantServices.approveMerchantApplication(
      req.body,
      req.user!,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `Merchant application ${result.verificationStatus.toLowerCase()} successfully`,
      data: result,
    });
  },
);

const getAllMerchants = catchAsync(async (req: Request, res: Response) => {
  const result = await MerchantServices.getAllMerchants(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Merchants fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await MerchantServices.getMyProfile(req.user!);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile fetched successfully",
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await MerchantServices.updateMyProfile(req.body, req.user!);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

export const MerchantControllers = {
  applyAsMerchant,
  verifyMerchantEmail,
  approveMerchantApplication,
  getAllMerchants,
  getMyProfile,
  updateMyProfile,
};
