---
name: Zandegi Legacy Extraction and Production Foundations Repair Plan
type: implementation-handoff
status: final
updated: '2026-10-02'
governed-by: ARCHITECTURE-SPINE.md
---

# Zandegi Legacy Extraction and Production Foundations Repair Plan

## Outcome

Turn the current monorepo into a dependable MVP foundation without reviving the legacy application. The architecture spine is the contract: when this plan, an older specification, a build prompt, or legacy code disagrees with it, the spine wins until the source documents are deliberately reconciled.

The current codebase is a useful scaffold, not yet a production foundation. Direct local checks pass: ESLint, all ten TypeScript configurations, and 197 tests. The root `pnpm`/Corepack bootstrap is broken, so `pnpm verify:current` cannot yet be treated as the reproducible verification command.

## Product Corrections Before Feature Work

These are corrections to earlier documents, not optional refinements:

1. AI-generated duration, difficulty, priority, or rarity never determines XP. The server awards from fixed policy inputs or verified effort.
2. Paid plans, Crew Boosts, purchased Shards, and entitlements never increase XP, repair streaks, alter rank, or improve leaderboard position.
3. Opening or using a tool earns nothing by itself. A registered action must produce qualifying evidence.
4. Raw goals, mission text, provider payloads, and evidence do not enter the immutable ledger. `MissionGenerated` is an operational/outbox message, not a progression fact.
5. `core` owns progression; `economy` owns currency, commerce, entitlements, and tuning; `api` alone coordinates them and owns transaction boundaries.
6. Tools return state and verified facts. They never write awards or projections directly.
7. All external integrations, including external calendar sync, are post-MVP. The internal scheduler remains in scope.
8. Private Vercel Blob replaces the earlier S3/R2 assumption for MVP evidence storage and remains hidden behind a storage port.
9. Web and mobile share rules, contracts, tokens, and analytics names, not screens or platform controls.

## Phase 0 - Stabilise the Foundation

| Repair | Required result |
| --- | --- |
| Package manager | Activate pnpm 12.8.2 through Corepack, replace the malformed multi-document lockfile with one reviewed lockfile, and prove a clean install. |
| Runtime | Set the root engine and CI to Node 24 LTS and remove assumptions tied to Node 20. |
| Framework security | Patch Next.js to 15.5.27 and run its build and tests before any Next.js 16 migration. |
| Dependency baseline | Move together to TypeScript 6.0.3 plus a compatible current `typescript-eslint` v8, React/DOM 19.3.0, Zod 4.6.5 workspace-wide, Anthropic SDK 0.131.0, tRPC 11.19.0, and Inngest 4.21.0. Pin exact reviewed installs. |
| Environment example | Replace the legacy SQLite/NextAuth variables; remove every nonblank secret-shaped example; document local, preview, and production variables. |
| Deployment identity | Configure Vercel `syd1`, Neon AWS `ap-southeast-2` pooled runtime access, Upstash Sydney primary, and Blob Sydney; validate each resource's environment identity against `VERCEL_ENV`. |
| Verification command | Make one root command run formatting or linting, all package type checks, unit tests, and production builds in a fresh checkout. |
| Generation seam | Remove the web route's direct AI orchestration and every web import of AI pipeline types. Route generation through an API use case/client contract and replace fake persisted event/date behaviour. Remove model-authored XP from AI `Scored*` types, scoring, generated payloads, and XP preview UI. |
| Build record | Correct `BUILD-LOG.md` so it distinguishes scaffolded packages from production-ready capabilities. |
| Import boundary | Add a check that fails if current apps or packages import from `legacy/`. |

### Phase 0 acceptance

- A fresh checkout installs using the pinned package manager and committed lockfile.
- The canonical verification command passes without hidden global tools.
- Production builds for implemented apps pass on Node 24.
- No example file contains a usable credential or secret-like placeholder value.
- No current source imports legacy code.
- The web route calls the API boundary; AI, persistence, clocks, and IDs are injected behind ports.
- Exact target versions appear in manifests and one valid lockfile; AI and shared contracts use Zod 4.

## Legacy Disposition

### Extract or rewrite

