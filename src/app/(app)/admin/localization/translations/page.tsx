import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listLocalizationDashboard } from "@/server/localization/localization-service";
import { saveTranslationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LocalizationTranslationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const data = await listLocalizationDashboard(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Translations" description="Manage namespace-based UI strings for enabled locales.">
      {params.message ? <Card className="border-emerald-200 bg-emerald-50 text-sm text-emerald-800">{params.message}</Card> : null}

      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add or update translation</h2>
          <form action={saveTranslationAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Locale
              <select name="localeCode" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                {data.locales.map((locale) => <option key={locale.localeCode} value={locale.localeCode}>{locale.localeCode}</option>)}
              </select>
            </label>
            <TextInput label="Namespace" name="namespace" placeholder="common" required />
            <TextInput label="Key" name="translationKey" placeholder="nav.startBeta" required />
            <TextArea label="Default value" name="defaultValue" className="md:col-span-3" required />
            <TextArea label="Translated value" name="translatedValue" className="md:col-span-3" required />
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
              Status
              <select name="status" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)] md:col-span-3">
              Save translation
            </button>
          </form>
        </Card>
      ) : null}

      <AdminDataTable
        data={data.translations}
        emptyMessage="No translation strings configured yet."
        columns={[
          { key: "key", header: "Key", render: (row) => <div><p className="font-semibold">{row.namespace}.{row.translationKey}</p><p className="text-sm text-[var(--text-secondary)]">{row.localeCode}</p></div> },
          { key: "default", header: "Default", render: (row) => <span className="text-sm">{row.defaultValue}</span> },
          { key: "translated", header: "Translated", render: (row) => <span className="text-sm">{row.translatedValue}</span> },
          { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "published" ? "success" : row.status === "draft" ? "warning" : "neutral"}>{row.status}</Badge> },
        ]}
      />
    </AdminShell>
  );
}
