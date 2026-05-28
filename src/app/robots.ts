import type { MetadataRoute } from "next";
import { siteUrl } from "@/server/seo/seo-service";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/dashboard",
        "/orders/",
        "/billing",
        "/settings",
        "/profile",
        "/privacy-center",
        "/support/",
        "/api/",
        "/storage/",
        "/catering/",
        "/restaurant/",
        "/chef/",
        "/legal/accept-required",
      ],
    },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
