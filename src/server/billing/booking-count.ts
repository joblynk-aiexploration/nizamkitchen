import { prisma } from "@/lib/prisma";

// HomeChefRequestOffer is not visible on PrismaClient under moduleResolution:
// "bundler" — the @prisma/client re-export chain can't resolve .prisma/client
// relative to the @prisma/client package directory (see AGENTS.md).
// The delegate exists at runtime; we narrow to its count signature via a
// typed Record access rather than a global cast or @ts-ignore.
type OfferCountWhere = {
  chefProfile?: { organizationId?: string };
  status?: string;
  acceptedAt?: { gte?: Date | null };
};

function offerCountDelegate(): { count(args: { where?: OfferCountWhere }): Promise<number> } {
  return (prisma as unknown as Record<string, unknown>)[
    "homeChefRequestOffer"
  ] as ReturnType<typeof offerCountDelegate>;
}

/**
 * Counts accepted HomeChefRequestOffer rows for an org since the given date.
 *
 * Uses acceptedAt for precision. Rows with status="accepted" but acceptedAt=null
 * (legacy data) are intentionally excluded — the acceptance service always sets
 * acceptedAt=now, so null rows pre-date the acceptedAt column.
 */
export function countAcceptedOffers(organizationId: string, since: Date): Promise<number> {
  return offerCountDelegate().count({
    where: {
      chefProfile: { organizationId },
      status: "accepted",
      acceptedAt: { gte: since },
    },
  });
}
