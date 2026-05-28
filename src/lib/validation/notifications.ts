import { z } from "zod";

export const notificationPreferenceSchema = z.object({
  emailEnabled: z.coerce.boolean().default(false),
  inAppEnabled: z.coerce.boolean().default(false),
  homeChefUpdates: z.coerce.boolean().default(false),
  chefRequestMessages: z.coerce.boolean().default(false),
  groceryReminders: z.coerce.boolean().default(false),
  mealPlanReminders: z.coerce.boolean().default(false),
  adminAlerts: z.coerce.boolean().default(false),
  marketingEmails: z.coerce.boolean().default(false),
});

export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;
