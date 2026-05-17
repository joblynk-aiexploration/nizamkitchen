# NizamKitchen Local AI Training Foundation

NizamKitchen should not train a model from scratch for the MVP. The realistic path is to collect high-quality verified examples first, export them as JSONL, and later fine-tune an existing open-source model outside the production web app.

## Recommended Path

1. Use `local_rules` now for free transcript-only analysis.
2. Paste transcripts or authorized captions only.
3. Let `local_rules` create a draft structured analysis.
4. Have a platform admin correct and verify the result.
5. Store verified analyses as AI training examples.
6. Export verified examples as JSONL.
7. Fine-tune an existing open-source model later.
8. Serve that local model behind `LOCAL_AI_BASE_URL` with `AI_PROVIDER=local_http`.

## Why Not Train From Scratch

Training from scratch requires large datasets, expensive compute, model safety work, and ongoing evaluation. It is not appropriate for this phase. Fine-tuning an existing open-source model on verified NizamKitchen corrections is the practical path.

## Production Boundaries

The web app should not require a GPU. Training should happen outside the production web app on a local machine, separate worker, or future ML environment. The web app stores verified examples, exports JSONL, and calls an optional local inference server.

## Transcript And Copyright Safety

Do not train on copyrighted YouTube transcripts unless the user/admin provides them or permission is documented. JSONL export includes transcript permission metadata so datasets can be reviewed before fine-tuning.

## Local Providers

`local_rules` is a deterministic transcript analyzer. It does not watch videos and does not claim to. It extracts ingredients, explicit quantities, timestamps, techniques, warnings, and differences from written recipes based only on transcript evidence.

`local_http` is a future connector for a locally hosted model. The web app sends recipe context and transcript text to:

```http
POST {LOCAL_AI_BASE_URL}/analyze-cooking-video
```

The local server must return JSON matching the same strict video-analysis Zod schema used by paid providers.

## Local Environment

```bash
AI_VIDEO_ANALYSIS_ENABLED=true
AI_PROVIDER=local_rules
LOCAL_AI_ENABLED=true
LOCAL_TRANSCRIPT_ANALYZER_ENABLED=true
LOCAL_AI_BASE_URL=
LOCAL_AI_MODEL=
LOCAL_AI_TIMEOUT_MS=30000
```

For a future local server:

```bash
AI_VIDEO_ANALYSIS_ENABLED=true
AI_PROVIDER=local_http
LOCAL_AI_ENABLED=true
LOCAL_AI_BASE_URL=http://localhost:8001
LOCAL_AI_MODEL=nizamkitchen-local-v1
```

## JSONL Export

Create a dataset in `/admin/ai-training/datasets`, add verified examples, then export:

```http
GET /api/admin/ai-training/datasets/{id}/export
```

Each line contains `task`, `input`, `output`, and safe `metadata`. Rejected examples and secrets are excluded.
