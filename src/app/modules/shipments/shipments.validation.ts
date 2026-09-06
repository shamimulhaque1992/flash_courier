import z from "zod";

export const CreateShipmentZodSchema = z.object({
	receiverName: z.string().min(2).max(100).trim(),
	receiverEmail: z.email("Invalid receiver email"),
	receiverContactNumber: z.string().min(7).max(20).trim(),
	receiverThana: z.string().min(2).max(100).trim(),
	receiverDistrict: z.string().min(2).max(100).trim(),
	receiverDivision: z.string().min(2).max(100).trim(),
	receiverAddress: z.string().max(255).trim().optional(),
	packageDescription: z.string().max(500).trim().optional(),
	packageWeight: z.number().positive("Package weight must be greater than 0"),
	packageDimensions: z.string().max(100).trim().optional(),
	isFragile: z.boolean().optional().default(false),
	note: z.string().max(500).trim().optional(),
});

export const ShipmentValidations = {
	CreateShipmentZodSchema,
};
