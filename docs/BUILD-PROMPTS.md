# Zandegi MVP Build Prompts

These prompts implement the reconciled MVP in dependency order. Run one phase at a time and do not begin the next phase until every exit criterion is satisfied.

## Source-of-truth order

Every implementation phase must read these sources in this order:

1. `_bmad-output/specs/spec-zandegi/SPEC.md` and every listed companion.
2. `_bmad-output/planning-artifacts/architecture/architecture-Zandegi-2026-09-25/ARCHITECTURE-SPINE.md`.
3. `_bmad-output/planning-artifacts/architecture/architecture-Zandegi-2026-09-25/LEGACY-EXTRACTION-AND-REPAIR-PLAN.md`.
4. `CLAUDE.md` for repository working rules.
5. The current phase below.

If an older document, current implementation, or legacy file conflicts with those sources, stop relying on it. Record the discrepancy in `docs/BUILD-LOG.md`. Never import from `legacy/`.

The canonical spec controls product scope and observable behaviour. The architecture spine controls technical structure and wins any technical incompatibility.

## Phase 0 — Repair the foundation

```text
Read the canonical spec, all companions, the finalized architecture spine, the repair
plan, CLAUDE.md, and the existing BUILD-LOG.md before editing.

Goal: make a fresh checkout reproducible and establish one honest verification command.

1. Repair Corepack and pin pnpm 12.8.2. Replace the malformed multi-document lockfile
   with one reviewed lockfile; report the dependency delta.
2. Align engines, CI, and local tooling on Node 24 LTS.
3. Reconcile exact package versions with the architecture target: Next 15.5.27,
   React/DOM 19.3.0, TypeScript 6.0.3 plus compatible typescript-eslint v8,
   Tailwind 4.3.3, Zod 4.6.5 workspace-wide, Prisma 7.10.x, tRPC 11.19.0,
   Anthropic SDK 0.131.0, and Inngest 4.21.0. Pin exact reviewed installs.
4. Replace legacy SQLite and NextAuth variables in .env.example. Leave every secret
   example blank and document local, preview, and production variables.
5. Remove web imports of AI pipeline types and direct web-to-AI orchestration. Introduce
   the API use-case/client seam without implementing the full feature.
6. Remove model-authored XP fields and fake persisted events/dates from current AI and
   web contracts. Do not invent the replacement policy in this phase.
7. Add an import-boundary check that rejects current imports from legacy/.
8. Make one root verification command run lint, all type checks, unit tests, and
   production builds without global tools.
9. Correct BUILD-LOG.md so scaffolded code is not described as production-ready.

Exit criteria: clean install from the committed lockfile; canonical verification passes;
production builds pass on Node 24; no nonblank example secret; no current-to-legacy
import; web no longer imports AI types or orchestrates AI directly.
```

## Phase 1 — Freeze pure contracts and progression rules

```text
Prerequisite: Phase 0 is green.

Goal: publish the pure, versioned contracts every later package implements.

1. In core, define exact Zod 4 schemas for ActorContext, IdempotentCommand,
   LedgerEnvelopeV1, event payloads, aggregate sequence, typed compensation,
   OutboxMessageV1, VerifiedFact, evidence lifecycle, Pursuit, Mission, generation
   stream frames, KnowledgeSnapshot, FreshnessDecision, and safe client wire types.
2. Define AwardEvidenceKind exhaustively as SELF | TIMER | ARTIFACT | METRIC |
   INTEGRATION. Map every UI/tool action to exactly one kind.
3. Implement the approved versioned progression policy only after the two product
   questions in SPEC.md are answered. Model estimates cannot enter its inputs.
4. Implement pure folds, pure shape-only upcasters, quarantine behaviour, and typed
   promotion/reversal for provisional awards.
5. Publish canonical JSON fixtures for N and N-1. Dates are ISO UTC strings, numbers
   are safe integers, and absent versus null is explicit.

Exit criteria: golden fixtures validate; replay order uses aggregate sequence rather
than time; upcasters are deterministic and side-effect-free; duplicate correction,
changed-payload idempotency, and unknown-version tests pass; no AI or economy module
owns progression logic.
```

## Phase 2 — Economy policy and Pursuit catalog

