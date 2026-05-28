import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AuthConfigurationRedirectPage() {
  redirect("/admin/apis#social-sign-in");
}
