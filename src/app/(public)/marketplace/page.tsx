import { PublicMarketplacePage } from "@/components/marketplace/public-marketplace-page";

export const metadata = {
  title: "Marketplace | NizamKitchen",
  description: "Browse NizamKitchen home chefs, home catering sellers, restaurants, dishes, and public recipe discovery.",
};

export default function MarketplacePage() {
  return <PublicMarketplacePage kind="overview" />;
}
