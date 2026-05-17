import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDangerZone } from "@/components/admin/admin-danger-zone";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { getRecipeById } from "@/server/recipes";
import { formatTotalTime, groupIngredientsBySection } from "@/lib/recipe-utils";
import { isAIVideoAnalysisAvailable, getVideoAnalysisConfig } from "@/lib/video-analysis-config";
import { isYouTubeDiscoveryAvailable } from "@/lib/youtube-discovery-config";
import { getVideoAnalysesForReference } from "@/server/video-analysis/video-analysis-service";
import { listAnalysisJobsForReference } from "@/server/video-analysis/video-analysis-jobs";
import { listCandidatesForRecipe } from "@/server/youtube-discovery/candidate-service";
import { getDiscoveryRunsForRecipe } from "@/server/youtube-discovery/discovery-service";
import { VideoReferenceCard } from "@/components/video/video-reference-card";
import { VideoAnalysisDisplay } from "@/components/video/video-analysis-display";
import { AIAnalysisButton } from "@/components/video/ai-analysis-button";
import { FormMessage } from "@/components/ui/form-message";
import { formatYouTubeDuration } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export default async function AdminRecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
    "auditor",
  ]);
  const { id } = await params;
  const { message } = await searchParams;
  const recipe = await getRecipeById(id);

  if (!recipe) notFound();

  const canMutate =
    session.user.platformRole === "platform_owner" ||
    session.user.platformRole === "platform_admin";

  const sections = groupIngredientsBySection(recipe.ingredients);
  const aiConfigured = isAIVideoAnalysisAvailable();
  const aiProviderName = getVideoAnalysisConfig().provider;
  const discoveryAvailable = isYouTubeDiscoveryAvailable();

  const youtubeRefs = recipe.mediaRefs
    .filter((r) => r.type === "youtube")
    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || a.displayOrder - b.displayOrder);

  // Fetch analyses, jobs, and candidates in parallel
  const [refAnalysisData, candidates, discoveryRuns] = await Promise.all([
    Promise.all(
      youtubeRefs.map(async (ref) => {
        const [analyses, jobs] = await Promise.all([
          getVideoAnalysesForReference(ref.id),
          listAnalysisJobsForReference(ref.id),
        ]);
        return { ref, analyses, jobs };
      }),
    ),
    listCandidatesForRecipe(id),
    getDiscoveryRunsForRecipe(id),
  ]);

  const pendingCandidates = candidates.filter((c) => c.status === "pending");
  const importedCandidates = candidates.filter((c) => c.status === "imported");
  const rejectedCandidates = candidates.filter((c) => c.status === "rejected");

  async function togglePublished() {
    "use server";
    try {
      const { requirePlatformRole: getSession } = await import("@/lib/auth/session");
      const { updateRecipe } = await import("@/server/recipes");
      const { revalidatePath } = await import("next/cache");
      const sess = await getSession(["platform_owner", "platform_admin"]);
      const current = await (await import("@/server/recipes")).getRecipeById(id);
      if (!current) redirect("/admin/recipe-library?message=Recipe not found.");
      await updateRecipe(sess, id, { isPublished: !current.isPublished });
      revalidatePath(`/admin/recipe-library/${id}`);
      revalidatePath("/admin/recipe-library");
    } catch (error) {
      rethrowIfRedirectError(error);
      redirect(`/admin/recipe-library/${id}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update recipe publication."))}`);
    }
  }

  return (
    <AdminShell
      session={session}
      title={recipe.name}
      description={`${recipe.cuisine.name} · ${formatTotalTime(recipe)} · ${recipe.servings} servings`}
    >
      {message && <FormMessage message={message} />}

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{recipe.difficulty}</Badge>
        <Badge tone="warning">{recipe.spiceLevel}</Badge>
        <Badge tone={recipe.isPublished ? "success" : "neutral"}>
          {recipe.isPublished ? "Published" : "Draft"}
        </Badge>
        {recipe.isGlobal && <Badge tone="info">global</Badge>}
        {recipe.visibility !== "global" && <Badge tone="warning">{recipe.visibility}</Badge>}
        {recipe.countryCode && <Badge tone="neutral">{recipe.countryCode}</Badge>}
        {recipe.dietaryTags.map(({ dietaryTag }) => (
          <Badge key={dietaryTag.id} tone="success">{dietaryTag.name}</Badge>
        ))}
      </div>

      {recipe.description && (
        <Card>
          <p className="text-sm text-[var(--color-ink)]">{recipe.description}</p>
          {recipe.story && (
            <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-xs italic text-[var(--color-muted)]">
              {recipe.story}
            </p>
          )}
        </Card>
      )}

      {/* ── Video References Section ── */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold text-[var(--color-ink)]">
            Video references ({youtubeRefs.length})
          </h2>
          {canMutate && (
            <Button asChild variant="secondary">
              <a href="#add-video-ref">Add video</a>
            </Button>
          )}
        </div>

        {youtubeRefs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No video references yet.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {refAnalysisData.map(({ ref, analyses, jobs }) => (
              <div key={ref.id} className="space-y-4 rounded-2xl border border-[var(--color-border)] p-4">
                <VideoReferenceCard ref_={ref} showEmbed={false} isAdmin />

                <div className="flex flex-wrap items-center gap-2">
                  {ref.isPrimary && <Badge tone="success">Primary</Badge>}
                  <Badge tone="neutral">{ref.language ?? "no language"}</Badge>
                  {ref.creatorName && <span className="text-sm text-[var(--color-muted)]">{ref.creatorName}</span>}
                  {canMutate && (
                    <form action="/api/admin/youtube-discovery/recheck-availability" method="post" className="ml-auto">
                      <input type="hidden" name="target" value="media_reference" />
                      <input type="hidden" name="mediaReferenceId" value={ref.id} />
                      <button type="submit" className="rounded-xl border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)] hover:bg-slate-50">
                        Recheck availability
                      </button>
                    </form>
                  )}
                </div>

                {/* Analysis controls */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      AI analysis ({analyses.length})
                    </p>
                    {canMutate && (
                      <AIAnalysisButton
                        recipeId={recipe.id}
                        recipeMediaReferenceId={ref.id}
                        aiConfigured={aiConfigured}
                        providerName={aiProviderName}
                        videoAvailable={ref.availabilityStatus !== "unavailable" && ref.availabilityStatus !== "restricted"}
                      />
                    )}
                  </div>

                  {/* Job status */}
                  {jobs.slice(0, 3).map((job) => (
                    <div key={job.id} className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      <span className={`inline-block h-2 w-2 rounded-full ${
                        job.status === "completed" ? "bg-emerald-500"
                        : job.status === "failed" ? "bg-red-500"
                        : job.status === "running" ? "bg-amber-500"
                        : "bg-slate-300"
                      }`} />
                      Job {job.status} · {job.sourceType} · {job.createdAt.toLocaleDateString()}
                      {job.errorMessage && (
                        <span className="text-red-600"> — {job.errorMessage}</span>
                      )}
                    </div>
                  ))}

                  {analyses.map((analysis) => (
                    <div key={analysis.id} className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={
                          analysis.verificationStatus === "verified" ? "success"
                          : analysis.verificationStatus === "rejected" ? "neutral"
                          : analysis.verificationStatus === "needs_review" ? "warning"
                          : "info"
                        }>
                          {analysis.verificationStatus}
                        </Badge>
                        <Badge tone="neutral">{analysis.confidence}</Badge>
                        {analysis.aiProvider && <Badge tone="neutral">source: {analysis.aiProvider}</Badge>}
                        {analysis.rawTranscriptProvided && <Badge tone="info">transcript provided</Badge>}
                        <span className="text-xs text-[var(--color-muted)]">
                          {analysis.createdAt.toLocaleDateString()}
                        </span>

                        {/* Verification controls */}
                        {canMutate && analysis.verificationStatus !== "verified" && (
                          <form action={`/api/video-analysis/analyses/${analysis.id}/verify`} method="post" className="flex gap-2">
                            <input type="hidden" name="verificationStatus" value="verified" />
                            <button type="submit" className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                              Verify and add to training data
                            </button>
                          </form>
                        )}
                        {canMutate && analysis.verificationStatus !== "rejected" && (
                          <form action={`/api/video-analysis/analyses/${analysis.id}/verify`} method="post" className="flex gap-2">
                            <input type="hidden" name="verificationStatus" value="rejected" />
                            <button type="submit" className="rounded-xl bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">
                              Reject
                            </button>
                          </form>
                        )}
                        {canMutate && analysis.verificationStatus !== "needs_review" && (
                          <form action={`/api/video-analysis/analyses/${analysis.id}/verify`} method="post" className="flex gap-2">
                            <input type="hidden" name="verificationStatus" value="needs_review" />
                            <button type="submit" className="rounded-xl border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)] hover:bg-slate-50">
                              Needs review
                            </button>
                          </form>
                        )}
                      </div>
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
                        Only verified corrected analyses should become training data.
                        {analysis.aiProvider === "mock" ? " Mock output should not be used unless an admin has manually corrected it first." : ""}
                      </div>
                      <VideoAnalysisDisplay analysis={analysis} />
                    </div>
                  ))}
                </div>

                {/* Edit/delete controls */}
                {canMutate && (
                  <div className="flex gap-2 border-t border-[var(--color-border)] pt-3">
                    <form action={`/api/admin/recipe-library/${recipe.id}/media-references/${ref.id}`} method="post">
                      <input type="hidden" name="_method" value="DELETE" />
                      <button
                        type="submit"
                        className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          if (!confirm("Remove this video reference?")) e.preventDefault();
                        }}
                      >
                        Remove
                      </button>
                    </form>
                    {!ref.isPrimary && (
                      <form action={`/api/admin/recipe-library/${recipe.id}/media-references/${ref.id}`} method="post">
                        <input type="hidden" name="isPrimary" value="on" />
                        <button type="submit" className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] hover:bg-slate-50">
                          Set as primary
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add video reference form */}
        {canMutate && (
          <div id="add-video-ref" className="mt-6 border-t border-[var(--color-border)] pt-6">
            <h3 className="mb-4 font-semibold text-[var(--color-ink)]">Add video reference</h3>
            <form
              action={`/api/admin/recipe-library/${recipe.id}/media-references`}
              method="post"
              className="grid gap-4 sm:grid-cols-2"
            >
              <input type="hidden" name="type" value="youtube" />
              <input type="hidden" name="provider" value="youtube" />
              <div className="sm:col-span-2">
                <input
                  name="url"
                  placeholder="YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
                  required
                  className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>
              <input name="title" placeholder="Video title" required className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <input name="creatorName" placeholder="Creator / Channel name" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
              <select name="language" defaultValue="" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
                <option value="">Language (optional)</option>
                <option value="en">English</option>
                <option value="ur">Urdu</option>
                <option value="hi">Hindi</option>
                <option value="ar">Arabic</option>
                <option value="te">Telugu</option>
                <option value="ta">Tamil</option>
              </select>
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                <input type="checkbox" name="isPrimary" />
                <span>Set as primary video</span>
              </label>
              <textarea
                name="notes"
                placeholder="Notes (optional)"
                rows={2}
                className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm sm:col-span-2"
              />
              <div className="sm:col-span-2">
                <Button type="submit" variant="primary">Add video reference</Button>
              </div>
            </form>
          </div>
        )}
      </Card>

      {/* ── YouTube Discovery Candidates ── */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[var(--color-ink)]">
              YouTube candidates ({pendingCandidates.length} pending, {importedCandidates.length} imported)
            </h2>
            {discoveryRuns.length > 0 && (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Last run: {discoveryRuns[0].createdAt.toLocaleDateString()} · status: {discoveryRuns[0].status}
              </p>
            )}
          </div>
          {canMutate && (
            <div className="flex gap-2">
              {discoveryAvailable ? (
                <form action="/api/admin/youtube-discovery/runs" method="post">
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <input type="hidden" name="forceRefresh" value="true" />
                  <Button type="submit" variant="secondary">
                    {pendingCandidates.length > 0 ? "Refresh candidates" : "Discover videos"}
                  </Button>
                </form>
              ) : (
                <p className="text-xs text-[var(--color-muted)]">
                  YouTube discovery not configured.{" "}
                  <a href="/admin/youtube-discovery" className="text-[var(--color-primary)] hover:underline">
                    Setup →
                  </a>
                </p>
              )}
            </div>
          )}
        </div>

        {pendingCandidates.length === 0 && importedCandidates.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            No candidates yet.{discoveryAvailable ? " Click Discover videos to search YouTube." : ""}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {pendingCandidates.map((c) => (
              <div key={c.id} className="flex gap-4 rounded-2xl border border-[var(--color-border)] p-4">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt={c.title} width={120} height={68}
                    className="h-17 w-28 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="h-16 w-28 shrink-0 rounded-xl bg-slate-100" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-[var(--color-ink)] line-clamp-2">{c.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">{c.channelTitle}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-[var(--color-muted)]">
                    {c.durationSeconds != null && <span>⏱ {formatYouTubeDuration(c.durationSeconds)}</span>}
                    {c.viewCount != null && <span>👁 {(Number(c.viewCount) / 1000).toFixed(0)}K</span>}
                    <Badge tone={c.score >= 30 ? "success" : c.score >= 0 ? "neutral" : "danger"}>
                      Score {c.score.toFixed(0)}
                    </Badge>
                  </div>
                  {Array.isArray(c.professionalSignalsJson) && (c.professionalSignalsJson as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(c.professionalSignalsJson as string[]).map((s, i) => (
                        <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{s}</span>
                      ))}
                    </div>
                  )}
                  {canMutate && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a href={`https://www.youtube.com/watch?v=${c.providerVideoId}`}
                        target="_blank" rel="noopener noreferrer"
                        className="rounded-xl border border-[var(--color-border)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)] hover:bg-slate-50">
                        Open on YouTube ↗
                      </a>
                      <form action={`/api/admin/youtube-discovery/candidates/${c.id}`} method="post">
                        <input type="hidden" name="action" value="approve" />
                        <button type="submit"
                          className="rounded-xl border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                          Approve
                        </button>
                      </form>
                      <form action={`/api/admin/youtube-discovery/candidates/${c.id}`} method="post">
                        <input type="hidden" name="action" value="import" />
                        <input type="hidden" name="isPrimary" value="on" />
                        <button type="submit"
                          className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                          Import as primary
                        </button>
                      </form>
                      <form action={`/api/admin/youtube-discovery/candidates/${c.id}`} method="post">
                        <input type="hidden" name="action" value="import" />
                        <button type="submit"
                          className="rounded-xl border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                          Import
                        </button>
                      </form>
                      <form action={`/api/admin/youtube-discovery/candidates/${c.id}`} method="post">
                        <input type="hidden" name="action" value="reject" />
                        <button type="submit"
                          className="rounded-xl border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                          Reject
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {rejectedCandidates.length > 0 && (
              <p className="text-xs text-[var(--color-muted)]">
                {rejectedCandidates.length} rejected candidate{rejectedCandidates.length !== 1 ? "s" : ""} hidden.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Ingredients & Steps */}
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">
            Ingredients ({recipe.ingredients.length})
          </h2>
          {Array.from(sections.entries()).map(([section, items]) => (
            <div key={section} className="mt-4">
              {sections.size > 1 && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  {section}
                </p>
              )}
              <ul className="space-y-1">
                {items.map((ri) => (
                  <li key={ri.id} className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm odd:bg-slate-50">
                    <span className="font-mono text-xs font-medium text-slate-500">
                      {ri.quantity}{ri.unit.symbol ?? ri.unit.code}
                    </span>
                    <span>
                      <Link href={`/admin/ingredients/${ri.ingredientId}`} className="hover:text-[var(--color-primary)]">
                        {ri.ingredient.name}
                      </Link>
                      {ri.preparationNote && (
                        <span className="italic text-[var(--color-muted)]">, {ri.preparationNote}</span>
                      )}
                      {ri.isOptional && <span className="ml-1 text-xs text-slate-400">(optional)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>

        <div className="space-y-4">
          <h2 className="font-semibold text-[var(--color-ink)]">Steps</h2>
          {recipe.steps.map((step) => (
            <Card key={step.id}>
              <div className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                  {step.stepNumber}
                </div>
                <div>
                  {step.title && <p className="font-semibold text-[var(--color-ink)]">{step.title}</p>}
                  <p className="mt-1 text-sm text-[var(--color-ink)]">{step.instruction}</p>
                  {step.durationMinutes && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">~{step.durationMinutes} min</p>
                  )}
                  {step.tips && (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Tip: {step.tips}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {canMutate && (
        <AdminDangerZone
          title="Publication control"
          description={
            recipe.isPublished
              ? "This recipe is currently published and visible to all organizations."
              : "This recipe is a draft and not visible to users."
          }
        >
          <form action={togglePublished}>
            <button
              type="submit"
              className={`rounded-2xl px-4 py-2 text-sm font-semibold text-white ${
                recipe.isPublished
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {recipe.isPublished ? "Unpublish recipe" : "Publish recipe"}
            </button>
          </form>
        </AdminDangerZone>
      )}
    </AdminShell>
  );
}
