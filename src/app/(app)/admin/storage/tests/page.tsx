import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listStorageConfigurations } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function StorageTestsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const [params, configs] = await Promise.all([searchParams, listStorageConfigurations()]);
  const active = configs.find((config) => config.status === "active");
  return (
    <AdminShell session={session} title="Storage bucket tests" description="Run safe connection, upload, read, and delete tests without exposing credentials.">
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">{active?.displayName ?? "No active storage configuration"}</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{active?.lastTestMessage ?? "Storage has not been tested yet."}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {["connection", "upload", "read", "delete"].map((kind) => (
            <form key={kind} action={`/api/admin/storage/test-${kind}`} method="post">
              <Button type="submit" variant="secondary" className="w-full">Test {kind}</Button>
            </form>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
