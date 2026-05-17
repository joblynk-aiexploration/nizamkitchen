import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { listTrainingDatasets } from "@/server/ai-training";
import { createTrainingDatasetAction } from "../_actions";
import { AiTrainingComingSoon, AiTrainingNav } from "../_components";

export const dynamic = "force-dynamic";

export default async function AiTrainingDatasetsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { message } = await searchParams;
  const enabled = await isFeatureEnabled("ai_training", session.activeOrganization?.id ?? null);
  const datasets = enabled ? await listTrainingDatasets() : [];

  return (
    <AdminShell session={session} title="Training datasets" description="Package verified examples into JSONL datasets for future local fine-tuning.">
      <AiTrainingNav />
      <FormMessage message={message} />
      {!enabled ? <AiTrainingComingSoon /> : (
        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Create dataset</h2>
            <form action={createTrainingDatasetAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_260px_auto]">
              <input name="name" required placeholder="Dataset name" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <select name="taskType" defaultValue="cooking_video_transcript_to_structured_analysis" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="cooking_video_transcript_to_structured_analysis">Video transcript to analysis</option>
                <option value="ingredient_extraction">Ingredient extraction</option>
                <option value="cooking_step_extraction">Cooking step extraction</option>
                <option value="recipe_difference_detection">Recipe difference detection</option>
              </select>
              <Button type="submit">Create</Button>
              <textarea name="description" placeholder="Description" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm md:col-span-3" />
            </form>
          </Card>

          <div className="space-y-3">
            {datasets.length === 0 ? (
              <Card><p className="text-sm text-[var(--color-muted)]">No datasets created yet.</p></Card>
            ) : datasets.map((dataset) => (
              <Card key={dataset.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--color-ink)]">{dataset.name}</h2>
                    <Badge tone={dataset.status === "ready" ? "success" : dataset.status === "exported" ? "info" : "neutral"}>{dataset.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{dataset.exampleCount} examples · v{dataset.version} · {dataset.taskType}</p>
                </div>
                <Button asChild variant="secondary"><Link href={`/admin/ai-training/datasets/${dataset.id}`}>Open</Link></Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
