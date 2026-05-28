import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import {
  canAccessHomeCatering,
  getHomeCateringProfileForOrganization,
  isHomeCateringBusiness,
} from "@/server/home-catering";
import { getSellerDashboardVerificationSummary } from "@/server/seller-verification-gates";
import { pauseHomeCateringProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CateringDashboardPage() {
  const session = await requireMembership();
  const enabled = await canAccessHomeCatering({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled || !isHomeCateringBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Home catering coming soon" description="Home catering seller tools are available only for enabled home catering organizations." />;
  }

  const [profile, gateSummary] = await Promise.all([
    getHomeCateringProfileForOrganization(session.activeOrganization.id),
    getSellerDashboardVerificationSummary({
      organizationId: session.activeOrganization.id,
      sellerType: "home_catering",
      countryCode: session.activeOrganization.countryCode,
    }),
  ]);
  const completion = profile
    ? [
        profile.displayName,
        profile.bio,
        profile.city,
        Array.isArray(profile.cuisineSpecialtiesJson) && profile.cuisineSpecialtiesJson.length > 0,
        profile.acceptsPickup || profile.acceptsDelivery || profile.acceptsPreorders,
      ].filter(Boolean).length * 20
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home catering"
        title="Seller workspace"
        description="Set up a profile for prepared dishes sold from your home or small kitchen. Menu and order requests are coming later."
        actions={
          <Button asChild>
            <Link href="/catering/profile">{profile ? "Edit profile" : "Create profile"}</Link>
          </Button>
        }
      />

      {!profile ? (
        <EmptyState
          title="No home catering profile yet"
          description="Create a seller profile and submit it for admin review before households can discover you."
          action={<Button asChild><Link href="/catering/profile/setup">Set up profile</Link></Button>}
        />
      ) : (
        <>
          <VerificationGateAlert summary={gateSummary} />
          <section className="grid gap-4 md:grid-cols-5">
            <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Completion</p><p className="mt-3 text-3xl font-semibold">{completion}%</p></Card>
            <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p><div className="mt-3"><Badge tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge></div></Card>
            <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification</p><div className="mt-3"><Badge tone={profile.verificationStatus === "verified" ? "success" : "warning"}>{profile.verificationStatus}</Badge></div></Card>
            <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Menu items</p><p className="mt-3 text-3xl font-semibold">0</p><p className="text-xs text-[var(--color-muted)]">Placeholder</p></Card>
            <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Open orders</p><p className="mt-3 text-3xl font-semibold">0</p><p className="text-xs text-[var(--color-muted)]">Coming later</p></Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-4">
            <Card>
              <h2 className="font-semibold text-[var(--color-ink)]">Edit profile</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Manage city-level service area, specialties, pickup, delivery, and preorder settings.</p>
              <Button asChild variant="secondary" className="mt-5"><Link href="/catering/profile">Edit profile</Link></Button>
            </Card>
            <Card>
              <h2 className="font-semibold text-[var(--color-ink)]">Add menu item</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Menu management is planned next. Profiles come first so admins can verify sellers.</p>
              <Button asChild variant="secondary" className="mt-5"><Link href="/catering/menu-items/new">Add menu item</Link></Button>
            </Card>
            <Card>
              <h2 className="font-semibold text-[var(--color-ink)]">View orders</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Review manual customer order requests. No checkout or payment collection is connected.</p>
              <Button asChild variant="secondary" className="mt-5"><Link href="/catering/orders">View orders</Link></Button>
            </Card>
            <Card>
              <h2 className="font-semibold text-[var(--color-ink)]">Pause profile</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Pausing hides your public seller profile from the caterer marketplace.</p>
              <form action={pauseHomeCateringProfileAction} className="mt-5">
                <input type="hidden" name="paused" value={profile.status === "paused" ? "false" : "true"} />
                <Button variant="secondary">{profile.status === "paused" ? "Unpause" : "Pause profile"}</Button>
              </form>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function VerificationGateAlert({ summary }: { summary: { missingRequirements: string[]; blockedCapabilities: string[]; policyName: string | null; overrideActive: boolean } }) {
  if (summary.missingRequirements.length === 0 && summary.blockedCapabilities.length === 0) return null;
  return (
    <Card className="border-amber-200 bg-amber-50">
      <h2 className="font-semibold text-amber-950">Verification checklist</h2>
      <p className="mt-2 text-sm text-amber-900">Policy: {summary.policyName ?? "No active marketplace gate policy"}. {summary.overrideActive ? "A temporary admin override is active." : "Complete the next steps to unlock marketplace capabilities."}</p>
      {summary.blockedCapabilities.length ? <p className="mt-3 text-sm text-amber-900">Blocked: {summary.blockedCapabilities.map((item) => item.replace(/_/g, " ")).join(", ")}.</p> : null}
      {summary.missingRequirements.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">{summary.missingRequirements.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      <Button asChild variant="secondary" className="mt-4"><Link href="/catering/verification">Open verification</Link></Button>
    </Card>
  );
}
