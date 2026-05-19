import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminVerificationProfiles } from "@/server/seller-verifications";

export const dynamic = "force-dynamic";

export default async function AdminVerificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [session, params] = await Promise.all([
    requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]),
    searchParams,
  ]);
  const profiles = await listAdminVerificationProfiles(session, params);
  const pending = profiles.filter((profile) => ["submitted", "under_review"].includes(profile.status)).length;
  const verified = profiles.filter((profile) => profile.status === "verified").length;
  const rejected = profiles.filter((profile) => profile.status === "rejected").length;

  return (
    <AdminShell session={session} title="Seller verifications" description="Review KYC, compliance documents, attestations, kitchen photos, background status, and payout readiness.">
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Profiles" value={profiles.length} />
        <Metric label="Pending review" value={pending} />
        <Metric label="Verified" value={verified} />
        <Metric label="Rejected" value={rejected} />
      </section>
      <Card className="flex flex-col gap-3 md:flex-row">
        <Button asChild><Link href="/admin/verifications/requirements">Configure requirements</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/verifications/background-checks">Background checks</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/verifications/kitchen-reviews">Kitchen reviews</Link></Button>
      </Card>
      <AdminDataTable
        data={profiles}
        emptyMessage="No seller verification profiles yet."
        columns={[
          { key: "seller", header: "Seller", render: (profile) => <Link className="font-semibold text-[var(--color-primary)]" href={`/admin/verifications/${profile.id}`}>{profile.organization.name}</Link> },
          { key: "type", header: "Seller type", render: (profile) => profile.sellerType.replace(/_/g, " ") },
          { key: "country", header: "Country", render: (profile) => profile.countryCode },
          { key: "status", header: "Status", render: (profile) => <Badge tone={profile.status === "verified" ? "success" : profile.status === "rejected" ? "danger" : "warning"}>{profile.status.replace(/_/g, " ")}</Badge> },
          { key: "level", header: "Level", render: (profile) => profile.verificationLevel.replace(/_/g, " ") },
          { key: "items", header: "Items", render: (profile) => profile.items.length },
        ]}
      />
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{value}</p></Card>;
}
