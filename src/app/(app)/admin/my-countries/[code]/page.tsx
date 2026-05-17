import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { CountryBadge } from "@/components/ui/country-badge";
import { getAdminCountryDetail } from "@/server/admin/countries";

export default async function MyCountryDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
  ]);
  const { code } = await params;
  const { country } = await getAdminCountryDetail(session, code);

  return (
    <AdminShell
      session={session}
      title={`Country scope: ${country.countryName}`}
      description="A focused country-manager view of assigned market settings, organizations, and audit-aware operational scope."
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/my-countries">Back to my countries</Link>
        </Button>
      }
    >
      <div className="rounded-3xl border border-[var(--color-border)] bg-white p-6">
        <CountryBadge countryCode={country.countryCode} countryName={country.countryName} />
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          This route intentionally reuses server-side country scoping so country managers cannot jump outside their assigned markets.
        </p>
      </div>
    </AdminShell>
  );
}
