import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getStorageUsageDashboard } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function AdminDropboxPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "country_manager"]);
  const dashboard = await getStorageUsageDashboard(session);
  return (
    <AdminShell session={session} title="Admin Dropbox" description="Internal S3-backed file manager for platform images, documents, support files, and verification uploads.">
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Total files" value={dashboard.totalFiles.toString()} />
        <Metric label="Storage used" value={formatBytes(dashboard.totalBytes)} />
        <Metric label="Archived" value={dashboard.archivedFiles.toString()} />
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Storage health</p><p className="mt-3"><Badge tone={dashboard.storageHealth === "success" ? "success" : "warning"}>{dashboard.storageConfigured ? dashboard.storageHealth : "not_configured"}</Badge></p></Card>
      </section>
      <Card className="flex flex-col gap-3 md:flex-row">
        <Button asChild><Link href="/admin/dropbox/files">Browse files</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/dropbox/uploads">Upload file</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/dropbox/folders">Virtual folders</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/dropbox/settings">Settings</Link></Button>
      </Card>
      <section className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="Files by module" data={dashboard.byModule} />
        <Breakdown title="Files by MIME type" data={dashboard.byMimeType} />
        <Breakdown title="Files by organization" data={dashboard.byOrganization} />
      </section>
      <AdminDataTable
        data={dashboard.recentUploads}
        emptyMessage="No uploads yet."
        columns={[
          { key: "file", header: "File", render: (file) => <Link className="font-semibold text-[var(--color-primary)]" href={`/admin/dropbox/files/${file.id}`}>{file.originalFilename}</Link> },
          { key: "module", header: "Module", render: (file) => file.module },
          { key: "purpose", header: "Purpose", render: (file) => file.purpose },
          { key: "status", header: "Status", render: (file) => <Badge tone={file.status === "active" ? "success" : file.status === "deleted" ? "danger" : "warning"}>{file.status}</Badge> },
        ]}
      />
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p></Card>;
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  return <Card><h2 className="font-semibold text-[var(--color-ink)]">{title}</h2><div className="mt-4 space-y-2 text-sm">{Object.entries(data).slice(0, 8).map(([key, value]) => <div key={key} className="flex justify-between gap-4"><span className="truncate">{key}</span><strong>{value}</strong></div>)}</div></Card>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
