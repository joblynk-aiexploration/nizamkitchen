import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { buildCountryMutationInput, createCountry } from "@/server/admin/countries";
import { auditAccessDenied } from "@/server/audit";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const formData = await request.formData();
    await createCountry(session, buildCountryMutationInput(formData));
    revalidatePath("/admin/countries");
    return NextResponse.redirect(new URL("/admin/countries?message=Country created.", request.url));
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.country",
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL("/admin/countries?message=Access denied.", request.url));
    }

    return NextResponse.redirect(new URL("/admin/countries/new?message=Unable to create country.", request.url));
  }
}
