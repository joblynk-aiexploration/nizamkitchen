import { NextResponse } from "next/server";
import { paypalAdapter } from "@/server/payments/providers/paypal/paypal-adapter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentOrderId = url.searchParams.get("orderId");
  const token = url.searchParams.get("token");
  if (!paymentOrderId || !token) return NextResponse.redirect(new URL("/orders?payment=failed", url.origin));

  try {
    await paypalAdapter.capturePayment({ providerOrderId: token });
    const order = await prisma.paymentOrder.findUnique({ where: { id: paymentOrderId } });
    const redirectPath = order?.module === "home_chef_request"
      ? `/home-chef/requests/${order.moduleEntityId}?payment=success`
      : `/orders/${order?.moduleEntityId ?? ""}?payment=success`;
    return NextResponse.redirect(new URL(redirectPath, url.origin));
  } catch (error) {
    console.error("[paypal-capture] failed", error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL("/orders?payment=failed", url.origin));
  }
}
