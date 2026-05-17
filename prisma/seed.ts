import crypto from "node:crypto";
import {
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
  "ai_suggestions",
];

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
    await prisma.mealType.upsert({
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
    story: "A starter demo recipe. Inspired by the Hyderabadi kacchi biryani tradition where marinated chicken and soaked rice are cooked together under a sealed dum. Cultural nuances and family variations should be added over time.",
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
    story: "A starter demo recipe. Mutton biryani requires longer marination and cooking than chicken. Family recipes vary significantly — this is a foundation to build from.",
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
    story: "A starter demo recipe. Khatti dal is a daily staple in Hyderabadi households — the tanginess level varies significantly by family preference.",
    difficulty: RecipeDifficulty.easy,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 15,
    cookMinutes: 40,
    servings: 4,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
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
    story: "A starter demo recipe. Bagara khana is simpler than biryani but deeply flavored. Often served with korma or dal.",
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
    story: "A starter demo recipe. Traditionally served alongside biryani. The gravy is the star — the chilies provide mild heat after cooking.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.medium,
    prepMinutes: 20,
    cookMinutes: 35,
    servings: 4,
    dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "green-chili", quantity: 12, unitCode: "piece", preparationNote: "large Bhavnagri chilies, slit lengthwise" },
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
    story: "A starter demo recipe. Tala hua gosht is a quick, high-heat dry curry. Often made with leftover cooked mutton.",
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
    story: "A starter demo recipe. Kheema can be dry or saucy depending on preference. This version is semi-dry and pairs well with naan or roti.",
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
    story: "A starter demo recipe. Double ka meetha is the quintessential Hyderabadi dessert. 'Double roti' is the local name for white bread. Exact sweetness and spice ratios vary by household.",
    difficulty: RecipeDifficulty.medium,
    spiceLevel: SpiceLevel.mild,
    prepMinutes: 20,
    cookMinutes: 30,
    servings: 6,
    dietaryTagSlugs: ["vegetarian"],
    ingredients: [
      { slug: "ghee", quantity: 4, unitCode: "tablespoon", section: "Frying" },
      { slug: "oil", quantity: 2, unitCode: "tablespoon", section: "Frying" },
      { slug: "yogurt", quantity: 100, unitCode: "gram", section: "Custard", isOptional: true },
      { slug: "salt", quantity: 1, unitCode: "pinch", section: "Frying" },
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
    story: "A starter demo recipe. One of the simplest and most important condiments in Hyderabadi cooking. Ratios are highly personal.",
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
    story: "A starter demo placeholder recipe. Haleem is one of the most complex and time-consuming dishes in Hyderabadi cuisine. A proper haleem recipe requires extensive cultural context, lentil ratios, and technique details that should be added by domain experts.",
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
    r.steps.forEach(async (step, index) => {
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
    });

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
      await prisma.featureFlag.update({ where: { id: existing.id }, data: { name: key.replace(/_/g, " "), description: `Placeholder flag for ${key}.`, enabled: false } });
    } else {
      await prisma.featureFlag.create({ data: { key, name: key.replace(/_/g, " "), description: `Placeholder flag for ${key}.`, enabled: false } });
    }
  }

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

  // ─── Food foundation seeding ────────────────────────────────────────────────
  console.log("Seeding units...");
  const unitMap = await seedUnits();

  console.log("Seeding unit conversions...");
  await seedConversions(unitMap);

  console.log("Seeding cuisines...");
  const cuisineMap = await seedCuisines();

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

  console.log("Seed complete.");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
