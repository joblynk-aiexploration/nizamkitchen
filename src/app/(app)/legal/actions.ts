"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, getRequestMetadata } from "@/lib/auth/session";
import {
  createAcceptance,
  getRequiredLegalDocumentsForUser,
  hasAcceptedLatestRequiredDocuments,
} from "@/server/legal/legal-service";

function destinationForOrganizationType(type?: string | null) {
  if (type === "chef_business") return "/chef";
  if (type === "home_catering") return "/catering";
  if (type === "restaurant") return "/restaurant";
  return "/dashboard";
}

export async function acceptRequiredLegalDocumentsAction() {
  const session = await requireUser();
  const result = await hasAcceptedLatestRequiredDocuments(session);
  if (result.accepted) redirect(destinationForOrganizationType(session.activeOrganization?.organizationType));

  const metadata = await getRequestMetadata();
  const required = await getRequiredLegalDocumentsForUser(session);
  const missingIds = new Set(result.missing.map((document) => document.id));

  await Promise.all(
    required
      .filter((document) => missingIds.has(document.id))
      .map((document) =>
        createAcceptance({
          userId: session.user.id,
          organizationId: session.activeOrganization?.id ?? null,
          documentId: document.id,
          ...metadata,
        }),
      ),
  );

  revalidatePath("/legal/accept-required");
  redirect(destinationForOrganizationType(session.activeOrganization?.organizationType));
}

export async function declineRequiredLegalDocumentsAction() {
  redirect("/logout");
}
