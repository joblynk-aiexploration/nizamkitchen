import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import { getTrainingDataset } from "@/server/ai-training";
import { addVerifiedExamplesAction, updateTrainingDatasetAction } from "../../_actions";
import { AiTrainingNav } from "../../_components";

export const dynamic = "force-dynamic";

export default async function AiTrainingDatasetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { id } = await params;
  const { message } = await searchParams;
  const dataset = await getTrainingDataset(id);
  if (!dataset) notFound();

  return (
    <AdminShell session={session} title={dataset.name} description="Curate verified examples, mark readiness, and export JSONL.">
      <AiTrainingNav />
      <FormMessage message={message} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={dataset.status === "ready" ? "success" : dataset.status === "exported" ? "info" : "neutral"}>{dataset.status}</Badge>
              <Badge tone="neutral">{dataset.taskType}</Badge>
              <Badge tone="neutral">{dataset.exampleCount} examples</Badge>
            </div>
            <p className="mt-3 text-sm text-[var(--color-muted)]">{dataset.description ?? "No description provided."}</p>
          </Card>

          {dataset.examples.length === 0 ? (
            <Card><p className="text-sm text-[var(--color-muted)]">This dataset has no examples yet.</p></Card>
          ) : dataset.examples.map(({ example }) => (
            <Card key={example.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">{example.recipe?.name ?? "Recipe unavailable"}</p>
                <p className="text-xs text-[var(--color-muted)]">{example.status} · quality {example.qualityScore ?? "not scored"}</p>
              </div>
              <Button asChild variant="secondary"><Link href={`/admin/ai-training/examples/${example.id}`}>Open</Link></Button>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Dataset actions</h2>
            <form action={addVerifiedExamplesAction} className="mt-4">
              <input type="hidden" name="datasetId" value={dataset.id} />
              <Button type="submit" variant="secondary">Add all verified examples</Button>
            </form>
            <form action={updateTrainingDatasetAction} className="mt-4 space-y-3">
              <input type="hidden" name="datasetId" value={dataset.id} />
              <input type="hidden" name="name" value={dataset.name} />
              <textarea name="description" defaultValue={dataset.description ?? ""} rows={3} className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <select name="status" defaultValue={dataset.status} className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="exported">Exported</option>
                <option value="archived">Archived</option>
              </select>
              <Button type="submit">Save dataset</Button>
            </form>
            <Button asChild variant="secondary" className="mt-3">
              <a href={`/api/admin/ai-training/datasets/${dataset.id}/export`}>Export JSONL</a>
            </Button>
          </Card>

          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Training runs</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Training is intentionally external/local and not launched inside the production web app.
            </p>
            <Button asChild variant="secondary" className="mt-4"><Link href="/admin/ai-training/runs">Create placeholder run</Link></Button>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
