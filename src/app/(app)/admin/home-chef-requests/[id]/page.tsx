import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  formatHomeChefResponseWindow,
  getAdminHomeChefRequest,
  getHomeChefAcceptancePolicyForRequest,
  getHomeChefPrivacyPolicyForRequest,
  HOME_CHEF_LEAD_TIME_LABELS,
} from "@/server/home-chef";
import {
  assignHomeChefRequestAction,
  createAdminHomeChefMessageAction,
  createHomeChefOfferAction,
  lockHomeChefBookingAction,
  revokeHomeChefAccessAction,
  triggerHomeChefCascadeAction,
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
  const [request, chefProfiles] = await Promise.all([
    getAdminHomeChefRequest(session, id).catch(() => null),
    prisma.chefProfile.findMany({
      where: { status: "active" },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, organizationId: true, countryCode: true, verificationStatus: true },
    }),
  ]);

  if (!request) notFound();
  const policy = await getHomeChefAcceptancePolicyForRequest(request);
  const privacyPolicy = await getHomeChefPrivacyPolicyForRequest(request);
  const canMutate = session.user.platformRole !== "auditor";
  const countryChefs = chefProfiles.filter((profile) => profile.countryCode === request.countryCode);

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
        <Badge tone="info">{HOME_CHEF_LEAD_TIME_LABELS[request.leadTimeCategory]}</Badge>
        <Badge tone="neutral">{request.matchingStatus.replace(/_/g, " ")}</Badge>
        <Badge tone={request.bookingLockStatus === "locked" ? "success" : request.bookingLockStatus === "revoked" ? "danger" : "neutral"}>
          {request.bookingLockStatus.replace(/_/g, " ")}
        </Badge>
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
              <Info label="Expected chef response" value={formatHomeChefResponseWindow(policy.acceptanceWindowMinutes)} />
              <Info label="Current deadline" value={request.acceptanceDeadlineAt?.toLocaleString()} />
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
              <h2 className="font-semibold text-[var(--color-ink)]">Privacy and logistics access</h2>
              <div className="grid gap-3 text-sm">
                <Info label="Exact address reveal" value={privacyPolicy?.revealExactAddressTrigger.replace(/_/g, " ") ?? "booking locked"} />
                <Info label="Customer name reveal" value={privacyPolicy?.revealCustomerNameTrigger.replace(/_/g, " ") ?? "booking locked"} />
                <Info label="Pre-acceptance messaging" value={privacyPolicy?.allowPreAcceptanceMessaging ? "Allowed anonymously" : "Disabled"} />
                <Info label="Phone/email policy" value={`Proxy ${privacyPolicy?.allowPhoneProxyAfterLock ? "enabled" : "disabled"} · real phone ${privacyPolicy?.allowRealPhoneReveal ? "allowed" : "hidden"} · email ${privacyPolicy?.allowEmailReveal ? "allowed" : "hidden"}`} />
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
                <p className="font-semibold text-[var(--color-ink)]">Access grants</p>
                {request.accessGrants.length === 0 ? (
                  <p className="mt-2">No chef access grants have been created.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {request.accessGrants.map((grant) => (
                      <p key={grant.id}>
                        {grant.grantType.replace(/_/g, " ")} · {grant.status}
                        {grant.revokedAt ? ` · revoked ${grant.revokedAt.toLocaleString()}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
                <p className="font-semibold text-[var(--color-ink)]">Contact proxy sessions</p>
                {request.contactProxySessions.length === 0 ? (
                  <p className="mt-2">No contact proxy sessions yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {request.contactProxySessions.map((proxy) => (
                      <p key={proxy.id}>
                        {proxy.provider.replace(/_/g, " ")} · {proxy.status} · expires {proxy.expiresAt.toLocaleString()}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <form action={lockHomeChefBookingAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <TextArea label="Lock reason" name="reason" defaultValue="Admin confirmed booking; payments are disabled or manually verified." />
                <Button type="submit" className="w-full justify-center">Lock booking and reveal logistics</Button>
              </form>
              <form action={revokeHomeChefAccessAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <TextArea label="Revoke reason" name="reason" defaultValue="Admin revoked access after cancellation, dispute, or reassignment." />
                <Button type="submit" variant="danger" className="w-full justify-center">Revoke logistics access</Button>
              </form>
            </Card>
          ) : null}

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
              <h2 className="font-semibold text-[var(--color-ink)]">Send chef offer</h2>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
                <p className="font-semibold text-[var(--color-ink)]">Policy window: {formatHomeChefResponseWindow(policy.acceptanceWindowMinutes)}</p>
                <p className="mt-1">
                  Cascade {policy.autoCascadeEnabled ? "enabled" : "disabled"} · max {policy.maxCascadeAttempts} attempts · {policy.cascadeDelayMinutes} minute delay
                </p>
              </div>
              <form action={createHomeChefOfferAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <SelectInput
                  label="Chef profile"
                  name="chefProfileId"
                  defaultValue={request.assignedChefProfileId ?? ""}
                  options={[
                    { value: "", label: "Choose a chef profile" },
                    ...countryChefs.map((profile) => ({
                      value: profile.id,
                      label: `${profile.displayName} (${profile.verificationStatus})`,
                    })),
                  ]}
                />
                <TextInput
                  label="Response window in minutes"
                  name="responseWindowMinutes"
                  type="number"
                  min={5}
                  defaultValue={policy.acceptanceWindowMinutes}
                />
                <TextInput label="Quote amount" name="quoteAmount" type="number" min={0} step="0.01" />
                <TextInput label="Currency" name="currencyCode" defaultValue={request.currencyCode} maxLength={3} />
                <TextArea label="Offer note" name="adminNotes" />
                <Button type="submit" variant="secondary" className="w-full justify-center">Send offer</Button>
              </form>
              <form action={triggerHomeChefCascadeAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <Button type="submit" variant="secondary" className="w-full justify-center">Trigger cascade</Button>
              </form>
            </Card>
          ) : null}

          {canMutate ? (
            <Card className="space-y-4">
              <h2 className="font-semibold text-[var(--color-ink)]">Legacy organization assignment</h2>
              <form action={assignHomeChefRequestAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <SelectInput
                  label="Chef organization"
                  name="assignedChefOrganizationId"
                  defaultValue={request.assignedChefOrganizationId ?? ""}
                  options={[
                    { value: "", label: "Unassigned" },
                    ...countryChefs.map((profile) => ({ value: profile.organizationId, label: profile.displayName })),
                  ]}
                />
                <TextArea label="Assignment note" name="note" />
                <Button type="submit" variant="secondary" className="w-full justify-center">Save assignment</Button>
              </form>
            </Card>
          ) : null}

          <Card className="space-y-4">
            <h2 className="font-semibold text-[var(--color-ink)]">Offer history</h2>
            {request.offers.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No chef offers have been sent yet.</p>
            ) : (
              request.offers.map((offer) => (
                <div key={offer.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--color-ink)]">{offer.chefProfile.displayName}</p>
                    <Badge tone={offer.status === "accepted" ? "success" : offer.status === "pending" ? "warning" : "neutral"}>
                      {offer.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Deadline: {offer.responseDeadlineAt.toLocaleString()} · type: {offer.offerType.replace(/_/g, " ")}
                  </p>
                  {offer.quoteAmount ? (
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      Quote: {offer.currencyCode ?? request.currencyCode} {offer.quoteAmount}
                    </p>
                  ) : null}
                  {offer.responseMessage ? (
                    <p className="mt-2 text-sm text-[var(--color-muted)]">{offer.responseMessage}</p>
                  ) : null}
                </div>
              ))
            )}
          </Card>

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
