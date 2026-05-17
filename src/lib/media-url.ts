const BLOCKED_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:"]);
const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

export function isSafeUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.startsWith("<")) return false; // reject HTML
  try {
    const url = new URL(trimmed);
    if (BLOCKED_PROTOCOLS.has(url.protocol)) return false;
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function sanitizeOptionalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return isSafeUrl(raw) ? raw.trim() : null;
}
