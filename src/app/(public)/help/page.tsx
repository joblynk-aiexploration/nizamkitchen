import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-16">
      <PageHeader
        eyebrow="Help center"
        title="How can we help?"
        description="Quick guidance for households, chefs, catering sellers, restaurants, payments, verification, and account support."
        actions={<Button asChild><Link href="/support">Contact support</Link></Button>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Households", "Meal plans, recipes, grocery lists, food order requests, and privacy controls."],
          ["Sellers", "Profiles, menus, verification, payouts, storage uploads, and order management."],
          ["Platform", "Payments, legal documents, API setup, storage, notifications, and security."],
        ].map(([title, description]) => (
          <Card key={title}>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
