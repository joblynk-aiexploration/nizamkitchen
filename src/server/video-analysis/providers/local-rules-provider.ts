import type { AIProviderOutput } from "@/lib/validation/video";
import type { AnalyzeVideoInput, AnalyzeVideoResult, VideoAnalysisProvider } from "./types";

type AliasEntry = {
  canonical: string;
  aliases: string[];
};

const INGREDIENT_ALIASES: AliasEntry[] = [
  { canonical: "onion", aliases: ["onion", "onions", "pyaz", "pyaaz"] },
  { canonical: "tomato", aliases: ["tomato", "tomatoes", "tamatar"] },
  { canonical: "green chili", aliases: ["green chili", "green chilli", "hari mirch"] },
  { canonical: "ginger garlic paste", aliases: ["ginger garlic paste", "adrak lehsun", "adrak lasan"] },
  { canonical: "basmati rice", aliases: ["basmati rice", "rice", "chawal"] },
  { canonical: "chicken", aliases: ["chicken", "murgh"] },
  { canonical: "mutton", aliases: ["mutton", "gosht"] },
  { canonical: "yogurt", aliases: ["yogurt", "yoghurt", "dahi"] },
  { canonical: "mint", aliases: ["mint", "pudina"] },
  { canonical: "cilantro", aliases: ["cilantro", "coriander", "hara dhania"] },
  { canonical: "lemon", aliases: ["lemon", "nimbu"] },
  { canonical: "turmeric", aliases: ["turmeric", "haldi"] },
  { canonical: "red chili powder", aliases: ["red chili powder", "lal mirch", "mirchi powder"] },
  { canonical: "coriander powder", aliases: ["coriander powder", "dhania powder"] },
  { canonical: "cumin", aliases: ["cumin", "jeera"] },
  { canonical: "garam masala", aliases: ["garam masala"] },
  { canonical: "biryani masala", aliases: ["biryani masala"] },
  { canonical: "tamarind", aliases: ["tamarind", "imli"] },
  { canonical: "curry leaves", aliases: ["curry leaves", "kadipatta"] },
  { canonical: "oil", aliases: ["oil", "cooking oil"] },
  { canonical: "ghee", aliases: ["ghee"] },
  { canonical: "salt", aliases: ["salt", "namak"] },
  { canonical: "cloves", aliases: ["cloves", "laung"] },
  { canonical: "cardamom", aliases: ["cardamom", "elaichi"] },
  { canonical: "cinnamon", aliases: ["cinnamon", "dalchini"] },
  { canonical: "bay leaf", aliases: ["bay leaf", "tej patta"] },
  { canonical: "black pepper", aliases: ["black pepper", "kali mirch"] },
  { canonical: "saffron", aliases: ["saffron", "zafran", "kesar"] },
  { canonical: "fried onions", aliases: ["fried onions", "birista"] },
];

