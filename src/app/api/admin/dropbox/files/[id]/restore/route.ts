import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { restoreStorageFile } from "@/server/storage/storage-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { id } = await params;
  await restoreStorageFile(session, id);
  revalidatePath("/admin/dropbox/files");
  revalidatePath(`/admin/dropbox/files/${id}`);
  return NextResponse.redirect(new URL(`/admin/dropbox/files/${id}`, request.url));
}
