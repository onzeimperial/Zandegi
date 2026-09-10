# CLAUDE.md — Zandegi build constitution

Place this file at the repository root. Claude Code loads it automatically every session.
It is the highest-authority document in the repo. If a session prompt contradicts it, this file wins
and you must say so before proceeding.

---

## 1. What Zandegi is

Zandegi is a life RPG. A person states any ambition — "get into medicine", "bench 100kg", "learn Farsi",
"save a house deposit", "stop doom-scrolling", "start a business" — and Zandegi turns it into a structured
mission with chapters, steps, scheduled time blocks, real tools, and XP. Their character levels up across
eight life domains. They join crews, climb leaderboards, earn Shards, and spend them on cosmetics.

The reference points are Notion (structure and tools), Duolingo (streaks, daily loop, gentle coercion),
and Fortnite (cosmetics, seasons, rank, social identity). Zandegi is all three, aimed at real life.

**One-line test for every feature:** does this make a real person do a real thing in the real world,
and then feel it? If no, cut it.

## 2. Non-negotiable product laws

These are absolute. Never violate them, never "temporarily" work around them, never ask permission to bend them.

1. **No pay-to-progress.** Money never buys XP, levels, rank, streaks, mission completion, or leaderboard
   position. Money buys cosmetics, convenience, insight, and capacity. Break this and the entire integrity
   of the progression system — which is the product — is worthless. This is also what keeps the app compliant
   and reviewable on both stores.
2. **No fake precision.** OUTCOME goals ("become a doctor") never display a percentage. They display
   chapters completed, evidence gathered, and next action. Only METRIC goals with a real measurable
   quantity may show a progress bar. Never invent a denominator.
3. **XP is earned by verified effort, not by tapping.** Every XP award traces to a completion event with a
   verification tier. There is no "claim XP" button that isn't attached to real work.
4. **The ledger is append-only.** Progress state is derived by folding events, never mutated in place.
   Corrections are compensating events. This is what makes the system auditable, replayable, and
   debuggable when a user says "why did my XP change".
5. **Determinism over model calls for anything scored.** XP, rarity, prioritisation, difficulty, and rank
   are pure functions with published formulas in `@zandegi/core`. The LLM writes content; it never
   assigns numbers that affect progression.
6. **Grounded content only.** Any mission step that asserts a fact, requirement, deadline, price, or
   eligibility rule must carry a source and a freshness date, or be rewritten as advice rather than fact.
   Unsourced hard claims fail the grounding validator and never ship to a user.
7. **Zandegi is not an exam tracker.** Exam prep is one Pursuit among ~140. If you find yourself building
   study-specific primitives into core, stop — you have drifted.
8. **Never dark-pattern the vulnerable.** No fake scarcity timers on real money, no loss-framing on
   streaks that shames, no purchase prompts inside a failure state, no loot boxes with real-money entry.
   Shard packs are fixed-value. The daily shop rotates on a real 24h clock.

## 3. Stack and environment

- TypeScript everywhere. `strict: true`. No `any` without a `// why:` comment.
- Next.js 15 (App Router), React 19, tRPC v11, Prisma, PostgreSQL (Neon), Clerk for auth.
- Tailwind CSS v4 + a token layer (see `docs/DESIGN.md`). shadcn/ui as the primitive base, restyled.
- Framer Motion for motion. Zustand for ephemeral client state. TanStack Query via tRPC.
- Anthropic SDK for generation. Model routing is centralised in `packages/ai/router.ts` — never call the
  SDK directly from a route or component.
- Redis (Upstash) for rate limits, daily shop rotation, leaderboard caches.
- Inngest for scheduled and background work (streak rollovers, season ticks, digest notifications).
- Stripe for web billing; RevenueCat wrapping StoreKit/Play Billing for mobile.
- Expo (React Native) for mobile, sharing `@zandegi/core` and the tRPC client.
- The developer runs **Windows / PowerShell**. Give PowerShell commands, not bash. Never assume terminal
  familiarity — number every step, state the directory, state what success looks like.

## 4. Monorepo layout

```
apps/
  web/          Next.js 15 — marketing site + full app
  mobile/       Expo — the daily loop, camera verification, notifications
  admin/        Internal: pursuit curation, content review, economy dashboards
packages/
  core/         Pure domain logic. NO I/O, NO framework imports. Already built, 75 tests.
  db/           Prisma schema, migrations, seed
  api/          tRPC routers
  ai/           Generation pipeline, prompts, model router, grounding validator
  ui/           Shared component library + design tokens
  tools/        The Tool Registry runtimes (trackers, calculators, templates, timers)
  economy/      XP, Shards, catalog, seasons, entitlements
  integrations/ Apple Health, Google Fit, Strava, GitHub, Google Calendar, Basiq
```

`packages/core` is sacred: pure functions only. If you need a date, it is passed in. If you need
randomness, a seed is passed in. This is why it is testable and why the numbers are trustworthy.

## 5. How you must work

- **Read before writing.** At the start of every session, read `docs/SPEC.md`, `docs/DESIGN.md`, and the
  existing `packages/core` exports. Do not re-implement what exists.
- **Plan first.** Post a numbered plan and the file list you intend to touch. Wait for approval on any
  session that touches the economy, the schema, or billing.
- **Tests are part of the deliverable, not a follow-up.** Every pure function in `core` and `economy`
  ships with tests. Every tRPC procedure ships with at least one happy-path and one auth-failure test.
- **Migrations are never destructive without an explicit callout.** Name them descriptively.
- **Commit in small, working increments** with conventional commit messages.
- **When something is ambiguous, ask one sharp question** rather than guessing and building the wrong
  thing. But never ask about anything already answered in `docs/SPEC.md`.
- **At the end of every session**, write a short entry to `docs/BUILD-LOG.md`: what shipped, what you
  learned, what is now broken or deferred, and the exact next step.

## 6. Definition of done for any user-facing surface

A screen is not done until all of these are true:

- Loading, empty, error, and offline states are designed and implemented — the empty state invites an action.
- Keyboard navigable with a visible focus ring.
- `prefers-reduced-motion` respected; all motion has a still fallback.
- Works at 375px width.
- Colour contrast passes WCAG AA for text.
- No layout shift on data load (skeletons match final dimensions).
- Copy follows `docs/DESIGN.md` voice rules: sentence case, active voice, the button verb matches the
  resulting toast.
- Analytics events fired per `docs/ANALYTICS.md`.
