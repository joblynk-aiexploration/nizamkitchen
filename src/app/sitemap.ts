import type { MetadataRoute } from "next";
import { ChefProfileStatus, RecipeVisibility, TemplateStatus, TemplateVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/server/seo/seo-service";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "/",
    "/features",
    "/pricing",
    "/for-households",
    "/for-chefs",
    "/for-restaurants",
    "/about",
    "/contact",
    "/help",
    "/faq",
    "/terms",
    "/privacy",
    "/chefs",
    "/caterers",
    "/restaurants",
  ];

  const [recipes, chefs, caterers, restaurants, templates] = await Promise.all([
    prisma.recipe.findMany({ where: { isPublished: true, visibility: RecipeVisibility.global }, select: { id: true, updatedAt: true } }).catch(() => []),
    prisma.chefProfile.findMany({ where: { isPublic: true, status: ChefProfileStatus.active }, select: { slug: true, updatedAt: true } }).catch(() => []),
    prisma.homeCateringProfile.findMany({ where: { isPublic: true, status: "active" }, select: { slug: true, updatedAt: true } }).catch(() => []),
    prisma.organization.findMany({ where: { organizationType: "restaurant", status: "active" }, select: { slug: true, updatedAt: true } }).catch(() => []),
    prisma.menuTemplate.findMany({ where: { status: TemplateStatus.active, visibility: { in: [TemplateVisibility.public, TemplateVisibility.household_available] } }, select: { slug: true, updatedAt: true } }).catch(() => []),
  ]);

  return [
    ...staticPaths.map((path) => ({
      url: siteUrl(path),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.7,
    })),
    ...recipes.map((recipe) => ({ url: siteUrl(`/recipes/${recipe.id}`), lastModified: recipe.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...chefs.map((profile) => ({ url: siteUrl(`/chefs/${profile.slug}`), lastModified: profile.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...caterers.map((profile) => ({ url: siteUrl(`/caterers/${profile.slug}`), lastModified: profile.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...restaurants.map((profile) => ({ url: siteUrl(`/restaurants/${profile.slug}`), lastModified: profile.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...templates.map((template) => ({ url: siteUrl(`/templates/${template.slug}`), lastModified: template.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
