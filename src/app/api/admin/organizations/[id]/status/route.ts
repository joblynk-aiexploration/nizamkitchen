import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { updateOrganizationStatus } from "@/server/admin/organizations";
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
    await updateOrganizationStatus(session, id, {
      status: formData.get("status"),
      reason: formData.get("reason") || undefined,
    });
    revalidatePath("/admin/organizations");
    revalidatePath(`/admin/organizations/${id}`);
    return NextResponse.redirect(new URL(`/admin/organizations/${id}?message=Organization status updated.`, request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.organization",
        targetId: id,
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL(`/admin/organizations/${id}?message=Access denied.`, request.url));
    }

    return NextResponse.redirect(new URL(`/admin/organizations/${id}?message=Unable to update organization status.`, request.url));
  }
}
