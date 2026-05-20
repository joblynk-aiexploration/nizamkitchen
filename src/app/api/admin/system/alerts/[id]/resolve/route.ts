import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import { updateSystemAlertStatus } from "@/server/observability/system-alerts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]);
  const { id } = await params;
  await updateSystemAlertStatus(session, id, "resolved");
  revalidatePath("/admin/system/alerts");
  revalidatePath(`/admin/system/alerts/${id}`);
  return NextResponse.redirect(new URL(`/admin/system/alerts/${id}?message=Alert resolved.`, request.url));
}
