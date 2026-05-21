import { getGooglePlatformPublicConfig } from "@/server/seo/seo-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getGooglePlatformPublicConfig();
  const line = config.adsTxtLine ?? (config.adsensePublisherId ? `google.com, ${config.adsensePublisherId.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0` : "");
  return new Response(line ? `${line}\n` : "# AdSense is not configured.\n", {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
