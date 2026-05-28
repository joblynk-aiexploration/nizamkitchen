import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { getGroceryList } from "@/server/grocery";
import { listGroceryListShares } from "@/server/grocery-partners";
import {
  createShareLinkAction,
  revokeShareLinkAction,
  sendGroceryListEmailPlaceholderAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function GroceryListSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; message?: string }>;
}) {
  const session = await requireMembership();
  const { id } = await params;
  const query = await searchParams;
  const list = await getGroceryList(id, session.activeOrganization.id);
  if (!list) notFound();

  const shares = await listGroceryListShares(id, session.activeOrganization.id);
  const createdUrl = query.token ? `${process.env.APP_URL ?? "http://localhost:3000"}/share/grocery-lists/${query.token}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Share Grocery List"
        title={list.name}
        description="Create read-only share links, revoke access, or record an email handoff placeholder."
      />

      {query.message && (
        <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{query.message}</Card>
      )}

      {createdUrl && (
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="text-sm font-semibold text-emerald-900">New share link created</p>
          <p className="mt-2 break-all rounded-2xl bg-white p-3 text-sm text-emerald-950">{createdUrl}</p>
          <p className="mt-2 text-xs text-emerald-800">This is the only time the raw token is shown. The database stores only a hash.</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Create read-only link</h2>
          <form action={createShareLinkAction} className="mt-4 space-y-4">
            <input type="hidden" name="listId" value={list.id} />
            <TextInput label="Expires in days (optional)" name="expiresInDays" type="number" min="1" max="90" placeholder="30" />
            <Button type="submit">Create share link</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Email placeholder</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Records an email handoff request for future mail-provider wiring. No external provider is called yet.</p>
          <form action={sendGroceryListEmailPlaceholderAction} className="mt-4 space-y-4">
            <input type="hidden" name="listId" value={list.id} />
            <TextInput label="Recipient email" name="recipientEmail" type="email" required />
            <TextArea label="Optional note" name="note" rows={3} />
            <Button type="submit" variant="secondary">Record email placeholder</Button>
          </form>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Existing share links</h2>
          <Link href={`/grocery-lists/${list.id}`} className="text-sm text-[var(--color-primary)]">Back to list</Link>
        </div>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {shares.length === 0 ? (
            <p className="py-6 text-sm text-[var(--color-muted)]">No share links have been created yet.</p>
          ) : shares.map((share) => (
            <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">
                  Created {share.createdAt.toLocaleString()} by {share.createdBy.fullName}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {share.expiresAt ? `Expires ${share.expiresAt.toLocaleDateString()}` : "No expiration"}
                  {" · "}
                  {share.revokedAt ? `Revoked ${share.revokedAt.toLocaleDateString()}` : "Active"}
                </p>
              </div>
              {!share.revokedAt && (
                <form action={revokeShareLinkAction}>
                  <input type="hidden" name="listId" value={list.id} />
                  <input type="hidden" name="shareId" value={share.id} />
                  <Button type="submit" variant="danger">Revoke</Button>
                </form>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
