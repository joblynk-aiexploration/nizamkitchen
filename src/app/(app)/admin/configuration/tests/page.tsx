import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function IntegrationTestsRedirectPage() {
  redirect("/admin/apis/tests");
}
