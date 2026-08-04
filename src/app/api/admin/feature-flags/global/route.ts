import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { setGlobalFeatureFlag } from "@/server/admin/feature-flags";
import { auditAccessDenied } from "@/server/audit";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const formData = await request.formData();
    const key = formData.get("key") as string;
    const enabled = formData.get("enabled") === "true";
    await setGlobalFeatureFlag(session, key, enabled);
    revalidatePath("/admin/feature-flags");
    return NextResponse.redirect(
      new URL(`/admin/feature-flags?message=${encodeURIComponent(`${key} ${enabled ? "enabled" : "disabled"} globally.`)}`, request.url),
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.feature_flag",
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL("/admin/feature-flags?message=Access+denied.", request.url));
    }
    return NextResponse.redirect(new URL("/admin/feature-flags?message=Failed+to+update+feature+flag.", request.url));
  }
}
