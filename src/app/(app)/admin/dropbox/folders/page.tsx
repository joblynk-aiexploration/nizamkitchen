import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listStorageFiles } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function AdminDropboxFoldersPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "country_manager"]);
  const files = await listStorageFiles(session);
  const folders = new Map<string, number>();
  for (const file of files) {
    const key = `/${file.countryCode ?? "system"}/${file.organizationId ?? "system"}/${file.module}/${file.purpose}/`;
    folders.set(key, (folders.get(key) ?? 0) + 1);
  }
  return (
    <AdminShell session={session} title="Virtual folders" description="S3 remains object storage; these folders group files by country, organization, module, and purpose.">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from(folders.entries()).map(([folder, count]) => (
          <Card key={folder}>
            <Link href={`/admin/dropbox/files?module=${encodeURIComponent(folder.split("/")[3] ?? "")}`} className="font-semibold text-[var(--color-primary)]">{folder}</Link>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{count} file{count === 1 ? "" : "s"}</p>
          </Card>
        ))}
        {folders.size === 0 ? <Card className="text-sm text-[var(--color-muted)]">No virtual folders yet.</Card> : null}
      </div>
    </AdminShell>
  );
}
