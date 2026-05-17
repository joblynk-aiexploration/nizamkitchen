import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { updateOrganizationMetadata } from "@/server/admin/organizations";
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
    await updateOrganizationMetadata(session, id, {
      name: formData.get("name"),
      slug: formData.get("slug"),
      currencyCode: formData.get("currencyCode"),
      defaultTimezone: formData.get("defaultTimezone"),
      defaultLocale: formData.get("defaultLocale"),
      measurementSystem: formData.get("measurementSystem"),
      organizationType: formData.get("organizationType"),
    });
    revalidatePath("/admin/organizations");
    revalidatePath(`/admin/organizations/${id}`);
    return NextResponse.redirect(new URL(`/admin/organizations/${id}?message=Organization updated.`, request.url));
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

    return NextResponse.redirect(new URL(`/admin/organizations/${id}?message=Unable to update organization.`, request.url));
  }
}