- Pursuit/catalog seed ideas, after checking each item against the current safety and content rules.
- Catalog validation cases and deterministic test fixtures that still describe wanted behaviour.
- Pure scoring and progression test ideas, rewritten for the current versioned award policy rather than copied with old constants.
- Task-service scenarios such as ordering, idempotency, completion conflicts, and error cases, rewritten as API use-case tests.
- Useful product copy that does not promise obsolete rewards, percentages, integrations, or paid advantages.

Extraction means reproducing the behaviour against current contracts with new tests. It does not mean importing legacy modules.

### Reject

- Legacy Prisma schema and migrations.
- NextAuth identity and session design.
- Legacy API routes and mixed database/business-logic services.
- Direct mutation of XP, wallets, streaks, ranks, or other projections.
- Old reward formulas, paid progression advantages, and generic outcome-percentage calculations.
- Old AI pipelines, generated timestamps, UI architecture, and provider-specific domain types.

### Defer

- Achievements, quests, parties, crews, duels, leaderboards, feeds, and other social systems unless placed in an approved MVP story.
- Billing and subscription implementation beyond the entitlement boundary.
- External calendar, health, fitness, GitHub, banking, and other provider integrations.
- Durable generation and advanced offline behaviour.

Do not delete `legacy/` until every legacy capability and test group is recorded as extracted, rewritten, rejected, or deferred.

### Legacy inventory register

Maintain this table as files are inspected; `status = done` requires the named replacement or rationale and its evidence.

| Source path / capability | Disposition | Replacement target | Evidence required | Status |
| --- | --- | --- | --- | --- |
| `legacy/**/prisma*`, migrations | reject | Phase 4 current schema | empty-state migration and repository tests | pending inventory |
| legacy auth/session code | reject | Phase 5 Clerk + internal principal | guest, account, claim, conflict tests | pending inventory |
| legacy API/routes/services | rewrite scenarios only | `packages/api` use cases | characterization-to-use-case test mapping | pending inventory |
| legacy XP/economy/progress formulas | reject | `core` progression and `economy` policies | invariant and golden-fixture tests | pending inventory |
| legacy Pursuit/catalog material | extract selectively | current catalog pipeline | per-item safety/source/schema validation | pending inventory |
| legacy task/tool tests | rewrite useful cases | API/tool contract tests | mapped test IDs and results | pending inventory |
| legacy UI/AI/provider code | reject or copy-review only | current web/AI adapters | rationale and no-import check | pending inventory |
| achievements/social/integrations | defer | approved future scope | linked scope decision | pending inventory |

## MVP Boundary

The technical MVP includes Phases 0-7 and the web portion of Phase 8: guest-to-account onboarding, safe mission generation, the trusted completion/progression loop, internal scheduling, deletion/export, and private evidence storage. External integrations and external calendar sync are excluded. Mobile, billing, and social capabilities can follow without changing the core contracts; their release order is a product-planning decision.

## Dependency-Safe Build Sequence

| Phase | Prerequisite | Required output and gate | Governing decisions |
| --- | --- | --- | --- |
| 1 | Phase 0 | Published ledger, command, award, safety, content, actor, and wire schemas with golden N/N-1 fixtures; pure replay/upcaster/compensation tests pass. | AD-1 to AD-6 |
| 2 | Phase 1 | Economy policies and tests prove money/entitlements cannot alter progression; progression tuning remains in core. | AD-2 to AD-5 |
| 3 | Phase 1 | Catalog data and validation report pass uniqueness, safety, age, source, and coverage checks. | AD-6, AD-8, AD-13 |
| 4 | 1-3 | Prisma 7 schema, migrations, Unit of Work, ledger/outbox repositories, real Postgres concurrency tests, empty-state migration, and rebuild pass. No production cutover yet. | AD-1 to AD-4, AD-7, AD-12 |
| 5 | Phase 4 | API/client contracts, Clerk/guest flows, generation stream, idempotency, cancellation, rate-limit and claim-race tests pass. | AD-2 to AD-9 |
| 6 | Phase 5 | Tool transition, evidence lifecycle, Blob ownership/quota/cleanup, and scheduler tests pass. File allowlist remains narrow. | AD-5, AD-6, AD-10 |
| 7 | Phase 6 | Relay lease/ack/dead-letter tests, signed job actor, retry/replay runbook, deletion saga, backup restore, RPO/RTO, and observability launch gate pass. | AD-3, AD-4, AD-11, AD-12 |
| 8 | Phase 7 | Postgres-backed vertical slice passes: guest -> API -> ledger/award/projections/outbox -> replay -> web decode. Admin/mobile are separate approvals. | all applicable ADs |

