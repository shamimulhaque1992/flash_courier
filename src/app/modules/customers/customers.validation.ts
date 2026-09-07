import z from "zod";
import { Division } from "../../../generated/prisma/enums";

const UpdateCustomerProfileZodSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  contactNumber: z.string().min(10).max(15).optional(),
  thana: z.string().min(2).max(100).optional(),
  district: z.string().min(2).max(100).optional(),
  division: z.nativeEnum(Division).optional(),
  address: z.string().min(2).max(255).optional(),
});

export const CustomerValidations = { UpdateCustomerProfileZodSchema };
