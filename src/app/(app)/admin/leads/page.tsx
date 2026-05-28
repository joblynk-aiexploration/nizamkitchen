import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listContactLeads } from "@/server/leads";

export const dynamic = "force-dynamic";

const statusTone = {
  new: "info",
  contacted: "warning",
  converted: "success",
  spam: "danger",
} as const;

async function markLead(formData: FormData) {
  "use server";
  const { requirePlatformRole: rpr } = await import("@/lib/auth/session");
  const { updateLeadStatus: uls } = await import("@/server/leads");
  const session = await rpr(["platform_owner", "platform_admin", "support_admin"]);
  const id = formData.get("id") as string;
  const status = formData.get("status") as string;
  if (id && status) await uls(session, id, status);
}

export default async function AdminLeadsPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);

  const leads = await listContactLeads(session);

  const byStatus = {
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    converted: leads.filter((l) => l.status === "converted").length,
    spam: leads.filter((l) => l.status === "spam").length,
  };

  return (
    <AdminShell
      session={session}
      title="Contact leads"
      description="Inbound enquiries from the public contact form."
    >
      {/* Metrics */}
      <section className="grid gap-4 sm:grid-cols-4">
        {Object.entries(byStatus).map(([status, count]) => (
          <Card key={status}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              {status}
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{count}</p>
          </Card>
        ))}
      </section>

      {/* Leads table */}
      <Card>
        <div className="divide-y divide-[var(--color-border)]">
          {leads.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-muted)]">No leads yet.</p>
          )}
          {leads.map((lead) => (
            <div key={lead.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--color-ink)]">{lead.name}</p>
                    <Badge tone={statusTone[lead.status as keyof typeof statusTone] ?? "neutral"}>
                      {lead.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--color-muted)]">{lead.email}</p>
                  {(lead.organizationType || lead.countryCode) && (
                    <p className="text-xs text-[var(--color-muted)]">
                      {[lead.organizationType, lead.countryCode].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-[var(--color-ink)]">
                {lead.message}
              </p>

              {/* Status actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {(["new", "contacted", "converted", "spam"] as const)
                  .filter((s) => s !== lead.status)
                  .map((s) => (
                    <form key={s} action={markLead}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="status" value={s} />
                      <button
                        type="submit"
                        className="rounded-xl border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-ink)]"
                      >
                        Mark {s}
                      </button>
                    </form>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
