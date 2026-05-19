import Link from "next/link";
import { StorageFilePurpose, StorageFileStatus, StorageFileVisibility, StorageModule } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listStorageFiles } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function AdminDropboxFilesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "country_manager"]);
  const params = await searchParams;
  const files = await listStorageFiles(session, {
    module: params.module,
    organizationId: params.organizationId,
    userId: params.userId,
    countryCode: params.countryCode,
    mimeType: params.mimeType,
    purpose: params.purpose,
    status: params.status,
    visibility: params.visibility,
    search: params.search,
    minSize: params.minSize ? Number(params.minSize) : undefined,
    maxSize: params.maxSize ? Number(params.maxSize) : undefined,
  });
  return (
    <AdminShell session={session} title="Dropbox files" description="Search and manage files stored in S3-compatible storage.">
      <Card>
        <form className="grid gap-4 md:grid-cols-4">
          <TextInput label="Search filename" name="search" defaultValue={params.search ?? ""} />
          <TextInput label="Country" name="countryCode" defaultValue={params.countryCode ?? ""} maxLength={2} />
          <TextInput label="Organization ID" name="organizationId" defaultValue={params.organizationId ?? ""} />
          <TextInput label="User ID" name="userId" defaultValue={params.userId ?? ""} />
          <SelectInput label="Module" name="module" defaultValue={params.module ?? ""} options={enumOptions(StorageModule)} />
          <SelectInput label="Purpose" name="purpose" defaultValue={params.purpose ?? ""} options={enumOptions(StorageFilePurpose)} />
          <SelectInput label="Status" name="status" defaultValue={params.status ?? ""} options={enumOptions(StorageFileStatus)} />
          <SelectInput label="Visibility" name="visibility" defaultValue={params.visibility ?? ""} options={enumOptions(StorageFileVisibility)} />
          <TextInput label="MIME contains" name="mimeType" defaultValue={params.mimeType ?? ""} />
          <TextInput label="Min size" name="minSize" type="number" defaultValue={params.minSize ?? ""} />
          <TextInput label="Max size" name="maxSize" type="number" defaultValue={params.maxSize ?? ""} />
          <div className="flex items-end gap-3"><Button type="submit">Filter</Button><Button asChild variant="secondary"><Link href="/admin/dropbox/uploads">Upload</Link></Button></div>
        </form>
      </Card>
      <AdminDataTable
        data={files}
        emptyMessage="No files match the filters."
        columns={[
          { key: "file", header: "File", render: (file) => <div><Link className="font-semibold text-[var(--color-primary)]" href={`/admin/dropbox/files/${file.id}`}>{file.originalFilename}</Link><p className="text-xs text-[var(--color-muted)]">{file.mimeType}</p></div> },
          { key: "scope", header: "Scope", render: (file) => <div><p>{file.countryCode ?? "system"}</p><p className="text-xs text-[var(--color-muted)]">{file.organizationId ?? "No organization"}</p></div> },
          { key: "module", header: "Module", render: (file) => file.module },
          { key: "purpose", header: "Purpose", render: (file) => file.purpose },
          { key: "size", header: "Size", render: (file) => formatBytes(file.sizeBytes) },
          { key: "visibility", header: "Visibility", render: (file) => file.visibility },
          { key: "status", header: "Status", render: (file) => <Badge tone={file.status === "active" ? "success" : file.status === "deleted" ? "danger" : "warning"}>{file.status}</Badge> },
          { key: "actions", header: "Actions", render: (file) => <Link className="text-sm font-semibold text-[var(--color-primary)]" href={`/admin/dropbox/files/${file.id}`}>Details</Link> },
        ]}
      />
    </AdminShell>
  );
}

function enumOptions(values: Record<string, string>) {
  return [{ value: "", label: "All" }, ...Object.values(values).map((value) => ({ value, label: value.replace(/_/g, " ") }))];
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
