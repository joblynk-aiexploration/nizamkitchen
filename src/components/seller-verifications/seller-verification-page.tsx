import { SellerRequirementType, type SellerVerificationProfile } from "@prisma/client";
import { DocumentUploadField, ImageUploadField } from "@/components/storage/file-upload-field";
import { SellerVerificationBadge } from "@/components/seller-verifications/verification-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { safeVerificationBadge } from "@/server/seller-verifications";

type Requirement = {
  id: string;
  requirementType: SellerRequirementType;
  title: string;
  description?: string | null;
  isRequired: boolean;
  provider: string;
};

type VerificationProfile = SellerVerificationProfile & {
  items: Array<{ id: string; requirementId: string | null; requirementType: SellerRequirementType; status: string; documentFileId: string | null; rejectionReason: string | null; expiresAt: Date | null }>;
  foodSafetyCertificates: Array<{ id: string; status: string; providerName: string | null; expiresAt: Date | null; rejectionReason: string | null }>;
  permits: Array<{ id: string; status: string; permitType: string; expiresAt: Date | null; rejectionReason: string | null }>;
  attestations: Array<{ id: string; attestationType: string; acceptedAt: Date }>;
  kitchenReviews: Array<{ id: string; status: string; photos: Array<{ id: string; category: string; fileId: string }> }>;
  trialReviews: Array<{ id: string; status: string; scheduledAt: Date | null; dishName: string | null; notes: string | null }>;
};

