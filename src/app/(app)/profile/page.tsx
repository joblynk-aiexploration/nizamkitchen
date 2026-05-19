import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

export default async function ProfileShortcutPage() {
  const session = await requireUser();
  redirect(`/users/${session.user.id}`);
}
