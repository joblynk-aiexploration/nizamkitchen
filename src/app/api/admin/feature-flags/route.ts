import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { createFeatureFlag } from "@/server/admin/feature-flags";
import { auditAccessDenied } from "@/server/audit";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const formData = await request.formData();
    await createFeatureFlag(session, {
      key: formData.get("key"),
      name: formData.get("name"),
      description: formData.get("description"),
      enabled: formData.get("enabled"),
      scopeType: formData.get("scopeType"),
      countryCode: formData.get("countryCode"),
      organizationId: formData.get("organizationId"),
    });
    revalidatePath("/admin/feature-flags");
    return NextResponse.redirect(new URL("/admin/feature-flags?message=Feature flag created.", request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.feature_flag",
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL("/admin/feature-flags?message=Access denied.", request.url));
    }

    return NextResponse.redirect(new URL("/admin/feature-flags?message=Unable to create feature flag.", request.url));
  }
}
