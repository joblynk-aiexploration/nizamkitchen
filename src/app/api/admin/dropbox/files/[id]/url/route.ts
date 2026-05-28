import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminDropboxSignedUrl } from "@/server/storage/storage-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "country_manager"]);
  const { id } = await params;
  const formData = await request.formData();
  const action = formData.get("action") === "preview" ? "preview" : "download";
  const headerList = await headers();
  const signed = await getAdminDropboxSignedUrl(session, id, action, {
    ipAddress: headerList.get("x-forwarded-for"),
    userAgent: headerList.get("user-agent"),
  });
  return NextResponse.redirect(signed.url);
}
