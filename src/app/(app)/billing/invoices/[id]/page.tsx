import { notFound } from "next/navigation";
import { BrandedInvoiceDocument } from "@/components/accounting/branded-invoice-document";
import { requireMembership } from "@/lib/auth/session";
import { getMemberAccountingDocument } from "@/server/accounting/accounting-service";
import { getInvoiceBrandingSettings } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";

export default async function BillingInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  const { id } = await params;
  const invoice = await getMemberAccountingDocument(session, id, "invoice");
  if (!invoice) notFound();
  const branding = await getInvoiceBrandingSettings();

  return (
    <BrandedInvoiceDocument
      document={invoice}
      branding={branding}
      backHref="/billing/invoices"
      pdfHref={`/api/billing/invoices/${invoice.id}/pdf`}
    />
  );
}
