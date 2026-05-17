import type { AnalyzeVideoInput } from "./providers/types";

export function buildTranscriptAnalysisPrompt(input: AnalyzeVideoInput): string {
  const ingredientList = input.recipeIngredients
    .map((ri) => `- ${ri.quantity} ${ri.unit} ${ri.name}`)
    .join("\n");

  return `You are a cooking video analyst. Analyze the provided transcript from a cooking video and produce a structured JSON breakdown.

RECIPE CONTEXT:
Title: ${input.recipeTitle}
Written ingredients:
${ingredientList}
Number of written steps: ${input.recipeStepCount}

VIDEO TRANSCRIPT:
${input.transcriptText ?? "(no transcript provided)"}

RULES:
- Extract only what is supported by evidence from the transcript.
- Never invent exact quantities. If a quantity is not mentioned or is unclear, use null.
- Use null when a value is unknown rather than guessing.
- Include confidence per ingredient and per step: "exact", "high", "medium", "low", or "unknown".
- Include evidenceText when you quote from the transcript.
- Identify differences between the video and the written recipe.
- Produce ONLY valid JSON matching the schema below. No markdown, no explanation.

OUTPUT JSON SCHEMA:
{
  "title": "string (short descriptive title for this analysis)",
  "summary": "string or null (2-3 sentence summary of what the video covers)",
  "confidence": "exact | high | medium | low | unknown (overall confidence)",
  "ingredients": [
    {
      "ingredientName": "string",
      "quantity": number | null,
      "unitName": "string | null",
      "preparationNote": "string | null",
      "timestampStartSeconds": number | null,
      "timestampEndSeconds": number | null,
      "confidence": "exact | high | medium | low | unknown",
      "evidenceText": "string | null (quote from transcript)",
      "notes": "string | null"
    }
  ],
  "steps": [
    {
      "stepNumber": number,
      "title": "string | null",
      "description": "string",
      "timestampStartSeconds": number | null,
      "timestampEndSeconds": number | null,
      "durationSeconds": number | null,
      "temperature": "string | null",
      "technique": "string | null",
      "confidence": "exact | high | medium | low | unknown",
      "evidenceText": "string | null",
      "notes": "string | null"
    }
  ],
  "differencesFromWrittenRecipe": [
    {
      "differenceType": "ingredient_difference | quantity_difference | step_difference | timing_difference | technique_difference | spice_level_difference | other",
      "title": "string",
      "description": "string",
      "severity": "info | warning | important"
    }
  ],
  "warnings": ["string"]
}`;
}
