import { describe, expect, it } from "vitest";
import { LocalRulesProvider, parseTimestampToSeconds } from "@/server/video-analysis/providers/local-rules-provider";

const provider = new LocalRulesProvider();

function analyze(transcriptText: string) {
  return provider.analyzeFromTranscript({
    recipeId: "recipe-1",
    recipeTitle: "Hyderabadi Biryani",
    recipeCuisine: "Hyderabadi",
    recipeCountryCode: "US",
    recipeIngredients: [
      { name: "Basmati Rice", quantity: 2, unit: "cups" },
      { name: "Onion", quantity: 2, unit: "pieces" },
    ],
    recipeStepCount: 3,
    transcriptText,
  });
}

describe("LocalRulesProvider", () => {
  it("detects Hyderabadi ingredient aliases", async () => {
    const result = await analyze(`
      0:00 Wash basmati rice or chawal.
      0:45 Slice pyaz and fry until golden.
      1:20 Add adrak lehsun paste.
      2:00 Add haldi and lal mirch.
    `);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const names = result.output.ingredients.map((item) => item.ingredientName);
    expect(names).toContain("basmati rice");
    expect(names).toContain("onion");
    expect(names).toContain("ginger garlic paste");
    expect(names).toContain("turmeric");
    expect(names).toContain("red chili powder");
  });

  it("detects explicit quantities without guessing missing quantities", async () => {
    const result = await analyze(`
      0:00 Add 2 cups rice.
      0:30 Add half cup yogurt.
      1:00 Add salt.
    `);

    expect(result.success).toBe(true);
    if (!result.success) return;
    const rice = result.output.ingredients.find((item) => item.ingredientName === "basmati rice");
    const yogurt = result.output.ingredients.find((item) => item.ingredientName === "yogurt");
    const salt = result.output.ingredients.find((item) => item.ingredientName === "salt");
    expect(rice?.quantity).toBe(2);
    expect(rice?.unitName).toBe("cup");
    expect(yogurt?.quantity).toBe(0.5);
    expect(salt?.quantity).toBeNull();
    expect(result.output.warnings).toContain("Quantities were not clearly available in the transcript.");
  });

  it("parses timestamps and creates a step timeline", async () => {
    const result = await analyze(`
      [00:45] The cook slices onions.
      (03:20) Oil is heated in a pot.
      1:02:15 The pot is covered for dum cooking.
    `);

    expect(parseTimestampToSeconds("0:45")).toBe(45);
    expect(parseTimestampToSeconds("1:02:15")).toBe(3735);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.steps).toHaveLength(3);
    expect(result.output.steps[0].timestampStartSeconds).toBe(45);
    expect(result.output.steps[2].technique).toBe("dum cooking");
  });

  it("does not create fake analysis without a transcript", async () => {
    const result = await analyze("");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("requires a user-provided transcript");
  });

  it("warns when timestamps are missing", async () => {
    const result = await analyze("Add rice. Fry onions. Serve hot.");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.warnings).toContain("Timestamps were not available, so step timing may be incomplete.");
  });
});
