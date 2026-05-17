"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

type AnalysisState =
  | { phase: "idle" }
  | { phase: "choosing" }
  | { phase: "transcript_input" }
  | { phase: "running" }
  | { phase: "done"; analysisId: string }
  | { phase: "error"; message: string };

type Props = {
  recipeId: string;
  recipeMediaReferenceId: string;
  aiConfigured: boolean;
};

export function AIAnalysisButton({ recipeId, recipeMediaReferenceId, aiConfigured }: Props) {
  const [state, setState] = useState<AnalysisState>({ phase: "idle" });
  const [transcript, setTranscript] = useState("");

  function handleClick() {
    if (!aiConfigured) {
      setState({ phase: "error", message: "AI video analysis is not configured yet. A platform admin needs to set up the AI provider." });
      return;
    }
    setState({ phase: "choosing" });
  }

  async function handleTranscriptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim()) return;

    setState({ phase: "running" });
    try {
      const res = await fetch("/api/video-analysis/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId,
          recipeMediaReferenceId,
          sourceType: "pasted_transcript",
          transcriptText: transcript.trim(),
        }),
      });

      const data = await res.json() as { success?: boolean; analysisId?: string; error?: string; configured?: boolean };

      if (!res.ok || !data.success) {
        setState({
          phase: "error",
          message: data.error ?? "Analysis failed. Please try again.",
        });
        return;
      }

      setState({ phase: "done", analysisId: data.analysisId ?? "" });
      // Refresh the page to show the new analysis
      window.location.reload();
    } catch {
      setState({ phase: "error", message: "Network error. Please try again." });
    }
  }

  if (state.phase === "idle") {
    return (
      <Button variant="secondary" onClick={handleClick} className="gap-2">
        <Sparkles className="h-4 w-4" />
        Analyze with AI
      </Button>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {state.message}
        </div>
        <Button variant="secondary" onClick={() => setState({ phase: "idle" })}>
          Dismiss
        </Button>
      </div>
    );
  }

  if (state.phase === "choosing") {
    return (
      <div className="space-y-2 rounded-2xl border border-[var(--color-border)] p-4">
        <p className="text-sm font-medium text-[var(--color-ink)]">Choose analysis input:</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setState({ phase: "transcript_input" })}>
            Paste transcript
          </Button>
          <Button variant="secondary" disabled title="Upload support coming soon">
            Upload video (coming soon)
          </Button>
          <Button variant="secondary" onClick={() => setState({ phase: "idle" })}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (state.phase === "transcript_input") {
    return (
      <form onSubmit={handleTranscriptSubmit} className="space-y-3">
        <p className="text-sm text-[var(--color-muted)]">
          Paste the video transcript below. The AI will analyze it and extract ingredients, steps, and differences from the written recipe.
        </p>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste transcript here..."
          rows={8}
          required
          minLength={10}
          className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={!transcript.trim()}>
            Analyze
          </Button>
          <Button type="button" variant="secondary" onClick={() => setState({ phase: "idle" })}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (state.phase === "running") {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Analyzing transcript...
      </div>
    );
  }

  if (state.phase === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Analysis complete. Refreshing...
      </div>
    );
  }

  return null;
}
