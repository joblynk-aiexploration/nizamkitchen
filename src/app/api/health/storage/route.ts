import { NextResponse } from "next/server";
import { env } from "@/lib/env";

function buildStorageHealthUrl(endpoint: string) {
  const url = new URL(endpoint);
  url.pathname = "/minio/health/live";
  return url.toString();
}

export async function GET() {
  const healthUrl = buildStorageHealthUrl(env.OBJECT_STORAGE_ENDPOINT);

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Storage probe returned ${response.status}.`);
    }

    return NextResponse.json({
      ok: true,
      storage: "reachable",
      configured: Boolean(env.OBJECT_STORAGE_ENDPOINT && env.OBJECT_STORAGE_BUCKET),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        storage: "unreachable",
        configured: Boolean(env.OBJECT_STORAGE_ENDPOINT && env.OBJECT_STORAGE_BUCKET),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
