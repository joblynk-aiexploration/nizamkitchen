import { NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/auth/session";
import { exportAccountingCsv } from "@/server/accounting/accounting-service";

export const dynamic = "force-dynamic";

const allowed = new Set(["invoices", "receipts", "commissions", "settlements", "taxes"]);

export async function GET(request: Request) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "invoices";
  if (!allowed.has(type)) {
    return NextResponse.json({ error: "Unsupported export type." }, { status: 400 });
  }
  const csv = await exportAccountingCsv(session, type as never);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="accounting-${type}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
