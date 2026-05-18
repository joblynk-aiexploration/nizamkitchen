import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyGroceryListButton } from "@/components/grocery/copy-grocery-list-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getGroceryList } from "@/server/grocery";
import { groceryListToClipboardText, listActiveGroceryPartners } from "@/server/grocery-partners";

export const dynamic = "force-dynamic";

export default async function GroceryListExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const list = await getGroceryList(id, session.activeOrganization.id);
  if (!list) notFound();

  const partners = await listActiveGroceryPartners(
    list.countryCode ?? session.activeOrganization.countryCode,
    session.activeOrganization.id,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Grocery Export"
        title={list.name}
        description="Print, download, copy, share, or prepare a partner handoff without sending personal data externally."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h2 className="font-semibold">Print</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Printer-friendly checklist with recipe sources and warnings.</p>
          <Button asChild className="mt-4" variant="secondary">
            <Link href={`/grocery-lists/${list.id}/print`} target="_blank">Open print view</Link>
          </Button>
        </Card>
        <Card>
          <h2 className="font-semibold">CSV</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Download item, quantity, unit, category, source recipes, and notes.</p>
          <Button asChild className="mt-4" variant="secondary">
            <a href={`/api/grocery-lists/${list.id}/export/csv`}>Export CSV</a>
          </Button>
        </Card>
        <Card>
          <h2 className="font-semibold">PDF</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Download a compact branded PDF checklist for offline shopping.</p>
          <Button asChild className="mt-4" variant="secondary">
            <a href={`/api/grocery-lists/${list.id}/export/pdf`}>Export PDF</a>
          </Button>
        </Card>
        <Card>
          <h2 className="font-semibold">Share</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Create a read-only tokenized link that can be revoked later.</p>
          <Button asChild className="mt-4" variant="secondary">
            <Link href={`/grocery-lists/${list.id}/share`}>Manage share links</Link>
          </Button>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Copy list</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Copy a plain-text version for messages or notes.</p>
        <div className="mt-4">
          <CopyGroceryListButton listId={list.id} text={groceryListToClipboardText(list)} />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Partner options</h2>
        {partners.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Grocery partner handoff is coming soon for this country. Exports still work and no personal data is sent externally.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {partners.map((partner) => (
              <div key={partner.id} className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
                <p className="font-semibold text-[var(--color-ink)]">{partner.name}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{partner.integrationType.replace(/_/g, " ")}</p>
                {partner.websiteUrl ? (
                  <Button asChild className="mt-4" variant="secondary">
                    <a href={partner.websiteUrl} target="_blank" rel="noreferrer">Open partner website</a>
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-[var(--color-muted)]">Partner website not configured yet.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
