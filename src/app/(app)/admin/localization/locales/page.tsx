import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT, TIME_FORMAT_OPTIONS } from "@/lib/date-time-formats";
import { listLocalizationDashboard } from "@/server/localization/localization-service";
import { saveLocaleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LocalizationLocalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const data = await listLocalizationDashboard(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Locales" description="Enable languages, control RTL behavior, and configure default date/time/number formatting.">
      {params.message ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{params.message}</Card> : null}

      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add or update locale</h2>
          <form action={saveLocaleAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <TextInput label="Locale code" name="localeCode" placeholder="en-US" required />
            <TextInput label="Language name" name="languageName" placeholder="English (United States)" required />
            <TextInput label="Native name" name="nativeName" placeholder="English" required />
            <SelectInput label="Date format" name="dateFormat" defaultValue={DEFAULT_DATE_FORMAT} options={[...DATE_FORMAT_OPTIONS]} required />
            <SelectInput label="Time format" name="timeFormat" defaultValue={DEFAULT_TIME_FORMAT} options={[...TIME_FORMAT_OPTIONS]} required />
            <TextInput label="Number format" name="numberFormat" placeholder="en-US" required />
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Direction
              <select name="textDirection" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="ltr">Left-to-right</option>
                <option value="rtl">Right-to-left</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Status
              <select name="status" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-slate-50 px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
              <input type="checkbox" name="isDefault" />
              Default locale
            </label>
            <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] md:col-span-3">
              Save locale
            </button>
          </form>
        </Card>
      ) : null}

      <AdminDataTable
        data={data.locales}
        emptyMessage="No locales configured yet."
        columns={[
          { key: "locale", header: "Locale", render: (locale) => <div><p className="font-semibold">{locale.localeCode}</p><p className="text-sm text-[var(--text-secondary)]">{locale.languageName}</p></div> },
          { key: "native", header: "Native name", render: (locale) => locale.nativeName },
          { key: "direction", header: "Direction", render: (locale) => <Badge tone={locale.textDirection === "rtl" ? "warning" : "info"}>{locale.textDirection.toUpperCase()}</Badge> },
          { key: "formats", header: "Formats", render: (locale) => <span className="text-sm">{locale.dateFormat} · {locale.timeFormat}</span> },
          { key: "status", header: "Status", render: (locale) => <Badge tone={locale.status === "active" ? "success" : "neutral"}>{locale.status}</Badge> },
        ]}
      />
    </AdminShell>
  );
}
