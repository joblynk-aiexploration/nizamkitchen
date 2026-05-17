import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { createTrainingRunAction } from "../_actions";
import { AiTrainingComingSoon, AiTrainingNav } from "../_components";

export const dynamic = "force-dynamic";

export default async function AiTrainingRunsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { message } = await searchParams;
  const enabled = await isFeatureEnabled("ai_training", session.activeOrganization?.id ?? null);
  const [datasets, runs] = await Promise.all([
    prisma.aiTrainingDataset.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.aiTrainingRun.findMany({ include: { dataset: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <AdminShell session={session} title="Training runs" description="Document local training experiments without running GPU work in the web app.">
      <AiTrainingNav />
      <FormMessage message={message} />
      {!enabled ? <AiTrainingComingSoon /> : (
      <>
      <Card className="border-blue-200 bg-blue-50">
        <Badge tone="info">Placeholder only</Badge>
        <p className="mt-3 text-sm text-blue-900">
          NizamKitchen does not train models inside the production web app. Export JSONL, train externally on local hardware or a separate worker, then expose inference through LOCAL_AI_BASE_URL.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Create placeholder run</h2>
        <form action={createTrainingRunAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <select name="datasetId" required className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
            <option value="">Choose dataset</option>
            {datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
          </select>
          <select name="modelType" defaultValue="local_finetune_placeholder" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
            <option value="local_finetune_placeholder">Local fine-tune placeholder</option>
            <option value="local_rules">Local rules baseline</option>
            <option value="local_http">Local HTTP model</option>
            <option value="external_placeholder">External placeholder</option>
          </select>
          <input name="baseModel" placeholder="Base model, e.g. qwen2.5-coder or llama" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <input name="outputModelPath" placeholder="Output path placeholder" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
          <textarea name="trainingConfigJson" defaultValue="{}" rows={4} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm md:col-span-2" />
          <div className="md:col-span-2"><Button type="submit">Create placeholder run</Button></div>
        </form>
      </Card>

      <div className="space-y-3">
        {runs.length === 0 ? <Card><p className="text-sm text-[var(--color-muted)]">No training run records yet.</p></Card> : runs.map((run) => (
          <Card key={run.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-[var(--color-ink)]">{run.dataset.name}</h2>
              <Badge tone={run.status === "completed" ? "success" : run.status === "failed" ? "warning" : "neutral"}>{run.status}</Badge>
              <Badge tone="neutral">{run.modelType}</Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Base: {run.baseModel ?? "not set"} · Output: {run.outputModelPath ?? "not set"}</p>
          </Card>
        ))}
      </div>
      </>
      )}
    </AdminShell>
  );
}
