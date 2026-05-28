import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getActionErrorMessage } from "@/lib/server-action-errors";
import { uploadStorageFile } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireUser();
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File is required." }, { status: 400 });
    const uploadModule = String(formData.get("module") ?? "");
    if (!session.activeOrganization && uploadModule !== "users" && !session.user.platformRole) {
      return NextResponse.json({ error: "Choose an active workspace before uploading this file." }, { status: 400 });
    }
    const uploaded = await uploadStorageFile(session, {
      file,
      module: uploadModule,
      purpose: formData.get("purpose"),
      visibility: formData.get("visibility") || "private",
      entityType: formData.get("entityType"),
      entityId: formData.get("entityId"),
      altText: formData.get("altText"),
      caption: formData.get("caption"),
    });
    return NextResponse.json({ file: uploaded }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getActionErrorMessage(error, "Upload failed.") }, { status: 400 });
  }
}
