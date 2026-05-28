import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";

export default async function AdminNewPolicyPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);

  return (
    <AdminShell
      session={session}
      title="New Marketplace Policy"
      description="Policy creation is intentionally controlled through seeded templates and server actions until the visual editor is enabled."
      actions={<Link href="/admin/policies" className="text-sm font-medium text-[var(--color-primary)] hover:underline">Back to policies</Link>}
    >
      <Card>
        <p className="text-sm text-[var(--color-muted)]">
          The policy engine is active. Use seeded templates or backend-safe admin tooling for new policies while the JSON rule editor is being reviewed.
        </p>
      </Card>
    </AdminShell>
  );
}
