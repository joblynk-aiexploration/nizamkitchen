"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { createCmsPage, createFaqItem, createHelpArticle, updateCmsPage, updateFaqItem, updateHelpArticle } from "@/server/content";

const CONTENT_ROLES = ["platform_owner", "platform_admin", "support_admin"] as const;

export async function createCmsPageAction(formData: FormData) {
  const session = await requirePlatformRole([...CONTENT_ROLES]);
  const page = await createCmsPage(session, Object.fromEntries(formData));
  revalidatePath("/admin/content/pages");
  redirect(`/admin/content/pages/${page.id}`);
}

export async function updateCmsPageAction(formData: FormData) {
  const session = await requirePlatformRole([...CONTENT_ROLES]);
  const id = String(formData.get("id") ?? "");
  await updateCmsPage(session, id, Object.fromEntries(formData));
  revalidatePath(`/admin/content/pages/${id}`);
  revalidatePath("/admin/content/pages");
}

export async function createHelpArticleAction(formData: FormData) {
  const session = await requirePlatformRole([...CONTENT_ROLES]);
  const article = await createHelpArticle(session, Object.fromEntries(formData));
  revalidatePath("/admin/content/help");
  redirect(`/admin/content/help/${article.id}`);
}

export async function updateHelpArticleAction(formData: FormData) {
  const session = await requirePlatformRole([...CONTENT_ROLES]);
  const id = String(formData.get("id") ?? "");
  await updateHelpArticle(session, id, Object.fromEntries(formData));
  revalidatePath(`/admin/content/help/${id}`);
  revalidatePath("/admin/content/help");
}

export async function createFaqItemAction(formData: FormData) {
  const session = await requirePlatformRole([...CONTENT_ROLES]);
  const faq = await createFaqItem(session, Object.fromEntries(formData));
  revalidatePath("/admin/content/faqs");
  redirect(`/admin/content/faqs/${faq.id}`);
}

export async function updateFaqItemAction(formData: FormData) {
  const session = await requirePlatformRole([...CONTENT_ROLES]);
  const id = String(formData.get("id") ?? "");
  await updateFaqItem(session, id, Object.fromEntries(formData));
  revalidatePath(`/admin/content/faqs/${id}`);
  revalidatePath("/admin/content/faqs");
}
