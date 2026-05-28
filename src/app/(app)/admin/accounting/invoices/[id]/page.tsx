import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { BrandedInvoiceDocument } from "@/components/accounting/branded-invoice-document";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAccountingDocument } from "@/server/accounting/accounting-service";
import { getInvoiceBrandingSettings } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";

export default async function AdminInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const invoice = await getAccountingDocument(session, id, "invoice");
  if (!invoice) notFound();
  const branding = await getInvoiceBrandingSettings();

  return (
    <AdminShell session={session} title={invoice.documentNumber} description="Branded invoice detail, print view, and PDF download.">
      <BrandedInvoiceDocument
        document={invoice}
        branding={branding}
        backHref="/admin/accounting/invoices"
        pdfHref={`/api/admin/accounting/invoices/${invoice.id}/pdf`}
      />
    </AdminShell>
  );
}
