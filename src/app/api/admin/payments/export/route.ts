import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import { exportPaymentsCsv } from "@/server/payments/operations";

export const dynamic = "force-dynamic";

const exportTypes = new Set(["transactions", "refunds", "disputes", "payouts", "commissions"]);

export async function GET(request: Request) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const type = new URL(request.url).searchParams.get("type") ?? "transactions";
  if (!exportTypes.has(type)) return NextResponse.json({ error: "Unsupported export type." }, { status: 400 });
  const csv = await exportPaymentsCsv(session, type as "transactions" | "refunds" | "disputes" | "payouts" | "commissions");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="payment-${type}.csv"`,
    },
  });
}
