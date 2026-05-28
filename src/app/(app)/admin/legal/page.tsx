import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listLegalDocuments } from "@/server/legal/legal-service";

export const dynamic = "force-dynamic";

export default async function AdminLegalPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const documents = await listLegalDocuments(session);
  const publishedCount = documents.filter((document) => document.status === "published").length;

  return (
    <AdminShell
      session={session}
      title="Legal Center"
      description="Manage legal templates, published versions, acceptances, and consent events."
      actions={<Button asChild><Link href="/admin/legal/documents">Documents</Link></Button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Documents</p><p className="mt-2 text-4xl font-bold">{documents.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Published</p><p className="mt-2 text-4xl font-bold">{publishedCount}</p></Card>
        <Card><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Template warning</p><p className="mt-2 text-sm text-[var(--color-muted)]">Replace placeholders with counsel-approved text before production.</p></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Button asChild variant="secondary"><Link href="/admin/legal/acceptances">View acceptances</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/legal/consents">View consents</Link></Button>
        <Button asChild variant="secondary"><Link href="/admin/legal/documents/new">New document</Link></Button>
      </div>
    </AdminShell>
  );
}
