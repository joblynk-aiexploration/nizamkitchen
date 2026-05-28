import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminDropboxSignedUrl, getDropboxFile } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function AdminDropboxFileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "country_manager"]);
  const { id } = await params;
  const file = await getDropboxFile(session, id);
  const preview = canPreview(file.mimeType) ? await getAdminDropboxSignedUrl(session, file.id, "preview").catch(() => null) : null;
  return (
    <AdminShell session={session} title={file.originalFilename} description="Preview, download, archive, restore, or delete S3-backed file metadata.">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Preview</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
            {preview && file.mimeType.startsWith("image/") ? (
              // Signed admin previews use short-lived S3 URLs, so Next image optimization is intentionally skipped.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={file.altText ?? file.originalFilename} className="max-h-[480px] w-full rounded-xl object-contain" />
            ) : null}
            {preview && file.mimeType === "application/pdf" ? <iframe src={preview.url} title={file.originalFilename} className="h-[520px] w-full rounded-xl bg-white" /> : null}
            {!preview ? <div className="py-16 text-center text-sm text-[var(--color-muted)]">Preview unsupported. Use signed download for this file type.</div> : null}
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Actions</h2>
          <div className="mt-4 grid gap-3">
            <form action={`/api/admin/dropbox/files/${file.id}/url`} method="post"><input type="hidden" name="action" value="download" /><Button type="submit" className="w-full">Create signed download URL</Button></form>
            {file.status === "archived" ? <form action={`/api/admin/dropbox/files/${file.id}/restore`} method="post"><Button type="submit" variant="secondary" className="w-full">Restore file</Button></form> : <form action={`/api/admin/dropbox/files/${file.id}/archive`} method="post"><Button type="submit" variant="secondary" className="w-full">Archive file</Button></form>}
            <form action={`/api/admin/dropbox/files/${file.id}`} method="post" className="rounded-2xl border border-red-200 bg-red-50 p-3">
              <label className="flex items-start gap-2 text-xs text-red-800">
                <input type="checkbox" name="confirmDelete" value="yes" className="mt-0.5" required />
                <span>I understand this deletes the metadata and S3 object if permitted.</span>
              </label>
              <Button type="submit" variant="danger" className="mt-3 w-full">Delete metadata and object</Button>
            </form>
          </div>
        </Card>
      </section>
      <Card>
        <dl className="grid gap-3 text-sm md:grid-cols-3">
          <Detail label="Status" value={file.status} />
          <Detail label="Visibility" value={file.visibility} />
          <Detail label="Module" value={file.module} />
          <Detail label="Purpose" value={file.purpose} />
          <Detail label="Bucket" value={file.bucketName} />
          <Detail label="Object key" value={file.objectKey} />
          <Detail label="MIME type" value={file.mimeType} />
          <Detail label="Size" value={`${file.sizeBytes} bytes`} />
          <Detail label="Checksum" value={file.checksumSha256 ?? "Not set"} />
          <Detail label="Organization" value={file.organizationId ?? "System"} />
          <Detail label="Uploaded by" value={file.uploadedById} />
          <Detail label="Country" value={file.countryCode ?? "System"} />
        </dl>
      </Card>
      <AdminDataTable
        data={file.accessLogs}
        emptyMessage="No access log entries yet."
        columns={[
          { key: "action", header: "Action", render: (log) => <Badge>{log.action}</Badge> },
          { key: "user", header: "User", render: (log) => log.userId ?? "system" },
          { key: "created", header: "Created", render: (log) => log.createdAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}

function canPreview(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-[var(--color-ink)]">{label}</dt><dd className="break-all text-[var(--color-muted)]">{value}</dd></div>;
}
