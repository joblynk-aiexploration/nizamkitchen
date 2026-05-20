import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, getChefProfileForOrganization, isChefBusiness } from "@/server/chefs";
import { getSellerDashboardVerificationSummary } from "@/server/seller-verification-gates";
import { pauseChefProfileAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ChefDashboardPage() {
  const session = await requireMembership();
  const enabled = await canAccessChefMarketplace({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  if (!enabled || !isChefBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Chef marketplace unavailable" description="Chef tools are available only for enabled chef business organizations." />;
  }

  const [profile, gateSummary] = await Promise.all([
    getChefProfileForOrganization(session.activeOrganization.id),
    getSellerDashboardVerificationSummary({
      organizationId: session.activeOrganization.id,
      sellerType: "chef_business",
      countryCode: session.activeOrganization.countryCode,
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Chef business"
        title="Chef marketplace workspace"
        description="Create your profile, add services, set availability, and review assigned requests. Admin approval is required before public listing."
        actions={
          <Button asChild>
            <Link href="/chef/profile">{profile ? "Edit profile" : "Create profile"}</Link>
          </Button>
        }
      />

      {!profile ? (
        <EmptyState
          title="No chef profile yet"
          description="Create a profile and submit it for admin review before households can find you."
          action={<Button asChild><Link href="/chef/profile">Create chef profile</Link></Button>}
        />
      ) : (
        <>
          <VerificationGateAlert summary={gateSummary} />
          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile status</p>
              <div className="mt-3"><Badge tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge></div>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification</p>
              <div className="mt-3"><Badge tone={profile.verificationStatus === "verified" ? "success" : "warning"}>{profile.verificationStatus}</Badge></div>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Services</p>
              <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{profile.services.length}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public listing</p>
              <p className="mt-3 text-sm font-semibold text-[var(--color-ink)]">{profile.isPublic ? "Visible" : "Hidden"}</p>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <Card>
              <h2 className="font-semibold text-[var(--color-ink)]">Profile</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Update bio, service area, languages, and specialties.</p>
              <Button asChild variant="secondary" className="mt-5"><Link href="/chef/profile">Manage profile</Link></Button>
            </Card>
            <Card>
              <h2 className="font-semibold text-[var(--color-ink)]">Services</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Add pricing placeholders for daily cooking, meal prep, occasions, and custom work.</p>
              <Button asChild variant="secondary" className="mt-5"><Link href="/chef/services">Manage services</Link></Button>
            </Card>
            <Card>
              <h2 className="font-semibold text-[var(--color-ink)]">Availability</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Set rough weekly availability. Live scheduling is not built yet.</p>
              <Button asChild variant="secondary" className="mt-5"><Link href="/chef/availability">Manage availability</Link></Button>
            </Card>
          </section>

          <Card className="space-y-3">
            <h2 className="font-semibold text-[var(--color-ink)]">Pause profile</h2>
            <p className="text-sm text-[var(--color-muted)]">Pausing hides your public profile. Re-activating still depends on admin approval and verification.</p>
            <form action={pauseChefProfileAction}>
              <input type="hidden" name="paused" value={profile.status === "paused" ? "false" : "true"} />
              <Button variant="secondary">{profile.status === "paused" ? "Unpause profile" : "Pause profile"}</Button>
            </form>
          </Card>
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
      <Button asChild variant="secondary" className="mt-4"><Link href="/chef/verification">Open verification</Link></Button>
    </Card>
  );
}
