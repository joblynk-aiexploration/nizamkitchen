import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NizamKitchen",
    short_name: "NizamKitchen",
    description: "Plan meals, cook recipes, and shop grocery lists from your household kitchen.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#edf2f7",
    theme_color: "#0f766e",
    categories: ["food", "lifestyle", "productivity"],
    icons: [
      {
        src: "/icons/nizam-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icons/nizam-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
