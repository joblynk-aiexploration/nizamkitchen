import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { AccessDeniedError } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";
import { getActionErrorMessage } from "@/lib/server-action-errors";
import { buildCountryMutationInput, createCountry } from "@/server/admin/countries";
import { auditAccessDenied } from "@/server/audit";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  }

  try {
    const formData = await request.formData();
    const country = await createCountry(session, buildCountryMutationInput(formData));
    revalidatePath("/admin/countries");
    revalidatePath(`/admin/countries/${country.countryCode}`);
    return NextResponse.redirect(
      new URL(`/admin/countries?message=${encodeURIComponent(`${country.countryName} was created successfully.`)}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "admin.country",
        details: { reason: error.code },
      });
      return NextResponse.redirect(new URL("/admin/countries?message=Access denied.", request.url), { status: 303 });
    }

    const message = getActionErrorMessage(error, "Unable to create country.");
    return NextResponse.redirect(
      new URL(`/admin/countries/new?message=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }
}
