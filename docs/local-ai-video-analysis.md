# Local AI Video Analysis

This document describes the local AI providers available for video analysis and how to prepare training data for fine-tuning.

## Overview

AI video analysis extracts ingredients, cooking steps, and differences from a recipe's reference video. Three local provider modes are available:

| Provider | Requires | Cost | Notes |
|---|---|---|---|
| `local_rules` | Pasted transcript | $0 | Deterministic rule-based parser |
| `local_http` | Local AI server at `LOCAL_AI_BASE_URL` | $0 | Placeholder for a self-hosted model |
| `mock` | Nothing | $0 | Synthetic output, for testing only |

## Environment Variables

```env
AI_VIDEO_ANALYSIS_ENABLED=true
AI_PROVIDER=local_rules       # or local_http, mock

# Required for local_rules
LOCAL_AI_ENABLED=true
LOCAL_TRANSCRIPT_ANALYZER_ENABLED=true

# Required for local_http
LOCAL_AI_ENABLED=true
LOCAL_AI_BASE_URL=http://localhost:8080
LOCAL_AI_MODEL=my-cooking-model
LOCAL_AI_TIMEOUT_MS=30000

# Optional: for future ffmpeg-based frame extraction
FFMPEG_PATH=/usr/local/bin/ffmpeg
LOCAL_VIDEO_FRAME_ANALYSIS_ENABLED=false
LOCAL_SPEECH_TO_TEXT_ENABLED=false
```

## local_rules Provider

The `local_rules` provider is a deterministic transcript parser. It:

- Extracts timestamped cooking steps from action verbs (wash, chop, fry, dum, garnish, etc.)
- Identifies ingredients by name and common transliterations (pyaz → onion, haldi → turmeric, etc.)
- Parses quantities and units near ingredient mentions
- Identifies known cooking techniques (dum cooking, tempering/tadka, marination, etc.)
- Surfaces differences between the transcript and the written recipe ingredient list

**It does not watch or download the video.** The analyst must paste the video transcript manually in the admin UI.

### Limitations

- Only recognizes ingredients in the built-in `INGREDIENT_ALIASES` table (see `local-rules-provider.ts`).
- Confidence is capped at `medium` — it cannot observe quantities not stated in text.
- No vision: cooking techniques that are shown but not spoken are missed.

## local_http Provider

The `local_http` provider sends the transcript and recipe metadata to a local HTTP server:

```
POST http://{LOCAL_AI_BASE_URL}/analyze-cooking-video
Content-Type: application/json

{
  "recipeName": "Hyderabadi Chicken Biryani",
  "cuisine": "Hyderabadi",
  "countryCode": "IN",
  "writtenRecipeIngredients": [...],
  "transcript": "...",
  "videoMetadata": { "title": "...", "language": "..." },
  "promptVersion": "cooking-video-analysis-v1",
  "model": null
}
```

The server must return a JSON body matching the `aiProviderOutputSchema` (see `src/lib/validation/video.ts`).

## Training Data Preparation

Verified analyses are automatically captured as training examples in the `AiTrainingExample` table. Each verified analysis (status `verified` in `RecipeVideoAnalysis`) triggers a call to `createTrainingExampleFromVerifiedAnalysis()`.

To export training data for fine-tuning, query the database:

```sql
SELECT
  ate.id,
  ate.taskType,
  ate.inputJson,
  ate.outputJson,
  ate.sourceType,
  ate.createdAt
FROM "AiTrainingExample" ate
WHERE ate.status = 'approved'
ORDER BY ate.createdAt DESC;
```

The `inputJson` contains the prompt context and the `outputJson` contains the verified AI output. These can be used to fine-tune a local model using any standard instruction-tuning approach.

## Adding New Ingredients to local_rules

Edit `INGREDIENT_ALIASES` in `src/server/video-analysis/providers/local-rules-provider.ts`:

```typescript
{ canonical: "fenugreek seeds", aliases: ["fenugreek", "methi seeds", "methi dana"] },
```

Each entry maps a canonical name to all spelling and transliteration variants that may appear in a transcript.
