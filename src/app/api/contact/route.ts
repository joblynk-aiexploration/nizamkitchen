import { NextResponse } from "next/server";
import { createContactLead } from "@/server/leads";
import { contactLeadSchema } from "@/lib/validation/contact";
import { getClientIpFromHeaders } from "@/lib/security";
import { verifyRecaptcha } from "@/server/seo/seo-service";

export async function POST(request: Request) {
  const formData = await request.formData();
  const recaptcha = await verifyRecaptcha({
    token: formData.get("recaptchaToken")?.toString(),
    page: "contact",
    ip: getClientIpFromHeaders(request.headers),
    countryCode: formData.get("countryCode")?.toString(),
  });
  if (!recaptcha.ok) {
    return NextResponse.redirect(
      new URL(`/contact?message=${encodeURIComponent(recaptcha.reason)}`, request.url),
    );
  }

  const parsed = contactLeadSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    organizationType: formData.get("organizationType") || undefined,
    countryCode: formData.get("countryCode") || undefined,
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/contact?message=Please+fill+in+all+required+fields+correctly.", request.url),
    );
  }

  try {
    await createContactLead(parsed.data);
    return NextResponse.redirect(
      new URL("/contact?message=Thank+you%21+We%27ll+be+in+touch+soon.", request.url),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/contact?message=Something+went+wrong.+Please+try+again.", request.url),
    );
  }
}
