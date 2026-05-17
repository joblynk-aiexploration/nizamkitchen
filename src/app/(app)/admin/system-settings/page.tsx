import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAdminSystemSettings } from "@/server/admin/system-settings";

export const dynamic = "force-dynamic";

export default async function AdminSystemSettingsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const settings = await listAdminSystemSettings();

  return (
    <AdminShell
      session={session}
      title="System settings"
      description="Control platform-wide defaults and operational switches without blending them into organization administration."
    >
      <div className="grid gap-4">
        {settings.map((setting) => (
          <Card key={setting.key}>
            <form action="/api/admin/system-settings" method="post" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)_auto] lg:items-end">
              <input type="hidden" name="key" value={setting.key} />
              <input type="hidden" name="description" value={setting.description} />
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">{setting.label}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{setting.description}</p>
              </div>
              <input
                name="value"
                defaultValue={setting.value}
                className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
              />
              <Button type="submit">Save</Button>
            </form>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
