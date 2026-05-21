import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PlatformSecretsRedirectPage() {
  redirect("/admin/apis/secrets");
}
