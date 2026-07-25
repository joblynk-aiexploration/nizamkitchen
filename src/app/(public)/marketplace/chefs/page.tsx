import { PublicMarketplacePage } from "@/components/marketplace/public-marketplace-page";

export const metadata = {
  title: "Home Chef Marketplace | NizamKitchen",
  description: "Browse platform-managed independent home chefs for in-home cooking requests.",
};

export default function MarketplaceChefsPage() {
  return <PublicMarketplacePage kind="chefs" />;
}
