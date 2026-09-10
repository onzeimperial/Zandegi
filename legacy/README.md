# Zandegi

**An AI-powered life progression platform.** Enter any real-life goal — an exam, a skill, a
career, a habit, a multi-year ambition — and Zandegi turns it into a game-like progression
system: milestones, a skill tree, a concrete task backlog, XP, levels, achievements, analytics,
and an AI coach that adapts the plan as you go.

The loop:

```
goal → AI understanding → decomposition → milestones → skills → tasks →
daily/weekly actions → progress → XP → levels → achievements → analytics →
adaptive AI coaching → (round again, smarter)
```

Zandegi is **not** limited to a fixed list of goals. The goal engine is general-purpose:
education, exams, careers, programming, languages, music, sport, fitness, business, finance,
creative work, research, personal development, projects, certifications, competitions.

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | **Next.js 15** (App Router, React 19), TypeScript strict |
| Database | **Prisma ORM**. SQLite for local dev (zero-setup); swap to PostgreSQL for production |
| Auth | **Auth.js v5** (NextAuth) — credentials + OAuth-ready, JWT sessions, bcrypt |
| AI | **Anthropic SDK** (`claude-sonnet-5` by default), Zod-validated structured output |
| Validation | **Zod** everywhere (requests, AI output, env) |
| Data fetching | **TanStack Query** |
| Styling | **Tailwind CSS** with CSS-variable design tokens, light/dark |
| Charts | **Recharts** |
| Tests | **Vitest** |

### Architecture at a glance

```
src/
  app/
    (auth)/            login, register
    (app)/             authenticated shell: dashboard, goals, coach, analytics,
                       achievements, challenges, friends, knowledge, settings, onboarding
    api/               ~30 route handlers — thin: validate → call a service → return JSON
  lib/                 env, db, auth, errors, api helpers (route wrapper, rate limit,
                       same-origin check), validation schemas, client fetch wrapper
  server/              domain logic, no HTTP concerns
    xp/                level curve (pure) + XP engine (writes events, cascades level-ups)
    achievements/      catalogue + evaluator
    planning/          adaptive planner: pace projection (pure) + milestone re-spacing
    goals/ tasks/      goal creation + plan application; task completion pipeline
    dashboard/ analytics/ search/ social/   read-model aggregation + social features
    progress/          daily snapshots (velocity, trends)
  ai/
    client.ts          Anthropic wrapper: generateText, generateJson (validate + 1 retry)
    schemas.ts         Zod schemas for every piece of AI structured output
    prompts.ts         persona + prompt builders
    context.ts         read-only user-data snapshot for the coach (scoped to one user)
    knowledge.ts       versioned-knowledge retrieval
    decompose.ts       goal → plan (AI, with heuristic fallback)
    heuristic.ts       deterministic rules-based planner (used when no API key)
    coach.ts           coach reply (AI, with heuristic fallback)
```

**Key principle:** the frontend never talks to the AI or the DB directly. Everything goes
`client → /api route (validate) → server service → db`. AI output is **always** validated
against a Zod schema before it touches the database.

---

## Setup

### Prerequisites

- **Node.js ≥ 20.11** and npm
- No database server needed for local dev (uses a SQLite file)

### Install & run

```bash
# 1. install dependencies
npm install

# 2. create your env file
cp .env.example .env
#    then edit .env — at minimum generate an AUTH_SECRET:
npx auth secret            # writes AUTH_SECRET into .env
#    (optional) add ANTHROPIC_API_KEY for live AI

# 3. create the database and generate the client
npx prisma migrate dev --name init

# 4. seed demo data (6 diverse goals + knowledge base + achievements)
npm run db:seed

# 5. start
npm run dev
```

Open <http://localhost:3000>. Sign in with the seeded account:

```
email:    demo@zandegi.app
password: demopassword1
```

or register a fresh account.

> One-shot: `npm run setup` runs install + migrate + seed.

### Without an Anthropic API key

Zandegi is **fully functional offline**. When `ANTHROPIC_API_KEY` is not set (or an AI call
fails validation), it falls back to a **deterministic rules-based planner and coach** — a real
planner that classifies the goal, picks a domain template, and sizes the timeline/task volume
to your available time. The UI labels these plans/replies as `rules-based` so you always know
which produced them. Add the key and re-generate a goal to get an AI-tailored plan.

---

## Environment variables

