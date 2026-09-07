import z from "zod";

const rating = z.number().int().min(1).max(5);

const CreateReviewZodSchema = z.object({
  shipmentId: z.string(),
  merchantRating: rating,
  riderRating: rating,
  comment: z.string().max(500).optional(),
});

const UpdateReviewZodSchema = z.object({
  merchantRating: rating.optional(),
  riderRating: rating.optional(),
  comment: z.string().max(500).optional(),
});

export const ReviewValidations = {
  CreateReviewZodSchema,
  UpdateReviewZodSchema,
};
