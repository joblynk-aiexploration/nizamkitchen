import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "card-shadow rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
