import { z } from "zod";

export const contactLeadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  organizationType: z.enum(["household", "chef", "restaurant", "other"]).optional(),
  countryCode: z.string().trim().min(2).max(3).toUpperCase().optional(),
  message: z.string().trim().min(10).max(2000),
});

export type ContactLeadInput = z.infer<typeof contactLeadSchema>;
