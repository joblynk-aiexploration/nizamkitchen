import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { destroySession, getCurrentSession, getRequestMetadata } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (session) {
    await createAuditLog({
      actorUserId: session.user.id,
      organizationId: session.activeOrganization?.id,
      countryCode: session.activeOrganization?.countryCode,
      action: "user.logout",
      targetType: "session",
      targetId: session.id,
      ...(await getRequestMetadata()),
    });
  }

  await destroySession(session?.sessionToken);

  return NextResponse.redirect(new URL("/login?message=Signed out successfully.", request.url), {
    status: 303,
  });
}
