import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/auth/session";
import { uploadStorageFile } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireMembership();
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "File is required." }, { status: 400 });
    const uploaded = await uploadStorageFile(session, {
      file,
      module: formData.get("module"),
      purpose: formData.get("purpose"),
      visibility: formData.get("visibility") || "private",
      entityType: formData.get("entityType"),
      entityId: formData.get("entityId"),
      altText: formData.get("altText"),
      caption: formData.get("caption"),
    });
    return NextResponse.json({ file: uploaded }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