export function SellerVerificationPage({
  title,
  description,
  profile,
  requirements,
  uploadAction,
  foodCertificateAction,
  permitAction,
  attestationAction,
  kitchenPhotoAction,
  submitAction,
  returnTo,
}: {
  title: string;
  description: string;
  profile: VerificationProfile | null;
  requirements: Requirement[];
  uploadAction: (formData: FormData) => Promise<void>;
  foodCertificateAction: (formData: FormData) => Promise<void>;
  permitAction: (formData: FormData) => Promise<void>;
  attestationAction: (formData: FormData) => Promise<void>;
  kitchenPhotoAction: (formData: FormData) => Promise<void>;
  submitAction: (formData: FormData) => Promise<void>;
  returnTo: string;
}) {
  if (!profile) {
    return <EmptyState title="Verification unavailable" description="Seller verification is available only for seller organization owners and admins." />;
  }
  const badge = safeVerificationBadge(profile);
  const itemByRequirement = new Map(profile.items.map((item) => [item.requirementId ?? item.requirementType, item]));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Seller verification" title={title} description={description} />
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p><p className="mt-3"><Badge tone={profile.status === "verified" ? "success" : profile.status === "rejected" ? "danger" : "warning"}>{profile.status.replace(/_/g, " ")}</Badge></p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public badge</p><p className="mt-3"><SellerVerificationBadge label={badge.label} tone={badge.tone} /></p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Submitted items</p><p className="mt-3 text-3xl font-semibold">{profile.items.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Attestations</p><p className="mt-3 text-3xl font-semibold">{profile.attestations.length}</p></Card>
      </section>

      {profile.rejectionReason ? <Card className="border-red-200 bg-red-50 text-sm text-red-800">{profile.rejectionReason}</Card> : null}

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Requirements</h2>
        <div className="grid gap-4">
          {requirements.map((requirement) => {
            const item = itemByRequirement.get(requirement.id) ?? itemByRequirement.get(requirement.requirementType);
            const isKitchen = requirement.requirementType === "kitchen_photos";
            const isAttestation = requirement.requirementType === "platform_attestation" || requirement.requirementType === "background_check";
            const isFoodCertificate = requirement.requirementType === "food_handler_certificate";
            const isPermit = requirement.requirementType === "local_permit";
            return (
              <div key={requirement.id} className="rounded-3xl border border-[var(--color-border)] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--color-ink)]">{requirement.title}</h3>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">{requirement.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone={requirement.isRequired ? "warning" : "neutral"}>{requirement.isRequired ? "Required" : "Optional"}</Badge>
                      <Badge tone="info">{requirement.provider.replace(/_/g, " ")}</Badge>
                      {item ? <Badge tone={item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> : <Badge tone="neutral">Not started</Badge>}
                    </div>
                    {item?.rejectionReason ? <p className="mt-3 text-sm text-red-700">{item.rejectionReason}</p> : null}
                  </div>
                </div>
                {isFoodCertificate ? (
                  <form action={foodCertificateAction} className="mt-5 grid gap-4 md:grid-cols-3">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <DocumentUploadField label="Private certificate file" name="fileId" module="organizations" purpose="food_handler_certificate" visibility="private" entityType="food_safety_certificate" entityId={profile.id} />
                    <TextInput label="Provider name" name="providerName" placeholder="ServSafe, local agency, etc." />
                    <TextInput label="Certificate number (optional)" name="certificateNumber" />
                    <TextInput label="Issued date" name="issuedAt" type="date" />
                    <TextInput label="Expiration date" name="expiresAt" type="date" />
                    <TextInput label="Country" name="countryCode" defaultValue={profile.countryCode} maxLength={2} />
                    <TextInput label="Region/state" name="region" defaultValue={profile.region ?? ""} />
                    <TextArea label="Notes" name="notes" />
                    <div className="flex items-end"><Button type="submit">Submit certificate</Button></div>
                  </form>
                ) : isPermit ? (
                  <form action={permitAction} className="mt-5 grid gap-4 md:grid-cols-3">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <SelectInput label="Permit type" name="permitType" options={["food_establishment_permit", "cottage_food_registration", "business_license", "tax_registration", "health_department_permit", "other"].map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
                    <DocumentUploadField label="Private permit/license file" name="fileId" module="organizations" purpose="business_license_document" visibility="private" entityType="seller_permit" entityId={profile.id} />
                    <TextInput label="Issuing authority" name="issuingAuthority" />
                    <TextInput label="Permit number (optional)" name="permitNumber" />
                    <TextInput label="Issued date" name="issuedAt" type="date" />
                    <TextInput label="Expiration date" name="expiresAt" type="date" />
                    <div className="flex items-end"><Button type="submit">Submit permit</Button></div>
                  </form>
                ) : isKitchen ? (
                  <form action={kitchenPhotoAction} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <SelectInput label="Photo category" name="category" options={["cooking_area", "sink_sanitation", "refrigerator_storage", "dry_storage", "prep_surface", "packaging_area", "waste_trash_area", "pet_separation", "handwashing", "other"].map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
                    <ImageUploadField label="Private kitchen photo" name="fileId" module="home_catering" purpose="kitchen_photo" visibility="private" entityType="kitchen_safety_review" entityId={profile.id} />
                    <div className="flex items-end"><Button type="submit">Upload photo</Button></div>
                  </form>
                ) : isAttestation ? (
                  <form action={attestationAction} className="mt-5 space-y-4">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="attestationType" value={requirement.requirementType === "background_check" ? "background_check_consent" : "seller_terms"} />
                    <input type="hidden" name="version" value="v1" />
                    <TextArea label="Attestation text" name="textSnapshot" defaultValue={attestationText(requirement.requirementType)} />
                    <Button type="submit">Accept attestation</Button>
                  </form>
                ) : (
                  <form action={uploadAction} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="requirementId" value={requirement.id.startsWith("default-") ? "" : requirement.id} />
                    <input type="hidden" name="requirementType" value={requirement.requirementType} />
                    <DocumentUploadField label="Private verification document" name="documentFileId" module="organizations" purpose={purposeForRequirement(requirement.requirementType)} visibility="private" entityType="seller_verification_item" entityId={profile.id} />
                    <TextInput label="Expires at (optional)" name="expiresAt" type="date" />
                    <div className="flex items-end"><Button type="submit">{item?.status === "rejected" ? "Resubmit" : "Submit"}</Button></div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <SummaryCard title="Food certificates" rows={profile.foodSafetyCertificates.map((certificate) => `${certificate.providerName ?? "Certificate"} · ${certificate.status.replace(/_/g, " ")}${certificate.expiresAt ? ` · expires ${certificate.expiresAt.toLocaleDateString()}` : ""}`)} />
        <SummaryCard title="Permits and licenses" rows={profile.permits.map((permit) => `${permit.permitType.replace(/_/g, " ")} · ${permit.status.replace(/_/g, " ")}${permit.expiresAt ? ` · expires ${permit.expiresAt.toLocaleDateString()}` : ""}`)} />
        <SummaryCard title="Trial/taste test" rows={profile.trialReviews.map((trial) => `${trial.dishName ?? "Trial review"} · ${trial.status.replace(/_/g, " ")}${trial.scheduledAt ? ` · ${trial.scheduledAt.toLocaleDateString()}` : ""}`)} empty="No trial/taste test has been requested." />
      </section>

      <Card>
        <form action={submitAction} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div>
            <h2 className="font-semibold text-[var(--color-ink)]">Ready for admin review?</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Admins can review your submitted items. You cannot approve your own verification.</p>
          </div>
          <Button type="submit">Submit verification</Button>
        </form>
      </Card>
    </div>
  );
}

function SummaryCard({ title, rows, empty = "Nothing submitted yet." }: { title: string; rows: string[]; empty?: string }) {
  return (
    <Card>
      <h2 className="font-semibold text-[var(--color-ink)]">{title}</h2>
      <div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
        {rows.length ? rows.map((row) => <p key={row}>{row}</p>) : <p>{empty}</p>}
      </div>
    </Card>
  );
}

function purposeForRequirement(requirementType: SellerRequirementType) {
  if (requirementType === "food_handler_certificate") return "food_handler_certificate";
  if (requirementType === "local_permit" || requirementType === "business_info") return "business_license_document";
  if (requirementType === "background_check") return "background_check_consent";
  return "verification_document";
}

function attestationText(requirementType: SellerRequirementType) {
  if (requirementType === "background_check") {
    return "I authorize NizamKitchen to record my consent for a future background check provider workflow. I understand NizamKitchen does not store raw national identity numbers.";
  }
  return "I confirm that I am responsible for complying with applicable local food safety, licensing, tax, and seller requirements for my location.";
}
