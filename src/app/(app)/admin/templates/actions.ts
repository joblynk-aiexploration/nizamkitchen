"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  archiveDishTemplate,
  archiveMenuTemplate,
  cloneDishTemplate,
  cloneMenuTemplate,
  upsertDishTemplate,
  upsertMenuTemplate,
} from "@/server/templates";

export async function upsertDishTemplateAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const template = await upsertDishTemplate(session, Object.fromEntries(formData));
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates/dishes");
    redirect(`/admin/templates/dishes/${template.id}?message=Dish template saved.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/templates/dishes?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save dish template."))}`);
  }
}

export async function archiveDishTemplateAction(formData: FormData) {
  const id = String(formData.get("id"));
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    await archiveDishTemplate(session, id);
    revalidatePath("/admin/templates/dishes");
    redirect("/admin/templates/dishes?message=Dish template archived.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/templates/dishes/${id}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to archive dish template."))}`);
  }
}

export async function cloneDishTemplateAction(formData: FormData) {
  const id = String(formData.get("id"));
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const clone = await cloneDishTemplate(session, id);
    revalidatePath("/admin/templates/dishes");
    redirect(`/admin/templates/dishes/${clone.id}?message=Dish template cloned.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/templates/dishes/${id}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to clone dish template."))}`);
  }
}

export async function upsertMenuTemplateAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const template = await upsertMenuTemplate(session, Object.fromEntries(formData));
    revalidatePath("/admin/templates");
    revalidatePath("/admin/templates/menus");
    redirect(`/admin/templates/menus/${template.id}?message=Menu template saved.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/templates/menus?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save menu template."))}`);
  }
}

export async function archiveMenuTemplateAction(formData: FormData) {
  const id = String(formData.get("id"));
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    await archiveMenuTemplate(session, id);
    revalidatePath("/admin/templates/menus");
    redirect("/admin/templates/menus?message=Menu template archived.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/templates/menus/${id}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to archive menu template."))}`);
  }
}

export async function cloneMenuTemplateAction(formData: FormData) {
  const id = String(formData.get("id"));
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
    const clone = await cloneMenuTemplate(session, id);
    revalidatePath("/admin/templates/menus");
    redirect(`/admin/templates/menus/${clone.id}?message=Menu template cloned.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/templates/menus/${id}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to clone menu template."))}`);
  }
}
