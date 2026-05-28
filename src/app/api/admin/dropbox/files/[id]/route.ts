import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { deleteAdminDropboxFile } from "@/server/storage/storage-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { id } = await params;
  const formData = await request.formData();
  if (formData.get("confirmDelete") !== "yes") {
    return NextResponse.redirect(new URL(`/admin/dropbox/files/${id}?message=Delete confirmation required.`, request.url));
  }
  await deleteAdminDropboxFile(session, id);
  revalidatePath("/admin/dropbox/files");
  return NextResponse.redirect(new URL("/admin/dropbox/files?status=deleted", request.url));
}
