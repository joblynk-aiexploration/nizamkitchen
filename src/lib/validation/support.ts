import { z } from "zod";

export const supportTicketTypeValues = ["bug", "feedback", "feature_request", "account_help", "billing", "other"] as const;
export const supportTicketStatusValues = ["open", "in_review", "waiting_on_user", "resolved", "closed"] as const;
export const supportTicketPriorityValues = ["low", "normal", "high", "urgent"] as const;

const nullableString = (max = 1000) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );

export const supportTicketCreateSchema = z.object({
  type: z.enum(supportTicketTypeValues),
  priority: z.enum(supportTicketPriorityValues).default("normal"),
  title: z.string().trim().min(4).max(180),
  description: z.string().trim().min(10).max(5000),
  pageUrl: nullableString(500).optional(),
  browserInfo: nullableString(1000).optional(),
});

export const supportTicketCommentSchema = z.object({
  body: z.string().trim().min(1).max(3000),
  isInternal: z.coerce.boolean().default(false),
});

export const supportTicketAdminUpdateSchema = z.object({
  status: z.enum(supportTicketStatusValues).optional(),
  priority: z.enum(supportTicketPriorityValues).optional(),
  assignedToId: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().min(1).nullable().optional(),
  ),
  adminNotes: nullableString(3000).optional(),
});

export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateSchema>;
export type SupportTicketCommentInput = z.infer<typeof supportTicketCommentSchema>;
export type SupportTicketAdminUpdateInput = z.infer<typeof supportTicketAdminUpdateSchema>;
