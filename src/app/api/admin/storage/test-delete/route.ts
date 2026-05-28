import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import { runStorageTest } from "@/server/storage/storage-service";

export async function POST(request: Request) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const result = await runStorageTest(session, "delete").catch((error) => ({ ok: false, message: error instanceof Error ? error.message : "Storage test failed." }));
  return NextResponse.redirect(new URL(`/admin/storage/tests?message=${encodeURIComponent(result.message)}`, request.url));
}
