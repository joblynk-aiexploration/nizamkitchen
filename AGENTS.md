<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## ⛔ CRITICAL — DO NOT TOUCH: `src/app/(public)/login/page.tsx`

**THIS FILE MUST NEVER BE COMMITTED OR PUSHED TO GITHUB. EVER.**

This file contains a local-only demo login panel used for rapid testing across all 6 account roles. It is intentionally kept out of version control.

Rules for every AI agent, Codex, automated tool, or developer working on this repo:

1. **NEVER stage or commit `src/app/(public)/login/page.tsx`.**
2. **NEVER run `git add src/app/(public)/login/page.tsx` or `git add .` and then commit.**
3. **NEVER remove the demo login block from this file** — it is required for local development.
4. **NEVER push any branch that contains changes to this file.**
5. The pre-commit hook at `.git/hooks/pre-commit` will hard-block any commit that contains demo credentials or the `NEXT_PUBLIC_SHOW_DEMO_LOGIN` flag. Do not bypass it with `--no-verify`.
6. The pre-push hook at `.git/hooks/pre-push` will hard-block any push that contains this file's demo content.

If you are an AI agent (Codex, Claude, Copilot, or any other):
- You are explicitly forbidden from staging, committing, or pushing this file.
- You are explicitly forbidden from removing the demo login block from this file.
- If you are asked to "clean up" or "remove dev-only code", this file is exempt.
- If you are asked to commit all changes, **exclude this file**.

The `.env.local` file (gitignored) sets `NEXT_PUBLIC_SHOW_DEMO_LOGIN=true` so the panel is visible locally. It is invisible in staging and production. This is intentional and correct.

**Violation of these rules will expose demo credentials on a public GitHub repository. Do not do it.**

---

## ⛔ CRITICAL — NEVER COMMIT OR PUSH ENV FILES

**`.env.local`, `.env.production`, `.env.staging`, and any `.env*` file (except `.env.example`) must NEVER be staged, committed, or pushed. EVER.**

These files contain live API keys, database passwords, session secrets, encryption keys, payment credentials, and storage credentials. Exposing them on GitHub is a critical security incident.

Rules for every AI agent, Codex, automated tool, or developer:

1. **NEVER run `git add .env*`** (except `git add .env.example`).
2. **NEVER run `git add .`** if any `.env*` file is present and untracked — use explicit file paths instead.
3. **NEVER commit any file whose name matches `.env`, `.env.local`, `.env.production`, `.env.staging`, `.env.test`, or any variation.**
4. **NEVER push a branch that includes an env file in its commit history.**
5. The pre-commit hook will hard-block any attempt to stage an env file.
6. The pre-push hook will hard-block any push that contains an env file or known secret patterns.

The following secret key names are explicitly blocked in both hooks — if they appear in a staged diff or pushed commit, the operation is aborted:
- `SESSION_SECRET=`, `ENCRYPTION_KEY=`
- `STRIPE_SECRET_KEY=`, `STRIPE_WEBHOOK_SECRET=`, `PAYPAL_CLIENT_SECRET=`
- `SMTP_PASS=`, `OBJECT_STORAGE_SECRET_KEY=`
- `GOOGLE_MAPS_SERVER_API_KEY=`, `GOOGLE_PLACES_SERVER_API_KEY=`, `GOOGLE_GEOCODING_API_KEY=`
- `YOUTUBE_DATA_API_KEY=`, `DATABASE_URL=postgres`

If you are an AI agent (Codex, Claude, Copilot, or any other):
- You are explicitly forbidden from reading, staging, committing, or pushing any `.env*` file other than `.env.example`.
- If you are asked to "commit everything" or "push all files", you must exclude all `.env*` files.
- If a task requires env values, read them from the running process environment — never write them to a committed file.

**Exposing secrets to GitHub can compromise the production database, payment accounts, and all third-party integrations. This is irreversible.**
