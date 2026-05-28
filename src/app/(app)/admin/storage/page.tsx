import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { listStorageConfigurations, listStorageFiles } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function AdminStoragePage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor", "country_manager"]);
  const [configs, files] = await Promise.all([listStorageConfigurations(), listStorageFiles(session)]);
  const active = configs.find((config) => config.status === "active");
  return (
    <AdminShell session={session} title="Storage" description="S3 and S3-compatible storage configuration, file registry, and bucket health checks.">
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active provider</p><p className="mt-3 text-xl font-semibold">{active?.provider ?? "Not configured"}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bucket</p><p className="mt-3 text-xl font-semibold">{active?.bucketName ?? "None"}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Files</p><p className="mt-3 text-3xl font-semibold">{files.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last test</p><p className="mt-3"><Badge tone={active?.lastTestStatus === "success" ? "success" : "warning"}>{active?.lastTestStatus ?? "not_tested"}</Badge></p></Card>
      </section>
      <Card className="flex flex-col gap-3 md:flex-row">
        <Button asChild><Link href="/admin/storage/configuration">Configure storage</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/storage/tests">Run bucket tests</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/storage/files">View files</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/storage/maintenance">Maintenance</Link></Button>
      </Card>
      <AdminDataTable
        data={configs}
        emptyMessage="No storage configurations yet."
        columns={[
          { key: "provider", header: "Provider", render: (config) => config.provider },
          { key: "bucket", header: "Bucket", render: (config) => config.bucketName },
          { key: "status", header: "Status", render: (config) => <Badge tone={config.status === "active" ? "success" : config.status === "error" ? "danger" : "warning"}>{config.status}</Badge> },
          { key: "test", header: "Last test", render: (config) => config.lastTestMessage ?? "Not tested" },
        ]}
      />
    </AdminShell>
  );
}
