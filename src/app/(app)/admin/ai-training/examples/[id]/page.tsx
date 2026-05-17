import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { JsonViewer } from "@/components/admin/json-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import { getTrainingExample } from "@/server/ai-training";
import { updateTrainingExampleAction } from "../../_actions";
import { AiTrainingNav } from "../../_components";

export const dynamic = "force-dynamic";

export default async function AiTrainingExampleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { id } = await params;
  const { message } = await searchParams;
  const example = await getTrainingExample(id);
  if (!example) notFound();

  return (
    <AdminShell session={session} title="Training example" description={example.recipe?.name ?? "Verified analysis example"}>
      <AiTrainingNav />
      <FormMessage message={message} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap gap-2">
              <Badge tone={example.status === "verified" ? "success" : example.status === "rejected" ? "warning" : "neutral"}>{example.status}</Badge>
              <Badge tone="neutral">{example.taskType}</Badge>
              <Badge tone="neutral">{example.sourceType}</Badge>
              {example.countryCode && <Badge tone="info">{example.countryCode}</Badge>}
            </div>
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              Created by {example.createdBy.fullName}. Verified by {example.verifiedBy?.fullName ?? "not verified"}.
            </p>
            {example.recipeVideoAnalysis?.aiProvider === "mock" && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Mock output should not be used as training data unless it was manually corrected and verified.
              </div>
            )}
            {hasTranscript(example.inputJson) && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Transcript text is present. Export only if the transcript was user/admin provided or permission is documented.
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-[var(--color-ink)]">Input JSON</h2>
            <JsonViewer value={example.inputJson} />
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold text-[var(--color-ink)]">Expected output JSON</h2>
            <JsonViewer value={example.expectedOutputJson} />
          </Card>
        </div>

        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Review metadata</h2>
          <form action={updateTrainingExampleAction} className="mt-4 space-y-4">
            <input type="hidden" name="exampleId" value={example.id} />
            <label className="block text-sm font-medium">
              Status
              <select name="status" defaultValue={example.status} className="mt-1 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="draft">Draft</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="exported">Exported</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Quality score
              <input name="qualityScore" type="number" min="1" max="5" defaultValue={example.qualityScore ?? ""} className="mt-1 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
            </label>
            <label className="block text-sm font-medium">
              Notes
              <textarea name="notes" rows={5} defaultValue={example.notes ?? ""} className="mt-1 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
            </label>
            <Button type="submit">Save review metadata</Button>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}

function hasTranscript(value: unknown) {
  return !!value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).transcript === "string";
}
