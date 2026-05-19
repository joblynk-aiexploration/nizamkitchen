import { NextResponse } from "next/server";
import { requireMembership } from "@/lib/auth/session";
import { deleteStorageFile } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  const { id } = await params;
  try {
    await deleteStorageFile(session, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
