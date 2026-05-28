import type { Metadata } from "next";
import { buildSeoMetadata } from "@/server/seo/seo-service";

const defaults: Record<string, { title: string; description: string }> = {
  "/": {
    title: "NizamKitchen | Plan, Cook, Hire, or Order Hyderabadi Food",
    description: "Plan Hyderabadi meals, generate grocery lists, cook from recipes, request home chefs, discover caterers, and order from restaurants.",
  },
  "/features": {
    title: "NizamKitchen Features | Meal Planning, Recipes, Grocery Lists, Chefs",
    description: "Explore NizamKitchen features for households, home chefs, caterers, restaurants, grocery workflows, privacy, and marketplace operations.",
  },
  "/pricing": {
    title: "NizamKitchen Pricing | Household and Seller Plans",
    description: "Review NizamKitchen pricing for households, chef businesses, home catering sellers, restaurants, and enterprise partners.",
  },
  "/for-households": {
    title: "NizamKitchen for Households",
    description: "Plan weekly meals, cook Hyderabadi recipes, build grocery lists, request chefs, and order when cooking is not the answer.",
  },
  "/for-chefs": {
    title: "NizamKitchen for Home Chefs",
    description: "Build a professional chef profile, manage requests, verification, availability, and payments from one marketplace workspace.",
  },
  "/for-restaurants": {
    title: "NizamKitchen for Restaurants",
    description: "Create menus, receive order requests, manage profiles, and reach households looking for authentic local food.",
  },
  "/about": {
    title: "About NizamKitchen",
    description: "Learn how NizamKitchen supports Hyderabadi households, chefs, caterers, restaurants, and food marketplace operations.",
  },
  "/contact": {
    title: "Contact NizamKitchen",
    description: "Contact NizamKitchen about household meal planning, seller onboarding, restaurant partnerships, or platform support.",
  },
};

export function publicPageMetadata(path: keyof typeof defaults): Promise<Metadata> {
  const fallback = defaults[path];
  return buildSeoMetadata({ path, title: fallback.title, description: fallback.description });
}
