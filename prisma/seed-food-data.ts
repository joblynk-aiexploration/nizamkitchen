/**
 * Standalone food-data seed — no src/ imports, safe to run in the production container.
 * Seeds: units, unit conversions, cuisines, ingredients, dietary tags, and recipes.
 *
 * Usage (from inside the app container):
 *   node /app/node_modules/.bin/tsx /app/prisma/seed-food-data.ts
 */
import {
  IngredientCategory,
  PrismaClient,
  RecipeDifficulty,
  RecipeSourceType,
  RecipeVisibility,
  SpiceLevel,
  UnitSystem,
  UnitType,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Units ────────────────────────────────────────────────────────────────────

const UNIT_SEEDS = [
  { code: "gram",       name: "gram",        pluralName: "grams",       type: UnitType.mass,    system: UnitSystem.metric,      symbol: "g",    isBaseUnit: true },
  { code: "kilogram",   name: "kilogram",    pluralName: "kilograms",   type: UnitType.mass,    system: UnitSystem.metric,      symbol: "kg" },
  { code: "ounce",      name: "ounce",       pluralName: "ounces",      type: UnitType.mass,    system: UnitSystem.imperial,    symbol: "oz" },
  { code: "pound",      name: "pound",       pluralName: "pounds",      type: UnitType.mass,    system: UnitSystem.imperial,    symbol: "lb" },
  { code: "milliliter", name: "milliliter",  pluralName: "milliliters", type: UnitType.volume,  system: UnitSystem.metric,      symbol: "ml",   isBaseUnit: true },
  { code: "liter",      name: "liter",       pluralName: "liters",      type: UnitType.volume,  system: UnitSystem.metric,      symbol: "L" },
  { code: "teaspoon",   name: "teaspoon",    pluralName: "teaspoons",   type: UnitType.volume,  system: UnitSystem.traditional, symbol: "tsp" },
  { code: "tablespoon", name: "tablespoon",  pluralName: "tablespoons", type: UnitType.volume,  system: UnitSystem.traditional, symbol: "tbsp" },
  { code: "cup",        name: "cup",         pluralName: "cups",        type: UnitType.volume,  system: UnitSystem.traditional, symbol: "cup" },
  { code: "piece",      name: "piece",       pluralName: "pieces",      type: UnitType.count,   system: UnitSystem.mixed,       symbol: "pc",   isBaseUnit: true },
  { code: "clove",      name: "clove",       pluralName: "cloves",      type: UnitType.count,   system: UnitSystem.mixed },
  { code: "bunch",      name: "bunch",       pluralName: "bunches",     type: UnitType.count,   system: UnitSystem.mixed },
  { code: "packet",     name: "packet",      pluralName: "packets",     type: UnitType.package, system: UnitSystem.mixed },
  { code: "can",        name: "can",         pluralName: "cans",        type: UnitType.package, system: UnitSystem.mixed },
  { code: "bottle",     name: "bottle",      pluralName: "bottles",     type: UnitType.package, system: UnitSystem.mixed },
  { code: "pinch",      name: "pinch",       pluralName: "pinches",     type: UnitType.custom,  system: UnitSystem.traditional },
  { code: "handful",    name: "handful",     pluralName: "handfuls",    type: UnitType.custom,  system: UnitSystem.traditional },
];

async function seedUnits() {
  const unitMap = new Map<string, string>();
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

// ─── Unit conversions ─────────────────────────────────────────────────────────

const CONVERSION_SEEDS = [
  { from: "kilogram",   to: "gram",        multiplier: 1000,      confidence: 1.0 },
  { from: "gram",       to: "kilogram",    multiplier: 0.001,     confidence: 1.0 },
  { from: "pound",      to: "ounce",       multiplier: 16,        confidence: 1.0 },
  { from: "ounce",      to: "pound",       multiplier: 0.0625,    confidence: 1.0 },
  { from: "ounce",      to: "gram",        multiplier: 28.3495,   confidence: 0.9999 },
  { from: "gram",       to: "ounce",       multiplier: 0.035274,  confidence: 0.9999 },
  { from: "pound",      to: "gram",        multiplier: 453.592,   confidence: 0.9999 },
  { from: "gram",       to: "pound",       multiplier: 0.0022046, confidence: 0.9999 },
  { from: "liter",      to: "milliliter",  multiplier: 1000,      confidence: 1.0 },
  { from: "milliliter", to: "liter",       multiplier: 0.001,     confidence: 1.0 },
  { from: "tablespoon", to: "teaspoon",    multiplier: 3,         confidence: 1.0 },
  { from: "teaspoon",   to: "tablespoon",  multiplier: 0.333333,  confidence: 1.0 },
  { from: "cup",        to: "tablespoon",  multiplier: 16,        confidence: 1.0 },
  { from: "tablespoon", to: "cup",         multiplier: 0.0625,    confidence: 1.0 },
  { from: "teaspoon",   to: "milliliter",  multiplier: 4.92892,   confidence: 0.95 },
  { from: "milliliter", to: "teaspoon",    multiplier: 0.202884,  confidence: 0.95 },
  { from: "tablespoon", to: "milliliter",  multiplier: 14.7868,   confidence: 0.95 },
  { from: "milliliter", to: "tablespoon",  multiplier: 0.067628,  confidence: 0.95 },
  { from: "cup",        to: "milliliter",  multiplier: 236.588,   confidence: 0.95 },
  { from: "milliliter", to: "cup",         multiplier: 0.0042268, confidence: 0.95 },
];

async function seedConversions(unitMap: Map<string, string>) {
  for (const c of CONVERSION_SEEDS) {
    const fromUnitId = unitMap.get(c.from);
    const toUnitId = unitMap.get(c.to);
    if (!fromUnitId || !toUnitId) continue;
    const existing = await prisma.unitConversion.findFirst({ where: { fromUnitId, toUnitId, ingredientId: null } });
    if (existing) {
      await prisma.unitConversion.update({ where: { id: existing.id }, data: { multiplier: c.multiplier, confidence: c.confidence } });
    } else {
      await prisma.unitConversion.create({ data: { fromUnitId, toUnitId, multiplier: c.multiplier, confidence: c.confidence, isGlobal: true } });
    }
  }
}

// ─── Cuisines ─────────────────────────────────────────────────────────────────

async function seedCuisines() {
  const cuisineMap = new Map<string, string>();
  const cuisine = await prisma.cuisine.upsert({
    where: { slug: "hyderabadi" },
    update: { name: "Hyderabadi", description: "Traditional cuisine of Hyderabad, India — known for biryani, haleem, and aromatic Mughal-influenced cooking.", isGlobal: true },
    create: { name: "Hyderabadi", slug: "hyderabadi", description: "Traditional cuisine of Hyderabad, India — known for biryani, haleem, and aromatic Mughal-influenced cooking.", isGlobal: true },
  });
  cuisineMap.set("hyderabadi", cuisine.id);
  return cuisineMap;
}

// ─── Dietary tags ─────────────────────────────────────────────────────────────

const DIETARY_TAGS = [
  { name: "Halal",       slug: "halal" },
  { name: "Vegetarian",  slug: "vegetarian" },
  { name: "Vegan",       slug: "vegan" },
  { name: "Gluten-Free", slug: "gluten-free" },
];

async function seedDietaryTags() {
  const tagMap = new Map<string, string>();
  for (const t of DIETARY_TAGS) {
    const tag = await prisma.dietaryTag.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: { name: t.name, slug: t.slug },
    });
    tagMap.set(t.slug, tag.id);
  }
  return tagMap;
}

