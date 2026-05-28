import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Beta support"
        title="Send feedback to NizamKitchen"
        description="Report bugs, ask for account help, or share feature requests directly with the platform team."
        actions={
          <Button asChild>
            <Link href="/support/new">New ticket</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Bug reports</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Tell us what broke, where it happened, and what you expected.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Feature requests</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Share ideas that would make your planning, cooking, or operations easier.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Account help</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Ask for help with access, organization setup, or beta onboarding.</p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Already sent something?</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Track status and reply to support from your ticket list.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/support/tickets">View my tickets</Link>
        </Button>
      </Card>
    </div>
  );
}
