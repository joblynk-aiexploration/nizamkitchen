export function FormMessage({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  const isError = /invalid|error|denied/i.test(message);

  return (
    <div
      className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
        isError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {message}
    </div>
  );
}
