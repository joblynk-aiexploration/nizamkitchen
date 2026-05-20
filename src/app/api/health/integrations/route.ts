import { NextResponse } from "next/server";
import { getIntegrationStatuses } from "@/server/admin/system-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const integrations = await getIntegrationStatuses();

    return NextResponse.json({
      ok: true,
      status: integrations.paymentHealth.failedWebhooks > 0 || integrations.storage.failingConfigurations > 0 ? "degraded" : "healthy",
      integrations,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        error: "Integration health check failed.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
