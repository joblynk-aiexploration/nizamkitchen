import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSocialLinks } from "@/components/business-social-links/social-link-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { requirePlatformRole } from "@/lib/auth/session";
import { listBusinessSocialLinks } from "@/server/business-social-links";
import { getAdminChefProfile } from "@/server/chefs";
import { moderateDeleteBusinessSocialLinkAction } from "../../business-social-links/actions";
import { updateAdminChefProfileAction, updateAdminChefReviewAction } from "../actions";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "suspended", label: "Suspended" },
  { value: "disabled", label: "Disabled" },
];

const verificationOptions = [
  { value: "unverified", label: "Unverified" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

export default async function AdminChefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const profile = await getAdminChefProfile(session, id).catch(() => null);
  if (!profile) notFound();
  const socialLinks = await listBusinessSocialLinks(profile.organizationId);
  const canMutate = session.user.platformRole !== "auditor";

  return (
    <AdminShell session={session} title={profile.displayName} description={`${profile.organization.name} · ${profile.countryCode}`}>
      <div className="flex flex-wrap gap-2">
        <Badge tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge>
        <Badge tone={profile.verificationStatus === "verified" ? "success" : "warning"}>{profile.verificationStatus}</Badge>
        <Badge tone={profile.isPublic ? "success" : "neutral"}>{profile.isPublic ? "Public" : "Hidden"}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Profile</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{profile.bio}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Info label="Base city" value={profile.baseCity} />
              <Info label="Region" value={profile.baseRegion} />
              <Info label="Years experience" value={profile.yearsExperience?.toString()} />
              <Info label="Service radius" value={profile.serviceRadiusKm ? `${profile.serviceRadiusKm} km` : null} />
              <Info label="Phone" value={profile.phone} />
              <Info label="Email" value={profile.email} />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Services</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {profile.services.map((service) => (
                <div key={service.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                  <p className="font-semibold text-[var(--color-ink)]">{service.name}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">{service.serviceType.replace(/_/g, " ")}</p>
                  <p className="mt-2 text-sm">{service.basePriceAmount ? `${service.basePriceAmount} ${service.currencyCode}` : "Price TBD"}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Reviews</h2>
            <div className="mt-5 space-y-3">
              {profile.reviews.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No reviews yet.</p> : null}
              {profile.reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{review.rating}/5</p>
                    <Badge tone={review.status === "published" ? "success" : "warning"}>{review.status}</Badge>
                  </div>
                  {review.comment ? <p className="mt-2 text-sm text-[var(--color-muted)]">{review.comment}</p> : null}
                  {canMutate ? (
                    <form action={updateAdminChefReviewAction} className="mt-3 flex gap-2">
                      <input type="hidden" name="chefProfileId" value={profile.id} />
                      <input type="hidden" name="reviewId" value={review.id} />
                      <select name="status" defaultValue={review.status} className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
                        <option value="pending">Pending</option>
                        <option value="published">Published</option>
                        <option value="hidden">Hidden</option>
                      </select>
                      <Button type="submit" variant="secondary">Update</Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <AdminSocialLinks links={socialLinks} deleteAction={moderateDeleteBusinessSocialLinkAction} />
        </div>

        <div className="space-y-6">
          {canMutate ? (
            <Card className="space-y-4">
              <h2 className="font-semibold text-[var(--color-ink)]">Admin controls</h2>
              <form action={updateAdminChefProfileAction} className="space-y-3">
                <input type="hidden" name="chefProfileId" value={profile.id} />
                <SelectInput label="Status" name="status" defaultValue={profile.status} options={statusOptions} />
                <SelectInput label="Verification" name="verificationStatus" defaultValue={profile.verificationStatus} options={verificationOptions} />
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input type="checkbox" name="isPublic" defaultChecked={profile.isPublic} />
                  Public listing
                </label>
                <TextArea label="Admin notes" name="adminNotes" />
                <Button type="submit" className="w-full justify-center">Save controls</Button>
              </form>
            </Card>
          ) : null}

          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Verification documents</h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">Document upload workflow is placeholder-only in this version.</p>
            <div className="mt-4 space-y-2">
              {profile.verificationDocuments.map((doc) => (
                <div key={doc.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                  {doc.documentType} · {doc.status}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{value || "Not provided"}</p>
    </div>
  );
}
