import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { getActionErrorMessage } from "@/lib/server-action-errors";
import { buildCountryMutationInput, updateCountry } from "@/server/admin/countries";
import { auditAccessDenied } from "@/server/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  const { code } = await params;

  try {
    const formData = await request.formData();
    await updateCountry(session, code, buildCountryMutationInput(formData));
    revalidatePath("/admin/countries");
    revalidatePath(`/admin/countries/${code}`);
    revalidatePath(`/admin/my-countries/${code}`);
    return NextResponse.redirect(
      new URL(`/admin/countries/${code}?message=${encodeURIComponent("Country settings were saved successfully.")}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.country",
        targetId: code,
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL(`/admin/countries/${code}?message=Access denied.`, request.url), { status: 303 });
    }

    const message = getActionErrorMessage(error, "Unable to update country.");
    return NextResponse.redirect(
      new URL(`/admin/countries/${code}?message=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }
}
