import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getObservabilitySnapshot } from "@/server/observability";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "nizamkitchen",
    environment: env.DEPLOYMENT_ENVIRONMENT,
    uptimeSeconds: Math.round(process.uptime()),
    version: process.env.npm_package_version ?? "0.1.0",
    observability: getObservabilitySnapshot(),
    timestamp: new Date().toISOString(),
  });
}
