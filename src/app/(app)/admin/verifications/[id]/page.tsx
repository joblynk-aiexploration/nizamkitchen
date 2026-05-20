import { SellerTrialReviewStatus, SellerVerificationItemStatus, SellerVerificationLevel, SellerVerificationStatus } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminVerificationProfile } from "@/server/seller-verifications";
import { requestBackgroundCheckAction, reviewFoodSafetyCertificateAction, reviewKitchenChecklistAction, reviewSellerPermitAction, reviewVerificationItemAction, reviewVerificationProfileAction, updateBackgroundCheckStatusAction, upsertTrialReviewAction } from "../../../seller-verification-actions";

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
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Certificates</p><p className="mt-3 text-3xl font-semibold">{profile.foodSafetyCertificates.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kitchen reviews</p><p className="mt-3 text-3xl font-semibold">{profile.kitchenReviews.length}</p></Card>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <AdminDataTable
            data={profile.foodSafetyCertificates}
            emptyMessage="No food safety certificates submitted."
            columns={[
              { key: "provider", header: "Certificate", render: (item) => item.providerName ?? "Food safety certificate" },
              { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
              { key: "file", header: "Private file", render: (item) => item.fileId },
              { key: "expires", header: "Expires", render: (item) => item.expiresAt?.toLocaleDateString() ?? "Not set" },
              { key: "actions", header: "Review", render: (item) => canMutate ? <ReviewDocumentForm profileId={profile.id} idName="certificateId" id={item.id} expiresAt={item.expiresAt} action={reviewFoodSafetyCertificateAction} /> : "Read only" },
            ]}
          />
          <AdminDataTable
            data={profile.permits}
            emptyMessage="No local permits or licenses submitted."
            columns={[
              { key: "type", header: "Permit", render: (item) => item.permitType.replace(/_/g, " ") },
              { key: "authority", header: "Authority", render: (item) => item.issuingAuthority ?? "Not provided" },
              { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
              { key: "file", header: "Private file", render: (item) => item.fileId },
              { key: "actions", header: "Review", render: (item) => canMutate ? <ReviewDocumentForm profileId={profile.id} idName="permitId" id={item.id} expiresAt={item.expiresAt} action={reviewSellerPermitAction} /> : "Read only" },
            ]}
          />
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
          <AdminDataTable
            data={profile.kitchenReviews}
            emptyMessage="No kitchen safety photos submitted."
            columns={[
              { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
              { key: "photos", header: "Photos", render: (item) => item.photos.length },
              { key: "notes", header: "Notes", render: (item) => item.notes ?? "No notes" },
              { key: "actions", header: "Checklist", render: (item) => canMutate ? <KitchenChecklistForm profileId={profile.id} reviewId={item.id} /> : "Read only" },
            ]}
          />
          <AdminDataTable
            data={profile.trialReviews}
            emptyMessage="No trial/taste test requested."
            columns={[
              { key: "dish", header: "Dish", render: (item) => item.dishName ?? "Not set" },
              { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "approved" || item.status === "waived" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
              { key: "scheduled", header: "Scheduled", render: (item) => item.scheduledAt?.toLocaleDateString() ?? "Not scheduled" },
            ]}
          />
          <AdminDataTable
            data={profile.backgroundChecks}
            emptyMessage="No background consent/check recorded."
            columns={[
              { key: "provider", header: "Provider", render: (item) => item.provider.replace(/_/g, " ") },
              { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "clear" ? "success" : item.status === "failed" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
              { key: "summary", header: "Safe summary", render: (item) => item.resultSummary ?? "No full report stored" },
              { key: "actions", header: "Status", render: (item) => canMutate ? <BackgroundCheckStatusForm profileId={profile.id} backgroundCheckId={item.id} /> : "Read only" },
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
          {canMutate ? <TrialReviewCard profileId={profile.id} trialReviewId={profile.trialReviews[0]?.id ?? null} /> : null}
          {canMutate ? <RequestBackgroundCheckCard profileId={profile.id} /> : null}
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Privacy guardrails</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">Identity documents, certificates, kitchen photos, and background status are private. Public profiles only show safe status badges, never document numbers or background-check details.</p>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

function RequestBackgroundCheckCard({ profileId }: { profileId: string }) {
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-[var(--color-ink)]">Request background check</h2>
      <p className="text-sm text-[var(--color-muted)]">Background checks require recorded seller consent before ordering.</p>
      <form action={requestBackgroundCheckAction} className="space-y-3">
        <input type="hidden" name="verificationProfileId" value={profileId} />
        <SelectInput label="Provider" name="provider" defaultValue="manual" options={[{ value: "manual", label: "manual" }, { value: "checkr_placeholder", label: "checkr placeholder" }]} />
        <Button type="submit" className="w-full justify-center">Request check</Button>
      </form>
    </Card>
  );
}

function BackgroundCheckStatusForm({ profileId, backgroundCheckId }: { profileId: string; backgroundCheckId: string }) {
  return (
    <form action={updateBackgroundCheckStatusAction} className="grid gap-2">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="backgroundCheckId" value={backgroundCheckId} />
      <select name="status" defaultValue="pending" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs">
        <option value="pending">pending</option>
        <option value="clear">clear</option>
        <option value="consider">consider</option>
        <option value="failed">failed</option>
        <option value="cancelled">cancelled</option>
      </select>
      <input name="resultSummary" placeholder="Safe summary only" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs" />
      <Button type="submit">Save</Button>
    </form>
  );
}

function ReviewDocumentForm({ profileId, idName, id, expiresAt, action }: { profileId: string; idName: "certificateId" | "permitId"; id: string; expiresAt: Date | null; action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name={idName} value={id} />
      <select name="status" defaultValue="approved" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs">
        <option value="approved">approve</option>
        <option value="needs_more_info">needs more info</option>
        <option value="rejected">reject</option>
        <option value="expired">expire</option>
      </select>
      <input type="date" name="expiresAt" defaultValue={expiresAt ? expiresAt.toISOString().slice(0, 10) : ""} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs" />
      <input name="rejectionReason" placeholder="Reason / note" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs" />
      <Button type="submit">Save</Button>
    </form>
  );
}

function KitchenChecklistForm({ profileId, reviewId }: { profileId: string; reviewId: string }) {
  const checks = [
    ["cleanPrepSurfaces", "Clean prep surfaces"],
    ["handwashingSanitation", "Handwashing/sanitation"],
    ["safeFoodStorage", "Safe food storage"],
    ["organizedDryStorage", "Organized dry storage"],
    ["properPackagingArea", "Proper packaging area"],
    ["noPetsInPrepArea", "Pet separation attestation"],
  ] as const;
  return (
    <form action={reviewKitchenChecklistAction} className="grid gap-2">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="reviewId" value={reviewId} />
      <select name="status" defaultValue="approved" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs">
        <option value="approved">approve</option>
        <option value="needs_more_info">needs more info</option>
        <option value="rejected">reject</option>
        <option value="under_review">under review</option>
      </select>
      {checks.map(([name, label]) => <label key={name} className="text-xs"><input type="checkbox" name={name} className="mr-2" />{label}</label>)}
      <input name="cleanlinessScore" placeholder="Cleanliness 1-5" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs" />
      <input name="storageScore" placeholder="Storage 1-5" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs" />
      <input name="sanitationScore" placeholder="Sanitation 1-5" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs" />
      <input name="packagingScore" placeholder="Packaging 1-5" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs" />
      <textarea name="notes" placeholder="Review notes" className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs" />
      <Button type="submit">Save checklist</Button>
    </form>
  );
}

function TrialReviewCard({ profileId, trialReviewId }: { profileId: string; trialReviewId: string | null }) {
  return (
    <Card className="space-y-4">
      <h2 className="font-semibold text-[var(--color-ink)]">Trial/taste test</h2>
      <form action={upsertTrialReviewAction} className="space-y-3">
        <input type="hidden" name="profileId" value={profileId} />
        <input type="hidden" name="trialReviewId" value={trialReviewId ?? ""} />
        <SelectInput label="Trial status" name="status" defaultValue={SellerTrialReviewStatus.requested} options={Object.values(SellerTrialReviewStatus).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
        <TextInput label="Scheduled date" name="scheduledAt" type="date" />
        <TextInput label="Dish name" name="dishName" />
        <TextInput label="Taste score" name="tasteScore" />
        <TextInput label="Packaging score" name="packagingScore" />
        <TextInput label="Presentation score" name="presentationScore" />
        <TextArea label="Notes" name="notes" />
        <Button type="submit" className="w-full justify-center">Save trial review</Button>
      </form>
    </Card>
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
