import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { updateSystemSetting } from "@/server/admin/system-settings";
import { auditAccessDenied } from "@/server/audit";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const formData = await request.formData();
    await updateSystemSetting(session, {
      key: formData.get("key"),
      value: formData.get("value"),
      description: formData.get("description"),
    });
    revalidatePath("/admin/system-settings");
    return NextResponse.redirect(new URL("/admin/system-settings?message=System setting updated.", request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.system_setting",
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL("/admin/system-settings?message=Access denied.", request.url));
    }

    return NextResponse.redirect(new URL("/admin/system-settings?message=Unable to update setting.", request.url));
  }
}