// ─── Ingredients ──────────────────────────────────────────────────────────────

type IngSeed = {
  name: string; canonicalName: string; slug: string;
  category: IngredientCategory; defaultUnitCode?: string;
  densityGramPerMl?: number; averagePieceWeightGrams?: number;
  aliases: Array<{ alias: string; language?: string; confidence?: number }>;
};

const INGREDIENT_SEEDS: IngSeed[] = [
  { name: "Onion", canonicalName: "Onion", slug: "onion", category: IngredientCategory.vegetable, defaultUnitCode: "piece", averagePieceWeightGrams: 150, aliases: [{ alias: "onions" }, { alias: "pyaz", language: "hi" }, { alias: "pyaaz", language: "hi" }, { alias: "kanda", language: "hi" }] },
  { name: "Tomato", canonicalName: "Tomato", slug: "tomato", category: IngredientCategory.vegetable, defaultUnitCode: "piece", averagePieceWeightGrams: 120, aliases: [{ alias: "tomatoes" }, { alias: "tamatar", language: "hi" }] },
  { name: "Green Chili", canonicalName: "Green Chili", slug: "green-chili", category: IngredientCategory.vegetable, defaultUnitCode: "piece", averagePieceWeightGrams: 10, aliases: [{ alias: "green chilies" }, { alias: "green chilli" }, { alias: "hari mirch", language: "hi" }] },
  { name: "Ginger Garlic Paste", canonicalName: "Ginger Garlic Paste", slug: "ginger-garlic-paste", category: IngredientCategory.condiment, defaultUnitCode: "tablespoon", densityGramPerMl: 1.1, aliases: [{ alias: "adrak lehsun", language: "hi" }, { alias: "adrak lehsun paste", language: "hi" }] },
  { name: "Garlic", canonicalName: "Garlic", slug: "garlic", category: IngredientCategory.vegetable, defaultUnitCode: "piece", averagePieceWeightGrams: 5, aliases: [{ alias: "garlic cloves" }, { alias: "lehsun", language: "hi" }] },
  { name: "Ginger", canonicalName: "Ginger", slug: "ginger", category: IngredientCategory.herb, defaultUnitCode: "gram", aliases: [{ alias: "fresh ginger" }, { alias: "adrak", language: "hi" }] },
  { name: "Basmati Rice", canonicalName: "Basmati Rice", slug: "basmati-rice", category: IngredientCategory.grain, defaultUnitCode: "gram", densityGramPerMl: 0.75, aliases: [{ alias: "basmati" }, { alias: "long grain rice" }] },
  { name: "Chicken", canonicalName: "Chicken", slug: "chicken", category: IngredientCategory.poultry, defaultUnitCode: "gram", aliases: [{ alias: "chicken pieces" }, { alias: "murgh", language: "hi" }] },
  { name: "Mutton", canonicalName: "Mutton", slug: "mutton", category: IngredientCategory.meat, defaultUnitCode: "gram", aliases: [{ alias: "lamb" }, { alias: "gosht", language: "hi" }] },
  { name: "Yogurt", canonicalName: "Yogurt", slug: "yogurt", category: IngredientCategory.dairy, defaultUnitCode: "gram", densityGramPerMl: 1.03, aliases: [{ alias: "curd" }, { alias: "dahi", language: "hi" }, { alias: "yoghurt" }] },
  { name: "Mint Leaves", canonicalName: "Mint Leaves", slug: "mint", category: IngredientCategory.herb, defaultUnitCode: "bunch", aliases: [{ alias: "mint" }, { alias: "pudina", language: "hi" }] },
  { name: "Coriander Leaves", canonicalName: "Coriander Leaves", slug: "cilantro", category: IngredientCategory.herb, defaultUnitCode: "bunch", aliases: [{ alias: "cilantro" }, { alias: "coriander leaves" }, { alias: "hara dhania", language: "hi" }] },
  { name: "Lemon", canonicalName: "Lemon", slug: "lemon", category: IngredientCategory.fruit, defaultUnitCode: "piece", averagePieceWeightGrams: 85, aliases: [{ alias: "lemons" }, { alias: "nimbu", language: "hi" }] },
  { name: "Turmeric Powder", canonicalName: "Turmeric Powder", slug: "turmeric", category: IngredientCategory.spice, defaultUnitCode: "teaspoon", aliases: [{ alias: "turmeric" }, { alias: "haldi", language: "hi" }] },
  { name: "Red Chili Powder", canonicalName: "Red Chili Powder", slug: "red-chili-powder", category: IngredientCategory.spice, defaultUnitCode: "teaspoon", aliases: [{ alias: "lal mirch", language: "hi" }, { alias: "cayenne pepper" }] },
  { name: "Coriander Powder", canonicalName: "Coriander Powder", slug: "coriander-powder", category: IngredientCategory.spice, defaultUnitCode: "teaspoon", aliases: [{ alias: "dhania powder", language: "hi" }, { alias: "ground coriander" }] },
  { name: "Cumin Seeds", canonicalName: "Cumin Seeds", slug: "cumin", category: IngredientCategory.spice, defaultUnitCode: "teaspoon", aliases: [{ alias: "cumin" }, { alias: "jeera", language: "hi" }] },
  { name: "Mustard Seeds", canonicalName: "Mustard Seeds", slug: "mustard-seeds", category: IngredientCategory.spice, defaultUnitCode: "teaspoon", aliases: [{ alias: "rai", language: "hi" }, { alias: "mustard seed" }] },
  { name: "Cinnamon Stick", canonicalName: "Cinnamon Stick", slug: "cinnamon-stick", category: IngredientCategory.spice, defaultUnitCode: "piece", aliases: [{ alias: "cinnamon" }, { alias: "dalchini", language: "hi" }] },
  { name: "Cloves", canonicalName: "Cloves", slug: "cloves", category: IngredientCategory.spice, defaultUnitCode: "piece", aliases: [{ alias: "clove" }, { alias: "laung", language: "hi" }] },
  { name: "Garam Masala", canonicalName: "Garam Masala", slug: "garam-masala", category: IngredientCategory.spice, defaultUnitCode: "teaspoon", aliases: [{ alias: "garam masala powder" }] },
  { name: "Biryani Masala", canonicalName: "Biryani Masala", slug: "biryani-masala", category: IngredientCategory.spice, defaultUnitCode: "tablespoon", aliases: [{ alias: "biryani spice mix" }] },
  { name: "Tamarind", canonicalName: "Tamarind", slug: "tamarind", category: IngredientCategory.condiment, defaultUnitCode: "gram", aliases: [{ alias: "imli", language: "hi" }, { alias: "tamarind paste" }] },
  { name: "Curry Leaves", canonicalName: "Curry Leaves", slug: "curry-leaves", category: IngredientCategory.herb, defaultUnitCode: "bunch", aliases: [{ alias: "kadipatta", language: "hi" }, { alias: "kadi patta", language: "hi" }] },
  { name: "Oil", canonicalName: "Oil", slug: "oil", category: IngredientCategory.oil, defaultUnitCode: "tablespoon", densityGramPerMl: 0.91, aliases: [{ alias: "cooking oil" }, { alias: "vegetable oil" }] },
  { name: "Ghee", canonicalName: "Ghee", slug: "ghee", category: IngredientCategory.oil, defaultUnitCode: "tablespoon", densityGramPerMl: 0.91, aliases: [{ alias: "clarified butter" }, { alias: "desi ghee", language: "hi" }] },
  { name: "Salt", canonicalName: "Salt", slug: "salt", category: IngredientCategory.spice, defaultUnitCode: "teaspoon", aliases: [{ alias: "namak", language: "hi" }, { alias: "table salt" }] },
  { name: "Toor Dal", canonicalName: "Toor Dal", slug: "toor-dal", category: IngredientCategory.lentil, defaultUnitCode: "gram", aliases: [{ alias: "split pigeon peas" }, { alias: "arhar dal", language: "hi" }] },
  { name: "Chana Dal", canonicalName: "Chana Dal", slug: "chana-dal", category: IngredientCategory.lentil, defaultUnitCode: "gram", aliases: [{ alias: "split Bengal gram" }, { alias: "chana daal" }] },
  { name: "Peanuts", canonicalName: "Peanuts", slug: "peanuts", category: IngredientCategory.nut, defaultUnitCode: "gram", aliases: [{ alias: "groundnuts" }, { alias: "moongfali", language: "hi" }] },
  { name: "Sesame Seeds", canonicalName: "Sesame Seeds", slug: "sesame-seeds", category: IngredientCategory.spice, defaultUnitCode: "tablespoon", aliases: [{ alias: "til", language: "hi" }, { alias: "white sesame seeds" }] },
  { name: "Desiccated Coconut", canonicalName: "Desiccated Coconut", slug: "desiccated-coconut", category: IngredientCategory.other, defaultUnitCode: "tablespoon", aliases: [{ alias: "dry coconut" }, { alias: "kopra", language: "hi" }] },
  { name: "Eggplant", canonicalName: "Eggplant", slug: "eggplant", category: IngredientCategory.vegetable, defaultUnitCode: "piece", averagePieceWeightGrams: 200, aliases: [{ alias: "brinjal" }, { alias: "baingan", language: "hi" }, { alias: "aubergine" }] },
  { name: "Okra", canonicalName: "Okra", slug: "okra", category: IngredientCategory.vegetable, defaultUnitCode: "gram", aliases: [{ alias: "bhindi", language: "hi" }, { alias: "lady finger" }] },
  { name: "Spinach", canonicalName: "Spinach", slug: "spinach", category: IngredientCategory.vegetable, defaultUnitCode: "bunch", aliases: [{ alias: "palak", language: "hi" }] },
  { name: "Dried Apricots", canonicalName: "Dried Apricots", slug: "dried-apricots", category: IngredientCategory.fruit, defaultUnitCode: "gram", aliases: [{ alias: "khubani", language: "hi" }, { alias: "apricots" }] },
  { name: "Milk", canonicalName: "Milk", slug: "milk", category: IngredientCategory.dairy, defaultUnitCode: "milliliter", densityGramPerMl: 1.03, aliases: [{ alias: "whole milk" }, { alias: "doodh", language: "hi" }] },
  { name: "Condensed Milk", canonicalName: "Condensed Milk", slug: "condensed-milk", category: IngredientCategory.dairy, defaultUnitCode: "milliliter", densityGramPerMl: 1.32, aliases: [{ alias: "sweetened condensed milk" }, { alias: "milkmaid" }] },
  { name: "Vermicelli", canonicalName: "Vermicelli", slug: "vermicelli", category: IngredientCategory.grain, defaultUnitCode: "gram", aliases: [{ alias: "seviyan", language: "hi" }, { alias: "sewai", language: "hi" }] },
  { name: "All-Purpose Flour", canonicalName: "All-Purpose Flour", slug: "all-purpose-flour", category: IngredientCategory.grain, defaultUnitCode: "gram", aliases: [{ alias: "maida", language: "hi" }, { alias: "plain flour" }] },
  { name: "Potato", canonicalName: "Potato", slug: "potato", category: IngredientCategory.vegetable, defaultUnitCode: "piece", averagePieceWeightGrams: 150, aliases: [{ alias: "potatoes" }, { alias: "aloo", language: "hi" }] },
  { name: "Egg", canonicalName: "Egg", slug: "egg", category: IngredientCategory.other, defaultUnitCode: "piece", averagePieceWeightGrams: 55, aliases: [{ alias: "eggs" }, { alias: "anda", language: "hi" }] },
  { name: "Sugar", canonicalName: "Sugar", slug: "sugar", category: IngredientCategory.sweetener, defaultUnitCode: "gram", aliases: [{ alias: "white sugar" }, { alias: "cheeni", language: "hi" }] },
  { name: "Cashews", canonicalName: "Cashews", slug: "cashews", category: IngredientCategory.nut, defaultUnitCode: "gram", aliases: [{ alias: "cashew nuts" }, { alias: "kaju", language: "hi" }] },
  { name: "Almonds", canonicalName: "Almonds", slug: "almonds", category: IngredientCategory.nut, defaultUnitCode: "gram", aliases: [{ alias: "almond" }, { alias: "badam", language: "hi" }] },
  { name: "Raisins", canonicalName: "Raisins", slug: "raisins", category: IngredientCategory.fruit, defaultUnitCode: "gram", aliases: [{ alias: "kishmish", language: "hi" }, { alias: "sultanas" }] },
  { name: "Saffron", canonicalName: "Saffron", slug: "saffron", category: IngredientCategory.spice, defaultUnitCode: "pinch", aliases: [{ alias: "kesar", language: "hi" }, { alias: "zafran", language: "hi" }] },
  { name: "White Bread", canonicalName: "White Bread", slug: "white-bread", category: IngredientCategory.grain, defaultUnitCode: "piece", aliases: [{ alias: "bread slices" }, { alias: "double roti", language: "hi" }] },
  { name: "Fried Onions", canonicalName: "Fried Onions", slug: "fried-onions", category: IngredientCategory.condiment, defaultUnitCode: "gram", aliases: [{ alias: "birista", language: "hi" }, { alias: "fried onion" }] },
  { name: "Jaggery", canonicalName: "Jaggery", slug: "jaggery", category: IngredientCategory.sweetener, defaultUnitCode: "gram", aliases: [{ alias: "gud", language: "hi" }, { alias: "gur", language: "hi" }] },
  { name: "Bottle Gourd", canonicalName: "Bottle Gourd", slug: "bottle-gourd", category: IngredientCategory.vegetable, defaultUnitCode: "gram", aliases: [{ alias: "lauki", language: "hi" }, { alias: "doodhi", language: "hi" }] },
  { name: "Green Cardamom", canonicalName: "Green Cardamom", slug: "cardamom", category: IngredientCategory.spice, defaultUnitCode: "piece", aliases: [{ alias: "cardamom" }, { alias: "elaichi", language: "hi" }, { alias: "cardamom pods" }] },
];

