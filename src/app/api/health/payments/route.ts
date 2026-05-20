import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [activeGateways, failedWebhooks, failedPayments, pendingRefunds] = await Promise.all([
      prisma.paymentGateway.count({ where: { status: "active" } }),
      prisma.paymentWebhookEvent.count({ where: { status: "failed" } }),
      prisma.paymentOrder.count({ where: { status: "failed" } }),
      prisma.paymentRefund.count({ where: { status: { in: ["requested", "processing"] } } }),
    ]);

    return NextResponse.json({
      ok: failedWebhooks === 0,
      status: failedWebhooks > 0 ? "degraded" : "healthy",
      payments: {
        activeGateways,
        failedWebhooks,
        failedPayments,
        pendingRefunds,
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY) || activeGateways > 0,
        paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID),
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        error: "Payment health check failed.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
