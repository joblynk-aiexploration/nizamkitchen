/**
 * Generates an ordered list of search queries for a recipe name.
 * We try progressively broader queries so the best match is attempted first.
 */
export function buildRestaurantQueriesForRecipe(
  recipeName: string,
  city?: string | null,
): string[] {
  const loc = city ? ` ${city}` : "";
  const lower = recipeName.toLowerCase();

  const queries: string[] = [];

  // 1. Exact recipe name + location
  queries.push(`${recipeName}${loc}`);

  // Extract dish type heuristics for Hyderabadi cuisine
  if (lower.includes("biryani")) {
    queries.push(`biryani restaurant${loc}`);
    queries.push(`Hyderabadi restaurant${loc}`);
  } else if (lower.includes("haleem")) {
    queries.push(`haleem restaurant${loc}`);
    queries.push(`Hyderabadi restaurant${loc}`);
  } else if (lower.includes("chicken")) {
    queries.push(`Indian chicken restaurant${loc}`);
    queries.push(`Hyderabadi restaurant${loc}`);
  } else if (lower.includes("mutton") || lower.includes("gosht")) {
    queries.push(`Indian mutton restaurant${loc}`);
    queries.push(`Hyderabadi restaurant${loc}`);
  } else {
    queries.push(`Hyderabadi restaurant${loc}`);
  }

  queries.push(`Indian restaurant${loc}`);
  queries.push(`Pakistani restaurant${loc}`);
  queries.push(`South Asian restaurant${loc}`);

  // Deduplicate while preserving order
  return [...new Set(queries)];
}

export function buildRestaurantQueriesForQuery(
  query: string,
  city?: string | null,
): string[] {
  const loc = city ? ` ${city}` : "";
  return [query + loc];
}