### Phase 1 - Pure contracts and rules

Implement in `core`: exact event/command/actor envelopes, aggregate ordering, pure upcasters, typed compensation, idempotency request hashing, pure folds/projections, Pursuit/generated-content/stream schemas, evidence and safety contracts, and the versioned `SELF | TIMER | ARTIFACT | METRIC | INTEGRATION` award policies and UI/tool mapping. Public contracts use Zod 4; golden fixtures define the JSON wire form.

### Phase 2 - Economy policy

Implement pure wallet, spend, grant, entitlement, and tuning rules in `economy`. Add invariant tests proving purchases and entitlements cannot influence progression, streaks, rank, or competitive position.

### Phase 3 - Pursuit catalog

Re-author the intended Pursuit catalog through current schemas. Add uniqueness, age, safety, source, duration, and coverage validation. Preserve useful legacy ideas only after they pass these checks.

### Phase 4 - Persistence and atomic append

Create `prisma.config.ts`, explicit generated-client output, `@prisma/adapter-pg`/`pg`, and bounded pool settings against Neon's pooled runtime URL; migrations run outside requests. Build the schema and transaction-scoped repositories for relational content, principal aliases, the ledger, award records, projections, evidence metadata, deletion tombstones, and `OutboxMessageV1`. Implement `db.UnitOfWork`, sequence/version locks, unique request hashes, and expand-migrate-contract compatibility. Prove generation/migration, a real pooled query, concurrent append/spend, N/N-1 reads, quarantine, replay, and projection rebuild.

### Phase 5 - API, identity, and generation

Build API use cases for goal intake, mission generation, completion, guest creation/claim, export/deletion, and reads. Add Clerk-backed principal resolution, canonical guest aliases, secure cookie rotation, `ActorContext`, server authorization, tRPC/client exports, validated SSE frames, rate limits, request cancellation, and fixed inference budgets below Vercel deadlines. The guest-retention feature specification must be approved before Phase 4 freezes the schema.

### Phase 6 - Trusted action loop

Implement tool state machines, server-attested `VerifiedFact`, evidence lifecycle states, private GA Blob storage, file allowlist, quotas, orphan/deletion cleanup, the internal scheduler, and completion verification. API use cases remain the only writers of ledger facts and awards.

### Phase 7 - Reliable asynchronous effects

Build the Inngest cron-triggered relay using leased `SKIP LOCKED` batches, acceptance acknowledgement, durable dedupe, retry, dead-letter/replay, and signed system actors. Configure the Vercel serve-route `maxDuration` and Inngest checkpoint runtime at 60-80% of it. Add metrics/alerts for oldest undelivered age and failures, a projection-rebuild runbook, the cross-provider deletion saga, backup/restore drill, and launch SLO/RPO/RTO gates. Redis is disposable and never authoritative.

### Phase 8 - Product surfaces

Move the web app onto `@zandegi/api/client` and client-safe core contracts, with no AI imports. Prove the Postgres-backed vertical slice and deployed `syd1` region. Then add admin catalog/review workflows and, only after `OfflineCompletionCommandV1` is fixed, the bounded native mobile client. Mobile may queue eligible completion commands, but XP stays pending until accepted by the server.

### Phase 9 - Deliberately later capabilities

Add billing, subscriptions, competitive/social features, and external integrations only through separately approved scopes. They must reuse the same API, entitlement, ledger, privacy, and outbox contracts.

## Developer Handoff Checklist

- Read `ARCHITECTURE-SPINE.md` before selecting a story.
- Link each implementation story to the architecture decisions it touches.
- Add characterization tests before extracting a useful legacy behaviour.
- Keep commits phase-bounded; do not combine toolchain repair, schema invention, and feature work in one change.
- For every ledger command, test authorization, idempotency, duplicate delivery, rollback, replay, and compensation.
- For every generated-content path, test schema failure, safety failure, stale source, timeout, disconnect, retry, and partial-stream suppression.
- For every evidence path, test ownership, token expiry, MIME/size rejection, orphan cleanup, deletion, and log redaction.
- Re-run the canonical verification command from a clean checkout before declaring a phase complete.
