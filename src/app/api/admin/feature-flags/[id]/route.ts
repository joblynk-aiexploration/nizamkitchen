import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { updateFeatureFlag } from "@/server/admin/feature-flags";
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
    await updateFeatureFlag(session, id, {
      key: formData.get("key"),
      name: formData.get("name"),
      description: formData.get("description"),
      enabled: formData.get("enabled"),
      scopeType: formData.get("scopeType"),
      countryCode: formData.get("countryCode"),
      organizationId: formData.get("organizationId"),
    });
    revalidatePath("/admin/feature-flags");
    return NextResponse.redirect(new URL("/admin/feature-flags?message=Feature flag updated.", request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.feature_flag",
        targetId: id,
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL("/admin/feature-flags?message=Access denied.", request.url));
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("[feature-flags] update failed", error);
    }

    return NextResponse.redirect(
      new URL("/admin/feature-flags?message=Feature flag update failed. Check required fields and try again.", request.url),
    );
  }
}
