"use client";

import { useRouter } from "next/navigation";
import type { IntegrationProvider } from "@prisma/client";
import { cn } from "@/lib/utils";

type ProviderOption = {
  value: IntegrationProvider;
  label: string;
};

export function ApiProviderPicker({
  selectedProvider,
  options,
}: {
  selectedProvider: IntegrationProvider;
  options: ProviderOption[];
}) {
  const router = useRouter();

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
      <span>API type</span>
      <select
        name="providerPicker"
        value={selectedProvider}
        onChange={(event) => router.push(`/admin/apis/new?provider=${event.target.value}`)}
        className={cn(
          "rounded-2xl border border-[var(--color-border)] bg-[var(--background-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition",
          "focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-xs font-normal text-[var(--color-muted)]">
        Selecting an API type updates the required setup fields below.
      </span>
    </label>
  );
}
