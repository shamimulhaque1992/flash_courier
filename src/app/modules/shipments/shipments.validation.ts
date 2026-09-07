import z from "zod";
import { Division } from "../../../generated/prisma/enums";

const divisionEnum = z.nativeEnum(Division);

export const CreateShipmentZodSchema = z.object({
	receiverName: z.string().min(2).max(100).trim(),
	receiverEmail: z.email("Invalid receiver email"),
	receiverContactNumber: z.string().min(7).max(20).trim(),
	receiverThana: z.string().min(2).max(100).trim(),
	receiverDistrict: z.string().min(2).max(100).trim(),
	receiverDivision: divisionEnum,
	receiverAddress: z.string().max(255).trim().optional(),
	packageDescription: z.string().max(500).trim().optional(),
	packageWeight: z.number().positive("Package weight must be greater than 0"),
	packageDimensions: z.string().max(100).trim().optional(),
	isFragile: z.boolean().optional().default(false),
	note: z.string().max(500).trim().optional(),
});

export const CalculateDeliveryPriceZodSchema = z.object({
	senderDivision: divisionEnum,
	receiverDivision: divisionEnum,
	packageWeight: z.number().positive("Package weight must be greater than 0"),
	isFragile: z.boolean().optional().default(false),
});

export const TrackShipmentZodSchema = z.object({
	trackingNumber: z.string().trim().min(1),
});

export const ShipmentValidations = {
	CreateShipmentZodSchema,
	CalculateDeliveryPriceZodSchema,
	TrackShipmentZodSchema,
};
