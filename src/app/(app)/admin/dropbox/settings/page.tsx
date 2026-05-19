import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listStorageConfigurations } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function AdminDropboxSettingsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const configs = await listStorageConfigurations();
  const active = configs.find((config) => config.status === "active");
  return (
    <AdminShell session={session} title="Dropbox settings" description="Admin Dropbox uses the platform storage configuration and never exposes S3 credentials.">
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Storage backend</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Active provider: {active?.provider ?? "not configured"} · Bucket: {active?.bucketName ?? "none"}</p>
        <div className="mt-4 flex gap-3">
          <Button asChild><Link href="/admin/storage/configuration">Storage configuration</Link></Button>
          <Button asChild variant="secondary"><Link href="/admin/storage/tests">Run storage tests</Link></Button>
        </div>
      </Card>
    </AdminShell>
  );
}
