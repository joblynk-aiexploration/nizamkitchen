import { StorageFilePurpose, StorageFileVisibility, StorageModule } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminDropboxUploadsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const params = await searchParams;
  return (
    <AdminShell session={session} title="Dropbox upload" description="Upload admin-managed files directly into configured S3 storage.">
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <Card>
        <form action="/api/admin/dropbox/upload" method="post" encType="multipart/form-data" className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)] md:col-span-2">
            File
            <input name="file" type="file" required className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm" />
          </label>
          <TextInput label="Organization ID (optional)" name="organizationId" />
          <TextInput label="Country code (optional)" name="countryCode" maxLength={2} />
          <TextInput label="User ID (optional metadata)" name="userId" />
          <SelectInput label="Module" name="module" defaultValue="admin_dropbox" options={enumOptions(StorageModule)} />
          <SelectInput label="Purpose" name="purpose" defaultValue="admin_dropbox" options={enumOptions(StorageFilePurpose)} />
          <SelectInput label="Visibility" name="visibility" defaultValue="private" options={enumOptions(StorageFileVisibility)} />
          <TextInput label="Entity type" name="entityType" placeholder="profile, order, support_ticket" />
          <TextInput label="Entity ID" name="entityId" />
          <TextInput label="Alt text" name="altText" />
          <TextArea label="Caption / notes" name="caption" />
          <div className="md:col-span-2"><Button type="submit">Upload to storage</Button></div>
        </form>
      </Card>
    </AdminShell>
  );
}

function enumOptions(values: Record<string, string>) {
  return Object.values(values).map((value) => ({ value, label: value.replace(/_/g, " ") }));
}
