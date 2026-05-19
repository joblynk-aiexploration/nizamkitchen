import { SellerVerificationItemStatus, SellerVerificationLevel, SellerVerificationStatus } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminVerificationProfile } from "@/server/seller-verifications";
import { reviewVerificationItemAction, reviewVerificationProfileAction } from "../../../seller-verification-actions";

export const dynamic = "force-dynamic";

export default async function AdminVerificationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string }> }) {
  const [session, routeParams, query] = await Promise.all([
    requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]),
    params,
    searchParams,
  ]);
  const profile = await getAdminVerificationProfile(session, routeParams.id);
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin" || session.user.platformRole === "country_manager";

  return (
    <AdminShell session={session} title={profile.organization.name} description={`${profile.sellerType.replace(/_/g, " ")} · ${profile.countryCode}`}>
      {query.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{query.message}</Card> : null}
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p><p className="mt-3"><Badge tone={profile.status === "verified" ? "success" : profile.status === "rejected" ? "danger" : "warning"}>{profile.status}</Badge></p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Level</p><p className="mt-3 text-sm font-semibold">{profile.verificationLevel.replace(/_/g, " ")}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Items</p><p className="mt-3 text-3xl font-semibold">{profile.items.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kitchen reviews</p><p className="mt-3 text-3xl font-semibold">{profile.kitchenReviews.length}</p></Card>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <AdminDataTable
            data={profile.items}
            emptyMessage="No submitted verification items."
            columns={[
              { key: "type", header: "Requirement", render: (item) => item.requirement?.title ?? item.requirementType.replace(/_/g, " ") },
              { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status}</Badge> },
              { key: "file", header: "Document file", render: (item) => item.documentFileId ?? "Provider/manual" },
              { key: "expires", header: "Expires", render: (item) => item.expiresAt?.toLocaleDateString() ?? "Not set" },
              { key: "actions", header: "Review", render: (item) => canMutate ? <ReviewItemForm profileId={profile.id} itemId={item.id} /> : "Read only" },
            ]}
          />
          <AdminDataTable
            data={profile.attestations}
            emptyMessage="No seller attestations accepted."
            columns={[
              { key: "type", header: "Attestation", render: (item) => item.attestationType.replace(/_/g, " ") },
              { key: "version", header: "Version", render: (item) => item.version },
              { key: "accepted", header: "Accepted", render: (item) => item.acceptedAt.toLocaleDateString() },
            ]}
          />
        </div>
        <div className="space-y-6">
          {canMutate ? (
            <Card className="space-y-4">
              <h2 className="font-semibold text-[var(--color-ink)]">Admin review</h2>
              <form action={reviewVerificationProfileAction} className="space-y-3">
                <input type="hidden" name="profileId" value={profile.id} />
                <SelectInput label="Profile status" name="status" defaultValue={profile.status} options={Object.values(SellerVerificationStatus).filter((value) => !["not_started", "in_progress", "submitted"].includes(value)).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
                <SelectInput label="Verification level" name="verificationLevel" defaultValue={profile.verificationLevel} options={Object.values(SellerVerificationLevel).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
                <TextArea label="Rejection reason" name="rejectionReason" defaultValue={profile.rejectionReason ?? ""} />
                <TextArea label="Internal admin notes" name="adminNotes" defaultValue={profile.adminNotes ?? ""} />
                <Button type="submit" className="w-full justify-center">Save verification review</Button>
              </form>
            </Card>
          ) : null}
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Privacy guardrails</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">Identity documents, certificates, kitchen photos, and background status are private. Public profiles only show safe status badges, never document numbers or background-check details.</p>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

function ReviewItemForm({ profileId, itemId }: { profileId: string; itemId: string }) {
  return (
    <form action={reviewVerificationItemAction} className="flex gap-2">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="itemId" value={itemId} />
      <select name="status" defaultValue={SellerVerificationItemStatus.approved} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs">
        <option value="approved">approve</option>
        <option value="rejected">reject</option>
        <option value="expired">expire</option>
      </select>
      <Button type="submit">Save</Button>
    </form>
  );
}
