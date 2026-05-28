"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  createGroceryListShare,
  revokeGroceryListShare,
  sendGroceryListEmailPlaceholder,
} from "@/server/grocery-partners";

export async function createShareLinkAction(formData: FormData) {
  const listId = String(formData.get("listId"));
  try {
    const session = await requireMembership();
    const expiresInDaysValue = formData.get("expiresInDays");
    const { token } = await createGroceryListShare(
      listId,
      session.activeOrganization.id,
      session.user.id,
      { expiresInDays: expiresInDaysValue ? Number(expiresInDaysValue) : undefined },
    );
    revalidatePath(`/grocery-lists/${listId}/share`);
    redirect(`/grocery-lists/${listId}/share?token=${encodeURIComponent(token)}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/grocery-lists/${listId}/share?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create share link."))}`);
  }
}

export async function revokeShareLinkAction(formData: FormData) {
  const listId = String(formData.get("listId"));
  try {
    const session = await requireMembership();
    await revokeGroceryListShare(
      String(formData.get("shareId")),
      listId,
      session.activeOrganization.id,
      session.user.id,
    );
    revalidatePath(`/grocery-lists/${listId}/share`);
    redirect(`/grocery-lists/${listId}/share?message=Share link revoked.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/grocery-lists/${listId}/share?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to revoke share link."))}`);
  }
}

export async function sendGroceryListEmailPlaceholderAction(formData: FormData) {
  const listId = String(formData.get("listId"));
  try {
    const session = await requireMembership();
    await sendGroceryListEmailPlaceholder({
      groceryListId: listId,
      organizationId: session.activeOrganization.id,
      actorUserId: session.user.id,
      input: {
        recipientEmail: formData.get("recipientEmail"),
        note: formData.get("note"),
      },
    });
    redirect(`/grocery-lists/${listId}/share?message=Email handoff placeholder recorded.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/grocery-lists/${listId}/share?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to record email handoff."))}`);
  }
}
