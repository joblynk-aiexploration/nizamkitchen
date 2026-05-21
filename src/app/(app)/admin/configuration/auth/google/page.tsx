import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function GoogleAuthConfigurationRedirectPage() {
  redirect("/admin/apis/categories");
}
