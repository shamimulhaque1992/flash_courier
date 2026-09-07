import z from "zod";
import { Division, RiderVerificationStatus } from "../../../generated/prisma/enums";

const RiderRegistrationZodSchema = z.object({
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
    role: z.enum(["RIDER"], { error: "Invalid role. Only 'RIDER' is allowed." }),
  }),
  rider: z.object({
    contactNumber: z
      .string()
      .min(10, "Contact number must be at least 10 characters long")
      .max(15, "Contact number must be at most 15 characters long"),
    nidNumber: z
      .string()
      .min(10, "NID number must be at least 10 characters long")
      .max(20, "NID number must be at most 20 characters long"),
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
    licenseNumber: z.string().optional(),
    vehicleType: z.string().min(2, "Vehicle type must be at least 2 characters long"),
    vehicleRegistrationNumber: z.string().optional(),
  }),
});

const RiderEmailVerificationZodSchema = z.object({
  email: z.email("Invalid email address"),
  otp: z.string().min(6, "OTP must be at least 6 characters long"),
});

const RiderApplicationApprovalZodSchema = z.object({
  riderId: z.string("Invalid rider ID"),
  verificationStatus: z.enum(RiderVerificationStatus, {
    error: "Invalid verification status",
  }),
  rejectionReason: z
    .string()
    .min(6, "Rejection reason must be at least 6 characters long")
    .optional(),
});

export const RiderValidations = {
  RiderRegistrationZodSchema,
  RiderEmailVerificationZodSchema,
  RiderApplicationApprovalZodSchema,
};
