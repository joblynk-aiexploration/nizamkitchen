import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import { isYouTubeDiscoveryAvailable, getYouTubeDiscoveryConfig } from "@/lib/youtube-discovery-config";
import { listRecentDiscoveryRuns } from "@/server/youtube-discovery/discovery-service";
import { listCandidatesGroupedByRecipe } from "@/server/youtube-discovery/candidate-service";
import { formatYouTubeDuration } from "@/lib/youtube";

export const dynamic = "force-dynamic";

function runStatusTone(status: string): "success" | "warning" | "neutral" | "danger" {
  if (status === "completed") return "success";
  if (status === "running") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

export default async function YouTubeDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { message } = await searchParams;
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  const discoveryAvailable = isYouTubeDiscoveryAvailable();
  const cfg = getYouTubeDiscoveryConfig();

  const [recentRuns, groupedCandidates] = await Promise.all([
    listRecentDiscoveryRuns(10),
    listCandidatesGroupedByRecipe(),
  ]);

  return (
    <AdminShell
      session={session}
      title="YouTube video discovery"
      description="Find and curate YouTube cooking videos for platform recipes. All discovery uses the official YouTube Data API."
    >
      {message && <FormMessage message={message} />}

      {/* ── API status ── */}
      {!discoveryAvailable && (
        <Card>
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <div>
              <p className="font-semibold text-[var(--color-ink)]">YouTube discovery is not configured</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {!cfg.enabled
                  ? (cfg as { enabled: false; reason: string }).reason
                  : "Unknown configuration error."}
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Add <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">YOUTUBE_DATA_API_KEY</code> and set{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">YOUTUBE_DISCOVERY_ENABLED=true</code> to enable discovery.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Bulk discovery actions ── */}
      {canMutate && discoveryAvailable && (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Bulk discovery</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Search YouTube for cooking videos for all published recipes. Results are stored as candidates for review.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action="/api/admin/youtube-discovery/runs" method="post">
              <input type="hidden" name="mode" value="all" />
              <Button type="submit" variant="primary">Discover videos for all recipes</Button>
            </form>
            <form action="/api/admin/youtube-discovery/runs" method="post">
              <input type="hidden" name="mode" value="missing" />
              <Button type="submit" variant="secondary">Discover missing only</Button>
            </form>
          </div>
        </Card>
      )}

      {/* ── Recent runs ── */}
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Recent discovery runs ({recentRuns.length})</h2>
        {recentRuns.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No discovery runs yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm">
                <span className={`h-2 w-2 shrink-0 rounded-full ${
                  run.status === "completed" ? "bg-emerald-500"
                  : run.status === "running" ? "bg-amber-500"
                  : run.status === "failed" ? "bg-red-500"
                  : "bg-slate-300"
                }`} />
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-[var(--color-ink)]">
                    {run.recipe?.name ?? "All recipes"}
                  </span>
                  <span className="ml-2 text-[var(--color-muted)]">
                    {run.candidatesFound} new candidates · {run.queryCount} queries
                  </span>
                </div>
                <Badge tone={runStatusTone(run.status)}>{run.status}</Badge>
                <span className="text-xs text-[var(--color-muted)]">
                  {run.createdAt.toLocaleDateString()}
                </span>
                {run.recipe && (
                  <Link href={`/admin/recipe-library/${run.recipe.id}`} className="text-xs text-[var(--color-primary)] hover:underline">
                    View recipe →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Pending candidates grouped by recipe ── */}
      <div className="space-y-6">
        <h2 className="font-semibold text-[var(--color-ink)]">
          Pending candidates — grouped by recipe ({groupedCandidates.length} recipes)
        </h2>

        {groupedCandidates.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--color-muted)]">
              No pending candidates. Run discovery to find YouTube videos for your recipes.
            </p>
          </Card>
        ) : (
          groupedCandidates.map(({ recipe, candidates }) => (
            <Card key={recipe.id}>
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold text-[var(--color-ink)]">{recipe.name}</h3>
                <div className="flex gap-2">
                  <Badge tone="neutral">{candidates.length} pending</Badge>
                  <Link href={`/admin/recipe-library/${recipe.id}`}>
                    <Button variant="secondary">View recipe</Button>
                  </Link>
                  {canMutate && discoveryAvailable && (
                    <form action="/api/admin/youtube-discovery/runs" method="post">
                      <input type="hidden" name="recipeId" value={recipe.id} />
                      <input type="hidden" name="forceRefresh" value="true" />
                      <Button type="submit" variant="secondary">Refresh</Button>
                    </form>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {candidates.map((c) => (
                  <div key={c.id} className="flex gap-4 rounded-2xl border border-[var(--color-border)] p-4">
                    {/* Thumbnail */}
                    {c.thumbnailUrl ? (
                      <img
                        src={c.thumbnailUrl}
                        alt={c.title}
                        width={160}
                        height={90}
                        className="h-20 w-36 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="h-20 w-36 shrink-0 rounded-xl bg-slate-100" />
                    )}

                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <p className="font-medium text-[var(--color-ink)] line-clamp-2">{c.title}</p>
                        {c.channelTitle && (
                          <p className="text-sm text-[var(--color-muted)]">{c.channelTitle}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                        {c.durationSeconds != null && (
                          <span>⏱ {formatYouTubeDuration(c.durationSeconds)}</span>
                        )}
                        {c.viewCount != null && (
                          <span>👁 {(Number(c.viewCount) / 1000).toFixed(0)}K views</span>
                        )}
                        {c.publishedAt && (
                          <span>{new Date(c.publishedAt).getFullYear()}</span>
                        )}
                        <Badge tone={c.score >= 30 ? "success" : c.score >= 0 ? "neutral" : "danger"}>
                          Score: {c.score.toFixed(0)}
                        </Badge>
                      </div>

                      {/* Professional signals */}
                      {Array.isArray(c.professionalSignalsJson) && c.professionalSignalsJson.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(c.professionalSignalsJson as string[]).map((sig, i) => (
                            <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                              {sig}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Rejection reasons */}
                      {Array.isArray(c.rejectionReasonsJson) && c.rejectionReasonsJson.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(c.rejectionReasonsJson as string[]).map((r, i) => (
                            <span key={i} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                              ⚠ {r}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      {canMutate && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <a
                            href={`https://www.youtube.com/watch?v=${c.providerVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] hover:bg-slate-50"
                          >
                            Open on YouTube ↗
                          </a>
                          <form action={`/api/admin/youtube-discovery/candidates/${c.id}`} method="post">
                            <input type="hidden" name="action" value="approve" />
                            <button type="submit" className="rounded-xl border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                              Approve
                            </button>
                          </form>
                          <form action={`/api/admin/youtube-discovery/candidates/${c.id}`} method="post">
                            <input type="hidden" name="action" value="import" />
                            <input type="hidden" name="isPrimary" value="on" />
                            <button type="submit" className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                              Import as primary
                            </button>
                          </form>
                          <form action={`/api/admin/youtube-discovery/candidates/${c.id}`} method="post">
                            <input type="hidden" name="action" value="import" />
                            <button type="submit" className="rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                              Import
                            </button>
                          </form>
                          <form action={`/api/admin/youtube-discovery/candidates/${c.id}`} method="post">
                            <input type="hidden" name="action" value="reject" />
                            <button type="submit" className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                              Reject
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </AdminShell>
  );
}
