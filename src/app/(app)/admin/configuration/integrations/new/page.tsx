import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NewPlatformIntegrationRedirectPage() {
  redirect("/admin/apis/new");
}
