import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { deleteFeatureFlag } from "@/server/admin/feature-flags";
import { auditAccessDenied } from "@/server/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const { id } = await params;
  const referer = request.headers.get("referer") ?? "/admin/feature-flags";

  try {
    await deleteFeatureFlag(session, id);
    revalidatePath("/admin/feature-flags");
    return NextResponse.redirect(new URL(referer, request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "admin.feature_flag", targetId: id, details: { reason: error.code } });
    }
    return NextResponse.redirect(new URL(`${referer}?message=Failed+to+remove+override.`, request.url));
  }
}
