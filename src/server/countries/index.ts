import { AccessDeniedError, assertCountryAccess } from "@/lib/auth";
import type { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { auditAccessDenied } from "@/server/audit";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function requireCountryAccess(session: Session, countryCode: string) {
  try {
    assertCountryAccess(session, countryCode);
  } catch (error) {
    await auditAccessDenied({
      session,
      targetType: "country",
      targetId: countryCode,
      details: { reason: error instanceof AccessDeniedError ? error.code : "UNKNOWN" },
    });
    throw error;
  }
}

export async function listManageableCountries(session: Session) {
  if (
    session.user.platformRole === "platform_owner" ||
    session.user.platformRole === "platform_admin"
  ) {
    return prisma.country.findMany({
      orderBy: { countryName: "asc" },
    });
  }

  const allowedCountryCodes = session.countryAssignments.map(
    (assignment) => assignment.countryCode,
  );

  return prisma.country.findMany({
    where: {
      countryCode: {
        in: allowedCountryCodes,
      },
    },
    orderBy: { countryName: "asc" },
  });
}
