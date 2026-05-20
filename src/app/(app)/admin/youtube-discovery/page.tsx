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
import { getAllRecipeVideoCoverage, getCoverageSummary } from "@/server/youtube-discovery/video-coverage";
import { formatYouTubeDuration } from "@/lib/youtube";
import type { RecipeVideoCoverageStatus } from "@/server/youtube-discovery/video-coverage";

export const dynamic = "force-dynamic";

function runStatusTone(status: string): "success" | "warning" | "neutral" | "danger" {
  if (status === "completed") return "success";
  if (status === "running") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

function coverageTone(status: RecipeVideoCoverageStatus): "success" | "warning" | "neutral" | "danger" {
  if (status === "covered") return "success";
  if (status === "needs_video") return "warning";
  if (status === "video_broken") return "danger";
  return "neutral";
}

function coverageLabel(status: RecipeVideoCoverageStatus): string {
  if (status === "covered") return "Covered";
  if (status === "needs_video") return "Needs video";
  if (status === "video_broken") return "Video broken";
  return "Unchecked";
}

export default async function YouTubeDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; tab?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { message } = await searchParams;
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  const [discoveryAvailable, cfg] = await Promise.all([
    isYouTubeDiscoveryAvailable(),
    getYouTubeDiscoveryConfig(),
  ]);

  const [summary, coverageRows, recentRuns, groupedCandidates] = await Promise.all([
    getCoverageSummary(),
    getAllRecipeVideoCoverage(),
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
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Without the API key you can still manually import YouTube URLs on any recipe page — they will be saved as unchecked until verified.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Coverage summary cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <p className="text-2xl font-bold text-[var(--color-ink)]">{summary.total}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Published recipes</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-emerald-600">{summary.covered}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Covered</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-amber-600">{summary.needsVideo}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Needs video</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-red-600">{summary.videoBroken}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Video broken</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-[var(--color-ink)]">{summary.coveragePercent}%</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Coverage</p>
        </Card>
      </div>

      {/* ── Bulk actions ── */}
      {canMutate && (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Bulk actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {discoveryAvailable && (
              <>
                <form action="/api/admin/youtube-discovery/runs" method="post">
                  <input type="hidden" name="mode" value="missing" />
                  <Button type="submit" variant="primary">Discover videos for missing recipes</Button>
                </form>
                <form action="/api/admin/youtube-discovery/runs" method="post">
                  <input type="hidden" name="mode" value="all" />
                  <Button type="submit" variant="secondary">Discover videos for all recipes</Button>
                </form>
                <form action="/api/admin/youtube-discovery/auto-import" method="post">
                  <Button type="submit" variant="secondary">
                    Auto-import best candidates (score ≥ 50)
                  </Button>
                </form>
              </>
            )}
            <form action="/api/admin/youtube-discovery/recheck-availability" method="post">
              <input type="hidden" name="target" value="all" />
              <Button type="submit" variant="secondary">Recheck all video availability</Button>
            </form>
          </div>
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Auto-import only imports candidates with a quality score ≥ 50, no hard disqualifiers, and verified availability. Candidates below the threshold are left for manual review.
          </p>
        </Card>
      )}

      {/* ── Recipe coverage table ── */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold text-[var(--color-ink)]">
            Recipe video coverage ({coverageRows.length} published recipes)
          </h2>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                <th className="pb-2 pr-4">Recipe</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Primary video</th>
                <th className="pb-2 pr-4">Last checked</th>
                <th className="pb-2 pr-4">Candidates</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {coverageRows.map((row) => (
                <tr key={row.recipeId} className="py-3">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/recipe-library/${row.recipeId}`}
                      className="font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {row.recipeName}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge tone={coverageTone(row.status)}>
                      {coverageLabel(row.status)}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    {row.primaryRef ? (
                      <div className="min-w-0">
                        <p className="max-w-48 truncate text-[var(--color-ink)]">{row.primaryRef.title}</p>
                        <Badge tone={
                          row.primaryRef.availabilityStatus === "available" ? "success"
                          : row.primaryRef.availabilityStatus === "unavailable" ? "danger"
                          : "neutral"
                        }>
                          {row.primaryRef.availabilityStatus}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-[var(--color-muted)]">
                    {row.primaryRef?.lastAvailabilityCheckedAt
                      ? row.primaryRef.lastAvailabilityCheckedAt.toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {row.pendingCandidateCount > 0 ? (
                      <span className="text-[var(--color-muted)]">
                        {row.pendingCandidateCount} pending
                        {row.bestCandidateScore !== null && (
                          <span className="ml-1 text-xs">
                            (best: {row.bestCandidateScore.toFixed(0)})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {canMutate && row.status !== "covered" && discoveryAvailable && (
                        <form action="/api/admin/youtube-discovery/runs" method="post">
                          <input type="hidden" name="recipeId" value={row.recipeId} />
                          <input type="hidden" name="forceRefresh" value="true" />
                          <button type="submit" className="rounded-xl border border-[var(--color-border)] px-2 py-1 text-xs font-semibold text-[var(--color-muted)] hover:bg-slate-50">
                            Discover
                          </button>
                        </form>
                      )}
                      {canMutate && row.pendingCandidateCount > 0 && row.status !== "covered" && (
                        <form action="/api/admin/youtube-discovery/auto-import" method="post">
                          <input type="hidden" name="recipeId" value={row.recipeId} />
                          <button type="submit" className="rounded-xl border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                            Auto-import
                          </button>
                        </form>
                      )}
                      {canMutate && row.primaryRef && (
                        <form action="/api/admin/youtube-discovery/recheck-availability" method="post">
                          <input type="hidden" name="target" value="media_reference" />
                          <input type="hidden" name="mediaReferenceId" value={row.primaryRef.id} />
                          <button type="submit" className="rounded-xl border border-[var(--color-border)] px-2 py-1 text-xs font-semibold text-[var(--color-muted)] hover:bg-slate-50">
                            Recheck
                          </button>
                        </form>
                      )}
                      <Link
                        href={`/admin/recipe-library/${row.recipeId}`}
                        className="rounded-xl border border-[var(--color-border)] px-2 py-1 text-xs font-semibold text-[var(--color-muted)] hover:bg-slate-50"
                      >
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Recent discovery runs ── */}
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
              No pending candidates.{discoveryAvailable ? " Run discovery to find YouTube videos for your recipes." : ""}
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
                    {c.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
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
                        <Badge tone={c.score >= 50 ? "success" : c.score >= 20 ? "neutral" : "danger"}>
                          Score: {c.score.toFixed(0)}
                        </Badge>
                        {c.score >= 50 && (
                          <Badge tone="success">Qualifies for auto-import</Badge>
                        )}
                      </div>

                      {Array.isArray(c.professionalSignalsJson) && c.professionalSignalsJson.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(c.professionalSignalsJson as string[]).map((sig, i) => (
                            <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                              {sig}
                            </span>
                          ))}
                        </div>
                      )}

                      {Array.isArray(c.rejectionReasonsJson) && c.rejectionReasonsJson.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(c.rejectionReasonsJson as string[]).map((r, i) => (
                            <span key={i} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                              ⚠ {r}
                            </span>
                          ))}
                        </div>
                      )}

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
