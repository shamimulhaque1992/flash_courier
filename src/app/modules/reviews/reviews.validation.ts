import z from "zod";

const rating = z.number().int().min(1).max(5);

const CreateReviewZodSchema = z.object({
	body: z.object({
		shipmentId: z.string().uuid(),
		merchantRating: rating,
		riderRating: rating,
		comment: z.string().max(500).optional(),
	}),
});

const UpdateReviewZodSchema = z.object({
	body: z.object({
		merchantRating: rating.optional(),
		riderRating: rating.optional(),
		comment: z.string().max(500).optional(),
	}),
});

export const ReviewValidations = {
	CreateReviewZodSchema,
	UpdateReviewZodSchema,
};
