import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getLocalAIStatus } from "@/lib/video-analysis-config";
import { getAiTrainingDashboardData } from "@/server/ai-training";
import { AiTrainingComingSoon, AiTrainingNav } from "./_components";

export const dynamic = "force-dynamic";

export default async function AiTrainingPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const enabled = await isFeatureEnabled("ai_training", session.activeOrganization?.id ?? null);
  const localStatus = getLocalAIStatus();

  return (
    <AdminShell
      session={session}
      title="AI Training"
      description="Build NizamKitchen-owned cooking-video intelligence from verified human corrections."
    >
      <AiTrainingNav />
      {!enabled ? <AiTrainingComingSoon /> : <AiTrainingDashboard localStatus={localStatus} />}
    </AdminShell>
  );
}

async function AiTrainingDashboard({ localStatus }: { localStatus: ReturnType<typeof getLocalAIStatus> }) {
  const data = await getAiTrainingDashboardData();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Training examples" value={data.total} hint={`${data.verified} verified examples`} />
        <AdminMetricCard label="Draft / rejected" value={`${data.draft}/${data.rejected}`} hint="Quality gate before export" />
        <AdminMetricCard label="Datasets" value={data.datasets} hint={`${data.exportedDatasets} exported`} />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[var(--color-ink)]">Local AI provider status</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              The web app uses local_rules now and can later call a local model via local_http.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={localStatus.enabled ? "success" : "neutral"}>{localStatus.enabled ? "local AI enabled" : "local AI disabled"}</Badge>
            <Badge tone={localStatus.localRulesReady ? "success" : "warning"}>local_rules {localStatus.localRulesReady ? "ready" : "not ready"}</Badge>
            <Badge tone={localStatus.localHttpConfigured ? "success" : "neutral"}>local_http {localStatus.localHttpConfigured ? "configured" : "not configured"}</Badge>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--color-muted)]">
          Provider: {localStatus.provider}. Local model: {localStatus.localAiModel ?? "not set"}. Base URL: {localStatus.localAiBaseUrl ?? "not set"}.
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Recent verified examples</h2>
          <Button asChild variant="secondary"><Link href="/admin/ai-training/examples">View all</Link></Button>
        </div>
        <div className="mt-4 space-y-3">
          {data.recentExamples.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No verified training examples yet. Verify corrected video analysis to create the first one.</p>
          ) : data.recentExamples.map((example) => (
            <div key={example.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)]">{example.recipe?.name ?? "Recipe unavailable"}</p>
                <p className="text-xs text-[var(--color-muted)]">Verified by {example.verifiedBy?.fullName ?? "platform admin"}</p>
              </div>
              <Button asChild variant="secondary"><Link href={`/admin/ai-training/examples/${example.id}`}>Open</Link></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
