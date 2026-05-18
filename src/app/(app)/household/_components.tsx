import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const cookingDays = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
] as const;

export function HouseholdNav() {
  const links = [
    { href: "/household", label: "Overview" },
    { href: "/household/preferences", label: "Preferences" },
    { href: "/household/favorites", label: "Favorites" },
    { href: "/household/avoided-ingredients", label: "Avoided ingredients" },
    { href: "/household/pantry", label: "Pantry" },
    { href: "/household/shopping-preferences", label: "Shopping" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Button key={link.href} asChild variant="secondary">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </div>
  );
}
export function ComingSoonFamilyProfiles() {
  return (
    <div className="space-y-6">
      <HouseholdNav />
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Family profiles</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-[var(--color-ink)]">Household preferences are coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          A platform admin can enable the family_profiles feature flag when this organization is ready to store household defaults.
        </p>
      </Card>
    </div>
  );
}

export function NonHouseholdState({ organizationType }: { organizationType: string }) {
  return (
    <div className="space-y-6">
      <HouseholdNav />
      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Organization type</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-[var(--color-ink)]">Household profile not needed here</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          This workspace is a {organizationType.replaceAll("_", " ")} organization. Household preferences are shown only for household accounts.
        </p>
      </Card>
    </div>
  );
}
