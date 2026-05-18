import crypto from "node:crypto";
import {
  CookingSkillLevel,
  ChefPriceUnit,
  ChefProfileStatus,
  ChefServiceType,
  ChefVerificationStatus,
  GroceryIntegrationType,
  GroceryPartnerStatus,
  IngredientCategory,
  MeasurementSystem,
  MembershipStatus,
  OrganizationStatus,
  OrganizationType,
  PlatformRole,
  PrismaClient,
  RecipeDifficulty,
  RecipeSourceType,
  RecipeVisibility,
  SpiceLevel,
  PreferredDeliveryMethod,
  UnitSystem,
  UnitType,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FEATURE_FLAGS = [
  "recipes",
  "meal_planner",
  "grocery_engine",
  "youtube_references",
  "home_chefs",
  "restaurant_fallback",
  "grocery_partners",
  "payments",
  "subscriptions",
  "family_profiles",
  "chef_verification",
];

// Flags that are enabled globally on a fresh seed.
// Re-seeding never overwrites the enabled state so manual changes are preserved.
const GLOBALLY_ENABLED_FLAGS = new Set(["recipes", "grocery_engine", "meal_planner", "youtube_references", "family_profiles", "home_chefs", "chef_verification", "grocery_partners"]);

const COUNTRY_SEEDS = [
  { countryCode: "US", countryName: "United States", currencyCode: "USD", defaultTimezone: "America/Chicago", defaultLocale: "en-US", measurementSystem: MeasurementSystem.imperial, phoneCountryCode: "+1" },
  { countryCode: "IN", countryName: "India", currencyCode: "INR", defaultTimezone: "Asia/Kolkata", defaultLocale: "en-IN", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+91" },
  { countryCode: "GB", countryName: "United Kingdom", currencyCode: "GBP", defaultTimezone: "Europe/London", defaultLocale: "en-GB", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+44" },
  { countryCode: "SA", countryName: "Saudi Arabia", currencyCode: "SAR", defaultTimezone: "Asia/Riyadh", defaultLocale: "ar-SA", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+966" },
  { countryCode: "AE", countryName: "United Arab Emirates", currencyCode: "AED", defaultTimezone: "Asia/Dubai", defaultLocale: "ar-AE", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+971" },
  { countryCode: "CA", countryName: "Canada", currencyCode: "CAD", defaultTimezone: "America/Toronto", defaultLocale: "en-CA", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+1" },
  { countryCode: "AU", countryName: "Australia", currencyCode: "AUD", defaultTimezone: "Australia/Sydney", defaultLocale: "en-AU", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+61" },
];

const USER_SEEDS = [
  { email: "owner@nizamkitchen.dev", fullName: "Platform Owner", platformRole: PlatformRole.platform_owner, status: UserStatus.active },
  { email: "admin@nizamkitchen.dev", fullName: "Platform Admin", platformRole: PlatformRole.platform_admin, status: UserStatus.active },
  { email: "country@nizamkitchen.dev", fullName: "Country Manager", platformRole: PlatformRole.country_manager, status: UserStatus.active },
  { email: "household@nizamkitchen.dev", fullName: "Household Owner", platformRole: null, status: UserStatus.active },
  { email: "chef@nizamkitchen.dev", fullName: "Chef Owner", platformRole: null, status: UserStatus.active },
  { email: "restaurant@nizamkitchen.dev", fullName: "Restaurant Owner", platformRole: null, status: UserStatus.active },
  { email: "disabled@nizamkitchen.dev", fullName: "Disabled User", platformRole: null, status: UserStatus.disabled },
];

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function upsertUser(
  email: string,
  fullName: string,
  platformRole: PlatformRole | null,
  status: UserStatus,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName, platformRole, status, passwordHash },
    create: { email, fullName, platformRole, status, passwordHash },
  });
}

async function createOrganization(params: { name: string; organizationType: OrganizationType; countryCode: string; ownerUserId: string; }) {
  const country = await prisma.country.findUniqueOrThrow({ where: { countryCode: params.countryCode } });
  const organization = await prisma.organization.upsert({
    where: { slug: slugify(params.name) },
    update: {
      organizationType: params.organizationType,
      status: OrganizationStatus.active,
      countryCode: country.countryCode,
      currencyCode: country.currencyCode,
      defaultTimezone: country.defaultTimezone,
      defaultLocale: country.defaultLocale,
      measurementSystem: country.measurementSystem,
    },
    create: {
      name: params.name,
      slug: slugify(params.name),
      organizationId: crypto.randomUUID(),
      organizationType: params.organizationType,
      status: OrganizationStatus.active,
      countryCode: country.countryCode,
      currencyCode: country.currencyCode,
      defaultTimezone: country.defaultTimezone,
      defaultLocale: country.defaultLocale,
      measurementSystem: country.measurementSystem,
    },
  });

  const role = params.organizationType === OrganizationType.household ? "org_owner" : params.organizationType === OrganizationType.chef_business ? "chef_owner" : "restaurant_owner";
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: params.ownerUserId, organizationId: organization.id } },
    update: { role, status: MembershipStatus.active },
    create: { userId: params.ownerUserId, organizationId: organization.id, role, status: MembershipStatus.active },
  });

  return organization;
}

// ─── Unit seeding ─────────────────────────────────────────────────────────────

type UnitSeed = {
  code: string;
  name: string;
  pluralName: string;
  type: UnitType;
  system: UnitSystem;
  symbol?: string;
  isBaseUnit?: boolean;
};

const UNIT_SEEDS: UnitSeed[] = [
  // Mass — metric
  { code: "gram",     name: "gram",      pluralName: "grams",      type: UnitType.mass,    system: UnitSystem.metric,      symbol: "g",    isBaseUnit: true },
  { code: "kilogram", name: "kilogram",  pluralName: "kilograms",  type: UnitType.mass,    system: UnitSystem.metric,      symbol: "kg" },
  // Mass — imperial
  { code: "ounce",    name: "ounce",     pluralName: "ounces",     type: UnitType.mass,    system: UnitSystem.imperial,    symbol: "oz" },
  { code: "pound",    name: "pound",     pluralName: "pounds",     type: UnitType.mass,    system: UnitSystem.imperial,    symbol: "lb" },
  // Volume — metric
  { code: "milliliter", name: "milliliter", pluralName: "milliliters", type: UnitType.volume, system: UnitSystem.metric,   symbol: "ml", isBaseUnit: true },
  { code: "liter",    name: "liter",     pluralName: "liters",     type: UnitType.volume,  system: UnitSystem.metric,      symbol: "L" },
  // Volume — traditional cooking
  { code: "teaspoon",   name: "teaspoon",   pluralName: "teaspoons",   type: UnitType.volume, system: UnitSystem.traditional, symbol: "tsp" },
  { code: "tablespoon", name: "tablespoon", pluralName: "tablespoons", type: UnitType.volume, system: UnitSystem.traditional, symbol: "tbsp" },
  { code: "cup",        name: "cup",        pluralName: "cups",        type: UnitType.volume, system: UnitSystem.traditional, symbol: "cup" },
  // Count
  { code: "piece",   name: "piece",   pluralName: "pieces",  type: UnitType.count,   system: UnitSystem.mixed, symbol: "pc",    isBaseUnit: true },
  { code: "clove",   name: "clove",   pluralName: "cloves",  type: UnitType.count,   system: UnitSystem.mixed },
  { code: "bunch",   name: "bunch",   pluralName: "bunches", type: UnitType.count,   system: UnitSystem.mixed },
  // Package
  { code: "packet",  name: "packet",  pluralName: "packets", type: UnitType.package, system: UnitSystem.mixed },
  { code: "can",     name: "can",     pluralName: "cans",    type: UnitType.package, system: UnitSystem.mixed },
  { code: "bottle",  name: "bottle",  pluralName: "bottles", type: UnitType.package, system: UnitSystem.mixed },
  // Traditional/cooking (imprecise by nature)
  { code: "pinch",    name: "pinch",    pluralName: "pinches",   type: UnitType.custom, system: UnitSystem.traditional },
  { code: "handful",  name: "handful",  pluralName: "handfuls",  type: UnitType.custom, system: UnitSystem.traditional },
];

async function seedUnits() {
  const unitMap = new Map<string, string>(); // code → id
  for (const u of UNIT_SEEDS) {
    const unit = await prisma.unit.upsert({
      where: { code: u.code },
      update: { name: u.name, pluralName: u.pluralName, type: u.type, system: u.system, symbol: u.symbol ?? null, isBaseUnit: u.isBaseUnit ?? false },
      create: { code: u.code, name: u.name, pluralName: u.pluralName, type: u.type, system: u.system, symbol: u.symbol ?? null, isBaseUnit: u.isBaseUnit ?? false, isGlobal: true },
    });
    unitMap.set(u.code, unit.id);
  }
  return unitMap;
}

type ConversionSeed = {
  from: string;
  to: string;
  multiplier: number;
  confidence: number;
  notes?: string;
};

// All conversions are directional. Reverse conversions are seeded separately.
const GLOBAL_CONVERSION_SEEDS: ConversionSeed[] = [
  // Exact mass conversions
  { from: "kilogram",   to: "gram",        multiplier: 1000,       confidence: 1.0, notes: "Exact SI conversion" },
  { from: "gram",       to: "kilogram",    multiplier: 0.001,      confidence: 1.0, notes: "Exact SI conversion" },
  { from: "pound",      to: "ounce",       multiplier: 16,         confidence: 1.0, notes: "Exact imperial conversion" },
  { from: "ounce",      to: "pound",       multiplier: 0.0625,     confidence: 1.0, notes: "Exact imperial conversion" },
  // Cross-system mass
  { from: "ounce",      to: "gram",        multiplier: 28.3495,    confidence: 0.9999 },
  { from: "gram",       to: "ounce",       multiplier: 0.035274,   confidence: 0.9999 },
  { from: "pound",      to: "gram",        multiplier: 453.592,    confidence: 0.9999 },
  { from: "gram",       to: "pound",       multiplier: 0.0022046,  confidence: 0.9999 },
  // Exact volume conversions
  { from: "liter",      to: "milliliter",  multiplier: 1000,       confidence: 1.0, notes: "Exact SI conversion" },
  { from: "milliliter", to: "liter",       multiplier: 0.001,      confidence: 1.0, notes: "Exact SI conversion" },
  // Standard cooking volume conversions (US standard)
  { from: "tablespoon", to: "teaspoon",    multiplier: 3,          confidence: 1.0,  notes: "US standard: 1 tbsp = 3 tsp" },
  { from: "teaspoon",   to: "tablespoon",  multiplier: 0.333333,   confidence: 1.0,  notes: "US standard: 1 tsp = 1/3 tbsp" },
  { from: "cup",        to: "tablespoon",  multiplier: 16,         confidence: 1.0,  notes: "US standard: 1 cup = 16 tbsp" },
  { from: "tablespoon", to: "cup",         multiplier: 0.0625,     confidence: 1.0,  notes: "US standard: 1 tbsp = 1/16 cup" },
  { from: "teaspoon",   to: "milliliter",  multiplier: 4.92892,    confidence: 0.95, notes: "US teaspoon, not metric teaspoon" },
  { from: "milliliter", to: "teaspoon",    multiplier: 0.202884,   confidence: 0.95 },
  { from: "tablespoon", to: "milliliter",  multiplier: 14.7868,    confidence: 0.95, notes: "US tablespoon" },
  { from: "milliliter", to: "tablespoon",  multiplier: 0.067628,   confidence: 0.95 },
  { from: "cup",        to: "milliliter",  multiplier: 236.588,    confidence: 0.95, notes: "US cup" },
  { from: "milliliter", to: "cup",         multiplier: 0.0042268,  confidence: 0.95 },
];

async function seedConversions(unitMap: Map<string, string>) {
  for (const c of GLOBAL_CONVERSION_SEEDS) {
    const fromUnitId = unitMap.get(c.from);
    const toUnitId = unitMap.get(c.to);
    if (!fromUnitId || !toUnitId) {
      console.warn(`Skipping conversion ${c.from}→${c.to}: unit not found`);
      continue;
    }

    const existing = await prisma.unitConversion.findFirst({
      where: { fromUnitId, toUnitId, ingredientId: null },
    });

    if (existing) {
      await prisma.unitConversion.update({
        where: { id: existing.id },
        data: { multiplier: c.multiplier, confidence: c.confidence, notes: c.notes ?? null },
      });
    } else {
      await prisma.unitConversion.create({
        data: {
          fromUnitId,
          toUnitId,
          multiplier: c.multiplier,
          confidence: c.confidence,
          notes: c.notes ?? null,
          isGlobal: true,
        },
      });
    }
  }
}

// ─── Cuisine seeding ──────────────────────────────────────────────────────────

async function seedCuisines() {
  const cuisineMap = new Map<string, string>(); // slug → id
  const cuisines = [
    { name: "Hyderabadi", slug: "hyderabadi", description: "Traditional cuisine of Hyderabad, India — known for biryani, haleem, and aromatic Mughal-influenced cooking.", isGlobal: true },
  ];

  for (const c of cuisines) {
    const cuisine = await prisma.cuisine.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, isGlobal: c.isGlobal },
      create: { name: c.name, slug: c.slug, description: c.description, isGlobal: c.isGlobal },
    });
    cuisineMap.set(c.slug, cuisine.id);
  }

  return cuisineMap;
}

// ─── Ingredient seeding ───────────────────────────────────────────────────────

type IngredientSeed = {
  name: string;
  canonicalName: string;
  slug: string;
  category: IngredientCategory;
  defaultUnitCode?: string;
  densityGramPerMl?: number;
  averagePieceWeightGrams?: number;
  aliases: Array<{ alias: string; language?: string; countryCode?: string; confidence?: number }>;
};

