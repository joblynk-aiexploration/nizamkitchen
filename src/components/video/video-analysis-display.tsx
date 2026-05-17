import type { RecipeVideoAnalysis, VideoAnalysisIngredient, VideoAnalysisStep, VideoRecipeDifference } from "@prisma/client";
import { AlertTriangle, CheckCircle, Clock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatYouTubeDuration } from "@/lib/youtube";

type FullAnalysis = RecipeVideoAnalysis & {
  ingredients: VideoAnalysisIngredient[];
  steps: VideoAnalysisStep[];
  differences: VideoRecipeDifference[];
  analyzedBy: { fullName: string } | null;
  verifiedBy: { fullName: string } | null;
};

const CONFIDENCE_TONE: Record<string, "success" | "info" | "warning" | "neutral"> = {
  exact: "success",
  high: "success",
  medium: "info",
  low: "warning",
  unknown: "neutral",
};

const SEVERITY_TONE: Record<string, "info" | "warning" | "neutral"> = {
  info: "info",
  warning: "warning",
  important: "warning",
};

function TimestampBadge({ start, end }: { start: number | null; end: number | null }) {
  if (start === null) return null;
  const label = end !== null
    ? `${formatYouTubeDuration(start)} – ${formatYouTubeDuration(end)}`
    : formatYouTubeDuration(start);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]">
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

export function VideoAnalysisDisplay({ analysis }: { analysis: FullAnalysis }) {
  const isVerified = analysis.verificationStatus === "verified";
  const isDraft = analysis.verificationStatus === "ai_draft";
  const isRejected = analysis.verificationStatus === "rejected";

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {isDraft && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            <strong>AI-generated draft — may be inaccurate.</strong> Use the written recipe for grocery planning unless this analysis is verified by a platform admin.
          </p>
        </div>
      )}
      {isVerified && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <p className="text-sm text-emerald-800 font-medium">Verified video breakdown.</p>
          {analysis.verifiedBy && (
            <span className="text-xs text-emerald-700">— {analysis.verifiedBy.fullName}</span>
          )}
        </div>
      )}
      {isRejected && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <p className="text-sm text-red-800">This analysis has been rejected and should not be used.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-[var(--color-ink)]">{analysis.title}</h3>
        <Badge tone={CONFIDENCE_TONE[analysis.confidence] ?? "neutral"}>
          {analysis.confidence} confidence
        </Badge>
        {analysis.aiProvider && (
          <Badge tone="neutral">{analysis.aiProvider}</Badge>
        )}
      </div>

      {analysis.summary && (
        <p className="text-sm text-[var(--color-muted)]">{analysis.summary}</p>
      )}

      {/* Ingredients detected */}
      {analysis.ingredients.length > 0 && (
        <Card>
          <h4 className="font-semibold text-[var(--color-ink)]">
            Ingredients detected in video ({analysis.ingredients.length})
          </h4>
          <ul className="mt-3 space-y-2">
            {analysis.ingredients.map((ing) => (
              <li key={ing.id} className="flex flex-wrap items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-[var(--color-ink)]">
                  {ing.quantity !== null ? `${ing.quantity} ` : ""}
                  {ing.unitName ? `${ing.unitName} ` : ""}
                  {ing.ingredientName}
                </span>
                {ing.preparationNote && (
                  <span className="text-[var(--color-muted)] italic">, {ing.preparationNote}</span>
                )}
                <Badge tone={CONFIDENCE_TONE[ing.confidence] ?? "neutral"}>{ing.confidence}</Badge>
                <TimestampBadge start={ing.timestampStartSeconds} end={ing.timestampEndSeconds} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Step timeline */}
      {analysis.steps.length > 0 && (
        <Card>
          <h4 className="font-semibold text-[var(--color-ink)]">
            Cooking steps ({analysis.steps.length})
          </h4>
          <div className="mt-3 space-y-3">
            {analysis.steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
                  {step.stepNumber}
                </div>
                <div className="min-w-0 flex-1">
                  {step.title && (
                    <p className="font-medium text-sm text-[var(--color-ink)]">{step.title}</p>
                  )}
                  <p className="text-sm text-[var(--color-muted)]">{step.description}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge tone={CONFIDENCE_TONE[step.confidence] ?? "neutral"}>{step.confidence}</Badge>
                    <TimestampBadge start={step.timestampStartSeconds} end={step.timestampEndSeconds} />
                    {step.technique && <Badge tone="neutral">{step.technique}</Badge>}
                    {step.temperature && <Badge tone="neutral">{step.temperature}</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Differences from written recipe */}
      {analysis.differences.length > 0 && (
        <Card>
          <h4 className="font-semibold text-[var(--color-ink)]">
            Differences from written recipe
          </h4>
          <ul className="mt-3 space-y-2">
            {analysis.differences.map((diff) => (
              <li key={diff.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)]" />
                <div>
                  <span className="font-medium text-[var(--color-ink)]">{diff.title}</span>
                  <span className="ml-2"><Badge tone={SEVERITY_TONE[diff.severity] ?? "neutral"}>{diff.severity}</Badge></span>
                  <p className="mt-0.5 text-[var(--color-muted)]">{diff.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