```text
Prerequisite: Phase 1 contracts are accepted.

Goal: implement economy boundaries and validate the complete seed catalog.

1. In economy, implement Shards, Crowns, commerce, entitlement, and economy-tuning
   policy only. Add invariant tests proving money, subscriptions, entitlements,
   purchased currency, and future boosts cannot alter XP, streaks, rank, or competition.
2. Author all 140 Pursuits listed in pursuit-catalog.md against the current schemas.
   Every Pursuit needs meaningful Chapters and exits, domain weights, goal type,
   effort band, applicable tools, evidence kinds, knowledge slots, safety class, and
   at least three anti-patterns.
3. Implement validate:pursuits for schema, uniqueness, weight sum, coverage, source,
   safety, exit-condition, and placeholder checks.
4. Implement resolver tests with messy, vague, impossible, local, safety-sensitive,
   and time-sensitive goals. Below the approved threshold, return the generic scaffold
   and a candidate; do not weaken safety or grounding.

Exit criteria: economy isolation tests pass; all 140 Pursuits pass validation with no
stubs; resolver quality is reported by domain and failure class; every legacy catalog
item used is recorded in the legacy inventory as extracted or rewritten.
```

## Phase 3 — PostgreSQL, ledger, Unit of Work, and outbox

```text
Prerequisites: Phases 1 and 2 are green, and the guest-retention question in SPEC.md is resolved.

Goal: make trusted progression atomic, replayable, and safe under concurrency.

1. Configure Prisma 7 using prisma.config.ts, explicit generated-client output,
   @prisma/adapter-pg and pg. Use Neon's pooled runtime URL with bounded pool size,
   idle timeout, and connection timeout. Migrations never run in request handlers.
2. Model relational content separately from the progression/economy ledger. Include
   principal aliases, command idempotency records, award records, immediate projections,
   evidence metadata, deletion tombstones, and the outbox.
3. Implement db.UnitOfWork.run with transaction-scoped repositories. Prisma types may
   not escape db and repositories may not open autonomous nested transactions.
4. Enforce event ID, aggregate sequence, command uniqueness, request hash, and one-time
   correction in PostgreSQL. Use explicit locks/version checks and bounded retries.
5. Atomically append facts, write awards, update allowed projections, and enqueue the
   outbox. Provisional awards update pending state only.
6. Build projection replay with per-aggregate quarantine, checkpoint/catch-up, and an
   authorized swap path.
7. Use expand-migrate-contract and test the empty schema plus the previous compatible
   application version.

Exit criteria: real-Postgres tests cover simultaneous completions/spends, rollback,
changed-payload retry, correction, provisional promotion/reversal, malformed append,
N/N-1 compatibility, quarantine, and byte-equivalent incremental versus rebuilt state.
```

## Phase 4 — API, guest identity, and safe Mission generation

```text
Prerequisite: Phase 3 is green.

Goal: expose the application boundary for value-before-signup Mission generation.

1. Implement API use cases for guest creation, goal intake, Mission generation, reads,
   completion, account claim, export, and deletion. Every use case receives ActorContext.
2. Implement secure guest tokens and cookies, origin/CSRF checks, rotation, expiry,
   canonical principal aliases, and an idempotent Clerk claim. Test new-account,
   existing-account, already-claimed, expired, and in-flight-command races.
3. Implement the request-scoped AI pipeline from product-rules.md. API supplies identity,
   clock, knowledge snapshot, safety policy, deadlines, IDs, persistence, and outbox.
4. Publish @zandegi/api/client and versioned tRPC/SSE contracts. Only individually
   validated Chapter previews stream; exactly one accepted terminal result persists.
5. Abort before acceptance starts. Once acceptance begins, finish it and let retry with
   the same key discover the committed Mission.
6. Add authorization, rate limits, correlation IDs, safe errors, content redaction, and
   application deadlines below Vercel limits.

Exit criteria: contract fixtures decode in a minimal web client; generation tests cover
unsafe/stale/ungrounded output, malformed frames, timeout, disconnect, retry, duplicate
terminal frames, and commit races; guest claim never loses or duplicates progress.
```

## Phase 5 — Tools, evidence, and internal scheduling

```text
Prerequisite: Phase 4 is green.

Goal: support trusted action without external integrations.

1. Implement the MVP tool transitions selected by approved stories. Tools return state
   and candidate facts; API loads/saves versioned state and creates server attestations.
2. Implement private Vercel Blob through the storage port. Use one-time upload authority,
   authenticated reads or short-lived signed delivery, a narrow allowlist, size limits,
   MIME sniffing, hash verification, quotas, and ownership checks.
3. Implement pending, uploaded, scanned/restricted-check, verified/rejected, deleting,
   and deleted evidence states plus confirmation timeout, orphan sweep, and deletion retry.
4. Implement the internal scheduler for availability, energy preference, recovery gaps,
   deadline pressure, and non-punitive rescheduling within 48 hours.
5. Complete only through the API command path. Opening a tool or uploading a file is not
   itself rewardable.

Exit criteria: ownership, forged fact, replay, concurrent transition, expired token,
wrong MIME, oversized file, missing/replaced object, quota, orphan cleanup, deletion,
and log-redaction tests pass; no external calendar or provider code exists.
```

