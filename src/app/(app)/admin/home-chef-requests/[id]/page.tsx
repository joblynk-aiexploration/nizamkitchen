import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAdminHomeChefRequest } from "@/server/home-chef";
import {
  assignHomeChefRequestAction,
  createAdminHomeChefMessageAction,
  updateAdminHomeChefStatusAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "submitted", label: "Submitted" },
  { value: "reviewing", label: "Reviewing" },
  { value: "matched", label: "Matched" },
  { value: "quoted", label: "Quoted" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

export default async function AdminHomeChefRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const { id } = await params;
  const [request, chefOrganizations] = await Promise.all([
    getAdminHomeChefRequest(session, id).catch(() => null),
    prisma.organization.findMany({
      where: { organizationType: "chef_business" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, countryCode: true },
    }),
  ]);

  if (!request) notFound();
  const canMutate = session.user.platformRole !== "auditor";
  const countryChefs = chefOrganizations.filter((organization) => organization.countryCode === request.countryCode);

  return (
    <AdminShell
      session={session}
      title={request.title}
      description={`${request.organization.name} · ${request.requestType.replace(/_/g, " ")} · ${request.countryCode}`}
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/home-chef-requests">All requests</Link>
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <Badge tone="warning">{request.status}</Badge>
        <Badge tone="info">{request.countryCode}</Badge>
        <Badge tone="neutral">{request.guestCount} guests</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Household request</h2>
            <p className="text-sm leading-6 text-[var(--color-muted)]">{request.description ?? "No description provided."}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Household" value={request.organization.name} />
              <Info label="Created by" value={`${request.createdBy.fullName} (${request.createdBy.email})`} />
              <Info label="Requested date" value={request.requestedDate.toLocaleDateString()} />
              <Info label="Time window" value={request.requestedTimeWindow} />
              <Info label="Phone" value={request.phone} />
              <Info label="City" value={request.city} />
              <Info label="Budget" value={request.budgetAmount ? `${request.budgetAmount} ${request.budgetCurrency}` : null} />
              <Info label="Gender preference" value={request.genderPreference.replace(/_/g, " ")} />
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Linked context</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {request.recipe ? (
                <Link href={`/admin/recipe-library/${request.recipe.id}`} className="rounded-2xl border border-[var(--color-border)] p-4 hover:bg-slate-50">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recipe</p>
                  <p className="mt-2 font-semibold text-[var(--color-ink)]">{request.recipe.name}</p>
                </Link>
              ) : null}
              {request.mealPlan ? (
                <div className="rounded-2xl border border-[var(--color-border)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Meal plan</p>
                  <p className="mt-2 font-semibold text-[var(--color-ink)]">{request.mealPlan.name}</p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {request.mealPlan.days.reduce((sum, day) => sum + day.entries.length, 0)} planned meals
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Messages</h2>
            <div className="space-y-3">
              {request.messages.map((message) => (
                <div key={message.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-ink)]">{message.senderUser.fullName}</p>
                    <div className="flex gap-2">
                      <Badge tone={message.isInternal ? "warning" : "info"}>
                        {message.isInternal ? "internal" : message.senderRole}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{message.message}</p>
                </div>
              ))}
            </div>
            {canMutate ? (
              <form action={createAdminHomeChefMessageAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <TextArea label="Message" name="message" required />
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input type="checkbox" name="isInternal" />
                  Internal note only
                </label>
                <Button type="submit">Add message</Button>
              </form>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          {canMutate ? (
            <Card className="space-y-4">
              <h2 className="font-semibold text-[var(--color-ink)]">Status controls</h2>
              <form action={updateAdminHomeChefStatusAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <SelectInput label="Status" name="status" defaultValue={request.status} options={statusOptions} />
                <TextArea label="Admin note" name="note" defaultValue={request.adminNotes ?? ""} />
                <Button type="submit" className="w-full justify-center">Update status</Button>
              </form>
            </Card>
          ) : null}

          {canMutate ? (
            <Card className="space-y-4">
              <h2 className="font-semibold text-[var(--color-ink)]">Assign chef placeholder</h2>
              <form action={assignHomeChefRequestAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <SelectInput
                  label="Chef organization"
                  name="assignedChefOrganizationId"
                  defaultValue={request.assignedChefOrganizationId ?? ""}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...countryChefs.map((org) => ({ value: org.id, label: org.name })),
                  ]}
                />
                <TextArea label="Assignment note" name="note" />
                <Button type="submit" variant="secondary" className="w-full justify-center">Save assignment</Button>
              </form>
            </Card>
          ) : null}

          <Card className="space-y-4">
            <h2 className="font-semibold text-[var(--color-ink)]">Status history</h2>
            {request.statusHistory.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <Badge tone="neutral">{item.newStatus}</Badge>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  {item.createdAt.toLocaleString()} by {item.changedBy.fullName}
                </p>
                {item.note ? <p className="mt-2 text-sm text-[var(--color-muted)]">{item.note}</p> : null}
              </div>
            ))}
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
