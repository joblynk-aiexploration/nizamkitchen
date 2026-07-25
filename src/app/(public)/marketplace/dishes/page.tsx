import { PublicMarketplacePage } from "@/components/marketplace/public-marketplace-page";

export const metadata = {
  title: "Dish Discovery | NizamKitchen",
  description: "Explore Hyderabadi dishes across recipes, home chef requests, caterers, and restaurants.",
};

export default function MarketplaceDishesPage() {
  return <PublicMarketplacePage kind="dishes" />;
}