async function seedIngredients(unitMap: Map<string, string>) {
  const ingredientMap = new Map<string, string>();
  for (const ing of INGREDIENT_SEEDS) {
    const defaultUnitId = ing.defaultUnitCode ? (unitMap.get(ing.defaultUnitCode) ?? null) : null;
    const existing = await prisma.ingredient.findFirst({ where: { slug: ing.slug, organizationId: null } });
    let ingredient;
    if (existing) {
      ingredient = await prisma.ingredient.update({
        where: { id: existing.id },
        data: { name: ing.name, canonicalName: ing.canonicalName, category: ing.category, defaultUnitId, densityGramPerMl: ing.densityGramPerMl ?? null, averagePieceWeightGrams: ing.averagePieceWeightGrams ?? null, isGlobal: true, isActive: true },
      });
    } else {
      ingredient = await prisma.ingredient.create({
        data: { name: ing.name, canonicalName: ing.canonicalName, slug: ing.slug, category: ing.category, defaultUnitId, densityGramPerMl: ing.densityGramPerMl ?? null, averagePieceWeightGrams: ing.averagePieceWeightGrams ?? null, isGlobal: true, isActive: true, organizationId: null, countryCode: null },
      });
    }
    ingredientMap.set(ing.slug, ingredient.id);
    for (const a of ing.aliases) {
      const existingAlias = await prisma.ingredientAlias.findFirst({ where: { ingredientId: ingredient.id, alias: a.alias } });
      if (!existingAlias) {
        await prisma.ingredientAlias.create({ data: { ingredientId: ingredient.id, alias: a.alias, language: a.language ?? null, confidence: a.confidence ?? 1.0 } });
      }
    }
  }
  return ingredientMap;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

type StepSeed = { title?: string; instruction: string; durationMinutes?: number; tips?: string };
type IngredientRef = { slug: string; quantity: number; unitCode: string; section?: string; preparationNote?: string; isOptional?: boolean };
type RecipeSeed = {
  name: string; slug: string; description: string; story?: string;
  difficulty: RecipeDifficulty; spiceLevel: SpiceLevel;
  prepMinutes: number; cookMinutes: number; restMinutes?: number;
  servings: number; servingUnit?: string;
  dietaryTagSlugs?: string[];
  ingredients: IngredientRef[];
  steps: StepSeed[];
};

const RECIPE_SEEDS: RecipeSeed[] = [
  {
    name: "Hyderabadi Chicken Biryani", slug: "hyderabadi-chicken-biryani",
    description: "The iconic layered rice and chicken dish of Hyderabad — cooked dum style with aromatic spices, mint, and saffron.",
    story: "Inspired by the Hyderabadi kacchi biryani tradition where raw marinated chicken and soaked rice are layered and cooked together under a sealed dum.",
    difficulty: RecipeDifficulty.hard, spiceLevel: SpiceLevel.hot,
    prepMinutes: 60, cookMinutes: 60, restMinutes: 20, servings: 6, dietaryTagSlugs: ["halal"],
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
      { title: "Marinate the chicken", instruction: "Mix chicken with yogurt, ginger garlic paste, red chili powder, turmeric, garam masala, biryani masala, and salt. Add half the fried onions. Marinate for at least 45 minutes, or overnight.", durationMinutes: 5, tips: "Longer marination gives deeper flavor." },
      { title: "Parboil the rice", instruction: "Wash basmati rice until water runs clear. Soak for 30 minutes. Boil in salted water until 70% cooked — the grain should still have a firm center. Drain immediately.", durationMinutes: 15 },
      { title: "Layer the biryani", instruction: "In a heavy-bottomed pot, spread the marinated chicken at the bottom. Layer partially cooked rice on top. Add remaining fried onions, mint leaves, cilantro, and drizzle ghee. Squeeze lemon juice over the top.", durationMinutes: 10 },
      { title: "Cook dum", instruction: "Seal the pot with a tight-fitting lid. Cook on high heat for 5 minutes, then reduce to the lowest flame and cook for 40 minutes. Do not open the lid during this time.", durationMinutes: 45, tips: "Place a tawa (flat griddle) under the pot to prevent scorching." },
      { title: "Rest and serve", instruction: "Remove from heat and let rest 15 minutes before opening. Gently mix from the edges inward to preserve the layers. Serve hot.", durationMinutes: 15 },
    ],
  },
  {
    name: "Hyderabadi Mutton Biryani", slug: "hyderabadi-mutton-biryani",
    description: "Slow-cooked mutton with aged basmati rice, layered and dum-cooked in the authentic Hyderabadi style.",
    story: "Mutton biryani requires overnight marination for the meat to fully absorb the spices. The fat from the bone-in pieces bastes the rice from below during dum.",
    difficulty: RecipeDifficulty.expert, spiceLevel: SpiceLevel.hot,
    prepMinutes: 90, cookMinutes: 90, restMinutes: 20, servings: 8, dietaryTagSlugs: ["halal"],
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
      { title: "Marinate mutton", instruction: "Marinate mutton with yogurt, all spices, ginger garlic paste, half the fried onions, and salt. Marinate overnight — strongly preferred for mutton.", durationMinutes: 10 },
      { title: "Parboil rice", instruction: "Soak rice 30 minutes, then parboil in well-salted water until 70% cooked. Drain and set aside.", durationMinutes: 15 },
      { title: "Layer and seal", instruction: "Spread marinated mutton in the base of a heavy pot. Add rice in layers, alternating with mint, cilantro, and fried onions. Drizzle ghee and lemon juice. Seal tightly.", durationMinutes: 10 },
      { title: "Dum cooking", instruction: "Cook on high heat 5 minutes, then lowest flame for 75 minutes. Mutton needs more time than chicken.", durationMinutes: 80, tips: "Check mutton tenderness by opening carefully after 60 minutes." },
      { title: "Rest and serve", instruction: "Rest 20 minutes sealed. Mix gently before serving.", durationMinutes: 20 },
    ],
  },
  {
    name: "Khatti Dal", slug: "khatti-dal",
    description: "A tart Hyderabadi lentil curry made tangy with tamarind and tempered with dried red chilies and curry leaves.",
    story: "Khatti dal is a daily staple in Hyderabadi households. The word khatti means sour, which comes from the tamarind extract.",
    difficulty: RecipeDifficulty.easy, spiceLevel: SpiceLevel.medium,
    prepMinutes: 15, cookMinutes: 40, servings: 4, dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "toor-dal", quantity: 200, unitCode: "gram" },
      { slug: "turmeric", quantity: 0.5, unitCode: "teaspoon" },
      { slug: "tamarind", quantity: 30, unitCode: "gram", preparationNote: "soaked, extract the juice" },
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
      { title: "Cook the lentils", instruction: "Rinse toor dal thoroughly. Cook with turmeric in a pressure cooker until soft, about 4–5 whistles. Mash lightly.", durationMinutes: 20 },
      { title: "Prepare the base", instruction: "Heat oil in a pan. Add cumin seeds. When they splutter, add onions and sauté until translucent. Add ginger garlic paste and cook 2 minutes. Add tomatoes and cook until mushy.", durationMinutes: 12 },
      { title: "Add spices and tamarind", instruction: "Add red chili powder, coriander powder, and salt. Mix well. Pour in the cooked dal and tamarind extract. Stir to combine.", durationMinutes: 5 },
      { title: "Simmer and temper", instruction: "Simmer on low heat 10 minutes. In a separate small pan, heat oil, add cumin and curry leaves — pour this tadka over the dal.", durationMinutes: 10 },
    ],
  },
  {
    name: "Mirchi ka Salan", slug: "mirchi-ka-salan",
    description: "A traditional Hyderabadi curry of large green chilies in a peanut, sesame, and coconut gravy with tamarind.",
    story: "Mirchi ka salan is the traditional biryani companion in Hyderabad — no biryani plate is complete without it.",
    difficulty: RecipeDifficulty.medium, spiceLevel: SpiceLevel.medium,
    prepMinutes: 20, cookMinutes: 35, servings: 4, dietaryTagSlugs: ["halal", "vegetarian"],
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
      { instruction: "Dry roast peanuts and sesame seeds separately. Grind together with a small amount of water into a coarse paste.", durationMinutes: 10, tips: "The peanut-sesame paste is the base of the salan." },
      { instruction: "Shallow fry the green chilies in oil until blistered. Remove and set aside.", durationMinutes: 5 },
      { instruction: "In the same oil, add cumin and curry leaves. Add ginger garlic paste, then fried onions. Cook 3 minutes.", durationMinutes: 5 },
      { instruction: "Add the peanut-sesame paste. Cook 5 minutes stirring constantly.", durationMinutes: 5 },
      { instruction: "Add tamarind extract, turmeric, red chili powder, coriander powder, and salt. Add water to adjust consistency. Simmer 10 minutes.", durationMinutes: 12 },
      { instruction: "Add the fried chilies into the gravy. Simmer 5 more minutes.", durationMinutes: 5 },
    ],
  },
  {
    name: "Haleem", slug: "haleem",
    description: "A slow-cooked Hyderabadi stew of meat, lentils, and broken wheat — cooked for hours until it becomes a thick, smooth paste.",
    story: "Haleem is one of the most complex dishes in Hyderabadi cuisine, associated with Ramadan and Eid. Meat, multiple lentils, and cracked wheat are cooked for hours until they merge into a thick paste.",
    difficulty: RecipeDifficulty.expert, spiceLevel: SpiceLevel.hot,
    prepMinutes: 60, cookMinutes: 240, servings: 10, dietaryTagSlugs: ["halal"],
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
      { title: "Prepare and cook meat", instruction: "Marinate mutton with yogurt, ginger garlic paste, and all spices. Cook in a pressure cooker until very tender — 6–8 whistles. The meat should fall apart.", durationMinutes: 60, tips: "Cook until overcooked by normal standards." },
      { title: "Cook lentil and grain mixture", instruction: "Soak mixed lentils (toor, chana, masoor) and cracked wheat overnight. Cook separately until very soft and mushy.", durationMinutes: 60 },
      { title: "Combine and cook together", instruction: "Combine cooked meat with lentil mixture. Cook on medium heat, stirring constantly and beating the mixture until it forms a thick, homogeneous paste. This takes 60–90 minutes.", durationMinutes: 90, tips: "Traditional haleem uses hand-beating. Some use a hand blender for shorter cooking time." },
      { title: "Temper and finish", instruction: "Heat ghee in a pan, fry onions until dark golden. Pour over haleem. Garnish each serving with fried onions, mint, cilantro, and a squeeze of lemon.", durationMinutes: 15 },
    ],
  },
  {
    name: "Double ka Meetha", slug: "double-ka-meetha",
    description: "A rich Hyderabadi bread pudding made with fried white bread, condensed milk, and garnished with nuts and saffron.",
    story: "Double ka meetha is the quintessential Hyderabadi dessert — fried bread soaked in saffron-spiced sugar syrup, then drenched in condensed milk.",
    difficulty: RecipeDifficulty.medium, spiceLevel: SpiceLevel.mild,
    prepMinutes: 20, cookMinutes: 30, servings: 6, dietaryTagSlugs: ["vegetarian"],
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
      { instruction: "Cut bread slices into triangles. Fry in ghee and oil until golden and crisp. Drain on paper towels.", durationMinutes: 15, tips: "Day-old bread fries better." },
      { instruction: "Prepare a thin sugar syrup with water, sugar, and cardamom. Boil 5 minutes.", durationMinutes: 8 },
      { instruction: "Arrange fried bread in a baking dish. Pour warm syrup over to soak. Let sit 5 minutes.", durationMinutes: 8 },
      { instruction: "Pour condensed milk and full-fat milk over the bread. Garnish with fried cashews, raisins, and saffron.", durationMinutes: 5 },
      { instruction: "Optionally bake at 180°C for 10 minutes to set, or serve at room temperature.", durationMinutes: 10, tips: "Chilling for 30 minutes before serving improves texture." },
    ],
  },
  {
    name: "Qubani ka Meetha", slug: "qubani-ka-meetha",
    description: "A Hyderabadi dried apricot dessert — apricots slowly cooked in sugar syrup into a thick tangy-sweet compote, served with cream.",
    story: "Dried apricots from the Khorasan region were historically traded through Hyderabad, and this dessert emerged from that abundance.",
    difficulty: RecipeDifficulty.easy, spiceLevel: SpiceLevel.mild,
    prepMinutes: 30, cookMinutes: 30, servings: 6, dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "dried-apricots", quantity: 400, unitCode: "gram", preparationNote: "soaked in water overnight", section: "Main" },
      { slug: "sugar", quantity: 150, unitCode: "gram" },
      { slug: "saffron", quantity: 1, unitCode: "pinch", preparationNote: "dissolved in 1 tbsp warm water", isOptional: true },
      { slug: "cardamom", quantity: 3, unitCode: "piece", preparationNote: "seeds ground" },
      { slug: "cashews", quantity: 30, unitCode: "gram", preparationNote: "for garnish", isOptional: true },
    ],
    steps: [
      { instruction: "Soak dried apricots in water for at least 6 hours or overnight.", durationMinutes: 5, tips: "Reserve the soaking water — it has flavor." },
      { instruction: "Drain apricots, reserving soaking liquid. Remove the seeds from each apricot.", durationMinutes: 15 },
      { instruction: "Combine apricots with 300ml of the reserved soaking water and sugar. Bring to a boil, then simmer 20 minutes until thick compote forms.", durationMinutes: 22 },
      { instruction: "Add saffron water and cardamom. Cook 5 more minutes until thick. Taste and adjust sweetness.", durationMinutes: 5, tips: "The compote thickens further as it cools." },
      { instruction: "Serve warm or chilled, topped with whipped cream, and fried cashews.", durationMinutes: 3 },
    ],
  },
  {
    name: "Chicken 65", slug: "chicken-65",
    description: "Crispy deep-fried spiced chicken with a signature Hyderabadi red color — a popular starter and street food.",
    story: "Chicken 65 is deeply associated with Hyderabad's street food and restaurant culture. Served with sliced onions, lemon, and mint chutney.",
    difficulty: RecipeDifficulty.medium, spiceLevel: SpiceLevel.hot,
    prepMinutes: 30, cookMinutes: 25, servings: 4, dietaryTagSlugs: ["halal"],
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
      { title: "Marinate chicken", instruction: "Mix chicken with yogurt, ginger garlic paste, all spices, lemon juice, and salt. Add flour and egg, mix to coat evenly. Marinate 20 minutes.", durationMinutes: 5, tips: "The flour and egg create the crisp coating during frying." },
      { title: "Deep fry", instruction: "Heat oil to 175°C. Fry chicken pieces in batches until crisp and cooked through, 6–7 minutes per batch. Drain on paper towels.", durationMinutes: 18 },
      { title: "Final toss", instruction: "In a separate pan, heat 1 tbsp oil. Add curry leaves and slit green chilies. Add the fried chicken and toss quickly for 1 minute.", durationMinutes: 3 },
    ],
  },
  {
    name: "Sheer Khurma", slug: "sheer-khurma",
    description: "A rich Hyderabadi vermicelli dessert cooked in milk, sweetened with sugar, and garnished with dates, nuts, and saffron — traditionally made on Eid.",
    story: "Sheer khurma is the Eid morning dessert of Hyderabad — shared with family and neighbors after the Eid prayer.",
    difficulty: RecipeDifficulty.easy, spiceLevel: SpiceLevel.mild,
    prepMinutes: 10, cookMinutes: 30, servings: 6, dietaryTagSlugs: ["halal", "vegetarian"],
    ingredients: [
      { slug: "vermicelli", quantity: 80, unitCode: "gram", preparationNote: "thin, toasted in ghee", section: "Main" },
      { slug: "milk", quantity: 1000, unitCode: "milliliter", section: "Main" },
      { slug: "sugar", quantity: 80, unitCode: "gram" },
      { slug: "ghee", quantity: 2, unitCode: "tablespoon" },
      { slug: "cardamom", quantity: 4, unitCode: "piece", preparationNote: "seeds ground" },
      { slug: "saffron", quantity: 1, unitCode: "pinch", preparationNote: "dissolved in 2 tbsp warm milk", isOptional: true },
      { slug: "cashews", quantity: 30, unitCode: "gram", preparationNote: "fried in ghee until golden", section: "Garnish" },
      { slug: "raisins", quantity: 20, unitCode: "gram", preparationNote: "fried in ghee", section: "Garnish" },
    ],
    steps: [
      { instruction: "Heat ghee in a heavy pan. Add vermicelli and toast on medium heat, stirring constantly, until golden brown.", durationMinutes: 5, tips: "Watch carefully — vermicelli browns quickly." },
      { instruction: "Bring milk to a boil. Add the toasted vermicelli. Cook on medium heat, stirring frequently, until vermicelli is soft and milk reduces slightly.", durationMinutes: 15 },
      { instruction: "Add sugar, cardamom, and saffron milk. Stir well. Cook 5 more minutes until sugar dissolves.", durationMinutes: 7, tips: "Serve slightly thinner than you want the final result — it thickens as it cools." },
      { instruction: "Garnish with ghee-fried cashews and raisins. Serve warm or at room temperature.", durationMinutes: 3 },
    ],
  },
  {
    name: "Bagara Baingan", slug: "bagara-baingan",
    description: "Whole baby eggplants cooked in a rich peanut, sesame, and coconut gravy with tamarind — the signature Hyderabadi eggplant dish.",
    story: "Baby brinjals stuffed with a peanut-sesame-coconut paste and slow-cooked in a tamarind gravy. Traditionally served alongside biryani.",
    difficulty: RecipeDifficulty.medium, spiceLevel: SpiceLevel.medium,
    prepMinutes: 25, cookMinutes: 35, servings: 4, dietaryTagSlugs: ["halal", "vegetarian"],
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
    ],
    steps: [
      { title: "Make the masala paste", instruction: "Dry roast peanuts until golden, then sesame seeds and coconut separately. Grind all three with a tablespoon of water into a coarse paste.", durationMinutes: 10 },
      { title: "Stuff the brinjals", instruction: "Make two slits crosswise in each baby brinjal from the base. Fill each with a teaspoon of the masala paste. Reserve remaining paste.", durationMinutes: 8 },
      { title: "Fry the brinjals", instruction: "Shallow fry the stuffed brinjals on all sides until blistered and softened, about 8 minutes. Remove and set aside.", durationMinutes: 8 },
      { title: "Build the gravy", instruction: "In the same oil, add cumin and curry leaves. Add ginger garlic paste, then fried onions. Cook 3 minutes. Add the remaining masala paste and cook 5 minutes.", durationMinutes: 10 },
      { title: "Simmer together", instruction: "Add tamarind extract, turmeric, red chili powder, coriander powder, and salt. Add 200ml water. Simmer 5 minutes, then add the fried brinjals. Cook 10 minutes on low heat.", durationMinutes: 15, tips: "Do not stir aggressively — the brinjals are delicate." },
    ],
  },
  {
    name: "Kheema", slug: "kheema",
    description: "Spiced minced mutton cooked with peas, tomatoes, and aromatic spices — a Hyderabadi household classic.",
    story: "Kheema is a versatile Hyderabadi household staple. This semi-dry version pairs well with naan, roti, or paratha.",
    difficulty: RecipeDifficulty.easy, spiceLevel: SpiceLevel.medium,
    prepMinutes: 15, cookMinutes: 35, servings: 4, dietaryTagSlugs: ["halal"],
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
    ],
    steps: [
      { instruction: "Heat oil in a pan. Sauté onions until golden. Add green chilies and ginger garlic paste, cook 2 minutes.", durationMinutes: 10 },
      { instruction: "Add tomatoes and cook until mushy and oil separates.", durationMinutes: 8 },
      { instruction: "Add all dry spices and salt. Mix well, then add minced mutton. Break up any lumps and cook on high heat 5 minutes.", durationMinutes: 8 },
      { instruction: "Cover and cook on medium heat 20 minutes until kheema is cooked through.", durationMinutes: 20, tips: "If using peas, add frozen peas 5 minutes before done." },
      { instruction: "Cook uncovered on high heat 5 minutes to dry out excess moisture. Garnish with cilantro.", durationMinutes: 5 },
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
  if (!cuisineId) { console.warn("Hyderabadi cuisine not found, skipping recipes"); return; }

  for (const r of RECIPE_SEEDS) {
    const existing = await prisma.recipe.findFirst({ where: { slug: r.slug, organizationId: null } });
    let recipe;
    if (existing) {
      recipe = existing;
      await prisma.recipe.update({
        where: { id: existing.id },
        data: { name: r.name, description: r.description, story: r.story ?? null, difficulty: r.difficulty, spiceLevel: r.spiceLevel, prepMinutes: r.prepMinutes, cookMinutes: r.cookMinutes, restMinutes: r.restMinutes ?? null, servings: r.servings, servingUnit: r.servingUnit ?? "serving", isPublished: true, isGlobal: true },
      });
    } else {
      recipe = await prisma.recipe.create({
        data: { cuisineId, name: r.name, slug: r.slug, description: r.description, story: r.story ?? null, difficulty: r.difficulty, spiceLevel: r.spiceLevel, prepMinutes: r.prepMinutes, cookMinutes: r.cookMinutes, restMinutes: r.restMinutes ?? null, servings: r.servings, servingUnit: r.servingUnit ?? "serving", visibility: RecipeVisibility.global, sourceType: RecipeSourceType.platform, isGlobal: true, isPublished: true, organizationId: null, countryCode: null },
      });
    }

    // Sync ingredients
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } });
    let order = 0;
    for (const ing of r.ingredients) {
      const ingredientId = ingredientMap.get(ing.slug);
      const unitId = unitMap.get(ing.unitCode);
      if (!ingredientId || !unitId) { console.warn(`  [skip] ${r.slug}: ingredient '${ing.slug}' or unit '${ing.unitCode}' not found`); continue; }
      await prisma.recipeIngredient.create({
        data: { recipeId: recipe.id, ingredientId, quantity: ing.quantity, unitId, preparationNote: ing.preparationNote ?? null, section: ing.section ?? null, isOptional: ing.isOptional ?? false, displayOrder: order++ },
      });
    }

    // Sync steps
    await prisma.recipeStep.deleteMany({ where: { recipeId: recipe.id } });
    for (const [i, step] of r.steps.entries()) {
      await prisma.recipeStep.create({
        data: { recipeId: recipe.id, stepNumber: i + 1, title: step.title ?? null, instruction: step.instruction, durationMinutes: step.durationMinutes ?? null, tips: step.tips ?? null, displayOrder: i },
      });
    }

    // Sync dietary tags
    await prisma.recipeDietaryTag.deleteMany({ where: { recipeId: recipe.id } });
    for (const tagSlug of (r.dietaryTagSlugs ?? [])) {
      const tagId = tagMap.get(tagSlug);
      if (tagId) await prisma.recipeDietaryTag.create({ data: { recipeId: recipe.id, dietaryTagId: tagId } });
    }

    console.log(`  ✓ ${r.name}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding units...");
  const unitMap = await seedUnits();

  console.log("Seeding unit conversions...");
  await seedConversions(unitMap);

  console.log("Seeding cuisines...");
  const cuisineMap = await seedCuisines();

  console.log("Seeding dietary tags...");
  const tagMap = await seedDietaryTags();

  console.log("Seeding ingredients...");
  const ingredientMap = await seedIngredients(unitMap);

  console.log("Seeding recipes...");
  await seedRecipes(cuisineMap, ingredientMap, unitMap, tagMap);

  console.log("\n✅ Food data seeding complete.");
  console.log(`   Units: ${UNIT_SEEDS.length}`);
  console.log(`   Ingredients: ${INGREDIENT_SEEDS.length}`);
  console.log(`   Recipes: ${RECIPE_SEEDS.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
