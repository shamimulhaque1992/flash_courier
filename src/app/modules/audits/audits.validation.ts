import { z } from "zod";

export const CreateAuditZodSchema = z.object({
	merchantId: z.string(),
	startDate: z.string(),
	endDate: z.string(),
});
