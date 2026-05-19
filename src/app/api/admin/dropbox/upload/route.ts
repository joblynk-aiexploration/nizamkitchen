import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { uploadAdminDropboxFile } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("File is required.");
    await uploadAdminDropboxFile(session, {
      file,
      organizationId: formData.get("organizationId"),
      countryCode: formData.get("countryCode"),
      userId: formData.get("userId"),
      module: formData.get("module"),
      purpose: formData.get("purpose"),
      visibility: formData.get("visibility"),
      entityType: formData.get("entityType"),
      entityId: formData.get("entityId"),
      altText: formData.get("altText"),
      caption: formData.get("caption"),
    });
    revalidatePath("/admin/dropbox");
    revalidatePath("/admin/dropbox/files");
    return NextResponse.redirect(new URL("/admin/dropbox/uploads?message=File uploaded.", request.url));
  } catch (error) {
    return NextResponse.redirect(new URL(`/admin/dropbox/uploads?message=${encodeURIComponent(error instanceof Error ? error.message : "Upload failed.")}`, request.url));
  }
}
