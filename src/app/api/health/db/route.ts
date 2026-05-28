import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      database: "reachable",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "unreachable",
        error: "Database health check failed.",
      },
      { status: 503 },
    );
  }
}
