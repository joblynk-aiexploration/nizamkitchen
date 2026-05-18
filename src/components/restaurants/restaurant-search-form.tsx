"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";

type Props = {
  defaultQuery?: string;
  defaultCity?: string;
  defaultRecipeId?: string;
};

export function RestaurantSearchForm({ defaultQuery = "", defaultCity = "", defaultRecipeId }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [city, setCity] = useState(defaultCity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = { query: query.trim() };
      if (city.trim()) body.city = city.trim();
      if (defaultRecipeId) body.recipeId = defaultRecipeId;

      const res = await fetch("/api/restaurants/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Search failed.");
      }

      const { searchId } = (await res.json()) as { searchId: string };
      router.push(`/order-instead/searches/${searchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput
        label="What are you looking for?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Hyderabadi biryani, haleem, kebabs…"
        required
        maxLength={200}
      />
      <TextInput
        label="City (optional)"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Hyderabad, London, Houston…"
        maxLength={100}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || !query.trim()}>
        {loading ? "Searching…" : "Find Restaurants"}
      </Button>
    </form>
  );
}
