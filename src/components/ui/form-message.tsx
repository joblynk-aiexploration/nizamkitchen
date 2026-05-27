const errorPattern = /\b(unable|invalid|error|denied|failed|failure|required|missing|not found|cannot|can't|must|choose|too many|already exists|expired|blocked|unavailable|unsupported|not allowed|permission)\b/i;
const warningPattern = /\b(not configured|configure|configuration|setup|disabled|not enabled|not available yet)\b/i;

export function getFormMessageTone(message: string) {
  if (warningPattern.test(message)) {
    return "warning";
  }

  return errorPattern.test(message) ? "error" : "success";
}

export function FormMessage({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  const tone = getFormMessageTone(message);
  const isError = tone === "error";
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : isError
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${toneClass}`}
    >
      {message}
    </div>
  );
}
