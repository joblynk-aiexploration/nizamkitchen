import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAccountingDocument } from "@/server/accounting/accounting-service";
import { getInvoiceBrandingSettings, invoicePdfFilename, renderInvoicePdf, storeInvoicePdfIfStorageAvailable } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const receipt = await getAccountingDocument(session, id, "receipt");
  if (!receipt) notFound();
  const branding = await getInvoiceBrandingSettings();
  await storeInvoicePdfIfStorageAvailable(session, receipt, branding);

  return new Response(renderInvoicePdf(receipt, branding), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoicePdfFilename(receipt)}"`,
    },
  });
}
