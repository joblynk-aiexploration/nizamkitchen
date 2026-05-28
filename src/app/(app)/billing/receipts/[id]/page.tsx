import { notFound } from "next/navigation";
import { BrandedInvoiceDocument } from "@/components/accounting/branded-invoice-document";
import { requireMembership } from "@/lib/auth/session";
import { getMemberAccountingDocument } from "@/server/accounting/accounting-service";
import { getInvoiceBrandingSettings } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";

export default async function BillingReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  const { id } = await params;
  const receipt = await getMemberAccountingDocument(session, id, "receipt");
  if (!receipt) notFound();
  const branding = await getInvoiceBrandingSettings();

  return (
    <BrandedInvoiceDocument
      document={receipt}
      branding={branding}
      backHref="/billing/receipts"
      pdfHref={`/api/billing/receipts/${receipt.id}/pdf`}
    />
  );
}
