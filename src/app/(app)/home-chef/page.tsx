import Link from "next/link";
import { CalendarDays, ChefHat, ClipboardList, PartyPopper, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessHomeChefs, isHouseholdRequestOrganization, listHomeChefRequests } from "@/server/home-chef";

export const dynamic = "force-dynamic";

const requestCards = [
  {
    title: "Request for a recipe",
    description: "Ask support to match a chef for one specific recipe.",
    href: "/home-chef/request?type=recipe",
    icon: ChefHat,
  },
  {
    title: "Request for a meal plan",
    description: "Use a full meal plan as the cooking brief.",
    href: "/home-chef/request?type=meal_plan",
    icon: CalendarDays,
  },
  {
    title: "Occasion cooking",
    description: "Plan for guests, family gatherings, Ramadan, Eid, or special events.",
    href: "/home-chef/request?type=occasion",
    icon: PartyPopper,
  },
  {
    title: "Daily or weekly cooking",
    description: "Send a manual request for recurring household cooking help.",
    href: "/home-chef/request?type=weekly_cooking",
    icon: UtensilsCrossed,
  },
];

export default async function HomeChefPage() {
  const session = await requireMembership();
  const enabled = await canAccessHomeChefs({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  const isHousehold = isHouseholdRequestOrganization(session.activeOrganization.organizationType);

  if (!enabled) {
    return (
      <EmptyState
        title="Home chef requests are coming soon"
        description="This organization does not have the home chef request MVP enabled yet."
      />
    );
  }

  if (!isHousehold) {
    return (
      <EmptyState
        title="Household feature"
        description="Home chef requests are currently available only for household organizations."
      />
    );
  }

  const requests = await listHomeChefRequests(session.activeOrganization.id);
  const openRequests = requests.filter((request) => !["cancelled", "completed", "declined"].includes(request.status));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Plan → chef request"
        title="Home chef requests"
        description="Manual MVP requests for recipe, meal-plan, occasion, daily, weekly, or custom cooking support. No marketplace or payments yet."
        actions={
          <>
            <Button asChild>
              <Link href="/home-chef/request">New request</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/chefs">Browse chefs</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/home-chef/requests">View requests</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {requestCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="block">
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 font-semibold text-[var(--color-ink)]">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{card.description}</p>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Request queue
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Recent requests</h2>
            </div>
            <Badge tone="info">{openRequests.length} open</Badge>
          </div>

          {requests.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No requests yet"
                description="Start with a recipe, meal plan, occasion, or custom request."
                action={
                  <Button asChild>
                    <Link href="/home-chef/request">Create first request</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {requests.slice(0, 5).map((request) => (
                <Link
                  key={request.id}
                  href={`/home-chef/requests/${request.id}`}
                  className="block rounded-2xl border border-[var(--color-border)] p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">{request.title}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {request.requestType.replace(/_/g, " ")} · {request.requestedDate.toLocaleDateString()}
                      </p>
                    </div>
                    <Badge tone={request.status === "submitted" || request.status === "reviewing" ? "warning" : "neutral"}>
                      {request.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--color-ink)]">Manual MVP</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">Requests go to platform support for review and manual matching.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-[var(--color-muted)]">
            <p>No automated booking yet.</p>
            <p>No chef marketplace yet.</p>
            <p>No payments yet.</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