All are documented in [`.env.example`](./.env.example). Summary:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | `file:./dev.db` for SQLite, or a `postgresql://…` URL |
| `AUTH_SECRET` | ✅ (prod) | Session/JWT signing key. `npx auth secret` |
| `AUTH_URL` / `NEXTAUTH_URL` | ✅ (prod) | Public base URL |
| `ANTHROPIC_API_KEY` | ⬜ | Enables live AI planning + coaching |
| `ZANDEGI_AI_MODEL` | ⬜ | Default `claude-sonnet-5` |
| `ZANDEGI_AI_MODEL_FAST` | ⬜ | Cheap model for light tasks |
| `ZANDEGI_AI_MAX_TOKENS` | ⬜ | Per-request token cap (cost guard) |
| `ZANDEGI_AI_RATE_LIMIT` | ⬜ | AI requests/min per user (default 20) |
| `AUTH_GITHUB_ID` / `_SECRET`, `AUTH_GOOGLE_ID` / `_SECRET` | ⬜ | Enable OAuth providers |
| `ZANDEGI_ALLOWED_ORIGINS` | ⬜ | Comma-separated origins allowed to POST (CSRF) |
| `ZANDEGI_KNOWLEDGE_SEARCH_API_KEY` | ⬜ | Reserved for live knowledge refresh |

**Never commit `.env`.** Secrets are only read server-side via `src/lib/env.ts` (Zod-validated,
fails fast on misconfig). No secret is ever bundled into client code.

---

## Database

Single schema in [`prisma/schema.prisma`](./prisma/schema.prisma), ~25 models:

- **Auth**: `User`, `Account`, `Session`, `VerificationToken`, `Profile`
- **Goal engine**: `Goal`, `Milestone`, `Skill`, `SkillPrerequisite` (DAG), `Task`, `TaskCompletion`
- **Progression**: `XpEvent`, `Achievement`, `UserAchievement`, `ProgressSnapshot`, `Streak`
- **AI**: `AiConversation`, `AiMessage`, `AiRecommendation`, `Resource`
- **Knowledge**: `KnowledgeEntry` (versioned, with `effectiveFrom`, `confidence`, `source`)
- **Social**: `Friendship`, `Challenge`, `ChallengeParticipant`, `Notification`

The schema is written to run on **both SQLite and Postgres**: no Prisma enums (string
constants in `src/lib/constants.ts`), no native JSON columns (TEXT + `src/lib/json.ts`
helpers), no scalar lists. Proper indexes and cascade rules throughout.

### Migrations

```bash
npm run db:migrate         # create/apply a dev migration
npm run db:push            # push schema without a migration (prototyping)
npm run db:studio          # visual browser
npm run db:reset           # drop + re-migrate + re-seed
```

### Switching to PostgreSQL for production

1. In `prisma/schema.prisma` set `datasource db { provider = "postgresql" }`.
2. Set `DATABASE_URL="postgresql://user:pass@host:5432/zandegi"`.
3. `npm run db:migrate` (or `prisma migrate deploy` in CI).

No model changes are required — the schema is already portable.

---

## AI architecture

**1. Structured decomposition** (`src/ai/decompose.ts`)
Builds a prompt from the user's raw goal text + their capacity + retrieved versioned
knowledge, asks the model for JSON, and validates it against `goalPlanSchema`
(`src/ai/schemas.ts`). On validation failure it retries once with the errors fed back, then
falls back to the heuristic planner. The model may also return a **clarification request**
(1–4 questions) instead of a plan when the goal is too vague — the UI collects answers and
re-submits. Cross-references in the returned plan (skill parents, task→skill/milestone links)
are repaired by `normalisePlan` before anything is persisted.

**2. The coach** (`src/ai/coach.ts` + `src/ai/context.ts`)
`buildCoachContext` assembles a compact, **read-only** JSON snapshot of the user's real data —
goals, skills, milestones, open tasks, streak, 14-day activity, trajectory, open
recommendations — **strictly scoped to that user's id**. The coach answers grounded in that
snapshot and returns `coachReplySchema`: a reply, an ordered "focus today" list, structured
recommendations, and optional **proposed actions**.

**3. Controlled actions** (`src/app/api/coach/actions`)
The AI never mutates data on its own. It *proposes* actions (`create_task`, `adjust_timeline`,
`reprioritise_skill`); the user explicitly confirms each one; the API re-validates the payload
and re-checks goal ownership before applying.

