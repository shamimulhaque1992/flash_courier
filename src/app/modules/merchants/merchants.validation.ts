import z from "zod";
import { Division, MerchantVerificationStatus } from "../../../generated/prisma/enums";

const MerchantRegistrationZodSchema = z.object({
  user: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name must be at most 100 characters long"),
    email: z.email("Invalid email address"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters long")
      .max(100, "Password must be at most 100 characters long"),
    role: z.enum(["MERCHANT"], {
      error: "Invalid role. Only 'MERCHANT' is allowed.",
    }),
  }),
  merchant: z.object({
    contactNumber: z
      .string()
      .min(10, "Contact number must be at least 10 characters long")
      .max(15, "Contact number must be at most 15 characters long"),
    thana: z
      .string()
      .min(2, "Thana must be at least 2 characters long")
      .max(100, "Thana must be at most 100 characters long"),
    district: z
      .string()
      .min(2, "District must be at least 2 characters long")
      .max(100, "District must be at most 100 characters long"),
    division: z.nativeEnum(Division),
    address: z
      .string()
      .min(2, "Address must be at least 2 characters long")
      .max(255, "Address must be at most 255 characters long"),
    tradeLicenseNumber: z
      .string()
      .min(2, "Trade license number must be at least 2 characters long")
      .max(100, "Trade license number must be at most 100 characters long"),
    businessLicenseNumber: z
      .string()
      .min(2, "Business license number must be at least 2 characters long")
      .max(100, "Business license number must be at most 100 characters long"),
    businessType: z
      .string()
      .min(2, "Business type must be at least 2 characters long")
      .max(100, "Business type must be at most 100 characters long"),
    businessDescription: z
      .string()
      .min(2, "Business description must be at least 2 characters long")
      .max(255, "Business description must be at most 255 characters long"),
  }),
});

export const MerchantEmailVerificationZodSchema = z.object({
  email: z.email("Invalid email address"),
  otp: z.string().min(6, "OTP must be at least 6 characters long"),
});
export const MerchantApplicationApprovalZodSchema = z.object({
  merchantId: z.string("Invalid merchant ID"),
  verificationStatus: z.enum(MerchantVerificationStatus, {
    error: "Invalid verification status",
  }),
  rejectionReason: z
    .string()
    .min(6, "Rejection reason must be at least 6 characters long")
    .optional(),
});

export const MerchantValidations = {
  MerchantRegistrationZodSchema,
  MerchantEmailVerificationZodSchema,
  MerchantApplicationApprovalZodSchema,
};
