import { notFound } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getMemberAccountingDocument } from "@/server/accounting/accounting-service";
import { getInvoiceBrandingSettings, invoicePdfFilename, renderInvoicePdf, storeInvoicePdfIfStorageAvailable } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  const { id } = await params;
  const invoice = await getMemberAccountingDocument(session, id, "invoice");
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
