import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getObservabilitySnapshot } from "@/server/observability";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "_prisma_migrations"`;
  } catch {
    return NextResponse.json({
      ok: false,
      service: "nizamkitchen",
      environment: env.DEPLOYMENT_ENVIRONMENT,
      database: "unreachable",
      migrations: "unreachable",
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    service: "nizamkitchen",
    environment: env.DEPLOYMENT_ENVIRONMENT,
    database: "reachable",
    migrations: "reachable",
    prismaClient: "healthy",
    uptimeSeconds: Math.round(process.uptime()),
    version: process.env.npm_package_version ?? "0.1.0",
    observability: getObservabilitySnapshot(),
    timestamp: new Date().toISOString(),
  });
}
