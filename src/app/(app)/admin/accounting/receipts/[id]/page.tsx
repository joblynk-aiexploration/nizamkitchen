import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { BrandedInvoiceDocument } from "@/components/accounting/branded-invoice-document";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAccountingDocument } from "@/server/accounting/accounting-service";
import { getInvoiceBrandingSettings } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";

export default async function AdminReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const receipt = await getAccountingDocument(session, id, "receipt");
  if (!receipt) notFound();
  const branding = await getInvoiceBrandingSettings();

  return (
    <AdminShell session={session} title={receipt.documentNumber} description="Branded receipt detail, print view, and PDF download.">
      <BrandedInvoiceDocument
        document={receipt}
        branding={branding}
        backHref="/admin/accounting/receipts"
        pdfHref={`/api/admin/accounting/receipts/${receipt.id}/pdf`}
      />
    </AdminShell>
  );
}
