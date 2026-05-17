import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listTrainingExamples } from "@/server/ai-training";
import { AiTrainingComingSoon, AiTrainingNav } from "../_components";

export const dynamic = "force-dynamic";

export default async function AiTrainingExamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string; taskType?: string; countryCode?: string; sourceType?: string; search?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const params = await searchParams;
  const enabled = await isFeatureEnabled("ai_training", session.activeOrganization?.id ?? null);
  const examples = enabled ? await listTrainingExamples(params) : [];

  return (
    <AdminShell session={session} title="Training examples" description="Verified cooking-video analyses become reusable JSONL training rows.">
      <AiTrainingNav />
      <FormMessage message={params.message} />
      {!enabled ? <AiTrainingComingSoon /> : (
        <div className="space-y-6">
          <Card>
            <form className="grid gap-3 md:grid-cols-5">
              <input name="search" defaultValue={params.search ?? ""} placeholder="Search recipe" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <select name="status" defaultValue={params.status ?? ""} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="">Any status</option>
                <option value="draft">Draft</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="exported">Exported</option>
              </select>
              <select name="sourceType" defaultValue={params.sourceType ?? ""} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="">Any source</option>
                <option value="video_analysis">Video analysis</option>
                <option value="ai_draft_corrected">AI draft corrected</option>
                <option value="transcript">Transcript</option>
                <option value="manual">Manual</option>
              </select>
              <input name="countryCode" defaultValue={params.countryCode ?? ""} placeholder="Country" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <Button type="submit" variant="secondary">Filter</Button>
            </form>
          </Card>

          <div className="space-y-3">
            {examples.length === 0 ? (
              <Card><p className="text-sm text-[var(--color-muted)]">No training examples match the current filters.</p></Card>
            ) : examples.map((example) => (
              <Card key={example.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--color-ink)]">{example.recipe?.name ?? "Recipe unavailable"}</h2>
                    <Badge tone={example.status === "verified" ? "success" : example.status === "rejected" ? "warning" : "neutral"}>{example.status}</Badge>
                    <Badge tone="neutral">{example.sourceType}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{example.taskType} · {example.countryCode ?? "global"} · quality {example.qualityScore ?? "not scored"}</p>
                </div>
                <Button asChild variant="secondary"><Link href={`/admin/ai-training/examples/${example.id}`}>Open</Link></Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
