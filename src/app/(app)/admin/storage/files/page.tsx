import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listStorageFiles } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function StorageFilesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor", "country_manager"]);
  const files = await listStorageFiles(session);
  return (
    <AdminShell session={session} title="Storage files" description="Metadata registry for uploaded images, documents, and private attachments.">
      <AdminDataTable
        data={files}
        emptyMessage="No uploaded files yet."
        columns={[
          { key: "file", header: "File", render: (file) => <Link className="font-semibold text-[var(--color-primary)]" href={`/admin/storage/files/${file.id}`}>{file.originalFilename}</Link> },
          { key: "purpose", header: "Purpose", render: (file) => file.purpose },
          { key: "visibility", header: "Visibility", render: (file) => file.visibility },
          { key: "status", header: "Status", render: (file) => <Badge tone={file.status === "active" ? "success" : file.status === "deleted" ? "danger" : "warning"}>{file.status}</Badge> },
          { key: "size", header: "Size", render: (file) => `${file.sizeBytes} bytes` },
        ]}
      />
    </AdminShell>
  );
}
