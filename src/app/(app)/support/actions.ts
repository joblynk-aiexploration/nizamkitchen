"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { addUserSupportTicketComment, createSupportTicket } from "@/server/support";

export async function createSupportTicketAction(formData: FormData) {
  const session = await requireMembership();
  const ticket = await createSupportTicket(session, {
    type: formData.get("type"),
    priority: formData.get("priority"),
    title: formData.get("title"),
    description: formData.get("description"),
    pageUrl: formData.get("pageUrl"),
    browserInfo: formData.get("browserInfo"),
  });

  revalidatePath("/support");
  redirect(`/support/tickets/${ticket.id}`);
}

export async function addUserSupportTicketCommentAction(ticketId: string, formData: FormData) {
  const session = await requireMembership();
  await addUserSupportTicketComment(session, ticketId, {
    body: formData.get("body"),
    isInternal: false,
  });

  revalidatePath(`/support/tickets/${ticketId}`);
}