## Phase 6 — Async reliability, erasure, and operations

```text
Prerequisite: Phase 5 is green.

Goal: make side effects and recovery dependable enough for production.

1. Build the Inngest cron-triggered outbox relay with leased SKIP LOCKED batches,
   stable message/dedupe IDs, acknowledge-after-acceptance, retry/backoff, dead-letter,
   operator replay, and oldest-undelivered-age monitoring.
2. Verify Inngest signatures and least-privilege system actors. Keep Postgres-backed
   idempotency beyond provider dedupe windows.
3. Set the Vercel serve-route maxDuration and Inngest checkpoint runtime to 60-80% of it.
4. Implement the retryable export/deletion workflow across Clerk, PostgreSQL, Blob,
   Redis, queued jobs, projections, telemetry, and backup expiry.
5. Configure Vercel syd1, Neon ap-southeast-2, Upstash Sydney primary, Blob Sydney,
   and separate environment identities. Refuse preview-to-production combinations.
6. Define logs, metrics, alerts, budget limits, critical-loop SLOs, RPO/RTO, backup
   restore, projection rebuild, deployment rollback, and incident replay in RUNBOOK.md.

Exit criteria: delivery-before-ack failure, lease recovery, duplicate delivery, poison
message, job-auth failure, deletion retry, backup restore, projection rebuild, and
environment-isolation drills pass in a production-like environment.
```

## Phase 7 — Web MVP experience

```text
Prerequisite: Phase 6 is green.

Goal: deliver the complete MVP journey on web without moving rules into the UI.

1. Use the BMad UX workflow to create DESIGN.md and EXPERIENCE.md before UI construction.
   Preserve the product-rules presentation commitments.
2. Build web screens through @zandegi/api/client and client-safe core contracts only:
   landing/goal intake, validated Mission reveal, Mission detail, Today/schedule,
   eligible tools/evidence, Character/progression, account claim, export, and deletion.
3. Show progression as pending until server acceptance. Do not display a generated XP
   promise or a generic percentage for OUTCOME goals.
4. Use platform-neutral tokens and web primitives from ui. Keep screens and controls
   web-native; do not pre-build a mobile abstraction.
5. Meet keyboard, WCAG AA, reduced-motion, stable loading/error, light/dark, and 375px
   requirements. Gold appears only on earned value.

Exit criteria: the Postgres-backed guest -> API -> Mission -> completion -> ledger,
award, projections, outbox -> replay -> web decode slice passes; screenshots and manual
checks cover 375px and desktop, light/dark, keyboard, reduced motion, and failure states.
```

## Phase 8 — MVP release gate

```text
Prerequisite: Phase 7 is green.

Goal: prove the defined MVP is safe, recoverable, affordable, and deployable.

1. Run adversarial safety tests for clinical, eating-risk, self-harm-adjacent,
   financial, legal, age, guest-claim, evidence, and prompt-injection boundaries.
2. Run concurrency, idempotency, replay, compensation, rolling-version, deletion,
   outbox, backup/restore, and environment-isolation suites.
3. Measure validated Mission p50/p95, critical-loop latency/availability, and inference,
   database, job, cache, and Blob cost. Configure alerts and budgets from evidence.
4. Test a clean deploy and rollback using expand-migrate-contract compatibility.
5. Complete legal/privacy review for the actual MVP data, age handling, export, deletion,
   evidence, and AI usage. Do not claim regulated or professional services.
6. Reconcile BUILD-LOG.md, the legacy inventory, the spec, and the architecture so no
   scaffold, deferred capability, or unresolved blocker is described as shipped.

Exit criteria: canonical verification and all production gates pass; both SPEC open
questions are resolved; RUNBOOK.md is exercised; no MVP flow depends on mobile, billing,
social features, or an external integration.
```

## Explicitly deferred

Do not add these to an MVP phase without an approved spec update: mobile/offline, billing/subscriptions, shops/currency purchases, seasons, crews, feeds, duels, leaderboards, schools, referrals, health/fitness/GitHub/banking/screen-time/music integrations, or external calendar sync.

## Standing implementation rules

```text
Read the canonical spec and architecture before editing. Stay inside the current phase.
Do not import legacy code. Do not let a model, payment, subscription, entitlement,
purchased currency, or mere tool use influence progression. Do not trust client totals,
timestamps, facts, ownership, or authorization. Do not expose raw model output. Do not
store personal content in the immutable ledger. Do not add deferred integrations.
Post the plan, affected architecture decisions, and file list before writing code; end
with the canonical verification result and any remaining mismatch in BUILD-LOG.md.
```
