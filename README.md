# Zandegi

A life RPG. State any ambition — "get into medicine", "bench 100kg", "learn Farsi",
"save a house deposit" — and Zandegi turns it into a structured mission with chapters,
steps, scheduled time blocks, real tools, and XP. Your character levels up across eight
life domains.

## Governing documents

- **`CLAUDE.md`** — build constitution. Highest authority. How to build.
- **`docs/SPEC.md`** — master specification. What to build.
- **`docs/BUILD-PROMPTS.md`** — the ten build sessions, in order.
- **`docs/BUILD-LOG.md`** — running log of what shipped each session.

## Layout

```
apps/
  web/          Next.js 15 — marketing site + full app
  mobile/       Expo — placeholder, built session 9
  admin/        Internal tools — placeholder, built session 6+
packages/
  core/         Pure domain logic. No I/O.
  db/           Prisma schema, migrations, seed
  api/          tRPC routers
  ai/           Generation pipeline
  ui/           Component library + design tokens
  tools/        Tool Registry runtimes
  economy/      XP, currencies, seasons, entitlements
  integrations/ Health / fitness / calendar / git connectors
legacy/         The pre-monorepo prototype, kept for reference. Not part of the build.
```

## Getting started

```powershell
# from repo root
pnpm install
pnpm --filter @zandegi/web dev    # http://localhost:3000
pnpm -r typecheck
pnpm test
```

## Status

Monorepo scaffold complete. Next: BUILD-PROMPTS **session 1** — prove the mission
generator produces genuinely good missions across 60 goals. Needs `ANTHROPIC_API_KEY`
in `.env`.