**4. Versioned knowledge** (`src/ai/knowledge.ts`, `KnowledgeEntry`)
Real-world facts that change (exam formats, scoring, rankings) are **not hardcoded in
prompts**. They live in the DB with a version, an effective date, a confidence score and a
source. Retrieval passes these to the model with instructions to prefer them over training
data and to hedge on low-confidence items. Plans surface an "uncertain facts — verify these"
recommendation for claims the planner isn't sure about.

**5. Guards**
Per-user per-minute rate limiting on AI endpoints; a hard `max_tokens` cost cap; same-origin
checks on all mutations; every AI response schema-validated.

---

## Adaptive planning

`src/server/planning/` recomputes each goal from **actual throughput**:

- `projectPace` (pure, unit-tested) compares real progress to where the schedule expects you
  to be and classifies: `ahead` / `on_track` / `behind` / `stalled` / `no_deadline`, plus a
  projected completion date and an adherence ratio.
- `recomputeGoalPlan` re-spaces unfinished milestone due-dates across the remaining schedule
  and emits `AiRecommendation` rows when reality has diverged (behind → "add a session or
  push the date", stalled → "do one small task today", ahead → "raise the target").
- Runs on dashboard load and after every task completion, timeline change, or re-plan.

---

## Progression & gamification

- **XP / levels**: smooth power curve (`src/server/xp/levels.ts`), each level costs more.
  Task XP scales by difficulty, self-rated performance, and punctuality.
- **Skill mastery**: exponential moving average toward recent performance; skills level
  independently.
- **Streaks**: daily activity, with milestone bonuses at 3/7/14/30/100 days.
- **Achievements**: 22-entry catalogue (`src/server/achievements/definitions.ts`), each a pure
  `check(stats) → 0..100`. Re-evaluated after every progress change; unlocks award XP + a
  notification. Includes two secret achievements.
- **Challenges**: friends compete on XP / tasks / minutes / streak over a window; live
  leaderboard computed from real activity.
- **Fair comparison**: friend comparison is weighted by goal difficulty and hours invested
  (`fairScore`, `efficiency`) rather than raw XP, and respects per-field privacy flags.

---

## Development commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # prisma generate + next build
npm run start        # serve the production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest watch
npm run db:seed      # (re)seed demo data
npm run db:studio    # Prisma Studio
```

## Testing

`npm test` runs the Vitest suite. Current coverage focuses on the pure domain logic that the
rest of the app depends on:

| File | Covers |
| --- | --- |
| `test/levels.test.ts` | level curve monotonicity, `levelFromXp` inversion, bounds |
| `test/rewards.test.ts` | task-XP scaling by difficulty / performance / punctuality |
| `test/pace.test.ts` | adaptive pace classification + completion projection |
| `test/heuristic.test.ts` | goal classification, plan shape, schema validity, metric extraction |
| `test/ai-schemas.test.ts` | `extractJson`, plan/coach schema validation + defaults |
| `test/achievements.test.ts` | every achievement check is bounded and unlocks correctly |

API/integration tests against a throwaway SQLite DB are the natural next layer.

---

## Deployment

1. Provision PostgreSQL; set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`/`NEXTAUTH_URL`,
   `ANTHROPIC_API_KEY`, `ZANDEGI_ALLOWED_ORIGINS` (your production origin).
2. Set `provider = "postgresql"` in `prisma/schema.prisma`.
3. Build: `npm run build` (runs `prisma generate`).
4. Release step: `npx prisma migrate deploy`.
5. Start: `npm run start` (or deploy to a Node host / Vercel).
6. Swap the in-process rate limiter (`src/lib/api.ts`) for a shared store (e.g. Redis) if you
   run more than one instance.

Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`) are set in `next.config.mjs`.

---

## Status / known limitations

- **AI features require `ANTHROPIC_API_KEY`.** Without it the heuristic planner/coach run
  instead — real, but simpler. The integration architecture is complete; only the credential
  is external.
- **Live knowledge refresh** (`ZANDEGI_KNOWLEDGE_SEARCH_API_KEY`) is stubbed — the versioned
  `KnowledgeEntry` store and retrieval work; automated web refresh of entries is not wired to
  a provider.
- **OAuth providers** are wired but disabled until you supply client IDs/secrets.
- **Rate limiting** is per-process (fine for a single instance; use Redis for multi-instance).
- Email verification / password reset flows are not implemented (credentials auth only).
