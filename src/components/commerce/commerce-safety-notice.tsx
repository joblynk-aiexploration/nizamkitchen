import { Card } from "@/components/ui/card";

export function CommerceSafetyNotice() {
  return (
    <Card className="bg-amber-50/70">
      <h2 className="font-semibold text-amber-950">Food commerce safety note</h2>
      <div className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
        <p>Food sellers are responsible for complying with local food safety and licensing requirements.</p>
        <p>NizamKitchen does not process payments in this version.</p>
        <p>Customers should confirm allergens, ingredients, pickup, and delivery details directly with the seller.</p>
      </div>
    </Card>
  );
}
