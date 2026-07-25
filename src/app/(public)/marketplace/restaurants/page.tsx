import { PublicMarketplacePage } from "@/components/marketplace/public-marketplace-page";

export const metadata = {
  title: "Restaurant Marketplace | NizamKitchen",
  description: "Browse restaurant prepared-food options and public menu discovery in NizamKitchen.",
};

export default function MarketplaceRestaurantsPage() {
  return <PublicMarketplacePage kind="restaurants" />;
}
