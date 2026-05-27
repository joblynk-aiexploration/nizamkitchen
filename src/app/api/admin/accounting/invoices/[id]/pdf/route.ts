import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAccountingDocument } from "@/server/accounting/accounting-service";
import { getInvoiceBrandingSettings, invoicePdfFilename, renderInvoicePdf, storeInvoicePdfIfStorageAvailable } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const invoice = await getAccountingDocument(session, id, "invoice");
  if (!invoice) notFound();
  const branding = await getInvoiceBrandingSettings();
  await storeInvoicePdfIfStorageAvailable(session, invoice, branding);

  return new Response(renderInvoicePdf(invoice, branding), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoicePdfFilename(invoice)}"`,
    },
  });
}
