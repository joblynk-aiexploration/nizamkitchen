"use client";

import { useState } from "react";

type VideoRef = {
  url: string;
  title: string;
  creatorName: string | null;
  language: string | null;
  notes: string | null;
  isPrimary: boolean;
  displayOrder: number;
};

type Props = {
  ref_: VideoRef;
  formAction: string;
};

export function EditVideoRefForm({ ref_, formAction }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] hover:bg-slate-50"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="w-full">
      <form action={formAction} method="post" className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
            YouTube URL
          </label>
          <input
            name="url"
            defaultValue={ref_.url}
            placeholder="https://www.youtube.com/watch?v=..."
            required
            className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
            Title
          </label>
          <input
            name="title"
            defaultValue={ref_.title}
            required
            className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
            Creator / Channel
          </label>
          <input
            name="creatorName"
            defaultValue={ref_.creatorName ?? ""}
            className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
            Language
          </label>
          <select
            name="language"
            defaultValue={ref_.language ?? ""}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
          >
            <option value="">No language</option>
            <option value="en">English</option>
            <option value="ur">Urdu</option>
            <option value="hi">Hindi</option>
            <option value="ar">Arabic</option>
            <option value="te">Telugu</option>
            <option value="ta">Tamil</option>
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
          <input type="checkbox" name="isPrimary" defaultChecked={ref_.isPrimary} />
          <span>Primary video</span>
        </label>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-[var(--color-muted)]">
            Notes
          </label>
          <textarea
            name="notes"
            defaultValue={ref_.notes ?? ""}
            rows={2}
            className="w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
          />
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            className="rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
