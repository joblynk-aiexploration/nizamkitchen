import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireMembership } from "@/lib/auth/session";
import { getStorageFileUrl } from "@/server/storage/storage-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireMembership();
  const { id } = await params;
  const headerList = await headers();
  try {
    const signed = await getStorageFileUrl(session, id, {
      ipAddress: headerList.get("x-forwarded-for"),
      userAgent: headerList.get("user-agent"),
    });
    return NextResponse.json({ url: signed.url, expiresInSeconds: signed.expiresInSeconds });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
