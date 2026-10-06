# Zandegi

A LifeMaxxing application designed to track achievements, fulfil goals, and build
discipline to level up your character in game and in real life.

State any ambition — "get into medicine", "bench 100kg", "learn Farsi", "save a house
deposit" — and Zandegi turns it into a structured mission with chapters, steps,
scheduled time blocks, real tools, and XP. Your character levels up across eight life
domains.

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
node --version                    # Node >=24.15.0 and <25
npm install --global corepack@0.36.0
corepack enable
corepack prepare pnpm@12.8.2 --activate
pnpm install
pnpm --filter @zandegi/web dev    # http://localhost:3000
pnpm verify                       # the canonical check — run this before pushing
```

`pnpm verify` is the single canonical verification command, used identically in CI and
locally. It runs, in order and stopping at the first failure: the Prettier format check,
ESLint with zero tolerated warnings, every package type check plus the repository contract
files, the unit tests, and the production builds.

If the format check fails, run `pnpm format` and commit the result. Prettier is not always
idempotent in one pass, so if `pnpm format:check` still fails immediately afterwards, run
`pnpm format` once more before investigating.

It is scoped to the current pnpm workspace, which contains only `apps/*` and `packages/*`.
The `legacy/` directory is an independent npm project with its own lockfile: it is never
installed, entered, or modified by `pnpm verify`. It is verified by its own CI job, which
runs `npm ci`, `npm run typecheck` and `npm test` directly inside `legacy/`; the root
`pnpm verify:legacy` script is the local equivalent and also needs `npm ci` there first.
Current workspace code must never import from `legacy/`; `pnpm lint` fails if it does,
including through a dynamic `import()`.

## Status

Monorepo scaffold complete. Next: BUILD-PROMPTS **session 1** — prove the mission
generator produces genuinely good missions across 60 goals. Needs `ANTHROPIC_API_KEY`
in `.env`.
