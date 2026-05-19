"use client";

type Props = {
  formAction: string;
  hiddenFields?: Record<string, string>;
  label?: string;
  confirmMessage?: string;
  className?: string;
};

export function ConfirmRemoveButton({
  formAction,
  hiddenFields,
  label = "Remove",
  confirmMessage = "Remove this item?",
  className = "rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50",
}: Props) {
  return (
    <form
      action={formAction}
      method="post"
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
