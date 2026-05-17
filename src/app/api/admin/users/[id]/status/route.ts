import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { updateUserStatus } from "@/server/admin/users";
import { auditAccessDenied } from "@/server/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;

  try {
    const formData = await request.formData();
    await updateUserStatus(session, id, {
      status: formData.get("status"),
      reason: formData.get("reason"),
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${id}`);
    return NextResponse.redirect(new URL(`/admin/users/${id}?message=User status updated.`, request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.user",
        targetId: id,
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL(`/admin/users/${id}?message=Access denied.`, request.url));
    }

    return NextResponse.redirect(new URL(`/admin/users/${id}?message=Unable to update user status.`, request.url));
  }
}
