import { getAppBaseUrl, getSafeRedirectUrl, isProductionRuntime } from "@/lib/app-url";

function isInternalHost(hostname: string) {
  return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname);
}

function envAppOrigin() {
  return getAppBaseUrl();
}

export function getPublicOriginFromHeaders(headers: Headers, requestOrigin?: string) {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const originalHost = headers.get("x-original-host")?.split(",")[0]?.trim();
  const host = forwardedHost ?? originalHost ?? headers.get("host")?.split(",")[0]?.trim();
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedSsl = headers.get("x-forwarded-ssl");
  const scheme = headers.get("x-url-scheme");
  const requestProtocol = requestOrigin ? new URL(requestOrigin).protocol.replace(":", "") : undefined;
  const protocol = forwardedProto ?? scheme ?? (forwardedSsl === "on" ? "https" : requestProtocol ?? "http");

  if (host) {
    try {
      const candidate = new URL(`${protocol}://${host}`);
      if (!isProductionRuntime() || !isInternalHost(candidate.hostname)) {
        return candidate.origin;
      }
    } catch {
      // Fall through to APP_URL/request origin below.
    }
  }

  if (isProductionRuntime()) {
    return envAppOrigin();
  }

  return requestOrigin ?? envAppOrigin();
}

export function getPublicRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = getPublicOriginFromHeaders(request.headers, requestUrl.origin);

  if (isProductionRuntime() && isInternalHost(new URL(origin).hostname)) {
    return envAppOrigin();
  }

  return origin;
}

export function publicRedirectUrl(path: string, request: Request) {
  return new URL(getSafeRedirectUrl(path, "/dashboard"), getPublicRequestOrigin(request));
}
