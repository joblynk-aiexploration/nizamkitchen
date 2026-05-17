import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminSystemSettingsPage() {
  await requirePlatformRole(["platform_owner", "platform_admin"]);
  const settings = await prisma.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Runtime governance"
        title="System settings"
        description="Global platform settings are centralized here and kept separate from tenant-owned data."
      />
      <DataTable
        columns={[
          { key: "key", header: "Setting", render: (item) => <span className="font-semibold">{item.key}</span> },
          { key: "description", header: "Description", render: (item) => item.description ?? "N/A" },
          { key: "value", header: "Value", render: (item) => JSON.stringify(item.value) },
        ]}
        data={settings}
        emptyMessage="No system settings found."
      />
    </div>
  );
}
