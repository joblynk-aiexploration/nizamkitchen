"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { addAdminSupportTicketComment, updateAdminSupportTicket } from "@/server/support";

const SUPPORT_ROLES = ["platform_owner", "platform_admin", "support_admin"] as const;

export async function updateAdminSupportTicketAction(ticketId: string, formData: FormData) {
  const session = await requirePlatformRole([...SUPPORT_ROLES]);
  await updateAdminSupportTicket(session, ticketId, {
    status: formData.get("status"),
    priority: formData.get("priority"),
    assignedToId: formData.get("assignedToId"),
    adminNotes: formData.get("adminNotes"),
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
}

export async function addAdminSupportTicketCommentAction(ticketId: string, formData: FormData) {
  const session = await requirePlatformRole([...SUPPORT_ROLES]);
  await addAdminSupportTicketComment(session, ticketId, {
    body: formData.get("body"),
    isInternal: formData.get("isInternal") === "on",
  });

  revalidatePath(`/admin/support/${ticketId}`);
}