const NUMBER_WORDS = new Map<string, number>([
  ["half", 0.5],
  ["quarter", 0.25],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);

const ACTIONS = [
  "wash",
  "soak",
  "chop",
  "slice",
  "grind",
  "marinate",
  "heat",
  "fry",
  "sauté",
  "saute",
  "boil",
  "simmer",
  "layer",
  "cover",
  "dum",
  "bake",
  "garnish",
  "serve",
];

const TECHNIQUES: Array<{ label: string; patterns: string[] }> = [
  { label: "dum cooking", patterns: ["dum", "covered for dum"] },
  { label: "marination", patterns: ["marinate", "marination", "marinated"] },
  { label: "frying", patterns: ["fry", "fried", "frying"] },
  { label: "tempering/tadka", patterns: ["tempering", "tadka", "splutter"] },
  { label: "layering", patterns: ["layer", "layered", "layering"] },
  { label: "slow cooking", patterns: ["slow cook", "low flame"] },
  { label: "pressure cooking", patterns: ["pressure cook", "pressure cooker"] },
  { label: "soaking", patterns: ["soak", "soaked"] },
  { label: "grinding", patterns: ["grind", "ground", "paste"] },
];

const QUANTITY_PATTERN =
  /(\d+(?:\.\d+)?|\d+\s*\/\s*\d+|half|quarter|one|two|three|four|five|six|seven|eight|nine|ten)\s*(cups?|tsp|teaspoons?|tbsp|tablespoons?|g|grams?|kg|ml|liters?|litres?|pieces?|cloves?|pinch|handful)\b/i;

export class LocalRulesProvider implements VideoAnalysisProvider {
  readonly name = "local_rules";
  readonly isAvailable = true;

  async analyzeFromTranscript(input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    const transcript = extractTranscript(input.transcriptText);
    if (!transcript.trim()) {
      return {
        success: false,
        error: "Local rules analysis requires a user-provided transcript. It cannot analyze or watch the video directly.",
        provider: this.name,
      };
    }

    const lines = splitTranscriptLines(transcript);
    const ingredients = detectIngredients(lines);
    const steps = detectSteps(lines);
    const differences = buildIngredientDifferences(input.recipeIngredients.map((item) => item.name), ingredients);
    const warnings: string[] = [
      "Local rules analysis used only pasted transcript evidence; it did not watch the video.",
    ];

    if (ingredients.some((ingredient) => ingredient.quantity == null)) {
      warnings.push("Quantities were not clearly available in the transcript.");
    }
    if (!lines.some((line) => line.timestampSeconds !== null)) {
      warnings.push("Timestamps were not available, so step timing may be incomplete.");
    }

    const output: AIProviderOutput = {
      title: `Local transcript analysis for ${input.recipeTitle}`,
      summary: `Rule-based transcript analysis for ${input.recipeTitle}. It extracts only ingredients, quantities, timestamps, and cooking actions supported by pasted transcript text.`,
      confidence: steps.length > 0 || ingredients.length > 0 ? "medium" : "low",
      ingredients,
      steps,
      differencesFromWrittenRecipe: differences,
      warnings,
    };

    return {
      success: true,
      output,
      provider: this.name,
      model: "nizamkitchen-local-rules-v1",
      costCents: 0,
    };
  }

  async analyzeFromFrames(input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return this.analyzeFromTranscript(input);
  }
}

type TranscriptLine = {
  raw: string;
  text: string;
  timestampSeconds: number | null;
};

export function parseTimestampToSeconds(value: string) {
  const parts = value.replace(/[()[\]]/g, "").split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function extractTranscript(input?: string | null) {
  if (!input) return "";
  const marker = "VIDEO TRANSCRIPT:";
  const markerIndex = input.indexOf(marker);
  if (markerIndex === -1) return input;
  const afterMarker = input.slice(markerIndex + marker.length);
  const rulesIndex = afterMarker.indexOf("RULES:");
  return (rulesIndex === -1 ? afterMarker : afterMarker.slice(0, rulesIndex)).trim();
}

function splitTranscriptLines(transcript: string): TranscriptLine[] {
  return transcript
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => {
      const timestampMatch = raw.match(/^\s*[\[(]?(\d{1,2}:\d{2}(?::\d{2})?)[\])]?/);
      const timestampSeconds = timestampMatch?.[1]
        ? parseTimestampToSeconds(timestampMatch[1])
        : null;
      const text = timestampMatch ? raw.slice(timestampMatch[0].length).trim() : raw;
      return { raw, text: text || raw, timestampSeconds };
    });
}

function detectIngredients(lines: TranscriptLine[]): AIProviderOutput["ingredients"] {
  const found = new Map<string, AIProviderOutput["ingredients"][number]>();

  for (const line of lines) {
    const lower = line.text.toLowerCase();
    for (const entry of INGREDIENT_ALIASES) {
      const matchedAlias = entry.aliases.find((alias) => containsPhrase(lower, alias));
      if (!matchedAlias || found.has(entry.canonical)) continue;

      const quantity = parseQuantityNearAlias(line.text, matchedAlias);
      found.set(entry.canonical, {
        ingredientName: entry.canonical,
        quantity: quantity.quantity,
        unitName: quantity.unitName,
        timestampStartSeconds: line.timestampSeconds,
        timestampEndSeconds: null,
        confidence: quantity.quantity !== null ? "high" : matchedAlias === entry.canonical ? "medium" : "low",
        evidenceText: line.raw,
        notes: quantity.quantity === null ? "Quantity was not explicit in transcript evidence." : null,
      });
    }
  }

  return [...found.values()];
}

function detectSteps(lines: TranscriptLine[]): AIProviderOutput["steps"] {
  const actionLines = lines.filter((line) => {
    const lower = line.text.toLowerCase();
    return ACTIONS.some((action) => lower.includes(action));
  });

  return actionLines.map((line, index) => {
    const technique = detectTechnique(line.text);
    return {
      stepNumber: index + 1,
      title: technique ?? titleFromLine(line.text),
      description: line.text,
      timestampStartSeconds: line.timestampSeconds,
      timestampEndSeconds: null,
      durationSeconds: null,
      temperature: null,
      technique,
      confidence: line.timestampSeconds !== null ? "high" : "medium",
      evidenceText: line.raw,
      notes: null,
    };
  });
}

function buildIngredientDifferences(
  writtenIngredientNames: string[],
  detectedIngredients: AIProviderOutput["ingredients"],
): AIProviderOutput["differencesFromWrittenRecipe"] {
  const written = writtenIngredientNames.map((name) => name.toLowerCase());
  const detected = detectedIngredients.map((ingredient) => ingredient.ingredientName.toLowerCase());
  const differences: AIProviderOutput["differencesFromWrittenRecipe"] = [];

  for (const ingredient of detectedIngredients) {
    if (!written.some((name) => name.includes(ingredient.ingredientName.toLowerCase()) || ingredient.ingredientName.toLowerCase().includes(name))) {
      differences.push({
        differenceType: "ingredient_difference",
        title: `${ingredient.ingredientName} appears in transcript`,
        description: `${ingredient.ingredientName} was detected in the pasted transcript but was not clearly present in the written recipe ingredient list.`,
        severity: "info",
      });
    }
  }

  for (const name of writtenIngredientNames) {
    const normalized = name.toLowerCase();
    if (!detected.some((detectedName) => normalized.includes(detectedName) || detectedName.includes(normalized))) {
      differences.push({
        differenceType: "ingredient_difference",
        title: `${name} not mentioned in transcript`,
        description: `${name} is in the written recipe but was not clearly mentioned in the pasted transcript.`,
        severity: "info",
      });
    }
  }

  return differences.slice(0, 30);
}

function parseQuantityNearAlias(text: string, alias: string) {
  const lower = text.toLowerCase();
  const aliasIndex = lower.indexOf(alias.toLowerCase());
  const searchText = aliasIndex === -1
    ? text
    : text.slice(Math.max(0, aliasIndex - 36), aliasIndex + alias.length + 36);
  const match = searchText.match(QUANTITY_PATTERN);
  if (!match) {
    const lower = searchText.toLowerCase();
    if (/\bpinch\b/.test(lower)) return { quantity: 1, unitName: "pinch" };
    if (/\bhandful\b/.test(lower)) return { quantity: 1, unitName: "handful" };
    return { quantity: null, unitName: null };
  }

  return {
    quantity: normalizeQuantity(match[1]),
    unitName: normalizeUnit(match[2]),
  };
}

function normalizeQuantity(value: string) {
  const cleaned = value.toLowerCase().replace(/\s+/g, "");
  if (NUMBER_WORDS.has(cleaned)) return NUMBER_WORDS.get(cleaned) ?? null;
  if (cleaned.includes("/")) {
    const [numerator, denominator] = cleaned.split("/").map((part) => Number(part));
    return denominator ? numerator / denominator : null;
  }
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeUnit(value: string) {
  const unit = value.toLowerCase();
  if (unit === "g") return "grams";
  if (unit === "kg") return "kg";
  if (unit === "tsp") return "teaspoon";
  if (unit === "tbsp") return "tablespoon";
  if (unit.startsWith("liter") || unit.startsWith("litre")) return "liter";
  return unit.replace(/s$/, "");
}

function containsPhrase(text: string, phrase: string) {
  return new RegExp(`\\b${escapeRegExp(phrase.toLowerCase())}\\b`, "i").test(text);
}

function detectTechnique(text: string) {
  const lower = text.toLowerCase();
  return TECHNIQUES.find((technique) => technique.patterns.some((pattern) => lower.includes(pattern)))?.label ?? null;
}

function titleFromLine(text: string) {
  const lower = text.toLowerCase();
  const action = ACTIONS.find((item) => lower.includes(item));
  return action ? `${action[0].toUpperCase()}${action.slice(1)}` : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
