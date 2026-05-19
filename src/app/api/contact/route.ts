import { NextResponse } from "next/server";
import { createContactLead } from "@/server/leads";
import { contactLeadSchema } from "@/lib/validation/contact";

export async function POST(request: Request) {
  const formData = await request.formData();

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
