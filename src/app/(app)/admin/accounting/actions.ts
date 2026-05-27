"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  generateAccountingForPaidOrders,
  generateSellerSettlementReports,
  upsertTaxConfiguration,
} from "@/server/accounting/accounting-service";

function go(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

export async function saveTaxConfigurationAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    await upsertTaxConfiguration(session, {
      id: formData.get("id")?.toString() || null,
      name: formData.get("name")?.toString() ?? "",
      countryCode: formData.get("countryCode")?.toString() || null,
      region: formData.get("region")?.toString() || null,
      currencyCode: formData.get("currencyCode")?.toString() || null,
      module: formData.get("module")?.toString() || null,
      mode: (formData.get("mode")?.toString() || "disabled") as never,
      taxPercent: formData.get("taxPercent")?.toString() || null,
      fixedTaxAmount: formData.get("fixedTaxAmount")?.toString() || null,
      status: (formData.get("status")?.toString() || "draft") as never,
      notes: formData.get("notes")?.toString() || null,
    });
    revalidatePath("/admin/accounting");
    revalidatePath("/admin/accounting/taxes");
    go("/admin/accounting/taxes", "Tax configuration saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    go("/admin/accounting/taxes", getActionErrorMessage(error, "Unable to save tax configuration."));
  }
}

export async function generateAccountingRecordsAction() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    const result = await generateAccountingForPaidOrders(session);
    revalidatePath("/admin/accounting");
    revalidatePath("/admin/accounting/invoices");
    revalidatePath("/admin/accounting/receipts");
    revalidatePath("/admin/accounting/commissions");
    go("/admin/accounting", `Generated ${result.documentsCreated} documents and ${result.commissionsCreated} commission records.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    go("/admin/accounting", getActionErrorMessage(error, "Unable to generate accounting records."));
  }
}

export async function generateSettlementReportsAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    const periodStart = new Date(formData.get("periodStart")?.toString() || "");
    const periodEnd = new Date(formData.get("periodEnd")?.toString() || "");
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new Error("Valid settlement period start and end dates are required.");
    }
    const result = await generateSellerSettlementReports(session, periodStart, periodEnd);
    revalidatePath("/admin/accounting/settlements");
    go("/admin/accounting/settlements", `Generated ${result.created} settlement reports.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    go("/admin/accounting/settlements", getActionErrorMessage(error, "Unable to generate settlement reports."));
  }
}
