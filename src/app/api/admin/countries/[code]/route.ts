import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { buildCountryMutationInput, updateCountry } from "@/server/admin/countries";
import { auditAccessDenied } from "@/server/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { code } = await params;

  try {
    const formData = await request.formData();
    await updateCountry(session, code, buildCountryMutationInput(formData));
    revalidatePath("/admin/countries");
    revalidatePath(`/admin/countries/${code}`);
    revalidatePath(`/admin/my-countries/${code}`);
    return NextResponse.redirect(new URL(`/admin/countries/${code}?message=Country updated.`, request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.country",
        targetId: code,
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL(`/admin/countries/${code}?message=Access denied.`, request.url));
    }

    return NextResponse.redirect(new URL(`/admin/countries/${code}?message=Unable to update country.`, request.url));
  }
}