const INGREDIENT_SEEDS: IngredientSeed[] = [
  {
    name: "Onion", canonicalName: "Onion", slug: "onion", category: IngredientCategory.vegetable,
    defaultUnitCode: "piece", averagePieceWeightGrams: 150,
    aliases: [
      { alias: "onions", confidence: 1.0 },
      { alias: "pyaz", language: "hi", confidence: 0.99 },
      { alias: "pyaaz", language: "hi", confidence: 0.98 },
      { alias: "kanda", language: "hi", confidence: 0.97 },
    ],
  },
  {
    name: "Tomato", canonicalName: "Tomato", slug: "tomato", category: IngredientCategory.vegetable,
    defaultUnitCode: "piece", averagePieceWeightGrams: 120,
    aliases: [
      { alias: "tomatoes", confidence: 1.0 },
      { alias: "tamatar", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Green Chili", canonicalName: "Green Chili", slug: "green-chili", category: IngredientCategory.vegetable,
    defaultUnitCode: "piece", averagePieceWeightGrams: 10,
    aliases: [
      { alias: "green chilies", confidence: 1.0 },
      { alias: "green chilli", confidence: 1.0 },
      { alias: "hari mirch", language: "hi", confidence: 0.99 },
      { alias: "hara mirch", language: "hi", confidence: 0.97 },
    ],
  },
  {
    name: "Ginger Garlic Paste", canonicalName: "Ginger Garlic Paste", slug: "ginger-garlic-paste",
    category: IngredientCategory.condiment, defaultUnitCode: "tablespoon", densityGramPerMl: 1.1,
    aliases: [
      { alias: "ginger-garlic paste", confidence: 1.0 },
      { alias: "adrak lehsun paste", language: "hi", confidence: 0.99 },
      { alias: "adrak lasun paste", language: "hi", confidence: 0.97 },
    ],
  },
  {
    name: "Basmati Rice", canonicalName: "Basmati Rice", slug: "basmati-rice",
    category: IngredientCategory.grain, defaultUnitCode: "gram", densityGramPerMl: 0.75,
    aliases: [
      { alias: "basmati", confidence: 0.95 },
      { alias: "long grain rice", confidence: 0.8 },
    ],
  },
  {
    name: "Chicken", canonicalName: "Chicken", slug: "chicken",
    category: IngredientCategory.poultry, defaultUnitCode: "gram",
    aliases: [
      { alias: "chicken pieces", confidence: 1.0 },
      { alias: "murgh", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Mutton", canonicalName: "Mutton", slug: "mutton",
    category: IngredientCategory.meat, defaultUnitCode: "gram",
    aliases: [
      { alias: "lamb", confidence: 0.85 },
      { alias: "gosht", language: "hi", confidence: 0.99 },
      { alias: "bakra gosht", language: "hi", confidence: 0.98 },
    ],
  },
  {
    name: "Yogurt", canonicalName: "Yogurt", slug: "yogurt",
    category: IngredientCategory.dairy, defaultUnitCode: "gram", densityGramPerMl: 1.03,
    aliases: [
      { alias: "curd", confidence: 0.95 },
      { alias: "dahi", language: "hi", confidence: 0.99 },
      { alias: "yoghurt", confidence: 1.0 },
    ],
  },
  {
    name: "Mint", canonicalName: "Mint", slug: "mint",
    category: IngredientCategory.herb, defaultUnitCode: "bunch",
    aliases: [
      { alias: "mint leaves", confidence: 1.0 },
      { alias: "pudina", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Cilantro", canonicalName: "Cilantro", slug: "cilantro",
    category: IngredientCategory.herb, defaultUnitCode: "bunch",
    aliases: [
      { alias: "coriander", confidence: 0.95 },
      { alias: "hara dhania", language: "hi", confidence: 0.99 },
      { alias: "dhaniya", language: "hi", confidence: 0.98 },
      { alias: "fresh coriander", confidence: 0.95 },
    ],
  },
  {
    name: "Lemon", canonicalName: "Lemon", slug: "lemon",
    category: IngredientCategory.fruit, defaultUnitCode: "piece", averagePieceWeightGrams: 85,
    aliases: [
      { alias: "lemons", confidence: 1.0 },
      { alias: "nimbu", language: "hi", confidence: 0.99 },
      { alias: "lime", confidence: 0.75 },
    ],
  },
  {
    name: "Turmeric", canonicalName: "Turmeric", slug: "turmeric",
    category: IngredientCategory.spice, defaultUnitCode: "teaspoon",
    aliases: [
      { alias: "turmeric powder", confidence: 1.0 },
      { alias: "haldi", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Red Chili Powder", canonicalName: "Red Chili Powder", slug: "red-chili-powder",
    category: IngredientCategory.spice, defaultUnitCode: "teaspoon",
    aliases: [
      { alias: "red chilli powder", confidence: 1.0 },
      { alias: "lal mirch", language: "hi", confidence: 0.99 },
      { alias: "lal mirch powder", language: "hi", confidence: 0.99 },
      { alias: "cayenne pepper", confidence: 0.7 },
    ],
  },
  {
    name: "Coriander Powder", canonicalName: "Coriander Powder", slug: "coriander-powder",
    category: IngredientCategory.spice, defaultUnitCode: "teaspoon",
    aliases: [
      { alias: "dhania powder", language: "hi", confidence: 0.99 },
      { alias: "ground coriander", confidence: 0.95 },
    ],
  },
  {
    name: "Cumin", canonicalName: "Cumin", slug: "cumin",
    category: IngredientCategory.spice, defaultUnitCode: "teaspoon",
    aliases: [
      { alias: "cumin seeds", confidence: 0.95 },
      { alias: "jeera", language: "hi", confidence: 0.99 },
      { alias: "zeera", language: "hi", confidence: 0.97 },
    ],
  },
  {
    name: "Garam Masala", canonicalName: "Garam Masala", slug: "garam-masala",
    category: IngredientCategory.spice, defaultUnitCode: "teaspoon",
    aliases: [
      { alias: "garam masala powder", confidence: 1.0 },
    ],
  },
  {
    name: "Biryani Masala", canonicalName: "Biryani Masala", slug: "biryani-masala",
    category: IngredientCategory.spice, defaultUnitCode: "tablespoon",
    aliases: [
      { alias: "biryani spice mix", confidence: 0.9 },
    ],
  },
  {
    name: "Tamarind", canonicalName: "Tamarind", slug: "tamarind",
    category: IngredientCategory.condiment, defaultUnitCode: "gram",
    aliases: [
      { alias: "imli", language: "hi", confidence: 0.99 },
      { alias: "tamarind paste", confidence: 0.85 },
    ],
  },
  {
    name: "Curry Leaves", canonicalName: "Curry Leaves", slug: "curry-leaves",
    category: IngredientCategory.herb, defaultUnitCode: "bunch",
    aliases: [
      { alias: "kadipatta", language: "hi", confidence: 0.99 },
      { alias: "kadi patta", language: "hi", confidence: 0.99 },
      { alias: "meetha neem", language: "hi", confidence: 0.9 },
    ],
  },
  {
    name: "Oil", canonicalName: "Oil", slug: "oil",
    category: IngredientCategory.oil, defaultUnitCode: "tablespoon", densityGramPerMl: 0.91,
    aliases: [
      { alias: "cooking oil", confidence: 1.0 },
      { alias: "vegetable oil", confidence: 0.9 },
      { alias: "tel", language: "hi", confidence: 0.95 },
    ],
  },
  {
    name: "Ghee", canonicalName: "Ghee", slug: "ghee",
    category: IngredientCategory.oil, defaultUnitCode: "tablespoon", densityGramPerMl: 0.91,
    aliases: [
      { alias: "clarified butter", confidence: 0.9 },
      { alias: "desi ghee", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Salt", canonicalName: "Salt", slug: "salt",
    category: IngredientCategory.spice, defaultUnitCode: "teaspoon",
    aliases: [
      { alias: "namak", language: "hi", confidence: 0.99 },
      { alias: "table salt", confidence: 1.0 },
    ],
  },
  {
    name: "Toor Dal", canonicalName: "Toor Dal", slug: "toor-dal",
    category: IngredientCategory.lentil, defaultUnitCode: "gram",
    aliases: [
      { alias: "split pigeon peas", confidence: 1.0 },
      { alias: "arhar dal", language: "hi", confidence: 0.99 },
      { alias: "tuvar dal", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Chana Dal", canonicalName: "Chana Dal", slug: "chana-dal",
    category: IngredientCategory.lentil, defaultUnitCode: "gram",
    aliases: [
      { alias: "split Bengal gram", confidence: 1.0 },
      { alias: "bengal gram dal", confidence: 0.95 },
      { alias: "chana daal", confidence: 1.0 },
    ],
  },
  {
    name: "Peanuts", canonicalName: "Peanuts", slug: "peanuts",
    category: IngredientCategory.nut, defaultUnitCode: "gram",
    aliases: [
      { alias: "groundnuts", confidence: 1.0 },
      { alias: "moongfali", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Sesame Seeds", canonicalName: "Sesame Seeds", slug: "sesame-seeds",
    category: IngredientCategory.spice, defaultUnitCode: "tablespoon",
    aliases: [
      { alias: "til", language: "hi", confidence: 0.99 },
      { alias: "white sesame seeds", confidence: 0.95 },
    ],
  },
  {
    name: "Desiccated Coconut", canonicalName: "Desiccated Coconut", slug: "desiccated-coconut",
    category: IngredientCategory.other, defaultUnitCode: "tablespoon",
    aliases: [
      { alias: "dry coconut", confidence: 1.0 },
      { alias: "kopra", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Eggplant", canonicalName: "Eggplant", slug: "eggplant",
    category: IngredientCategory.vegetable, defaultUnitCode: "piece", averagePieceWeightGrams: 200,
    aliases: [
      { alias: "brinjal", confidence: 1.0 },
      { alias: "baingan", language: "hi", confidence: 0.99 },
      { alias: "aubergine", confidence: 1.0 },
    ],
  },
  {
    name: "Dried Apricots", canonicalName: "Dried Apricots", slug: "dried-apricots",
    category: IngredientCategory.fruit, defaultUnitCode: "gram",
    aliases: [
      { alias: "khubani", language: "hi", confidence: 0.99 },
      { alias: "apricots", confidence: 0.9 },
    ],
  },
  {
    name: "Milk", canonicalName: "Milk", slug: "milk",
    category: IngredientCategory.dairy, defaultUnitCode: "milliliter", densityGramPerMl: 1.03,
    aliases: [
      { alias: "whole milk", confidence: 1.0 },
      { alias: "doodh", language: "hi", confidence: 0.99 },
      { alias: "full-fat milk", confidence: 0.95 },
    ],
  },
  {
    name: "Condensed Milk", canonicalName: "Condensed Milk", slug: "condensed-milk",
    category: IngredientCategory.dairy, defaultUnitCode: "milliliter", densityGramPerMl: 1.32,
    aliases: [
      { alias: "sweetened condensed milk", confidence: 1.0 },
      { alias: "milkmaid", confidence: 0.85 },
    ],
  },
  {
    name: "Vermicelli", canonicalName: "Vermicelli", slug: "vermicelli",
    category: IngredientCategory.grain, defaultUnitCode: "gram",
    aliases: [
      { alias: "seviyan", language: "hi", confidence: 0.99 },
      { alias: "sewai", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "All-Purpose Flour", canonicalName: "All-Purpose Flour", slug: "all-purpose-flour",
    category: IngredientCategory.grain, defaultUnitCode: "gram",
    aliases: [
      { alias: "maida", language: "hi", confidence: 0.99 },
      { alias: "plain flour", confidence: 1.0 },
      { alias: "refined flour", confidence: 0.95 },
    ],
  },
  {
    name: "Potato", canonicalName: "Potato", slug: "potato",
    category: IngredientCategory.vegetable, defaultUnitCode: "piece", averagePieceWeightGrams: 150,
    aliases: [
      { alias: "potatoes", confidence: 1.0 },
      { alias: "aloo", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Egg", canonicalName: "Egg", slug: "egg",
    category: IngredientCategory.other, defaultUnitCode: "piece", averagePieceWeightGrams: 55,
    aliases: [
      { alias: "eggs", confidence: 1.0 },
      { alias: "anda", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Sugar", canonicalName: "Sugar", slug: "sugar",
    category: IngredientCategory.sweetener, defaultUnitCode: "gram",
    aliases: [
      { alias: "white sugar", confidence: 1.0 },
      { alias: "cheeni", language: "hi", confidence: 0.99 },
      { alias: "chini", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Cashews", canonicalName: "Cashews", slug: "cashews",
    category: IngredientCategory.nut, defaultUnitCode: "gram",
    aliases: [
      { alias: "cashew nuts", confidence: 1.0 },
      { alias: "kaju", language: "hi", confidence: 0.99 },
    ],
  },
  {
    name: "Raisins", canonicalName: "Raisins", slug: "raisins",
    category: IngredientCategory.fruit, defaultUnitCode: "gram",
    aliases: [
      { alias: "kishmish", language: "hi", confidence: 0.99 },
      { alias: "sultanas", confidence: 0.85 },
    ],
  },
  {
    name: "Saffron", canonicalName: "Saffron", slug: "saffron",
    category: IngredientCategory.spice, defaultUnitCode: "pinch",
    aliases: [
      { alias: "kesar", language: "hi", confidence: 0.99 },
      { alias: "zafran", language: "hi", confidence: 0.97 },
    ],
  },
  {
    name: "White Bread", canonicalName: "White Bread", slug: "white-bread",
    category: IngredientCategory.grain, defaultUnitCode: "piece",
    aliases: [
      { alias: "bread slices", confidence: 1.0 },
      { alias: "double roti", language: "hi", confidence: 0.99 },
      { alias: "sandwich bread", confidence: 0.9 },
    ],
  },
  {
    name: "Bottle Gourd", canonicalName: "Bottle Gourd", slug: "bottle-gourd",
    category: IngredientCategory.vegetable, defaultUnitCode: "gram",
    aliases: [
      { alias: "lauki", language: "hi", confidence: 0.99 },
      { alias: "doodhi", language: "hi", confidence: 0.95 },
    ],
  },
  {
    name: "Cardamom", canonicalName: "Cardamom", slug: "cardamom",
    category: IngredientCategory.spice, defaultUnitCode: "piece",
    aliases: [
      { alias: "elaichi", language: "hi", confidence: 0.99 },
      { alias: "green cardamom", confidence: 1.0 },
      { alias: "cardamom pods", confidence: 1.0 },
    ],
  },
];

async function seedIngredients(unitMap: Map<string, string>) {
  const ingredientMap = new Map<string, string>(); // slug → id

  for (const ing of INGREDIENT_SEEDS) {
    const defaultUnitId = ing.defaultUnitCode ? unitMap.get(ing.defaultUnitCode) ?? null : null;

    const existingIngredient = await prisma.ingredient.findFirst({
      where: { slug: ing.slug, organizationId: null },
    });

    let ingredient;
    if (existingIngredient) {
      ingredient = await prisma.ingredient.update({
        where: { id: existingIngredient.id },
        data: {
          name: ing.name,
          canonicalName: ing.canonicalName,
          category: ing.category,
          defaultUnitId,
          densityGramPerMl: ing.densityGramPerMl ?? null,
          averagePieceWeightGrams: ing.averagePieceWeightGrams ?? null,
          isGlobal: true,
          isActive: true,
        },
      });
    } else {
      ingredient = await prisma.ingredient.create({
        data: {
          name: ing.name,
          canonicalName: ing.canonicalName,
          slug: ing.slug,
          category: ing.category,
          defaultUnitId,
          densityGramPerMl: ing.densityGramPerMl ?? null,
          averagePieceWeightGrams: ing.averagePieceWeightGrams ?? null,
          isGlobal: true,
          isActive: true,
          organizationId: null,
          countryCode: null,
        },
      });
    }

    ingredientMap.set(ing.slug, ingredient.id);

    // Seed aliases — upsert by ingredientId+alias
    for (const a of ing.aliases) {
      const existing = await prisma.ingredientAlias.findFirst({
        where: { ingredientId: ingredient.id, alias: a.alias },
      });
      if (!existing) {
        await prisma.ingredientAlias.create({
          data: {
            ingredientId: ingredient.id,
            alias: a.alias,
            language: a.language ?? null,
            countryCode: a.countryCode ?? null,
            confidence: a.confidence ?? 1.0,
          },
        });
      }
    }
  }

  return ingredientMap;
}

// ─── Ingredient-specific unit conversions ─────────────────────────────────────

async function seedIngredientConversions(
  unitMap: Map<string, string>,
  ingredientMap: Map<string, string>,
) {
  const pieceId = unitMap.get("piece");
  const gramId = unitMap.get("gram");
  const tablespoonId = unitMap.get("tablespoon");
  const milliliterId = unitMap.get("milliliter");

  if (!pieceId || !gramId || !tablespoonId || !milliliterId) return;

  // Piece → gram conversions for ingredients with known average weights
  const pieceToGramIngredients = [
    { slug: "onion",       weight: 150 },
    { slug: "tomato",      weight: 120 },
    { slug: "green-chili", weight: 10 },
    { slug: "lemon",       weight: 85 },
  ];

  for (const item of pieceToGramIngredients) {
    const ingredientId = ingredientMap.get(item.slug);
    if (!ingredientId) continue;

    const exists = await prisma.unitConversion.findFirst({
      where: { fromUnitId: pieceId, toUnitId: gramId, ingredientId },
    });
    if (!exists) {
      await prisma.unitConversion.create({
        data: {
          fromUnitId: pieceId,
          toUnitId: gramId,
          ingredientId,
          multiplier: item.weight,
          confidence: 0.8,
          notes: `Estimated average weight for ${item.slug}.`,
          isGlobal: true,
        },
      });
    }

    // Also seed the reverse
    const existsReverse = await prisma.unitConversion.findFirst({
      where: { fromUnitId: gramId, toUnitId: pieceId, ingredientId },
    });
    if (!existsReverse) {
      await prisma.unitConversion.create({
        data: {
          fromUnitId: gramId,
          toUnitId: pieceId,
          ingredientId,
          multiplier: 1 / item.weight,
          confidence: 0.8,
          notes: `Estimated from average weight for ${item.slug}.`,
          isGlobal: true,
        },
      });
    }
  }

  // Volume-based conversions for liquids with known density
  const densityIngredients = [
    { slug: "oil",                  density: 0.91 },
    { slug: "ghee",                 density: 0.91 },
    { slug: "yogurt",               density: 1.03 },
    { slug: "ginger-garlic-paste",  density: 1.10 },
    { slug: "basmati-rice",         density: 0.75 },
  ];

  for (const item of densityIngredients) {
    const ingredientId = ingredientMap.get(item.slug);
    if (!ingredientId) continue;

    // tablespoon → gram
    const tbspToGram = 14.7868 * item.density;
    const existsTbspGram = await prisma.unitConversion.findFirst({
      where: { fromUnitId: tablespoonId, toUnitId: gramId, ingredientId },
    });
    if (!existsTbspGram) {
      await prisma.unitConversion.create({
        data: {
          fromUnitId: tablespoonId,
          toUnitId: gramId,
          ingredientId,
          multiplier: tbspToGram,
          confidence: 0.85,
          notes: `Based on density of ${item.density} g/ml.`,
          isGlobal: true,
        },
      });
    }
  }
}

// ─── Dietary tags ─────────────────────────────────────────────────────────────

async function seedDietaryTags() {
  const tags = [
    { name: "Halal", slug: "halal" },
    { name: "Vegetarian", slug: "vegetarian" },
    { name: "Vegan", slug: "vegan" },
    { name: "Gluten-Free", slug: "gluten-free" },
    { name: "Dairy-Free", slug: "dairy-free" },
    { name: "Nut-Free", slug: "nut-free" },
  ];

  const tagMap = new Map<string, string>();
  for (const tag of tags) {
    const record = await prisma.dietaryTag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name },
      create: { name: tag.name, slug: tag.slug },
    });
    tagMap.set(tag.slug, record.id);
  }
  return tagMap;
}

// ─── Meal types ───────────────────────────────────────────────────────────────

async function seedMealTypes() {
  const types = [
    { name: "Breakfast", slug: "breakfast", displayOrder: 1 },
    { name: "Lunch", slug: "lunch", displayOrder: 2 },
    { name: "Dinner", slug: "dinner", displayOrder: 3 },
    { name: "Snack", slug: "snack", displayOrder: 4 },
    { name: "Dessert", slug: "dessert", displayOrder: 5 },
    { name: "Eid Special", slug: "eid-special", displayOrder: 6 },
    { name: "Ramadan Sehri", slug: "ramadan-sehri", displayOrder: 7 },
    { name: "Ramadan Iftar", slug: "ramadan-iftar", displayOrder: 8 },
  ];

  for (const t of types) {
    await prisma.mealTypeOption.upsert({
      where: { slug: t.slug },
      update: { name: t.name, displayOrder: t.displayOrder },
      create: t,
    });
  }
}

// ─── Recipe seeding ───────────────────────────────────────────────────────────

type IngredientLine = {
  slug: string;
  quantity: number;
  unitCode: string;
  preparationNote?: string;
  section?: string;
  isOptional?: boolean;
};

type RecipeSeed = {
  name: string;
  slug: string;
  description: string;
  story?: string;
  difficulty: RecipeDifficulty;
  spiceLevel: SpiceLevel;
  prepMinutes: number;
  cookMinutes: number;
  restMinutes?: number;
  servings: number;
  servingUnit?: string;
  dietaryTagSlugs?: string[];
  ingredients: IngredientLine[];
  steps: Array<{ title?: string; instruction: string; durationMinutes?: number; tips?: string }>;
};

const RECIPE_SEEDS: RecipeSeed[] = [
  {
    name: "Hyderabadi Chicken Biryani",
    slug: "hyderabadi-chicken-biryani",
    description: "The iconic layered rice and chicken dish of Hyderabad — cooked dum style with aromatic spices, mint, and saffron.",
    story: "Inspired by the Hyderabadi kacchi biryani tradition where raw marinated chicken and soaked rice are layered and cooked together under a sealed dum. The chicken releases its juices as it cooks, flavoring the rice from below. Every family varies the spice ratios and dum time.",
    difficulty: RecipeDifficulty.hard,
    spiceLevel: SpiceLevel.hot,
    prepMinutes: 60,
    cookMinutes: 60,
    restMinutes: 20,
    servings: 6,
    servingUnit: "serving",
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "chicken", quantity: 1000, unitCode: "gram", section: "Chicken" },
      { slug: "basmati-rice", quantity: 750, unitCode: "gram", section: "Rice" },
      { slug: "yogurt", quantity: 250, unitCode: "gram", section: "Marinade", preparationNote: "whisked" },
      { slug: "onion", quantity: 4, unitCode: "piece", section: "Marinade", preparationNote: "thinly sliced and fried until golden" },
      { slug: "ginger-garlic-paste", quantity: 2, unitCode: "tablespoon", section: "Marinade" },
      { slug: "red-chili-powder", quantity: 2, unitCode: "teaspoon", section: "Marinade" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon", section: "Marinade" },
      { slug: "garam-masala", quantity: 1, unitCode: "teaspoon", section: "Marinade" },
      { slug: "biryani-masala", quantity: 2, unitCode: "tablespoon", section: "Marinade" },
      { slug: "mint", quantity: 1, unitCode: "bunch", section: "Layering" },
      { slug: "cilantro", quantity: 1, unitCode: "bunch", section: "Layering" },
      { slug: "oil", quantity: 4, unitCode: "tablespoon", section: "Cooking" },
      { slug: "ghee", quantity: 2, unitCode: "tablespoon", section: "Cooking" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon", section: "Cooking" },
      { slug: "lemon", quantity: 2, unitCode: "piece", section: "Finishing" },
    ],
    steps: [
      { title: "Marinate the chicken", instruction: "Mix chicken with yogurt, ginger garlic paste, red chili powder, turmeric, garam masala, biryani masala, and salt. Add half the fried onions. Marinate for at least 45 minutes, or overnight in the refrigerator.", durationMinutes: 5, tips: "Longer marination gives deeper flavor." },
      { title: "Parboil the rice", instruction: "Wash basmati rice until water runs clear. Soak for 30 minutes. Boil in salted water until 70% cooked — the grain should still have a firm center. Drain immediately.", durationMinutes: 15 },
      { title: "Layer the biryani", instruction: "In a heavy-bottomed pot, spread the marinated chicken at the bottom. Layer partially cooked rice on top. Add remaining fried onions, mint leaves, cilantro, and drizzle ghee. Squeeze lemon juice over the top.", durationMinutes: 10 },
      { title: "Cook dum", instruction: "Seal the pot with a tight-fitting lid (or aluminium foil). Cook on high heat for 5 minutes, then reduce to the lowest flame and cook for 40 minutes. Do not open the lid during this time.", durationMinutes: 45, tips: "Place a tawa (flat griddle) under the pot to prevent scorching." },
      { title: "Rest and serve", instruction: "Remove from heat and let rest 15 minutes before opening. Gently mix from the edges inward to preserve the layers. Serve hot.", durationMinutes: 15 },
    ],
  },
  {
    name: "Hyderabadi Mutton Biryani",
    slug: "hyderabadi-mutton-biryani",
    description: "Slow-cooked mutton with aged basmati rice, layered and dum-cooked in the authentic Hyderabadi style.",
    story: "Mutton biryani requires overnight marination for the meat to fully absorb the spices and yogurt. The fat from the bone-in pieces bastes the rice from below during dum, producing a richness that chicken biryani cannot match.",
    difficulty: RecipeDifficulty.expert,
    spiceLevel: SpiceLevel.hot,
    prepMinutes: 90,
    cookMinutes: 90,
    restMinutes: 20,
    servings: 8,
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "mutton", quantity: 1200, unitCode: "gram", section: "Mutton", preparationNote: "bone-in pieces, cleaned" },
      { slug: "basmati-rice", quantity: 900, unitCode: "gram", section: "Rice" },
      { slug: "yogurt", quantity: 300, unitCode: "gram", section: "Marinade" },
      { slug: "onion", quantity: 5, unitCode: "piece", section: "Marinade", preparationNote: "fried until dark golden" },
      { slug: "ginger-garlic-paste", quantity: 3, unitCode: "tablespoon", section: "Marinade" },
      { slug: "red-chili-powder", quantity: 2, unitCode: "teaspoon", section: "Marinade" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon", section: "Marinade" },
      { slug: "biryani-masala", quantity: 3, unitCode: "tablespoon", section: "Marinade" },
      { slug: "mint", quantity: 1, unitCode: "bunch", section: "Layering" },
      { slug: "cilantro", quantity: 1, unitCode: "bunch", section: "Layering" },
      { slug: "oil", quantity: 5, unitCode: "tablespoon", section: "Cooking" },
      { slug: "ghee", quantity: 3, unitCode: "tablespoon", section: "Cooking" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon", section: "Cooking" },
      { slug: "lemon", quantity: 2, unitCode: "piece", section: "Finishing" },
    ],
    steps: [
      { title: "Marinate mutton", instruction: "Marinate mutton with yogurt, all spices, ginger garlic paste, half the fried onions, and salt. Marinate for at least 2 hours — overnight is strongly preferred for mutton.", durationMinutes: 10 },
      { title: "Parboil rice", instruction: "Soak rice 30 minutes, then parboil in well-salted water until 70% cooked. Drain and set aside.", durationMinutes: 15 },
      { title: "Layer and seal", instruction: "Spread marinated mutton in the base of a heavy pot. Add rice in layers, alternating with mint, cilantro, and fried onions. Drizzle ghee and lemon juice. Seal tightly.", durationMinutes: 10 },
      { title: "Dum cooking", instruction: "Cook on high heat 5 minutes, then lowest flame for 75 minutes. Mutton needs more time than chicken.", durationMinutes: 80, tips: "Check mutton tenderness by opening carefully after 60 minutes." },
      { title: "Rest and serve", instruction: "Rest 20 minutes sealed. Mix gently before serving.", durationMinutes: 20 },
    ],
  },
  {
    name: "Khatti Dal",
    slug: "khatti-dal",
    description: "A tart Hyderabadi lentil curry made tangy with tamarind and tempered with dried red chilies and curry leaves.",
    story: "Khatti dal is a daily staple in Hyderabadi households. The word khatti means sour, which comes from the tamarind extract. Some families add dried red chilies and a mustard seed tadka; others keep it simpler. The tanginess level is deeply personal.",
    difficulty: RecipeDifficulty.easy,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 15,
    cookMinutes: 40,
    servings: 4,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "toor-dal", quantity: 200, unitCode: "gram", section: "Dal" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "tamarind", quantity: 30, unitCode: "gram", preparationNote: "soaked in warm water, extract the juice" },
      { slug: "tomato", quantity: 2, unitCode: "piece", preparationNote: "chopped" },
      { slug: "onion", quantity: 1, unitCode: "piece", preparationNote: "finely chopped" },
      { slug: "green-chili", quantity: 3, unitCode: "piece", preparationNote: "slit" },
      { slug: "ginger-garlic-paste", quantity: 1, unitCode: "teaspoon" },
      { slug: "red-chili-powder", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "cumin", quantity: 1, unitCode: "teaspoon", section: "Tempering" },
      { slug: "curry-leaves", quantity: 1, unitCode: "bunch", section: "Tempering" },
      { slug: "oil", quantity: 2, unitCode: "tablespoon" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
      { slug: "cilantro", quantity: 0.5, unitCode: "bunch", isOptional: true, preparationNote: "for garnish" },
    ],
    steps: [
      { title: "Cook the lentils", instruction: "Rinse lentils (toor dal) thoroughly. Cook with turmeric in a pressure cooker until soft, about 4–5 whistles. Mash lightly.", durationMinutes: 20 },
      { title: "Prepare the base", instruction: "Heat oil in a pan. Add cumin seeds — when they splutter, add onions and sauté until translucent. Add ginger garlic paste and cook 2 minutes. Add tomatoes and cook until mushy.", durationMinutes: 12 },
      { title: "Add spices and tamarind", instruction: "Add red chili powder, coriander powder, and salt. Mix well. Pour in the cooked dal and tamarind extract. Stir to combine.", durationMinutes: 5 },
      { title: "Simmer and temper", instruction: "Simmer on low heat 10 minutes. In a separate small pan, heat oil, add cumin, dry red chilies, and curry leaves — pour this tadka over the dal.", durationMinutes: 10 },
    ],
  },
  {
    name: "Bagara Khana",
    slug: "bagara-khana",
    description: "Hyderabadi baghara (tempered) rice cooked with whole spices, fried onions, and mint — a fragrant everyday rice dish.",
    story: "Bagara khana is everyday Hyderabadi rice — simpler than biryani but richly flavored with fried onions, whole spices, and mint. It is the standard accompaniment for korma, haleem, or dal.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.mild,
    prepMinutes: 20,
    cookMinutes: 30,
    servings: 4,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "basmati-rice", quantity: 500, unitCode: "gram" },
      { slug: "onion", quantity: 2, unitCode: "piece", preparationNote: "thinly sliced and fried" },
      { slug: "mint", quantity: 0.5, unitCode: "bunch" },
      { slug: "ginger-garlic-paste", quantity: 1, unitCode: "tablespoon" },
      { slug: "cumin", quantity: 1, unitCode: "teaspoon" },
      { slug: "oil", quantity: 3, unitCode: "tablespoon" },
      { slug: "ghee", quantity: 1, unitCode: "tablespoon" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
    ],
    steps: [
      { instruction: "Wash and soak rice 30 minutes. Drain.", durationMinutes: 30 },
      { instruction: "Heat oil in a pot. Add cumin seeds. When they splutter, add ginger garlic paste and sauté 1 minute.", durationMinutes: 3 },
      { instruction: "Add fried onions and mint. Stir well. Add soaked rice and coat with oil.", durationMinutes: 3 },
      { instruction: "Add 900ml water and salt. Bring to boil, then cover and cook on lowest flame 18 minutes.", durationMinutes: 20 },
      { instruction: "Remove from heat. Rest 5 minutes covered. Fluff with a fork and drizzle ghee before serving.", durationMinutes: 5 },
    ],
  },
  {
    name: "Mirchi ka Salan",
    slug: "mirchi-ka-salan",
    description: "A traditional Hyderabadi curry of large green chilies in a peanut, sesame, and coconut gravy with tamarind.",
    story: "Mirchi ka salan is the traditional biryani companion in Hyderabad — no biryani plate is complete without a small bowl of salan on the side. The peanut-sesame-coconut base gives it a nutty richness, and the tamarind provides tartness that cuts through the richness of the biryani.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 20,
    cookMinutes: 35,
    servings: 4,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "green-chili", quantity: 12, unitCode: "piece", preparationNote: "large Bhavnagri chilies, slit lengthwise", section: "Main" },
      { slug: "peanuts", quantity: 60, unitCode: "gram", preparationNote: "dry roasted", section: "Gravy Base" },
      { slug: "sesame-seeds", quantity: 2, unitCode: "tablespoon", preparationNote: "dry roasted", section: "Gravy Base" },
      { slug: "desiccated-coconut", quantity: 2, unitCode: "tablespoon", preparationNote: "dry roasted", section: "Gravy Base" },
      { slug: "tamarind", quantity: 40, unitCode: "gram", preparationNote: "soak and extract juice" },
      { slug: "onion", quantity: 2, unitCode: "piece", preparationNote: "sliced and fried" },
      { slug: "ginger-garlic-paste", quantity: 1, unitCode: "tablespoon" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "red-chili-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "cumin", quantity: 1, unitCode: "teaspoon", section: "Tempering" },
      { slug: "curry-leaves", quantity: 1, unitCode: "bunch", section: "Tempering" },
      { slug: "oil", quantity: 4, unitCode: "tablespoon" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
    ],
    steps: [
      { instruction: "Dry roast peanuts and sesame seeds separately. Grind together with a small amount of water into a coarse paste. Set aside.", durationMinutes: 10, tips: "The peanut-sesame paste is the base of the salan — don't skip it." },
      { instruction: "Shallow fry the green chilies in oil until blistered but not mushy. Remove and set aside.", durationMinutes: 5 },
      { instruction: "In the same oil, add cumin and curry leaves. Add ginger garlic paste, then the fried onions. Cook 3 minutes.", durationMinutes: 5 },
      { instruction: "Add the peanut-sesame paste. Cook 5 minutes stirring constantly to avoid burning.", durationMinutes: 5 },
      { instruction: "Add tamarind extract, turmeric, red chili powder, coriander powder, and salt. Add water to adjust consistency. Simmer 10 minutes.", durationMinutes: 12 },
      { instruction: "Add the fried chilies into the gravy. Simmer 5 more minutes so they absorb the flavors.", durationMinutes: 5 },
    ],
  },
  {
    name: "Tala Hua Gosht",
    slug: "tala-hua-gosht",
    description: "Pan-fried spiced mutton — a simple Hyderabadi dry preparation with bold spices and caramelized onions.",
    story: "Tala hua gosht is a quick, high-heat dry curry — the name literally means pan-fried meat. It is often made with pre-cooked mutton from a larger batch. The final bhuno (dry-frying) step is essential to develop the caramelized crust.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.hot,
    prepMinutes: 15,
    cookMinutes: 50,
    servings: 4,
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "mutton", quantity: 700, unitCode: "gram", preparationNote: "cut into small pieces" },
      { slug: "onion", quantity: 3, unitCode: "piece", preparationNote: "sliced" },
      { slug: "tomato", quantity: 2, unitCode: "piece", preparationNote: "chopped" },
      { slug: "ginger-garlic-paste", quantity: 2, unitCode: "tablespoon" },
      { slug: "red-chili-powder", quantity: 2, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "garam-masala", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "green-chili", quantity: 4, unitCode: "piece", preparationNote: "slit" },
      { slug: "oil", quantity: 4, unitCode: "tablespoon" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
      { slug: "lemon", quantity: 1, unitCode: "piece", preparationNote: "for garnish" },
      { slug: "cilantro", quantity: 0.5, unitCode: "bunch", preparationNote: "for garnish" },
    ],
    steps: [
      { instruction: "Heat oil in a wide pan. Fry onions until golden brown. Remove half and set aside for garnish.", durationMinutes: 12 },
      { instruction: "Add ginger garlic paste to the pan. Sauté 2 minutes. Add tomatoes and cook until oil separates.", durationMinutes: 8 },
      { instruction: "Add mutton pieces. Cook on high heat, stirring to sear all sides.", durationMinutes: 10 },
      { instruction: "Add all spices and salt. Mix well. Add a splash of water, cover, and cook on medium heat until mutton is tender.", durationMinutes: 30, tips: "Mutton on the bone takes longer — up to 45 minutes." },
      { instruction: "Remove lid and cook on high until liquid evaporates and mutton is dry-fried. Squeeze lemon and top with reserved onions and cilantro.", durationMinutes: 10 },
    ],
  },
  {
    name: "Kheema",
    slug: "kheema",
    description: "Spiced minced mutton (kheema) cooked with peas, tomatoes, and aromatic spices — a Hyderabadi household classic.",
    story: "Kheema is a versatile Hyderabadi household staple. This semi-dry version pairs well with naan, roti, or paratha. Adding matar (green peas) turns it into kheema matar, a popular variation.",
    difficulty: RecipeDifficulty.easy,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 15,
    cookMinutes: 35,
    servings: 4,
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "mutton", quantity: 500, unitCode: "gram", preparationNote: "minced (kheema)" },
      { slug: "onion", quantity: 2, unitCode: "piece", preparationNote: "finely chopped" },
      { slug: "tomato", quantity: 2, unitCode: "piece", preparationNote: "finely chopped" },
      { slug: "ginger-garlic-paste", quantity: 1.5, unitCode: "tablespoon" },
      { slug: "green-chili", quantity: 3, unitCode: "piece", preparationNote: "finely chopped" },
      { slug: "red-chili-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 1.5, unitCode: "teaspoon" },
      { slug: "turmeric", quantity: 0.25, unitCode: "teaspoon" },
      { slug: "garam-masala", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "oil", quantity: 3, unitCode: "tablespoon" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
      { slug: "cilantro", quantity: 0.5, unitCode: "bunch", preparationNote: "chopped, for garnish" },
      { slug: "lemon", quantity: 1, unitCode: "piece", isOptional: true },
    ],
    steps: [
      { instruction: "Heat oil in a pan. Sauté onions until golden. Add green chilies and ginger garlic paste, cook 2 minutes.", durationMinutes: 10 },
      { instruction: "Add tomatoes and cook until mushy and oil separates.", durationMinutes: 8 },
      { instruction: "Add all dry spices and salt. Mix well, then add minced mutton. Break up any lumps and cook on high heat 5 minutes.", durationMinutes: 8 },
      { instruction: "Cover and cook on medium heat 20 minutes until kheema is cooked through. Add peas if using.", durationMinutes: 20, tips: "If using peas, add frozen peas 5 minutes before done." },
      { instruction: "Cook uncovered on high heat 5 minutes to dry out excess moisture. Garnish with cilantro.", durationMinutes: 5 },
    ],
  },
  {
    name: "Double ka Meetha",
    slug: "double-ka-meetha",
    description: "A rich Hyderabadi bread pudding made with fried white bread, condensed milk, and garnished with nuts and saffron.",
    story: "Double ka meetha is the quintessential Hyderabadi dessert. The name comes from 'double roti', the local term for white bread. Fried bread soaked in saffron-spiced sugar syrup, then drenched in condensed milk — a dessert that appears at every Hyderabadi celebration.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.mild,
    prepMinutes: 20,
    cookMinutes: 30,
    servings: 6,
    dietaryTagSlugs: ["vegetarian"],
    ingredients: [
      { slug: "white-bread", quantity: 8, unitCode: "piece", preparationNote: "cut into triangles", section: "Bread" },
      { slug: "ghee", quantity: 3, unitCode: "tablespoon", section: "Bread" },
      { slug: "oil", quantity: 2, unitCode: "tablespoon", section: "Bread" },
      { slug: "sugar", quantity: 150, unitCode: "gram", section: "Syrup" },
      { slug: "milk", quantity: 250, unitCode: "milliliter", section: "Custard" },
      { slug: "condensed-milk", quantity: 200, unitCode: "milliliter", section: "Custard" },
      { slug: "saffron", quantity: 1, unitCode: "pinch", preparationNote: "dissolved in 2 tbsp warm milk", section: "Custard" },
      { slug: "cardamom", quantity: 3, unitCode: "piece", preparationNote: "seeds ground", section: "Syrup" },
      { slug: "cashews", quantity: 30, unitCode: "gram", preparationNote: "fried in ghee", section: "Garnish" },
      { slug: "raisins", quantity: 20, unitCode: "gram", preparationNote: "fried in ghee", section: "Garnish" },
    ],
    steps: [
      { instruction: "Cut bread slices into triangles or rectangles. Fry in ghee and oil until golden and crisp. Drain on paper towels.", durationMinutes: 15, tips: "Day-old bread fries better and absorbs less oil." },
      { instruction: "Prepare a thin sugar syrup with water, sugar, and a pinch of cardamom. Boil 5 minutes.", durationMinutes: 8 },
      { instruction: "Arrange fried bread in a baking dish. Pour warm syrup over to soak. Let sit 5 minutes.", durationMinutes: 8 },
      { instruction: "Pour condensed milk and full-fat milk over the bread. Garnish with fried cashews, raisins, and saffron.", durationMinutes: 5 },
      { instruction: "Optionally bake at 180°C for 10 minutes to set, or serve as-is at room temperature.", durationMinutes: 10, tips: "Chilling for 30 minutes before serving improves texture." },
    ],
  },
  {
    name: "Dahi ki Chutney",
    slug: "dahi-ki-chutney",
    description: "A cooling Hyderabadi yogurt chutney with green chilies, cilantro, and garlic — a classic accompaniment for biryani.",
    story: "One of the simplest and most important condiments in Hyderabadi cooking. A spoonful of dahi ki chutney alongside biryani is non-negotiable. Ratios are highly personal — some families blend it completely smooth, others keep it slightly chunky.",
    difficulty: RecipeDifficulty.easy,
    spiceLevel: SpiceLevel.mild,
    prepMinutes: 10,
    cookMinutes: 0,
    servings: 6,
    dietaryTagSlugs: ["halal", "vegetarian", "gluten-free"],
    ingredients: [
      { slug: "yogurt", quantity: 300, unitCode: "gram" },
      { slug: "cilantro", quantity: 0.5, unitCode: "bunch" },
      { slug: "mint", quantity: 0.25, unitCode: "bunch", isOptional: true },
      { slug: "green-chili", quantity: 2, unitCode: "piece" },
      { slug: "salt", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "cumin", quantity: 0.25, unitCode: "teaspoon", preparationNote: "roasted and ground", isOptional: true },
    ],
    steps: [
      { instruction: "Blend cilantro, mint, green chilies, and a little yogurt into a smooth paste.", durationMinutes: 3 },
      { instruction: "Whisk remaining yogurt until smooth. Fold in the herb paste. Add salt and roasted cumin powder.", durationMinutes: 3 },
      { instruction: "Adjust consistency with a little water if needed. Serve chilled.", durationMinutes: 2 },
    ],
  },
  {
    name: "Haleem",
    slug: "haleem",
    description: "A slow-cooked Hyderabadi stew of meat, lentils, and broken wheat — traditionally cooked for hours until the mixture becomes a thick, smooth paste.",
    story: "Haleem is one of the most complex and time-consuming dishes in Hyderabadi cuisine — a slow-cooked stew where meat, multiple lentils, and cracked wheat are cooked for hours until they merge into a thick, homogeneous paste. It is associated with Ramadan and Eid and is sold by specialized vendors during the season.",
    difficulty: RecipeDifficulty.expert,
    spiceLevel: SpiceLevel.hot,
    prepMinutes: 60,
    cookMinutes: 240,
    servings: 10,
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "mutton", quantity: 1000, unitCode: "gram" },
      { slug: "onion", quantity: 4, unitCode: "piece", preparationNote: "sliced and fried" },
      { slug: "ginger-garlic-paste", quantity: 3, unitCode: "tablespoon" },
      { slug: "red-chili-powder", quantity: 2, unitCode: "teaspoon" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 2, unitCode: "teaspoon" },
      { slug: "garam-masala", quantity: 1, unitCode: "teaspoon" },
      { slug: "cumin", quantity: 1, unitCode: "teaspoon" },
      { slug: "yogurt", quantity: 200, unitCode: "gram" },
      { slug: "ghee", quantity: 4, unitCode: "tablespoon" },
      { slug: "oil", quantity: 4, unitCode: "tablespoon" },
      { slug: "mint", quantity: 1, unitCode: "bunch", preparationNote: "for garnish" },
      { slug: "cilantro", quantity: 1, unitCode: "bunch", preparationNote: "for garnish" },
      { slug: "lemon", quantity: 3, unitCode: "piece", preparationNote: "for serving" },
      { slug: "salt", quantity: 2, unitCode: "teaspoon" },
    ],
    steps: [
      { title: "Prepare and cook meat", instruction: "Marinate mutton with yogurt, ginger garlic paste, and all spices. Cook in a pressure cooker until very tender — 6–8 whistles. The meat should fall apart.", durationMinutes: 60, tips: "The meat needs to shred completely — cook until overcooked by normal standards." },
      { title: "Cook lentil and grain mixture", instruction: "Soak mixed lentils (toor, chana, masoor) and cracked wheat overnight. Cook separately until very soft and mushy.", durationMinutes: 60 },
      { title: "Combine and cook together", instruction: "Combine cooked meat with lentil mixture in a large pot. Cook on medium heat, stirring constantly and beating the mixture with a wooden spoon to create a thick, homogeneous paste. This step can take 60–90 minutes.", durationMinutes: 90, tips: "Traditional haleem uses a wooden bhunna (hand-beating) technique. Some recipes use hand blenders for shorter cooking time." },
      { title: "Temper and finish", instruction: "Heat ghee in a pan, fry onions until dark golden. Pour over haleem. Garnish each serving with fried onions, mint, cilantro, and a squeeze of lemon.", durationMinutes: 15 },
    ],
  },
  {
    name: "Bagara Baingan",
    slug: "bagara-baingan",
    description: "Whole baby eggplants cooked in a rich peanut, sesame, and coconut gravy with tamarind — the signature Hyderabadi eggplant dish.",
    story: "Bagara baingan is one of the most distinctive dishes in Hyderabadi cuisine. Baby brinjals are stuffed with a peanut-sesame-coconut paste and slow-cooked in a tamarind gravy. Traditionally served as a side alongside biryani.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 25,
    cookMinutes: 35,
    servings: 4,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "eggplant", quantity: 8, unitCode: "piece", preparationNote: "baby brinjals, slit from base leaving stem intact", section: "Main" },
      { slug: "peanuts", quantity: 60, unitCode: "gram", preparationNote: "dry roasted", section: "Masala Paste" },
      { slug: "sesame-seeds", quantity: 2, unitCode: "tablespoon", preparationNote: "dry roasted", section: "Masala Paste" },
      { slug: "desiccated-coconut", quantity: 2, unitCode: "tablespoon", preparationNote: "dry roasted", section: "Masala Paste" },
      { slug: "tamarind", quantity: 40, unitCode: "gram", preparationNote: "soak and extract juice" },
      { slug: "onion", quantity: 2, unitCode: "piece", preparationNote: "sliced and fried golden" },
      { slug: "ginger-garlic-paste", quantity: 1, unitCode: "tablespoon" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "red-chili-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 1.5, unitCode: "teaspoon" },
      { slug: "cumin", quantity: 1, unitCode: "teaspoon", section: "Tempering" },
      { slug: "curry-leaves", quantity: 1, unitCode: "bunch", section: "Tempering" },
      { slug: "oil", quantity: 5, unitCode: "tablespoon" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
      { slug: "cilantro", quantity: 0.5, unitCode: "bunch", preparationNote: "for garnish", isOptional: true },
    ],
    steps: [
      { title: "Make the masala paste", instruction: "Dry roast peanuts until golden, then sesame seeds and coconut separately. Grind all three with a tablespoon of water into a coarse paste.", durationMinutes: 10, tips: "Don't over-roast the coconut — it should be lightly golden only." },
      { title: "Stuff the brinjals", instruction: "Make two slits crosswise in each baby brinjal from the base without cutting through. Fill each with a teaspoon of the masala paste. Reserve the remaining paste.", durationMinutes: 8 },
      { title: "Fry the brinjals", instruction: "Heat oil in a wide pan. Shallow fry the stuffed brinjals on all sides until the skin is blistered and softened, about 8 minutes. Remove and set aside.", durationMinutes: 8 },
      { title: "Build the gravy", instruction: "In the same oil, add cumin and curry leaves. Add ginger garlic paste, then fried onions. Cook 3 minutes. Add the remaining masala paste and cook 5 minutes, stirring constantly.", durationMinutes: 10 },
      { title: "Simmer together", instruction: "Add tamarind extract, turmeric, red chili powder, coriander powder, and salt. Add 200ml water. Simmer 5 minutes, then add the fried brinjals. Cook 10 minutes on low heat until brinjals are completely soft and gravy is thick.", durationMinutes: 15, tips: "Do not stir aggressively — the brinjals are delicate once cooked." },
    ],
  },
  {
    name: "Qubani ka Meetha",
    slug: "qubani-ka-meetha",
    description: "A Hyderabadi dried apricot dessert — apricots slowly cooked in sugar syrup until they form a thick, tangy-sweet compote, served with malai or cream.",
    story: "Qubani ka meetha is the other iconic Hyderabadi dessert alongside double ka meetha. Dried apricots from the Khorasan region were historically traded through Hyderabad, and this dessert emerged from that abundance. The apricot kernels inside each seed, cracked and added back, are a traditional finishing touch.",
    difficulty: RecipeDifficulty.easy,
    spiceLevel: SpiceLevel.mild,
    prepMinutes: 30,
    cookMinutes: 30,
    servings: 6,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "dried-apricots", quantity: 400, unitCode: "gram", preparationNote: "soaked in water overnight", section: "Main" },
      { slug: "sugar", quantity: 150, unitCode: "gram" },
      { slug: "saffron", quantity: 1, unitCode: "pinch", preparationNote: "dissolved in 1 tbsp warm water", isOptional: true },
      { slug: "cardamom", quantity: 3, unitCode: "piece", preparationNote: "seeds ground" },
      { slug: "cashews", quantity: 30, unitCode: "gram", preparationNote: "for garnish", isOptional: true },
    ],
    steps: [
      { instruction: "Soak dried apricots in water for at least 6 hours or overnight. They should be fully hydrated and plump.", durationMinutes: 5, tips: "Reserve the soaking water — it has flavor and will be used in cooking." },
      { instruction: "Drain apricots, reserving soaking liquid. Remove the seeds from each apricot. Crack some seeds open to extract the white kernels inside — set these aside for garnish.", durationMinutes: 15 },
      { instruction: "Combine apricots with 300ml of the reserved soaking water and sugar in a heavy pan. Bring to a boil, then simmer on medium heat 20 minutes, stirring occasionally, until the apricots break down into a thick compote.", durationMinutes: 22 },
      { instruction: "Add saffron water and cardamom powder. Stir gently. Cook 5 more minutes until the consistency is like a thick jam. Taste and adjust sweetness.", durationMinutes: 5, tips: "The compote thickens further as it cools — remove from heat slightly before it reaches desired consistency." },
      { instruction: "Serve warm or chilled, topped with whipped cream or thick malai, apricot kernels, and fried cashews.", durationMinutes: 3 },
    ],
  },
  {
    name: "Dum ka Chicken",
    slug: "dum-ka-chicken",
    description: "Whole chicken pieces slow-cooked dum style in a thick yogurt and spice marinade — deeply flavored and fork-tender.",
    story: "Dum ka chicken is distinct from biryani — there is no rice. The chicken alone cooks under a sealed dum, and the spice-laden yogurt marinade becomes a thick, clinging masala. It is often served as the main dish at celebrations with naan or bagara khana.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.hot,
    prepMinutes: 60,
    cookMinutes: 55,
    servings: 5,
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "chicken", quantity: 1200, unitCode: "gram", preparationNote: "bone-in, cleaned, scored deeply", section: "Chicken" },
      { slug: "yogurt", quantity: 300, unitCode: "gram", preparationNote: "whisked", section: "Marinade" },
      { slug: "onion", quantity: 3, unitCode: "piece", preparationNote: "fried until dark golden, crushed", section: "Marinade" },
      { slug: "ginger-garlic-paste", quantity: 2, unitCode: "tablespoon", section: "Marinade" },
      { slug: "red-chili-powder", quantity: 2, unitCode: "teaspoon", section: "Marinade" },
      { slug: "coriander-powder", quantity: 1, unitCode: "teaspoon", section: "Marinade" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon", section: "Marinade" },
      { slug: "garam-masala", quantity: 1, unitCode: "teaspoon", section: "Marinade" },
      { slug: "mint", quantity: 0.5, unitCode: "bunch", section: "Marinade" },
      { slug: "cilantro", quantity: 0.5, unitCode: "bunch", section: "Marinade" },
      { slug: "lemon", quantity: 2, unitCode: "piece", preparationNote: "juice only" },
      { slug: "ghee", quantity: 2, unitCode: "tablespoon" },
      { slug: "oil", quantity: 3, unitCode: "tablespoon" },
      { slug: "salt", quantity: 1.5, unitCode: "teaspoon" },
    ],
    steps: [
      { title: "Marinate chicken", instruction: "Score the chicken deeply on all sides. Combine all marinade ingredients — yogurt, crushed fried onions, ginger garlic paste, all spices, mint, cilantro, lemon juice, and salt. Coat the chicken thoroughly. Marinate at least 45 minutes.", durationMinutes: 10, tips: "Overnight marination in the refrigerator gives significantly more flavor depth." },
      { title: "Seal and dum", instruction: "Place the marinated chicken in a heavy-bottomed pot with ghee and oil. Do not add water. Seal the lid tightly with aluminium foil, then place the lid on top. Cook on high heat 5 minutes, then lowest flame 45 minutes.", durationMinutes: 50, tips: "Place a heavy tawa under the pot if using a thin-bottomed pan to prevent scorching." },
      { title: "Open and finish", instruction: "Remove from heat and rest 10 minutes before opening. The chicken should be fall-off-the-bone tender and the masala should have thickened and clung to the pieces. If too liquidy, cook uncovered on medium heat 5 minutes.", durationMinutes: 10 },
    ],
  },
  {
    name: "Shami Kabab",
    slug: "shami-kabab",
    description: "Smooth, pan-fried mutton and chana dal patties spiced with whole spices — a classic Hyderabadi starter.",
    story: "Shami kabab is a staple of Hyderabadi hospitality — served as a starter at gatherings and iftar during Ramadan. The chana dal acts as a binder and adds texture. Frying them fresh means the crust is crisp while the inside stays soft.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 30,
    cookMinutes: 40,
    servings: 5,
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "mutton", quantity: 400, unitCode: "gram", preparationNote: "minced or bone-in chunks (pressure-cooked to shred)", section: "Main" },
      { slug: "chana-dal", quantity: 100, unitCode: "gram", preparationNote: "soaked 30 minutes", section: "Main" },
      { slug: "onion", quantity: 1, unitCode: "piece", preparationNote: "roughly chopped" },
      { slug: "green-chili", quantity: 4, unitCode: "piece" },
      { slug: "ginger-garlic-paste", quantity: 1, unitCode: "tablespoon" },
      { slug: "red-chili-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "garam-masala", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "cumin", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "egg", quantity: 1, unitCode: "piece", preparationNote: "beaten, for binding" },
      { slug: "cilantro", quantity: 0.5, unitCode: "bunch", preparationNote: "finely chopped" },
      { slug: "mint", quantity: 0.25, unitCode: "bunch", preparationNote: "finely chopped" },
      { slug: "oil", quantity: 3, unitCode: "tablespoon", preparationNote: "for shallow frying" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
      { slug: "lemon", quantity: 1, unitCode: "piece", preparationNote: "for serving" },
    ],
    steps: [
      { title: "Cook the meat and dal together", instruction: "Combine mutton, soaked chana dal, onion, ginger garlic paste, green chilies, all spices, and salt in a pressure cooker. Add just enough water to cover. Cook 5–6 whistles until meat is completely tender and dal is soft.", durationMinutes: 25, tips: "The goal is a dry mixture — do not add excess water." },
      { title: "Dry out the mixture", instruction: "Open the pressure cooker. If any water remains, cook on high heat stirring until completely dry. The mixture must be moisture-free or the kababs will not bind.", durationMinutes: 8 },
      { title: "Grind and mix", instruction: "Let cool slightly. Grind the mixture coarsely — it should be smooth but not a paste. Transfer to a bowl. Add chopped cilantro, mint, and beaten egg. Mix well. Taste and adjust salt.", durationMinutes: 8 },
      { title: "Shape and fry", instruction: "Divide into 12–14 equal portions. Shape each into a smooth round patty about 1cm thick. Shallow fry in oil on medium heat, 3 minutes per side, until dark brown and crisp on the outside.", durationMinutes: 12, tips: "Chill the shaped kababs in the refrigerator for 30 minutes before frying — they hold together better." },
    ],
  },
  {
    name: "Kaddu ka Dalcha",
    slug: "kaddu-ka-dalcha",
    description: "A Hyderabadi dal cooked with tender pieces of bottle gourd (lauki) and tempered with garlic and whole spices.",
    story: "Dalcha is a Hyderabadi-style lentil preparation cooked with vegetables or meat — bottle gourd (lauki) is the most traditional vegetable version. The tamarind and fenugreek give it a distinctive tart-bitter note that sets it apart from other dals.",
    difficulty: RecipeDifficulty.easy,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 20,
    cookMinutes: 40,
    servings: 4,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "toor-dal", quantity: 150, unitCode: "gram", section: "Dal" },
      { slug: "chana-dal", quantity: 50, unitCode: "gram", section: "Dal" },
      { slug: "bottle-gourd", quantity: 400, unitCode: "gram", preparationNote: "peeled and diced", section: "Vegetable" },
      { slug: "tamarind", quantity: 20, unitCode: "gram", preparationNote: "soaked, extract juice" },
      { slug: "onion", quantity: 1, unitCode: "piece", preparationNote: "finely chopped" },
      { slug: "tomato", quantity: 2, unitCode: "piece", preparationNote: "chopped" },
      { slug: "ginger-garlic-paste", quantity: 1, unitCode: "tablespoon" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "red-chili-powder", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 1, unitCode: "teaspoon" },
      { slug: "cumin", quantity: 1, unitCode: "teaspoon", section: "Tempering" },
      { slug: "curry-leaves", quantity: 1, unitCode: "bunch", section: "Tempering" },
      { slug: "oil", quantity: 2, unitCode: "tablespoon" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
    ],
    steps: [
      { instruction: "Rinse toor dal and chana dal together. Pressure cook with turmeric, diced bottle gourd, and enough water until both dal and gourd are completely soft, about 4 whistles.", durationMinutes: 20 },
      { instruction: "Heat oil in a pot. Add cumin seeds and curry leaves. Add onions and cook until golden. Add ginger garlic paste, cook 2 minutes, then add tomatoes and cook until mushy.", durationMinutes: 12 },
      { instruction: "Add red chili powder, coriander powder, and salt. Pour in the cooked dal and gourd. Add tamarind extract. Stir well.", durationMinutes: 3 },
      { instruction: "Simmer on medium heat 15 minutes until the dalcha thickens slightly. Serve with rice or bagara khana.", durationMinutes: 15 },
    ],
  },
  {
    name: "Tamatar ki Chutney",
    slug: "tamatar-ki-chutney",
    description: "A quick Hyderabadi spiced tomato chutney cooked with onions, green chilies, and a mustard-curry leaf tempering.",
    story: "Tamatar ki chutney is a simple but essential Hyderabadi condiment. Unlike tamarind chutneys, this one is cooked with fresh tomatoes and has a bright, tangy-spicy character. It works as a side for biryani, a dip for kababs, or a topping for luqmi.",
    difficulty: RecipeDifficulty.easy,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 10,
    cookMinutes: 20,
    servings: 6,
    dietaryTagSlugs: ["halal", "vegetarian", "vegan"],
    ingredients: [
      { slug: "tomato", quantity: 5, unitCode: "piece", preparationNote: "roughly chopped" },
      { slug: "onion", quantity: 1, unitCode: "piece", preparationNote: "finely chopped" },
      { slug: "green-chili", quantity: 4, unitCode: "piece", preparationNote: "slit" },
      { slug: "ginger-garlic-paste", quantity: 0.5, unitCode: "tablespoon" },
      { slug: "turmeric", quantity: 0.25, unitCode: "teaspoon" },
      { slug: "red-chili-powder", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "coriander-powder", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "cumin", quantity: 0.5, unitCode: "teaspoon", section: "Tempering" },
      { slug: "curry-leaves", quantity: 1, unitCode: "bunch", section: "Tempering" },
      { slug: "oil", quantity: 2, unitCode: "tablespoon" },
      { slug: "salt", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "cilantro", quantity: 0.25, unitCode: "bunch", preparationNote: "for garnish", isOptional: true },
    ],
    steps: [
      { instruction: "Heat oil in a pan. Add cumin seeds and curry leaves. Add onions and sauté until translucent.", durationMinutes: 6 },
      { instruction: "Add ginger garlic paste and green chilies. Cook 2 minutes. Add tomatoes, turmeric, red chili powder, coriander powder, and salt.", durationMinutes: 3 },
      { instruction: "Cook on medium heat, stirring occasionally, until tomatoes break down completely and oil separates — about 12 minutes. The chutney should be thick and concentrated.", durationMinutes: 12, tips: "Do not add water — the tomatoes release enough liquid on their own." },
      { instruction: "Mash the mixture lightly with a spoon for a chunky consistency, or blend briefly for a smoother chutney. Garnish with cilantro.", durationMinutes: 2 },
    ],
  },
  {
    name: "Chicken 65",
    slug: "chicken-65",
    description: "Crispy deep-fried spiced chicken with a signature Hyderabadi red color — a popular starter and street food.",
    story: "Despite its name (the origin is debated), Chicken 65 is deeply associated with Hyderabad's street food and restaurant culture. The signature deep-red color comes from red chili powder and food coloring. Served with sliced onions, lemon, and mint chutney at most Hyderabadi restaurants.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.hot,
    prepMinutes: 30,
    cookMinutes: 25,
    servings: 4,
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "chicken", quantity: 600, unitCode: "gram", preparationNote: "boneless, cut into small pieces", section: "Chicken" },
      { slug: "yogurt", quantity: 100, unitCode: "gram", section: "Marinade" },
      { slug: "ginger-garlic-paste", quantity: 1.5, unitCode: "tablespoon", section: "Marinade" },
      { slug: "red-chili-powder", quantity: 2, unitCode: "teaspoon", section: "Marinade" },
      { slug: "coriander-powder", quantity: 1, unitCode: "teaspoon", section: "Marinade" },
      { slug: "turmeric", quantity: 0.25, unitCode: "teaspoon", section: "Marinade" },
      { slug: "garam-masala", quantity: 0.5, unitCode: "teaspoon", section: "Marinade" },
      { slug: "lemon", quantity: 1, unitCode: "piece", preparationNote: "juice only", section: "Marinade" },
      { slug: "all-purpose-flour", quantity: 30, unitCode: "gram", section: "Coating" },
      { slug: "egg", quantity: 1, unitCode: "piece", section: "Coating" },
      { slug: "curry-leaves", quantity: 1, unitCode: "bunch", section: "Finishing" },
      { slug: "green-chili", quantity: 4, unitCode: "piece", preparationNote: "slit", section: "Finishing" },
      { slug: "oil", quantity: 400, unitCode: "milliliter", preparationNote: "for deep frying" },
      { slug: "salt", quantity: 1, unitCode: "teaspoon" },
    ],
    steps: [
      { title: "Marinate chicken", instruction: "Mix chicken with yogurt, ginger garlic paste, red chili powder, coriander powder, turmeric, garam masala, lemon juice, and salt. Add flour and egg, mix to coat evenly. Marinate 20 minutes.", durationMinutes: 5, tips: "The flour and egg in the marinade create the crisp coating during frying." },
      { title: "Deep fry", instruction: "Heat oil to 175°C. Fry chicken pieces in batches — do not crowd the pan. Fry 6–7 minutes per batch until crisp and cooked through. Drain on paper towels.", durationMinutes: 18 },
      { title: "Final toss", instruction: "In a separate pan, heat 1 tbsp oil. Add curry leaves and slit green chilies — they will splutter, so stand back. Add the fried chicken and toss quickly for 1 minute to coat with the fragrant oil.", durationMinutes: 3 },
    ],
  },
  {
    name: "Luqmi",
    slug: "luqmi",
    description: "Crispy Hyderabadi pastry squares filled with spiced minced mutton — a traditional snack served at gatherings and celebrations.",
    story: "Luqmi is a uniquely Hyderabadi snack — small square or rectangular pastries with a savory minced meat filling, deep fried until golden and crisp. They are served at celebrations and mehfils (gatherings) alongside chai.",
    difficulty: RecipeDifficulty.hard,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 60,
    cookMinutes: 30,
    servings: 6,
    dietaryTagSlugs: ["halal"],
    ingredients: [
      { slug: "all-purpose-flour", quantity: 300, unitCode: "gram", section: "Pastry" },
      { slug: "ghee", quantity: 3, unitCode: "tablespoon", preparationNote: "for pastry shortening", section: "Pastry" },
      { slug: "salt", quantity: 0.5, unitCode: "teaspoon", section: "Pastry" },
      { slug: "mutton", quantity: 300, unitCode: "gram", preparationNote: "minced (kheema)", section: "Filling" },
      { slug: "onion", quantity: 1, unitCode: "piece", preparationNote: "finely chopped", section: "Filling" },
      { slug: "green-chili", quantity: 3, unitCode: "piece", preparationNote: "finely chopped", section: "Filling" },
      { slug: "ginger-garlic-paste", quantity: 1, unitCode: "tablespoon", section: "Filling" },
      { slug: "red-chili-powder", quantity: 0.5, unitCode: "teaspoon", section: "Filling" },
      { slug: "coriander-powder", quantity: 0.5, unitCode: "teaspoon", section: "Filling" },
      { slug: "garam-masala", quantity: 0.25, unitCode: "teaspoon", section: "Filling" },
      { slug: "cilantro", quantity: 0.25, unitCode: "bunch", preparationNote: "finely chopped", section: "Filling" },
      { slug: "lemon", quantity: 0.5, unitCode: "piece", preparationNote: "juice only", section: "Filling" },
      { slug: "oil", quantity: 400, unitCode: "milliliter", preparationNote: "for deep frying" },
    ],
    steps: [
      { title: "Make the pastry dough", instruction: "Mix flour, salt, and ghee together until the mixture resembles breadcrumbs. Gradually add cold water and knead into a stiff, smooth dough. Rest covered for 30 minutes.", durationMinutes: 10, tips: "A stiffer dough than roti dough — it should not be soft. This keeps the pastry crisp." },
      { title: "Cook the filling", instruction: "Heat oil in a pan. Sauté onions until golden. Add ginger garlic paste and green chilies, cook 2 minutes. Add minced mutton and all spices. Cook on high heat, breaking lumps, until completely dry — no moisture should remain. Add cilantro and lemon juice. Cool completely.", durationMinutes: 20, tips: "The filling must be completely dry or the pastry will go soggy." },
      { title: "Roll and fill", instruction: "Roll the dough thin (3mm). Cut into 8cm × 10cm rectangles. Place a tablespoon of filling on one half of each rectangle. Moisten edges with water. Fold over and press edges firmly to seal. Crimp with a fork.", durationMinutes: 20 },
      { title: "Deep fry", instruction: "Heat oil to 170°C. Fry luqmi in batches until golden and crisp, turning once, about 4 minutes per side. Drain on paper towels. Serve hot with tamatar ki chutney.", durationMinutes: 12 },
    ],
  },
  {
    name: "Sheer Khurma",
    slug: "sheer-khurma",
    description: "A rich Hyderabadi vermicelli dessert cooked in milk, sweetened with sugar, and garnished with dates, nuts, and saffron — traditionally made on Eid.",
    story: "Sheer khurma is the Eid morning dessert of Hyderabad — shared with family and neighbors after the Eid prayer. The name means 'milk with dates' in Persian. Every household has its own ratio of vermicelli to milk, and the garnish varies widely.",
    difficulty: RecipeDifficulty.easy,
    spiceLevel: SpiceLevel.mild,
    prepMinutes: 10,
    cookMinutes: 30,
    servings: 6,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "vermicelli", quantity: 80, unitCode: "gram", preparationNote: "thin, roasted or pan-toasted in ghee", section: "Main" },
      { slug: "milk", quantity: 1000, unitCode: "milliliter", section: "Main" },
      { slug: "sugar", quantity: 80, unitCode: "gram" },
      { slug: "ghee", quantity: 2, unitCode: "tablespoon" },
      { slug: "cardamom", quantity: 4, unitCode: "piece", preparationNote: "seeds ground" },
      { slug: "saffron", quantity: 1, unitCode: "pinch", preparationNote: "dissolved in 2 tbsp warm milk", isOptional: true },
      { slug: "cashews", quantity: 30, unitCode: "gram", preparationNote: "fried in ghee until golden", section: "Garnish" },
      { slug: "raisins", quantity: 20, unitCode: "gram", preparationNote: "fried in ghee", section: "Garnish" },
    ],
    steps: [
      { instruction: "Heat ghee in a heavy pan. Add vermicelli and toast on medium heat, stirring constantly, until golden brown. Remove and set aside.", durationMinutes: 5, tips: "Watch carefully — vermicelli browns quickly." },
      { instruction: "In the same pan, bring milk to a boil. Add the toasted vermicelli. Cook on medium heat, stirring frequently, until vermicelli is soft and the milk reduces slightly, about 15 minutes.", durationMinutes: 15 },
      { instruction: "Add sugar, cardamom, and saffron milk. Stir well. Cook 5 more minutes until sugar dissolves and sheer khurma reaches desired consistency — it will thicken further as it cools.", durationMinutes: 7, tips: "Serve slightly thinner than you want the final result — it thickens significantly as it cools." },
      { instruction: "Garnish with ghee-fried cashews and raisins. Serve warm or at room temperature.", durationMinutes: 3 },
    ],
  },
  {
    name: "Osmania Biscuit",
    slug: "osmania-biscuit",
    description: "The legendary mildly sweet and salted shortbread biscuit of Hyderabad — synonymous with Irani chai at the old cafés of the city.",
    story: "Osmania biscuits are named after Mir Osman Ali Khan, the last Nizam of Hyderabad, who reportedly loved them with his evening tea. They are sold by the kilo in Hyderabad's Irani chai cafés. The defining characteristic is the balance of sweet and salt, and the melt-in-the-mouth texture from the high fat content. This is a home recreation of the classic.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.mild,
    prepMinutes: 20,
    cookMinutes: 20,
    restMinutes: 60,
    servings: 24,
    dietaryTagSlugs: ["vegetarian"],
    ingredients: [
      { slug: "all-purpose-flour", quantity: 250, unitCode: "gram", section: "Dough" },
      { slug: "sugar", quantity: 60, unitCode: "gram", section: "Dough" },
      { slug: "salt", quantity: 0.5, unitCode: "teaspoon", section: "Dough" },
      { slug: "ghee", quantity: 80, unitCode: "gram", preparationNote: "at room temperature", section: "Dough" },
      { slug: "milk", quantity: 60, unitCode: "milliliter", preparationNote: "cold", section: "Dough" },
      { slug: "cardamom", quantity: 3, unitCode: "piece", preparationNote: "seeds ground", section: "Dough" },
    ],
    steps: [
      { title: "Make the dough", instruction: "Sift flour into a bowl. Add sugar, salt, and cardamom powder. Rub in the ghee until the mixture resembles fine breadcrumbs. Add cold milk gradually, mixing until the dough just comes together — do not over-knead.", durationMinutes: 10, tips: "The dough should be crumbly but hold together when pressed. Less mixing means a shorter, more tender biscuit." },
      { title: "Rest the dough", instruction: "Wrap in cling film and rest in the refrigerator for 1 hour. This relaxes the gluten and chills the fat, which is essential for the crumbly texture.", durationMinutes: 60 },
      { title: "Shape and bake", instruction: "Preheat oven to 170°C. Roll dough to 6mm thickness on a lightly floured surface. Cut into 6cm rounds or oblongs. Place on a lined baking tray. Prick each biscuit a few times with a fork. Bake 18–20 minutes until pale golden — they should not brown.", durationMinutes: 22, tips: "Osmania biscuits should be pale, not golden-brown. Take them out as soon as they look set and very lightly colored." },
      { instruction: "Cool completely on the tray — they firm up as they cool. Store in an airtight tin.", durationMinutes: 20 },
    ],
  },
];

async function seedRecipes(
  cuisineMap: Map<string, string>,
  ingredientMap: Map<string, string>,
  unitMap: Map<string, string>,
  tagMap: Map<string, string>,
) {
  const cuisineId = cuisineMap.get("hyderabadi");
  if (!cuisineId) {
    console.warn("Hyderabadi cuisine not found, skipping recipe seed");
    return;
  }

  for (const r of RECIPE_SEEDS) {
    const existing = await prisma.recipe.findFirst({
      where: { slug: r.slug, organizationId: null },
    });

    let recipe;
    if (existing) {
      recipe = existing;
      await prisma.recipe.update({
        where: { id: existing.id },
        data: {
          name: r.name,
          description: r.description,
          story: r.story ?? null,
          difficulty: r.difficulty,
          spiceLevel: r.spiceLevel,
          prepMinutes: r.prepMinutes,
          cookMinutes: r.cookMinutes,
          restMinutes: r.restMinutes ?? null,
          servings: r.servings,
          servingUnit: r.servingUnit ?? "serving",
          isPublished: true,
          isGlobal: true,
        },
      });
    } else {
      recipe = await prisma.recipe.create({
        data: {
          cuisineId,
          name: r.name,
          slug: r.slug,
          description: r.description,
          story: r.story ?? null,
          difficulty: r.difficulty,
          spiceLevel: r.spiceLevel,
          prepMinutes: r.prepMinutes,
          cookMinutes: r.cookMinutes,
          restMinutes: r.restMinutes ?? null,
          servings: r.servings,
          servingUnit: r.servingUnit ?? "serving",
          visibility: RecipeVisibility.global,
          sourceType: RecipeSourceType.platform,
          isGlobal: true,
          isPublished: true,
          organizationId: null,
          countryCode: null,
        },
      });
    }

    // Sync ingredients
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
    let order = 0;
    for (const ing of r.ingredients) {
      const ingredientId = ingredientMap.get(ing.slug);
      const unitId = unitMap.get(ing.unitCode);
      if (!ingredientId || !unitId) {
        console.warn(`Recipe ${r.slug}: ingredient '${ing.slug}' or unit '${ing.unitCode}' not found — skipping line`);
        continue;
      }
      await prisma.recipeIngredient.create({
        data: {
          recipeId: recipe.id,
          ingredientId,
          quantity: ing.quantity,
          unitId,
          preparationNote: ing.preparationNote ?? null,
          section: ing.section ?? null,
          isOptional: ing.isOptional ?? false,
          displayOrder: order++,
        },
      });
    }

    // Sync steps
    await prisma.recipeStep.deleteMany({ where: { recipeId: recipe.id } });
    for (const [index, step] of r.steps.entries()) {
      await prisma.recipeStep.create({
        data: {
          recipeId: recipe.id,
          stepNumber: index + 1,
          title: step.title ?? null,
          instruction: step.instruction,
          durationMinutes: step.durationMinutes ?? null,
          tips: step.tips ?? null,
          displayOrder: index,
        },
      });
    }

    // Sync dietary tags
    await prisma.recipeDietaryTag.deleteMany({ where: { recipeId: recipe.id } });
    for (const tagSlug of (r.dietaryTagSlugs ?? [])) {
      const tagId = tagMap.get(tagSlug);
      if (tagId) {
        await prisma.recipeDietaryTag.create({
          data: { recipeId: recipe.id, dietaryTagId: tagId },
        });
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  for (const country of COUNTRY_SEEDS) {
    await prisma.country.upsert({
      where: { countryCode: country.countryCode },
      update: { ...country, supportedModules: FEATURE_FLAGS, isActive: true },
      create: { ...country, supportedModules: FEATURE_FLAGS, isActive: true },
    });
  }

  const users = new Map<string, Awaited<ReturnType<typeof upsertUser>>>();
  for (const user of USER_SEEDS) {
    const record = await upsertUser(user.email, user.fullName, user.platformRole, user.status, passwordHash);
    users.set(user.email, record);
  }

  await prisma.countryAssignment.upsert({
    where: { userId_countryCode: { userId: users.get("country@nizamkitchen.dev")!.id, countryCode: "US" } },
    update: {},
    create: { userId: users.get("country@nizamkitchen.dev")!.id, countryCode: "US" },
  });

  const householdOrg = await createOrganization({ name: "Nizam Family Kitchen", organizationType: OrganizationType.household, countryCode: "US", ownerUserId: users.get("household@nizamkitchen.dev")!.id });
  const chefOrg = await createOrganization({ name: "Hyderabad Home Chefs Demo", organizationType: OrganizationType.chef_business, countryCode: "US", ownerUserId: users.get("chef@nizamkitchen.dev")!.id });
  const restaurantOrg = await createOrganization({ name: "Biryani House Demo", organizationType: OrganizationType.restaurant, countryCode: "US", ownerUserId: users.get("restaurant@nizamkitchen.dev")!.id });

  for (const key of FEATURE_FLAGS) {
    const existing = await prisma.featureFlag.findFirst({ where: { key, organizationId: null, countryCode: null } });
    if (existing) {
      // Never overwrite enabled state — preserve manual changes made after seeding
      await prisma.featureFlag.update({ where: { id: existing.id }, data: { name: key.replace(/_/g, " "), description: `Placeholder flag for ${key}.` } });
    } else {
      await prisma.featureFlag.create({ data: { key, name: key.replace(/_/g, " "), description: `Placeholder flag for ${key}.`, enabled: GLOBALLY_ENABLED_FLAGS.has(key) } });
    }
  }

  // Remove discontinued AI flags from the database.
  await prisma.featureFlag.deleteMany({ where: { key: { in: ["ai_video_analysis", "ai_training", "ai_suggestions"] } } });

  const existingSubscription = await prisma.billingSubscription.findFirst({ where: { organizationId: householdOrg.id, planCode: "foundation-trial" } });
  if (!existingSubscription) {
    await prisma.billingSubscription.create({
      data: { organizationId: householdOrg.id, countryCode: "US", provider: "placeholder", status: "trialing", planCode: "foundation-trial", currencyCode: "USD", billingPeriod: "monthly" },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: "platform.default_support_email" },
    update: { value: "support@nizamkitchen.dev" },
    create: { key: "platform.default_support_email", value: "support@nizamkitchen.dev", description: "Support inbox for the platform foundation environment." },
  });

  const auditItems = [
    { actorUserId: users.get("owner@nizamkitchen.dev")!.id, action: "setting.updated", targetType: "system_setting", targetId: "platform.default_support_email" },
    { actorUserId: users.get("admin@nizamkitchen.dev")!.id, action: "billing.updated", organizationId: householdOrg.id, countryCode: "US", targetType: "billing_subscription", targetId: "foundation-trial" },
    { actorUserId: users.get("owner@nizamkitchen.dev")!.id, action: "feature_flag.updated", targetType: "feature_flag", targetId: "recipes" },
    { actorUserId: users.get("household@nizamkitchen.dev")!.id, organizationId: householdOrg.id, countryCode: "US", action: "organization.created", targetType: "organization", targetId: householdOrg.id },
    { actorUserId: users.get("chef@nizamkitchen.dev")!.id, organizationId: chefOrg.id, countryCode: "US", action: "organization.created", targetType: "organization", targetId: chefOrg.id },
    { actorUserId: users.get("restaurant@nizamkitchen.dev")!.id, organizationId: restaurantOrg.id, countryCode: "US", action: "organization.created", targetType: "organization", targetId: restaurantOrg.id },
  ];

  for (const item of auditItems) {
    const exists = await prisma.auditLog.findFirst({ where: { action: item.action, targetType: item.targetType, targetId: item.targetId } });
    if (!exists) {
      await prisma.auditLog.create({ data: item });
    }
  } 

  const chefOwner = await prisma.membership.findFirstOrThrow({
    where: { organizationId: chefOrg.id, role: "chef_owner" },
    select: { userId: true },
  });
  const biryaniChefOrg = await createOrganization({ name: "Dum Biryani Specialist", organizationType: OrganizationType.chef_business, countryCode: "US", ownerUserId: chefOwner.userId });
  const tiffinChefOrg = await createOrganization({ name: "Weekly Tiffin Chef", organizationType: OrganizationType.chef_business, countryCode: "US", ownerUserId: chefOwner.userId });

  // ─── Food foundation seeding ────────────────────────────────────────────────
  console.log("Seeding units...");
  const unitMap = await seedUnits();

  console.log("Seeding unit conversions...");
  await seedConversions(unitMap);

  console.log("Seeding cuisines...");
  const cuisineMap = await seedCuisines();
  const hyderabadiCuisineId = cuisineMap.get("hyderabadi");

  if (hyderabadiCuisineId) {
    await prisma.householdProfile.upsert({
      where: { organizationId: householdOrg.id },
      update: {
        countryCode: householdOrg.countryCode,
        displayName: "Nizam Family Kitchen",
        defaultHouseholdSize: 4,
        defaultServings: 4,
        defaultSpiceLevel: SpiceLevel.medium,
        preferredMeasurementSystem: MeasurementSystem.mixed,
        preferredCuisineIds: [hyderabadiCuisineId],
        cookingSkillLevel: CookingSkillLevel.intermediate,
        weeklyCookingDays: ["monday", "wednesday", "saturday"],
        groceryBudgetCurrency: householdOrg.currencyCode,
      },
      create: {
        organizationId: householdOrg.id,
        countryCode: householdOrg.countryCode,
        displayName: "Nizam Family Kitchen",
        defaultHouseholdSize: 4,
        defaultServings: 4,
        defaultSpiceLevel: SpiceLevel.medium,
        preferredMeasurementSystem: MeasurementSystem.mixed,
        preferredCuisineIds: [hyderabadiCuisineId],
        cookingSkillLevel: CookingSkillLevel.intermediate,
        weeklyCookingDays: ["monday", "wednesday", "saturday"],
        groceryBudgetCurrency: householdOrg.currencyCode,
      },
    });

    await prisma.householdPreferredCuisine.upsert({
      where: { organizationId_cuisineId: { organizationId: householdOrg.id, cuisineId: hyderabadiCuisineId } },
      update: {},
      create: { organizationId: householdOrg.id, cuisineId: hyderabadiCuisineId },
    });
  }

  await prisma.householdShoppingPreference.upsert({
    where: { organizationId: householdOrg.id },
    update: {
      preferredDeliveryMethod: PreferredDeliveryMethod.no_preference,
      preferredShoppingDay: "saturday",
    },
    create: {
      organizationId: householdOrg.id,
      preferredDeliveryMethod: PreferredDeliveryMethod.no_preference,
      preferredShoppingDay: "saturday",
    },
  });

  console.log("Seeding ingredients and aliases...");
  const ingredientMap = await seedIngredients(unitMap);

  console.log("Seeding ingredient-specific conversions...");
  await seedIngredientConversions(unitMap, ingredientMap);

  console.log("Seeding dietary tags...");
  const tagMap = await seedDietaryTags();

  console.log("Seeding meal types...");
  await seedMealTypes();

  console.log("Seeding recipes...");
  await seedRecipes(cuisineMap, ingredientMap, unitMap, tagMap);

  // Clear then re-seed curated YouTube videos for all platform recipes.
  await prisma.recipeMediaReference.deleteMany({
    where: {
      type: "youtube",
      recipe: { organizationId: null },
    },
  });

  console.log("Seeding curated YouTube videos...");
  await seedRecipeVideos();

  console.log("Seeding grocery partner placeholders...");
  await seedGroceryPartners();

  console.log("Seeding demo chef marketplace profiles...");
  await seedChefMarketplaceProfiles([
    {
      organizationId: chefOrg.id,
      countryCode: chefOrg.countryCode,
      currencyCode: chefOrg.currencyCode,
      displayName: "Hyderabad Home Kitchen",
      slug: "hyderabad-home-kitchen",
      bio: "A demo chef business focused on homestyle Hyderabadi family meals, gentle spice customization, and weekend occasion cooking.",
      status: ChefProfileStatus.active,
      verificationStatus: ChefVerificationStatus.verified,
      isPublic: true,
      baseCity: "Chicago",
      baseRegion: "IL",
      languages: ["English", "Urdu", "Hindi"],
      specialties: ["Khatti Dal", "Bagara Khana", "Family dinners"],
      services: [
        { name: "Family dinner visit", serviceType: ChefServiceType.occasion, priceUnit: ChefPriceUnit.per_event, amount: 180 },
        { name: "Weekly cooking support", serviceType: ChefServiceType.weekly_cooking, priceUnit: ChefPriceUnit.per_week, amount: 420 },
      ],
    },
    {
      organizationId: biryaniChefOrg.id,
      countryCode: biryaniChefOrg.countryCode,
      currencyCode: biryaniChefOrg.currencyCode,
      displayName: "Dum Biryani Specialist",
      slug: "dum-biryani-specialist",
      bio: "A demo profile for a chef business specializing in Hyderabadi chicken and mutton dum biryani for small family occasions.",
      status: ChefProfileStatus.draft,
      verificationStatus: ChefVerificationStatus.pending,
      isPublic: false,
      baseCity: "Irving",
      baseRegion: "TX",
      languages: ["English", "Urdu"],
      specialties: ["Chicken Dum Biryani", "Mutton Biryani", "Mirchi ka Salan"],
      services: [
        { name: "Biryani occasion package", serviceType: ChefServiceType.occasion, priceUnit: ChefPriceUnit.per_event, amount: 260 },
      ],
    },
    {
      organizationId: tiffinChefOrg.id,
      countryCode: tiffinChefOrg.countryCode,
      currencyCode: tiffinChefOrg.currencyCode,
      displayName: "Weekly Tiffin Chef",
      slug: "weekly-tiffin-chef",
      bio: "A paused demo chef profile for weekly home-style meals, dal, rice, chutneys, and simple Hyderabadi staples.",
      status: ChefProfileStatus.paused,
      verificationStatus: ChefVerificationStatus.verified,
      isPublic: false,
      baseCity: "Houston",
      baseRegion: "TX",
      languages: ["English", "Hindi"],
      specialties: ["Weekly tiffin", "Vegetarian meals", "Khatti Dal"],
      services: [
        { name: "Weekly tiffin prep", serviceType: ChefServiceType.weekly_cooking, priceUnit: ChefPriceUnit.per_week, amount: 300 },
      ],
    },
  ]);

  console.log("Seeding sample home chef requests...");
  await seedHomeChefRequests({
    householdOrgId: householdOrg.id,
    chefOrgId: chefOrg.id,
    householdUserId: users.get(USER_SEEDS[3].email)!.id,
    adminUserId: users.get(USER_SEEDS[1].email)!.id,
    countryCode: householdOrg.countryCode,
    currencyCode: householdOrg.currencyCode,
  });

  console.log("Seed complete.");
}

async function seedHomeChefRequests(params: {
  householdOrgId: string;
  chefOrgId: string;
  householdUserId: string;
  adminUserId: string;
  countryCode: string;
  currencyCode: string;
}) {
  const chickenBiryani = await prisma.recipe.findFirst({
    where: { slug: "hyderabadi-chicken-biryani", organizationId: null },
    select: { id: true },
  });
  const khattiDal = await prisma.recipe.findFirst({
    where: { slug: "khatti-dal", organizationId: null },
    select: { id: true },
  });

  let mealPlan = await prisma.mealPlan.findFirst({
    where: { organizationId: params.householdOrgId, name: "Sample Family Weekend Plan" },
  });

  if (!mealPlan) {
    mealPlan = await prisma.mealPlan.create({
      data: {
        organizationId: params.householdOrgId,
        countryCode: params.countryCode,
        createdById: params.householdUserId,
        name: "Sample Family Weekend Plan",
        status: "active",
        startDate: new Date("2026-05-23T00:00:00.000Z"),
        endDate: new Date("2026-05-24T00:00:00.000Z"),
        householdSize: 4,
        notes: "Demo meal plan used for the home-chef request MVP.",
        days: {
          create: [
            {
              date: new Date("2026-05-23T00:00:00.000Z"),
              dayLabel: "Saturday",
              entries: chickenBiryani
                ? {
                    create: [
                      {
                        recipeId: chickenBiryani.id,
                        mealType: "dinner",
                        targetServings: 6,
                        displayOrder: 1,
                      },
                    ],
                  }
                : undefined,
            },
            {
              date: new Date("2026-05-24T00:00:00.000Z"),
              dayLabel: "Sunday",
              entries: khattiDal
                ? {
                    create: [
                      {
                        recipeId: khattiDal.id,
                        mealType: "lunch",
                        targetServings: 4,
                        displayOrder: 1,
                      },
                    ],
                  }
                : undefined,
            },
          ],
        },
      },
    });
  }

  const requestSeeds = [
    {
      title: "Chef for Hyderabadi Chicken Biryani",
      requestType: "recipe",
      status: "submitted",
      recipeId: chickenBiryani?.id ?? null,
      mealPlanId: null,
      requestedDate: new Date("2026-05-23T00:00:00.000Z"),
      requestedTimeWindow: "4 PM - 8 PM",
      guestCount: 6,
      notes: "Local demo request for a recipe-backed chef request.",
      assignedChefOrganizationId: null,
    },
    {
      title: "Weekly cooking support for Nizam Family Kitchen",
      requestType: "weekly_cooking",
      status: "reviewing",
      recipeId: null,
      mealPlanId: mealPlan.id,
      requestedDate: new Date("2026-05-24T00:00:00.000Z"),
      requestedTimeWindow: "Morning prep preferred",
      guestCount: 4,
      notes: "Local demo request for weekly cooking support.",
      assignedChefOrganizationId: params.chefOrgId,
    },
    {
      title: "Small Eid-style dinner occasion",
      requestType: "occasion",
      status: "matched",
      recipeId: null,
      mealPlanId: null,
      requestedDate: new Date("2026-05-30T00:00:00.000Z"),
      requestedTimeWindow: "3 PM - 9 PM",
      guestCount: 10,
      notes: "Local demo request for an occasion.",
      assignedChefOrganizationId: params.chefOrgId,
    },
  ] as const;

  for (const item of requestSeeds) {
    const existing = await prisma.homeChefRequest.findFirst({
      where: { organizationId: params.householdOrgId, title: item.title },
    });

    const request = existing
      ? await prisma.homeChefRequest.update({
          where: { id: existing.id },
          data: {
            status: item.status,
            requestType: item.requestType,
            recipeId: item.recipeId,
            mealPlanId: item.mealPlanId,
            requestedDate: item.requestedDate,
            requestedTimeWindow: item.requestedTimeWindow,
            guestCount: item.guestCount,
            notes: item.notes,
            assignedChefOrganizationId: item.assignedChefOrganizationId,
            budgetCurrency: params.currencyCode,
          },
        })
      : await prisma.homeChefRequest.create({
          data: {
            organizationId: params.householdOrgId,
            countryCode: params.countryCode,
            createdById: params.householdUserId,
            status: item.status,
            requestType: item.requestType,
            title: item.title,
            recipeId: item.recipeId,
            mealPlanId: item.mealPlanId,
            requestedDate: item.requestedDate,
            requestedTimeWindow: item.requestedTimeWindow,
            guestCount: item.guestCount,
            householdSize: 4,
            city: "Chicago",
            region: "IL",
            preferredLanguage: "English",
            genderPreference: "no_preference",
            budgetCurrency: params.currencyCode,
            notes: item.notes,
            assignedChefOrganizationId: item.assignedChefOrganizationId,
            statusHistory: {
              create: {
                newStatus: item.status,
                changedById: params.adminUserId,
                note: "Local demo request seeded for manual QA.",
              },
            },
            messages: {
              create: {
                senderUserId: params.householdUserId,
                senderRole: "household",
                message: "Please review this demo home chef request.",
                isInternal: false,
              },
            },
          },
        });

    const auditExists = await prisma.auditLog.findFirst({
      where: { action: "home_chef_request.created", targetId: request.id },
    });
    if (!auditExists) {
      await prisma.auditLog.create({
        data: {
          actorUserId: params.householdUserId,
          organizationId: params.householdOrgId,
          countryCode: params.countryCode,
          action: "home_chef_request.created",
          targetType: "home_chef_request",
          targetId: request.id,
        },
      });
    }
  }
}

async function seedChefMarketplaceProfiles(
  profiles: Array<{
    organizationId: string;
    countryCode: string;
    currencyCode: string;
    displayName: string;
    slug: string;
    bio: string;
    status: ChefProfileStatus;
    verificationStatus: ChefVerificationStatus;
    isPublic: boolean;
    baseCity: string;
    baseRegion: string;
    languages: string[];
    specialties: string[];
    services: Array<{
      name: string;
      serviceType: ChefServiceType;
      priceUnit: ChefPriceUnit;
      amount: number;
    }>;
  }>,
) {
  for (const item of profiles) {
    const profile = await prisma.chefProfile.upsert({
      where: { organizationId: item.organizationId },
      update: {
        countryCode: item.countryCode,
        displayName: item.displayName,
        slug: item.slug,
        bio: item.bio,
        status: item.status,
        verificationStatus: item.verificationStatus,
        isPublic: item.isPublic,
        baseCity: item.baseCity,
        baseRegion: item.baseRegion,
        languages: item.languages,
        specialties: item.specialties,
        yearsExperience: item.displayName.includes("Biryani") ? 8 : 5,
        serviceRadiusKm: 30,
        email: "chef-demo@example.test",
      },
      create: {
        organizationId: item.organizationId,
        countryCode: item.countryCode,
        displayName: item.displayName,
        slug: item.slug,
        bio: item.bio,
        status: item.status,
        verificationStatus: item.verificationStatus,
        isPublic: item.isPublic,
        baseCity: item.baseCity,
        baseRegion: item.baseRegion,
        languages: item.languages,
        specialties: item.specialties,
        yearsExperience: item.displayName.includes("Biryani") ? 8 : 5,
        serviceRadiusKm: 30,
        email: "chef-demo@example.test",
      },
    });

    for (const service of item.services) {
      const existingService = await prisma.chefService.findFirst({
        where: { chefProfileId: profile.id, name: service.name },
      });
      if (existingService) {
        await prisma.chefService.update({
          where: { id: existingService.id },
          data: {
            serviceType: service.serviceType,
            basePriceAmount: service.amount,
            currencyCode: item.currencyCode,
            priceUnit: service.priceUnit,
            isActive: true,
          },
        });
      } else {
        await prisma.chefService.create({
          data: {
            chefProfileId: profile.id,
            name: service.name,
            description: "Demo marketplace service. Pricing is placeholder-only.",
            serviceType: service.serviceType,
            basePriceAmount: service.amount,
            currencyCode: item.currencyCode,
            priceUnit: service.priceUnit,
            minGuests: 2,
            maxGuests: service.serviceType === ChefServiceType.occasion ? 30 : 8,
            isActive: true,
          },
        });
      }
    }

    for (const dayOfWeek of [5, 6, 0]) {
      const existingAvailability = await prisma.chefAvailability.findFirst({
        where: { chefProfileId: profile.id, dayOfWeek },
      });
      if (existingAvailability) {
        await prisma.chefAvailability.update({
          where: { id: existingAvailability.id },
          data: { startTime: "10:00", endTime: "18:00", isAvailable: item.status !== ChefProfileStatus.paused },
        });
      } else {
        await prisma.chefAvailability.create({
          data: {
            chefProfileId: profile.id,
            dayOfWeek,
            startTime: "10:00",
            endTime: "18:00",
            isAvailable: item.status !== ChefProfileStatus.paused,
          },
        });
      }
    }

    const firstSpecialty = item.specialties[0];
    const existingSpecialty = await prisma.chefSpecialtyRecipe.findFirst({
      where: { chefProfileId: profile.id, dishName: firstSpecialty },
    });
    if (!existingSpecialty) {
      await prisma.chefSpecialtyRecipe.create({
        data: {
          chefProfileId: profile.id,
          dishName: firstSpecialty,
          notes: "Demo specialty for marketplace browsing.",
        },
      });
    }
  }
}


async function seedRecipeVideos() {
  const VIDEO_REFS = [
    { slug: "hyderabadi-chicken-biryani", videoId: "mFZkmjC2B3Y", title: "Authentic Hyderabadi Chicken Dum Biryani" },
    { slug: "hyderabadi-mutton-biryani",  videoId: "HLaLwAeAxBw", title: "Hyderabadi Mutton Biryani – Masala Trails with Smita Deo" },
    { slug: "khatti-dal",                  videoId: "Lj0ENznPLqg", title: "Hyderabadi Khatti Dal – Chef Sanjyot Keer" },
    { slug: "bagara-khana",               videoId: "SDqohCr7rz0", title: "Bagara Khana – Nawab's Kitchen" },
    { slug: "mirchi-ka-salan",            videoId: "3WD_YOaj4h4", title: "Mirchi Ka Salan – Authentic Hyderabadi Recipe" },
    { slug: "tala-hua-gosht",             videoId: "jgVD8EeicIg", title: "Tala Hua Gosht – Traditional Hyderabadi on Tawa" },
    { slug: "kheema",                     videoId: "OLKnHiYxH2M", title: "Hyderabadi Dum Ka Keema" },
    { slug: "double-ka-meetha",           videoId: "i5Zmw7ZGeIU", title: "Double Ka Meetha – Nawab's Kitchen Official" },
    { slug: "dahi-ki-chutney",            videoId: "aKylCGKtumA", title: "Dahi Ki Chutney – Norien Nasri" },
    { slug: "haleem",                     videoId: "2kMZA1W4Sn8", title: "World Famous Pista House Haleem" },
    { slug: "bagara-baingan",             videoId: "MusgIHWeH0Y", title: "Bagare Baingan – Hyderabadi Nizams Style – Cook With Fem" },
    { slug: "qubani-ka-meetha",           videoId: "ZDrCpK7Le4U", title: "Qubani Ka Meetha – Authentic Hyderabadi – Norien Nasri" },
    { slug: "dum-ka-chicken",             videoId: "lOk1lD2z-yU", title: "Hyderabadi Dum Ka Murgh – Cook With Fem" },
    { slug: "shami-kabab",               videoId: "jPlotlxOSgM", title: "Hyderabadi Shami Kabab – Cook With Fem" },
    { slug: "kaddu-ka-dalcha",            videoId: "hAZklLbETqU", title: "Hyderabadi Kaddu Ka Dalcha" },
    { slug: "tamatar-ki-chutney",         videoId: "_22q5ztwox8", title: "Hyderabadi Gadre Tamatar Chutney – Old Style" },
    { slug: "chicken-65",                 videoId: "xSefj4uFou8", title: "Hyderabadi Chicken 65 – Restaurant Style" },
    { slug: "luqmi",                      videoId: "nOrBtMxOM5k", title: "Hyderabadi Warqi Kheema Lukhmi – Cook With Fem" },
    { slug: "sheer-khurma",               videoId: "JPX1_hyGW-8", title: "World Famous Hyderabadi Sheer Khurma – Norien Nasri" },
    { slug: "osmania-biscuit",            videoId: "c2Q5eZTUrLg", title: "Osmania Biscuit – Hyderabad Famous Biscuits at Home" },
  ] as const;

  for (const ref of VIDEO_REFS) {
    const recipe = await prisma.recipe.findFirst({
      where: { slug: ref.slug, organizationId: null },
    });
    if (!recipe) {
      console.warn(`  [skip] Recipe not found for slug: ${ref.slug}`);
      continue;
    }
    await prisma.recipeMediaReference.create({
      data: {
        recipeId: recipe.id,
        type: "youtube",
        provider: "youtube",
        title: ref.title,
        url: `https://www.youtube.com/watch?v=${ref.videoId}`,
        embedUrl: `https://www.youtube.com/embed/${ref.videoId}`,
        externalId: ref.videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${ref.videoId}/hqdefault.jpg`,
        isPrimary: true,
        displayOrder: 0,
      },
    });
    console.log(`  [ok] ${ref.slug} → ${ref.videoId}`);
  }
}

async function seedGroceryPartners() {
  const partners = [
    {
      countryCode: "US",
      name: "Local Grocery Website Placeholder",
      slug: "local-grocery-website-placeholder",
      websiteUrl: "https://example.com/grocery",
      integrationType: GroceryIntegrationType.manual_link,
      status: GroceryPartnerStatus.active,
      supportedRegions: ["Chicago", "Dallas", "Houston"],
      notes: "Demo placeholder for manual grocery partner handoff. No checkout or personal data transfer is enabled.",
    },
    {
      countryCode: "IN",
      name: "India Grocery Export Placeholder",
      slug: "india-grocery-export-placeholder",
      websiteUrl: "https://example.com/india-grocery",
      integrationType: GroceryIntegrationType.export_only,
      status: GroceryPartnerStatus.draft,
      supportedRegions: ["Hyderabad"],
      notes: "Draft placeholder for future India grocery partner exploration.",
    },
  ];

  for (const partner of partners) {
    await prisma.groceryPartner.upsert({
      where: { slug: partner.slug },
      update: partner,
      create: partner,
    });
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
