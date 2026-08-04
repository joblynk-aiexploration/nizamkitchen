import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { setOrgFeatureFlag } from "@/server/admin/feature-flags";
import { auditAccessDenied } from "@/server/audit";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const referer = request.headers.get("referer") ?? "/admin/feature-flags";

  try {
    const formData = await request.formData();
    const key = formData.get("key") as string;
    const organizationId = formData.get("organizationId") as string;
    const enabled = formData.get("enabled") === "true";
    await setOrgFeatureFlag(session, key, organizationId, enabled);
    revalidatePath("/admin/feature-flags");
    revalidatePath(`/admin/feature-flags/${key}`);
    return NextResponse.redirect(new URL(referer, request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({ session, targetType: "admin.feature_flag", details: { reason: error.code } });
      return NextResponse.redirect(new URL(`${referer}?message=Access+denied.`, request.url));
    }
    return NextResponse.redirect(new URL(`${referer}?message=Failed+to+update.`, request.url));
  }
}
