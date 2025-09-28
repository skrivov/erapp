# Expense Reimbursement Conversational Agent (ERCA)

Demo Next.js application combining LLM-assisted extraction with a deterministic policy evaluator for expense approval routing. Implemented per `SPEC.md` using file-backed policies, Tailwind UI, and Zod-validated contracts.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 to start the upload → review → decision flow.

Create a `.env.local` with your provider credentials:

```
OPENAI_API_KEY=sk-...
# optional overrides
# OPENAI_EXTRACTION_MODEL=gpt-4o-mini
# OPENAI_POLICY_EVAL_MODEL=gpt-4o-mini
# ERCA_TESSDATA_PATH=/absolute/path/to/tessdata
```

## Key Commands

- `npm run dev` — Start the Next.js dev server.
- `npm run build` / `npm start` — Production build & serve.
- `npm test` — Alias for `npm run validate:taxi`, which runs the OCR + LLM validation pipeline against `scripts/datasets/taxi_*` (requires `OPENAI_API_KEY`; set `ERCA_TESSDATA_PATH` to a folder with `eng.traineddata` to keep OCR offline).
- `npm run validate:taxi` — Standalone receipt validation script; accepts `--only` and `--subset` filters for targeted runs.
- `npm run policy:lint` — Static lint pass over `/policies` JSON files.
- `npm run policy:eval` — LLM-assisted QA; generates `data/policy_report.md`.
- `npm run lint` — ESLint (Next.js defaults).
- `python scripts/datasets/download_receipts.py` — Pull sample DocILE/ICDAR receipts (requires `datasets` & `requests`).

## Project Structure

```
app/                # App Router pages & API routes (upload/review/decision/admin, /api/*)
components/         # Shared UI components
lib/                # Deterministic logic (evaluate, policy loader, clarifications, types)
schemas/            # Zod schemas for extraction/policy/decision payloads
policies/           # File-backed policy JSON (global + regional overlays)
data/               # Local audit + generated reports
scripts/            # Node scripts (policy linting, policy eval, taxi validation, datasets)
```

See `SPEC.md` for architecture details, guardrails, and acceptance criteria.
