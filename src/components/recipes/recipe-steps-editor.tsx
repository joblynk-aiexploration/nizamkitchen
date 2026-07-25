"use client";

import { Button } from "@/components/ui/button";

type ExistingRecipeStep = {
  id: string;
  stepNumber: number;
  title?: string | null;
  instruction: string;
  durationMinutes?: number | null;
  temperature?: string | null;
  tips?: string | null;
  displayOrder?: number;
};

type Props = {
  steps: ExistingRecipeStep[];
  addStepAction: (formData: FormData) => void | Promise<void>;
  updateStepAction: (formData: FormData) => void | Promise<void>;
  deleteStepAction: (formData: FormData) => void | Promise<void>;
  moveStepAction: (formData: FormData) => void | Promise<void>;
};

export function RecipeStepsEditor({
  steps,
  addStepAction,
  updateStepAction,
  deleteStepAction,
  moveStepAction,
}: Props) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-white shadow-sm">
      <div className="border-b border-[var(--color-border)] bg-gradient-to-r from-slate-50 via-white to-emerald-50 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
          Step Builder
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
              Shape the cooking flow
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
              Keep each instruction clear, ordered, and easy to follow while cooking.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200">
            {steps.length} steps
          </span>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {steps.length ? (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <article key={step.id} className="rounded-3xl border border-[var(--color-border)] bg-slate-50/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">
                        {step.title || `Step ${index + 1}`}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {step.durationMinutes ? `${step.durationMinutes} min` : "No duration set"}
                        {step.temperature ? ` · ${step.temperature}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={moveStepAction}>
                      <input type="hidden" name="stepId" value={step.id} />
                      <input type="hidden" name="direction" value="up" />
                      <Button type="submit" variant="secondary" className="min-h-9 px-3 py-1.5 text-xs">
                        Move up
                      </Button>
                    </form>
                    <form action={moveStepAction}>
                      <input type="hidden" name="stepId" value={step.id} />
                      <input type="hidden" name="direction" value="down" />
                      <Button type="submit" variant="secondary" className="min-h-9 px-3 py-1.5 text-xs">
                        Move down
                      </Button>
                    </form>
                    <form
                      action={deleteStepAction}
                      onSubmit={(event) => {
                        if (!confirm(`Remove step ${index + 1} from this recipe?`)) event.preventDefault();
                      }}
                    >
                      <input type="hidden" name="stepId" value={step.id} />
                      <Button type="submit" variant="danger" className="min-h-9 px-3 py-1.5 text-xs">
                        Remove step
                      </Button>
                    </form>
                  </div>
                </div>

                <form action={updateStepAction} className="mt-4 grid gap-3 md:grid-cols-2">
                  <input type="hidden" name="stepId" value={step.id} />
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Step title
                    </label>
                    <input
                      name="title"
                      type="text"
                      defaultValue={step.title ?? ""}
                      placeholder="Optional title"
                      className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Duration
                    </label>
                    <input
                      name="durationMinutes"
                      type="number"
                      min="0"
                      defaultValue={step.durationMinutes ?? ""}
                      placeholder="Minutes"
                      className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Instruction
                    </label>
                    <textarea
                      name="instruction"
                      required
                      rows={3}
                      defaultValue={step.instruction}
                      className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Temperature
                    </label>
                    <input
                      name="temperature"
                      type="text"
                      defaultValue={step.temperature ?? ""}
                      placeholder="Optional"
                      className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Cooking tip
                    </label>
                    <input
                      name="tips"
                      type="text"
                      defaultValue={step.tips ?? ""}
                      placeholder="Optional"
                      className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex justify-end md:col-span-2">
                    <Button type="submit">Update step</Button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-slate-50 p-6 text-sm text-[var(--color-muted)]">
            No steps have been added yet. Add the first instruction below.
          </div>
        )}

        <form action={addStepAction} className="space-y-4 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-4 sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">Add cooking step</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Use one clear action per step so the recipe stays easy to cook.</p>
          </div>
          <input
            name="title"
            type="text"
            placeholder="Step title (optional)"
            className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <textarea
            name="instruction"
            required
            rows={3}
            placeholder="Step instruction..."
            className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <input
              name="durationMinutes"
              type="number"
              min="0"
              placeholder="Duration (min)"
              className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <input
              name="temperature"
              type="text"
              placeholder="Temperature (optional)"
              className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <input
              name="tips"
              type="text"
              placeholder="Tip (optional)"
              className="rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit">Add step</Button>
        </form>
      </div>
    </section>
  );
}
