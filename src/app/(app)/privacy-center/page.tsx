import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getUserPrivacyCenterData } from "@/server/privacy/privacy-service";

export const dynamic = "force-dynamic";

const sections = [
  { href: "/privacy-center/data", title: "Review my data", description: "Profile, memberships, orders, files, legal acceptances, and summaries." },
  { href: "/privacy-center/activity", title: "Activity controls", description: "Review recent account activity and clear activity entries that are safe to remove." },
  { href: "/privacy-center/download", title: "Download my data", description: "Request a private JSON export for admin review and generation." },
  { href: "/privacy-center/delete", title: "Deletion requests", description: "Request account deletion, anonymization, correction, or file deletion review." },
  { href: "/privacy-center/settings", title: "Privacy settings", description: "Manage profile visibility, analytics consent, emails, and recommendations." },
];

export default async function PrivacyCenterPage() {
  const session = await requireMembership();
  const data = await getUserPrivacyCenterData(session);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy center"
        title="Your data and privacy controls"
        description="Review your NizamKitchen data, manage privacy preferences, and request exports or deletion review."
        actions={<Button asChild><Link href="/privacy-center/download">Request export</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Memberships</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{data.memberships.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Orders</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{data.foodOrders.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Files</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{data.storageFiles.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Activity</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{data.userActivities.length + data.auditEntries.length}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.href} className="flex flex-col justify-between gap-5">
            <div>
              <h2 className="font-semibold text-[var(--color-ink)]">{section.title}</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{section.description}</p>
            </div>
            <Button asChild variant="secondary" className="self-start">
              <Link href={section.href}>Open</Link>
            </Button>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Protected records</h2>
        <div className="mt-3 grid gap-2 text-sm text-[var(--color-muted)]">
          {data.protectedDataNotice.map((notice) => (
            <p key={notice}>{notice}</p>
          ))}
        </div>
      </Card>
    </div>
  );
}
