# Repository Guidelines

## Demo Rule — No Legacy Fallbacks
- This is a demo project. NEVER make fallback to legacy code. Do not add “legacy” branches, switches, or hidden codepaths; remove or refactor obsolete code instead.

## Project Structure & Module Organization
- `app/` — App Router pages and layouts (`layout.tsx`, `page.tsx`). Add routes via folders (e.g., `app/upload/page.tsx`) and API routes under `app/api/*/route.ts`.
- `public/` — Static assets served at `/`.
- Planned (per SPEC): `/lib`, `/schemas`, `/policies` (JSON rules), `/data/audit.jsonl` (dev‑only log). Keep these when implementing.
- Config: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`.
- Docs: `SPEC.md` defines architecture and contracts; keep changes aligned.

## Build, Test, and Development Commands
- `npm run dev` — Start Next.js dev server at http://localhost:3000.
- `npm run build` — Production build.
- `npm start` — Serve the production build.
- `npm run lint` — Run ESLint (`--fix` optional).

## Coding Style & Naming Conventions
- TypeScript (strict). ESLint extends `next/core-web-vitals` and `next/typescript`.
- Indentation 2 spaces. Components in PascalCase; hooks `use*`; other identifiers camelCase.
- Routes use `page.tsx`/`layout.tsx`; shared UI under `components/` (create if needed). Use `.tsx` for React, `.ts` for libs.
- Styling via Tailwind utilities in `app/globals.css`.

## Testing Guidelines
- Add tests with Jest + React Testing Library; optional Playwright for E2E.
- Name as `*.test.ts`/`*.test.tsx`; colocate or use `__tests__/`.
- Prioritize schemas, the deterministic evaluator, and API contracts from `SPEC.md`.

## Commit & Pull Request Guidelines
- Commits: small, imperative; prefer Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- PRs: description, linked issues, screenshots for UI, repro steps, and passing `npm run lint`/`npm run build`.

## Security & Configuration Tips
- Secrets in `.env.local` (git‑ignored). Client‑exposed vars must be `NEXT_PUBLIC_*`.
- LLM/provider keys are server‑only; call providers from API routes and validate responses with Zod.
- File writes are dev‑only (e.g., `/data/audit.jsonl`); serverless storage is ephemeral per SPEC.

## Spec Alignment
- Follow `SPEC.md` module boundaries and API routes: `/api/extract`, `/api/submit`, `/api/policies`, `/api/policy-eval`.
- Keep rules as file‑backed JSON under `/policies`; implement the deterministic evaluator and step ordering as specified; avoid adding a database.
