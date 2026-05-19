import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SellerVerificationPage } from "@/components/seller-verifications/seller-verification-page";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { acceptSellerAttestationAction, submitKitchenPhotoAction, submitSellerDocumentAction, submitSellerVerificationAction } from "../../seller-verification-actions";
import { getOrCreateSellerVerificationProfile, listRequirementsForSeller } from "@/server/seller-verifications";

export const dynamic = "force-dynamic";

export default async function RestaurantVerificationPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [session, params] = await Promise.all([requireMembership(), searchParams]);
  const enabled = await isFeatureEnabled("seller_verification", session.activeOrganization.id);
  if (!enabled) return <EmptyState title="Seller verification is disabled" description="Compliance workflows are not enabled for this restaurant yet." />;
  const profile = await getOrCreateSellerVerificationProfile(session).catch(() => null);
  const requirements = profile ? await listRequirementsForSeller({ countryCode: profile.countryCode, region: profile.region, sellerType: profile.sellerType }) : [];
  return (
    <div className="space-y-6">
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}
      <SellerVerificationPage
        title="Restaurant verification"
        description="Upload business/license, attestation, and payout readiness documents for admin review."
        profile={profile}
        requirements={requirements}
        uploadAction={submitSellerDocumentAction}
        attestationAction={acceptSellerAttestationAction}
        kitchenPhotoAction={submitKitchenPhotoAction}
        submitAction={submitSellerVerificationAction}
        returnTo="/restaurant/verification"
      />
    </div>
  );
}
