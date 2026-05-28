import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { saveStorageConfiguration } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    const formData = await request.formData();
    await saveStorageConfiguration(session, {
      id: stringValue(formData.get("id")),
      provider: formData.get("provider"),
      displayName: formData.get("displayName"),
      status: formData.get("status"),
      bucketName: formData.get("bucketName"),
      region: formData.get("region"),
      endpoint: formData.get("endpoint"),
      forcePathStyle: formData.get("forcePathStyle") === "on",
      publicBaseUrl: formData.get("publicBaseUrl"),
      accessKeyId: formData.get("accessKeyId"),
      secretAccessKey: formData.get("secretAccessKey"),
      sessionToken: formData.get("sessionToken"),
      signedUrlExpiresInSeconds: formData.get("signedUrlExpiresInSeconds"),
      maxUploadSizeBytes: formData.get("maxUploadSizeBytes"),
      allowedMimeTypes: formData.get("allowedMimeTypes"),
    });
    revalidatePath("/admin/storage");
    revalidatePath("/admin/storage/configuration");
    return NextResponse.redirect(new URL("/admin/storage/configuration?message=Storage configuration saved.", request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save storage configuration.";
    return NextResponse.redirect(new URL(`/admin/storage/configuration?message=${encodeURIComponent(message)}`, request.url));
  }
}

function stringValue(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value : "";
  return text || undefined;
}
