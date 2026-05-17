import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "card-shadow rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}
