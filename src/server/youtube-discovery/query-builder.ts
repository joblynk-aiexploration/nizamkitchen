export type DiscoveryQuery = {
  query: string;
  videoDuration: "any" | "medium" | "long";
  regionCode?: string;
  relevanceLanguage?: string;
};

const HYDERABADI_TERMS = ["hyderabadi", "hyderabad", "nizami", "deccani"];
const SOUTH_ASIAN_TERMS = ["biryani", "korma", "nihari", "haleem", "kebab", "tikka", "masala", "curry", "pulao", "pilaf"];

function looksHyderabadi(recipeName: string): boolean {
  const lower = recipeName.toLowerCase();
  return HYDERABADI_TERMS.some((t) => lower.includes(t));
}

function looksComplex(recipeName: string): boolean {
  const lower = recipeName.toLowerCase();
  return SOUTH_ASIAN_TERMS.some((t) => lower.includes(t));
}

export function buildDiscoveryQueries(params: {
  recipeName: string;
  cuisineName?: string;
  countryCode?: string;
}): DiscoveryQuery[] {
  const { recipeName, cuisineName, countryCode } = params;
  const isHyderabadi = looksHyderabadi(recipeName) || (cuisineName ? looksHyderabadi(cuisineName) : false);
  const isComplex = looksComplex(recipeName);

  const queries: DiscoveryQuery[] = [];

  const duration: "medium" | "long" = isComplex ? "long" : "medium";

  // Core recipe queries
  queries.push({ query: `${recipeName} recipe`, videoDuration: duration });
  queries.push({ query: `${recipeName} authentic recipe`, videoDuration: duration });
  queries.push({ query: `${recipeName} cooking`, videoDuration: duration });

  // Hyderabadi-specific signals
  if (isHyderabadi) {
    queries.push({ query: `${recipeName} Hyderabadi authentic`, videoDuration: duration });
    queries.push({ query: `${recipeName} restaurant style`, videoDuration: duration });
    queries.push({ query: `${recipeName} professional chef`, videoDuration: duration });
    queries.push({ query: `${recipeName} traditional recipe`, videoDuration: duration });
    queries.push({ query: `${recipeName} step by step`, videoDuration: duration });
  } else {
    queries.push({ query: `${recipeName} restaurant style`, videoDuration: duration });
    queries.push({ query: `${recipeName} by chef`, videoDuration: duration });
    queries.push({ query: `${recipeName} step by step`, videoDuration: duration });
  }

  // Cuisine-qualified query if cuisine differs from recipe name
  if (cuisineName && !recipeName.toLowerCase().includes(cuisineName.toLowerCase())) {
    queries.push({ query: `${cuisineName} ${recipeName} recipe`, videoDuration: duration });
  }

  // Optionally scope to region
  const regionCode = countryCode?.toUpperCase();

  // Deduplicate
  const seen = new Set<string>();
  return queries
    .filter((q) => {
      if (seen.has(q.query)) return false;
      seen.add(q.query);
      return true;
    })
    .map((q) => ({ ...q, regionCode }));
}
