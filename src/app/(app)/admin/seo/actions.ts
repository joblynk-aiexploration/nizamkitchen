"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type Prisma, RobotsDirective, SeoScope } from "@prisma/client";
import { requirePlatformRole } from "@/lib/auth/session";
import { saveSeoSetting } from "@/server/seo/seo-service";

function clean(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text || null;
}

function parseJsonField(value: FormDataEntryValue | null) {
  const text = clean(value);
  if (!text) return null;
  try {
    return JSON.parse(text) as Prisma.InputJsonValue;
  } catch {
    return { parseError: "Invalid JSON was not saved.", raw: text } as Prisma.InputJsonObject;
  }
}

function enumValue<T extends Record<string, string>>(source: T, value: FormDataEntryValue | null, fallback: T[keyof T]) {
  const text = value?.toString();
  return Object.values(source).includes(text as T[keyof T]) ? text as T[keyof T] : fallback;
}

export async function saveSeoSettingAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner"]);
  const setting = await saveSeoSetting({
    id: clean(formData.get("id")) ?? undefined,
    scope: enumValue(SeoScope, formData.get("scope"), SeoScope.page),
    entityType: clean(formData.get("entityType")),
    entityId: clean(formData.get("entityId")),
    countryCode: clean(formData.get("countryCode")),
    city: clean(formData.get("city")),
    path: clean(formData.get("path")),
    metaTitle: clean(formData.get("metaTitle")),
    metaDescription: clean(formData.get("metaDescription")),
    canonicalUrl: clean(formData.get("canonicalUrl")),
    ogTitle: clean(formData.get("ogTitle")),
    ogDescription: clean(formData.get("ogDescription")),
    ogImageFileId: clean(formData.get("ogImageFileId")),
    twitterTitle: clean(formData.get("twitterTitle")),
    twitterDescription: clean(formData.get("twitterDescription")),
    twitterImageFileId: clean(formData.get("twitterImageFileId")),
    robotsDirective: enumValue(RobotsDirective, formData.get("robotsDirective"), RobotsDirective.index_follow),
    structuredDataJson: parseJsonField(formData.get("structuredDataJson")),
    aeoSummary: clean(formData.get("aeoSummary")),
    aeoFaqJson: parseJsonField(formData.get("aeoFaqJson")),
    isActive: formData.get("isActive") !== "off",
    actorUserId: session.user.id,
  });

  revalidatePath("/");
  revalidatePath("/admin/seo");
  redirect(`/admin/seo/${redirectPathForScope(setting.scope)}?message=SEO setting saved.`);
}

function redirectPathForScope(scope: SeoScope) {
  if (scope === SeoScope.global) return "global";
  if (scope === SeoScope.recipe) return "recipes";
  if (scope === SeoScope.seller_profile) return "seller-profiles";
  if (scope === SeoScope.city_page || scope === SeoScope.country_page || scope === SeoScope.custom_path || scope === SeoScope.page) return "pages";
  if (scope === SeoScope.menu_template) return "schema";
  return "pages";
}
