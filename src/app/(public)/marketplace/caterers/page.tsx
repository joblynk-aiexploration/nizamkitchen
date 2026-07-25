import { PublicMarketplacePage } from "@/components/marketplace/public-marketplace-page";

export const metadata = {
  title: "Home Catering Marketplace | NizamKitchen",
  description: "Browse home catering sellers for pickup, delivery, and preorder prepared food.",
};

export default function MarketplaceCaterersPage() {
  return <PublicMarketplacePage kind="caterers" />;
}
