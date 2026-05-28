import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StorageFileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor", "country_manager"]);
  const { id } = await params;
  const file = await prisma.storageFile.findUniqueOrThrow({ where: { id }, include: { accessLogs: { orderBy: { createdAt: "desc" }, take: 10 }, versions: true } });
  return (
    <AdminShell session={session} title={file.originalFilename} description="File metadata and access history. Object keys are internal and read access should use signed URLs.">
      <Card>
        <dl className="grid gap-3 text-sm md:grid-cols-2">
          <Detail label="Provider" value={file.provider} />
          <Detail label="Bucket" value={file.bucketName} />
          <Detail label="Object key" value={file.objectKey} />
          <Detail label="MIME type" value={file.mimeType} />
          <Detail label="Purpose" value={file.purpose} />
          <Detail label="Visibility" value={file.visibility} />
          <Detail label="Status" value={file.status} />
          <Detail label="Checksum" value={file.checksumSha256 ?? "Not set"} />
        </dl>
      </Card>
    </AdminShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-[var(--color-ink)]">{label}</dt><dd className="break-all text-[var(--color-muted)]">{value}</dd></div>;
}
