import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMembership } from "@/lib/auth/session";
import { formatQuantity, groupIngredientsBySection } from "@/lib/recipe-utils";
import { getRecipeById } from "@/server/recipes";

export const dynamic = "force-dynamic";

export default async function CookingModePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  await requireMembership();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const recipe = await getRecipeById(id);
  if (!recipe || !recipe.isPublished) notFound();

  const sections = groupIngredientsBySection(recipe.ingredients);
  const stepCount = recipe.steps.length;
  const selectedStepNumber = Math.min(Math.max(Number(query.step ?? "1") || 1, 1), Math.max(stepCount, 1));
  const step = recipe.steps[selectedStepNumber - 1] ?? null;
  const previousStep = Math.max(selectedStepNumber - 1, 1);
  const nextStep = Math.min(selectedStepNumber + 1, Math.max(stepCount, 1));

  return (
    <main className="mx-auto max-w-6xl space-y-5 pb-24">
      <div className="sticky top-0 z-10 -mx-5 border-b border-[var(--color-border)] bg-[var(--color-app-surface)]/95 px-5 py-4 backdrop-blur sm:mx-0 sm:rounded-b-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Cooking Mode</p>
            <h1 className="font-serif text-2xl font-semibold leading-tight text-[var(--color-ink)] sm:text-4xl">{recipe.name}</h1>
          </div>
          <Button asChild variant="secondary">
            <Link href={`/recipes/${recipe.id}`}>Exit</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Ingredients visible while cooking</h2>
          {Array.from(sections.entries()).map(([section, items]) => (
            <div key={section} className="mt-4">
              {sections.size > 1 ? (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{section}</p>
              ) : null}
              <ul className="space-y-2">
                {items.map((ri) => (
                  <li key={ri.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-base leading-7">
                    <span className="font-semibold text-[var(--color-ink)]">{formatQuantity(ri.quantity, ri.unit)}</span>{" "}
                    <span className="text-[var(--color-muted)]">{ri.ingredient.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>

        <Card className="min-h-[55vh]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">Step {selectedStepNumber} of {stepCount}</Badge>
            {step?.durationMinutes ? <Badge tone="neutral">~{step.durationMinutes} min</Badge> : null}
          </div>

          {step ? (
            <div className="mt-6">
              {step.title ? <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{step.title}</h2> : null}
              <p className="mt-4 text-2xl leading-10 text-[var(--color-ink)] sm:text-3xl sm:leading-[3.2rem]">
                {step.instruction}
              </p>
              {step.tips ? (
                <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-base leading-7 text-amber-900">Tip: {step.tips}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-6 text-lg text-[var(--color-muted)]">No steps have been added yet.</p>
          )}

          <div className="mt-8 grid grid-cols-2 gap-3">
            <Button asChild variant="secondary">
              <Link aria-label="Previous cooking step" href={`/recipes/${recipe.id}/cooking?step=${previousStep}`}>Previous</Link>
            </Button>
            <Button asChild>
              <Link aria-label="Next cooking step" href={`/recipes/${recipe.id}/cooking?step=${nextStep}`}>Next</Link>
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
