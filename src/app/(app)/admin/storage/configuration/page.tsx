import { StorageConfigurationStatus, StorageProvider } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { DEFAULT_ALLOWED_MIME_TYPES } from "@/server/storage/file-validation";
import { listStorageConfigurations } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export default async function StorageConfigurationPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const [params, configs] = await Promise.all([searchParams, listStorageConfigurations()]);
  const config = configs.find((item) => item.status === "active") ?? configs[0];
  return (
    <AdminShell session={session} title="Storage configuration" description="Configure AWS S3 or S3-compatible storage. Secrets are encrypted and never shown after save.">
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Bucket settings</h2>
          <Badge tone={config?.secretAccessKeyConfigured ? "success" : "warning"}>{config?.secretAccessKeyConfigured ? "Credentials configured" : "Credentials missing"}</Badge>
        </div>
        <form action="/api/admin/storage/configuration" method="post" className="mt-5 grid gap-4 md:grid-cols-2">
          {config ? <input type="hidden" name="id" value={config.id} /> : null}
          <TextInput label="Display name" name="displayName" defaultValue={config?.displayName ?? "AWS S3 production"} required />
          <SelectInput label="Provider" name="provider" defaultValue={config?.provider ?? "aws_s3"} options={Object.values(StorageProvider).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <SelectInput label="Status" name="status" defaultValue={config?.status ?? "draft"} options={Object.values(StorageConfigurationStatus).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <TextInput label="Bucket name" name="bucketName" defaultValue={config?.bucketName ?? ""} required />
          <TextInput label="Region" name="region" defaultValue={config?.region ?? "us-east-1"} />
          <TextInput label="Endpoint (S3-compatible optional)" name="endpoint" defaultValue={config?.endpoint ?? ""} />
          <TextInput label="Public base URL (optional)" name="publicBaseUrl" defaultValue={config?.publicBaseUrl ?? ""} />
          <TextInput label="Access key ID" name="accessKeyId" type="password" placeholder={config?.accessKeyPreview ?? "Enter to save or rotate"} />
          <TextInput label="Secret access key" name="secretAccessKey" type="password" placeholder={config?.secretAccessKeyConfigured ? "Configured. Enter to rotate." : "Required for S3"} />
          <TextInput label="Session token (optional)" name="sessionToken" type="password" placeholder={config?.sessionTokenConfigured ? "Configured. Enter to rotate." : "Optional"} />
          <TextInput label="Signed URL expiration seconds" name="signedUrlExpiresInSeconds" type="number" defaultValue={config?.signedUrlExpiresInSeconds ?? 900} />
          <TextInput label="Max upload size bytes" name="maxUploadSizeBytes" type="number" defaultValue={config?.maxUploadSizeBytes ?? 10_485_760} />
          <TextArea label="Allowed MIME types" name="allowedMimeTypes" defaultValue={Array.isArray(config?.allowedMimeTypesJson) ? config.allowedMimeTypesJson.join("\n") : DEFAULT_ALLOWED_MIME_TYPES.join("\n")} />
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]"><input type="checkbox" name="forcePathStyle" defaultChecked={config?.forcePathStyle ?? false} /> Force path-style URLs</label>
          <div className="md:col-span-2"><Button type="submit">Save encrypted storage settings</Button></div>
        </form>
      </Card>
    </AdminShell>
  );
}
