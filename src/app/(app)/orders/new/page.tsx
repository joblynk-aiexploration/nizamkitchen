import { notFound } from "next/navigation";
import { CommerceSafetyNotice } from "@/components/commerce/commerce-safety-notice";
import { FoodOrderRequestForm } from "@/components/food-orders/order-forms";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listEnabledCountryPhoneOptions } from "@/server/localization/localization-service";
import { getGoogleMapsPublicConfig } from "@/server/maps/google-maps-config";
import { createFoodOrderAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewFoodOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ menuItemId?: string }>;
}) {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "household") {
    return <EmptyState title="Household orders only" description="Only household accounts can submit food order requests." />;
  }
  const { menuItemId } = await searchParams;
  if (!menuItemId) notFound();
  const [item, mapsConfig, phoneOptions] = await Promise.all([
    prisma.menuItem.findFirst({
      where: {
        id: menuItemId,
        status: "active",
        menu: { status: "active", visibility: "public" },
        organization: { status: { in: ["active", "paused"] } },
      },
      include: {
        organization: {
          select: { id: true, name: true, organizationType: true },
        },
      },
    }),
    getGoogleMapsPublicConfig(session.activeOrganization.countryCode),
    listEnabledCountryPhoneOptions(),
  ]);
  if (!item) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Manual order request"
        title="Request this dish"
        description="Submit an inquiry to the seller. Payment and final confirmation happen directly with the seller for now."
      />
      <FoodOrderRequestForm
        action={createFoodOrderAction}
        item={item}
        customerName={session.user.fullName}
        customerEmail={session.user.email}
        mapsConfig={mapsConfig}
        phoneOptions={phoneOptions}
      />
      <CommerceSafetyNotice />
    </div>
  );
}
