import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { deleteAdminUser } from "@/server/admin/users";
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
    await deleteAdminUser(session, id, {
      confirm: formData.get("confirm"),
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${id}`);

    return NextResponse.redirect(new URL("/admin/users?message=User has been removed from platform access.", request.url));
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

    const message =
      error instanceof Error ? encodeURIComponent(error.message) : "Unable to remove user.";

    return NextResponse.redirect(new URL(`/admin/users/${id}?message=${message}`, request.url));
  }
}
