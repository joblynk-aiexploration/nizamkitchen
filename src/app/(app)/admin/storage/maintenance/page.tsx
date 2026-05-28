import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getStorageMaintenanceReport } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function StorageMaintenancePage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor", "country_manager"]);
  const [params, report] = await Promise.all([searchParams, getStorageMaintenanceReport(session)]);
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title="Storage maintenance" description="Production-safe cleanup reports for S3 metadata, private files, and storage usage.">
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Total files" value={report.totalFiles} />
        <Metric label="Active" value={report.activeFiles} />
        <Metric label="Archived" value={report.archivedFiles} />
        <Metric label="Deleted" value={report.deletedFiles} tone={report.deletedFiles ? "warning" : "success"} />
      </section>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Cleanup utilities</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">These actions only touch metadata unless explicitly routed through file delete APIs. Remote S3 object deletion stays deliberate.</p>
          </div>
          {canMutate ? (
            <form action="/api/admin/storage/maintenance/archive-deleted" method="post">
              <Button type="submit" variant="secondary">Archive deleted metadata</Button>
            </form>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {report.recommendations.map((item) => (
            <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">{item}</div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Missing and unreferenced object checks</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{report.unreferencedS3ObjectsStatus}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold text-[var(--color-ink)]">S3 read-check candidates</p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{report.missingObjectCandidates.length} active objects are ready for targeted read verification.</p>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] p-4">
            <p className="text-sm font-semibold text-[var(--color-ink)]">Orphaned metadata candidates</p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{report.orphanedMetadataCandidates.length} active files need ownership review.</p>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminDataTable
          data={report.orphanedMetadataCandidates}
          emptyMessage="No obvious orphaned StorageFile records found."
          columns={[
            { key: "file", header: "File", render: (file) => <FileLink id={file.id} name={file.originalFilename} /> },
            { key: "module", header: "Module", render: (file) => file.module },
            { key: "purpose", header: "Purpose", render: (file) => file.purpose },
            { key: "status", header: "Status", render: (file) => <Badge tone="warning">{file.status}</Badge> },
          ]}
        />
        <AdminDataTable
          data={report.privateDocuments.slice(0, 25)}
          emptyMessage="No private document uploads found."
          columns={[
            { key: "file", header: "Private file", render: (file) => <FileLink id={file.id} name={file.originalFilename} /> },
            { key: "purpose", header: "Purpose", render: (file) => file.purpose },
            { key: "visibility", header: "Visibility", render: (file) => <Badge tone="info">{file.visibility}</Badge> },
          ]}
        />
      </section>

      <AdminDataTable
        data={report.usageByOrganization.slice(0, 50)}
        emptyMessage="No storage usage recorded."
        columns={[
          { key: "organization", header: "Organization", render: (usage) => usage.organizationId },
          { key: "files", header: "Files", render: (usage) => usage.fileCount },
          { key: "bytes", header: "Storage used", render: (usage) => formatBytes(usage.totalBytes) },
        ]}
      />
    </AdminShell>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
      {tone !== "neutral" ? <Badge tone={tone}>{tone}</Badge> : null}
    </Card>
  );
}

function FileLink({ id, name }: { id: string; name: string }) {
  return <Link className="font-semibold text-[var(--color-primary)]" href={`/admin/dropbox/files/${id}`}>{name}</Link>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
