import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import { archiveDeletedStorageFiles } from "@/server/storage/storage-service";

export async function POST(request: Request) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const result = await archiveDeletedStorageFiles(session);
  revalidatePath("/admin/storage/maintenance");
  revalidatePath("/admin/dropbox");
  revalidatePath("/admin/dropbox/files");
  return NextResponse.redirect(new URL(`/admin/storage/maintenance?message=${encodeURIComponent(`Archived ${result.count} deleted file records.`)}`, request.url));
}
