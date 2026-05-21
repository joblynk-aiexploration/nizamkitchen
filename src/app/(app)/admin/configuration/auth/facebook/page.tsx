import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function FacebookAuthConfigurationRedirectPage() {
  redirect("/admin/apis/categories");
}
