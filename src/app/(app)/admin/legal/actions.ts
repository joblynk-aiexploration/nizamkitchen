"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LegalAudience, LegalDocumentType } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  archiveLegalDocument,
  createLegalDocument,
  publishLegalDocument,
  updateDraftLegalDocument,
} from "@/server/legal/legal-service";

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

export async function createLegalDocumentAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const document = await createLegalDocument(session, {
    documentType: String(formData.get("documentType")) as LegalDocumentType,
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    version: String(formData.get("version") ?? "").trim(),
    audience: String(formData.get("audience")) as LegalAudience,
    countryCode: optionalString(formData.get("countryCode")),
    region: optionalString(formData.get("region")),
    contentMarkdown: String(formData.get("contentMarkdown") ?? "").trim(),
  });
  revalidatePath("/admin/legal");
  revalidatePath("/admin/legal/documents");
  redirect(`/admin/legal/documents/${document.id}`);
}

export async function updateDraftLegalDocumentAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const id = String(formData.get("id") ?? "");
  await updateDraftLegalDocument(session, id, {
    title: String(formData.get("title") ?? "").trim(),
    contentMarkdown: String(formData.get("contentMarkdown") ?? "").trim(),
  });
  revalidatePath("/admin/legal");
  revalidatePath("/admin/legal/documents");
  revalidatePath(`/admin/legal/documents/${id}`);
}

export async function publishLegalDocumentAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const id = String(formData.get("id") ?? "");
  await publishLegalDocument(session, id);
  revalidatePath("/admin/legal");
  revalidatePath("/admin/legal/documents");
  revalidatePath(`/admin/legal/documents/${id}`);
}

export async function archiveLegalDocumentAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const id = String(formData.get("id") ?? "");
  await archiveLegalDocument(session, id);
  revalidatePath("/admin/legal");
  revalidatePath("/admin/legal/documents");
  revalidatePath(`/admin/legal/documents/${id}`);
}
