# Architecture Rubric Review — Zandegi

**Reviewer:** Architecture rubric walker  
**Reviewed:** `ARCHITECTURE-SPINE.md` and `LEGACY-EXTRACTION-AND-REPAIR-PLAN.md`  
**Repository evidence:** `CLAUDE.md`, `docs/SPEC.md`, root/package manifests, `packages/core`, `packages/ai`, `apps/web`  
**Mechanical lint:** Pass — 0 findings  
**Verdict:** **Changes required before implementation handoff.** The spine has a strong paradigm, package ownership model, data-integrity posture, and operational seed, but several remaining gaps can still produce incompatible implementations in the exact foundations the document is intended to bind.

## Gate Summary

The spine succeeds at the broad architecture contract:

- The modular-monolith / functional-core / imperative-shell paradigm is named and mapped.
- Progression and economy event sourcing are bounded instead of applied indiscriminately.
- Each AD has syntactically complete Binds, Prevents, and Rule sections.
- Deployment, environment isolation, evidence storage, privacy, safety, legacy extraction, and version policy are all represented.
- The companion plan correctly treats legacy as an extraction source and establishes a dependency-safe build order.
- The known brownfield seam (`apps/web` directly orchestrating `@zandegi/ai`) is acknowledged.

The gate should not pass yet because the trusted-award boundary, dependency graph, anti-abuse ordering, outbox dispatch, and production operations remain underspecified. The companion plan is also not yet “implementation-ready” after Phase 0: most later phases lack acceptance criteria, concrete outputs, and a legacy disposition inventory.

## High Findings

### H1 — The authoritative effort input for XP is not defined

**Why this matters:** AD-5 correctly states that model-produced duration, difficulty, priority, and rarity cannot determine progression. It then says award calculators accept “server-observed verified effort or authored/fixed policy inputs” and generic steps use a neutral policy. Those alternatives are materially different reward systems. Two builders could legitimately choose actual elapsed minutes, authored step bands, verification-tier constants, or a hybrid and award different XP for the same completion.

**Repository evidence:**

- `packages/ai/src/stages/07-score.ts` currently calculates `baseXp` from the model-produced `estimatedMinutes`.
- `packages/ai/src/types.ts` places `baseXp` and completion XP inside AI-owned `ScoredMission` types.
- `apps/web/src/components/mission-review.tsx` displays those generated XP values.
- `packages/core/src/scoring/xp.ts` still accepts `estimatedMinutes` as a scoring input.
- `docs/SPEC.md` describes the estimate-based formula, while `CLAUDE.md` forbids model-assigned progression numbers.

The companion plan states the correction but does not name all affected contracts or decide the replacement input model.

**Required disposition:** **Discuss, then amend AD-5 and the plan.** Bind one award-input policy for each MVP verification method and distinguish planning estimates from authoritative completion evidence. State whether pre-completion XP is hidden, shown as a non-binding estimate, or derived from an authored policy band. Add explicit repair items for AI `Scored*` types, the scoring stage, generated event payloads, web API/client types, and current XP preview UI.

### H2 — The package dependency diagram conflicts with the client-sharing rule and current code

**Why this matters:** The diagram permits apps to depend only on `api`, but AD-9 says web/mobile share `core` rules, validation schemas, design tokens, and an API client. The diagram also shows `ui -> core`, without showing apps consuming `ui`, and does not identify where the shared API client lives. “Apps contain no business rules” does not tell a builder which `core` exports are safe in a client bundle.

**Repository evidence:**

- `apps/web/package.json` directly depends on `@zandegi/ai`.
- `apps/web/src/app/generate/generation-flow.ts`, `generator-state.ts`, and `components/mission-review.tsx` import AI-owned public types.
- `apps/web/next.config.mjs` transpiles both `@zandegi/core` and `@zandegi/ai`.
- `packages/ui` is currently an empty scaffold described as a shared component library and token package.

The Phase 0 “generation seam” repairs the route orchestration but does not require removal of client-to-AI type coupling.

**Required disposition:** **Autofix after choosing the intended graph.** Either show approved app dependencies on a client-safe `core` surface and `ui`, or split public contracts/client artifacts into a separate entry point/package. Explicitly forbid apps from importing `ai`, `db`, and server-only core policy. Extend Phase 0 to replace every web import of AI pipeline types with API-owned public response/stream contracts.

### H3 — The transactional outbox has no bound relay ownership or serverless dispatch model

**Why this matters:** AD-4 introduces a relay that claims outbox rows and delivers them to Inngest, but neither the structural seed nor the deployment topology says where that relay runs, what wakes it, or which package owns it. On Vercel/Neon, builders could choose post-commit sends, a Vercel cron poller, an Inngest poller, a database trigger, or a separate worker. These choices have different atomicity and recovery guarantees.

“Handlers are idempotent, retryable, observable, and dead-letter failures” also leaves claim leases, duplicate sends, poison rows, recovery after delivery-before-ack, and dead-letter ownership undefined.

**Required disposition:** **Discuss and bind in AD-4/AD-11.** Choose the relay owner and trigger model; require a claim/lease state machine, stable delivery ID, retry/backoff policy, poison/dead-letter state, and operator replay path. Add its deployable location to the tree/topology and concrete acceptance tests to Phase 7.

### H4 — Trust/provisional-XP ordering is missing from the atomic consistency rule

**Why this matters:** AD-1 makes trust an immutable ledger fact, and the source specification makes low trust turn awards provisional and exclude them from leaderboards. AD-4’s atomic transaction updates `XpAward`, `Character`, `DomainStat`, `Streak`, and `Wallet`, but omits the trust projection and does not state whether risk evaluation happens before or after the award decision. Two implementations could issue different provisional status and immediate projections for the same evidence.

**Required disposition:** **Discuss and amend AD-4.** Define whether trust/risk evaluation is synchronous policy inside completion, an asynchronous flag that creates compensating events, or both with a precise boundary. Bind how provisional awards affect Character/DomainStat/Streak, caps, celebrations, feeds, and later promotion/reversal. Add replay tests covering trust changes and provisional-to-final transitions.

### H5 — The “implementation-ready” companion is phase-oriented but not execution-ready beyond Phase 0

**Why this matters:** Only Phase 0 has explicit acceptance criteria. Phases 1–9 name broad outcomes but not the concrete contracts, migrations, commands, tests, dependencies, or completion gates a developer should produce. The plan also requires every legacy capability/test group to be marked extracted, rewritten, rejected, or deferred, but supplies no inventory or status table. That makes the deletion gate non-executable and leaves extraction coverage subjective.

**Required disposition:** **Autofix the companion plan.** For Phases 1–8, add at least: outputs/artifacts, prerequisite phase, acceptance tests, migration/cutover notes, and explicit exclusions. Add a legacy inventory table with source path/capability, disposition, replacement target, characterization test, status, and rationale. Link each phase to the governing ADs.

### H6 — The production operational envelope is mentioned but not fully decided or deferred

**Why this matters:** At initiative altitude and with a stated purpose of repairing “production foundations,” the spine must cover operations. It requires observability, alerts, quotas, redaction, backup retention, and tested recovery but selects no telemetry/error-monitoring path, service ownership, SLOs, restore objective, or incident/replay workflow. Separate builders can choose incompatible logging schemas and monitoring providers, while “observable” and “documented” are not testable release gates by themselves.

**Required disposition:** **Discuss or explicitly defer with a pre-production gate.** At minimum bind structured log fields/redaction boundary, request/correlation propagation, metrics and alert ownership, availability/latency targets for the critical loop, database backup/restore test expectations, and RPO/RTO. If providers remain open, put provider selection and operational thresholds in Deferred with a mandatory revisit before production—not merely before scale.

## Medium Findings

### M1 — Guest retention is deferred even though guest onboarding is in the technical MVP

AD-7 requires expiry under a documented policy, while Deferred leaves the expiry period open and the plan schedules guest creation/claim in Phase 5. The plan is therefore not implementation-ready for guest persistence, cleanup, cookie lifetime, or privacy disclosure.

**Disposition:** Move the duration and cleanup/claim-conflict semantics into a pre-Phase-5 decision gate, or choose them in the spine. Include simultaneous signup, expired guest, already-claimed guest, and account-with-existing-progress cases.

### M2 — Account erasure around an immutable ledger needs a concrete tombstone/replay model

AD-12 says the principal-to-ledger mapping is erased while pseudonymous integrity facts may remain. It does not specify whether the subject identifier is irreversibly transformed, how projection rebuild skips erased principals, how shared crew/duel/feed records are repaired, or whether anti-abuse retention prevents immediate guest/account recreation.

“Where legally permitted” is a policy escape hatch rather than an enforceable rule.

**Disposition:** Add a deletion dataflow or schema-level invariant, plus acceptance cases for export, primary deletion, Blob deletion, outbox cleanup, backup expiry, projection rebuild, and shared/social references. Legal retention choices may remain a pre-launch open item, but the technical erasure mechanism must bind before schema implementation.

### M3 — Evidence lifecycle rules are incomplete

AD-10 binds immutable keys, ownership, hashes, deletion, and retention metadata, but no retention states or orphan-reconciliation protocol are defined. “Deleted with its owning record or retention job” allows synchronous deletion, eventual deletion, or indefinite orphaning after partial failure.

**Disposition:** Before Phase 6, define upload states (`issued/uploaded/confirmed/rejected/deleting/deleted` or equivalent), confirmation timeout, orphan sweep ownership, deletion retry semantics, and malware/content scanning posture. If malware scanning is out of MVP, say so explicitly and cap accepted file classes accordingly.

### M4 — Content freshness and source policy are not testable enough

AD-8 says a claim ships only when a source satisfies “freshness policy,” but the policy owner, TTL selection, source-quality rules, and behaviour when lookup is unavailable are absent. The current `packages/ai/src/grounding.ts` uses broad date-window heuristics rather than per-knowledge policy.

**Disposition:** Bind the owner of freshness policy and require per-slot/type TTL plus fail-closed behaviour for hard claims. Provider choice can remain deferred, but acceptance criteria should cover stale cache, lookup outage, conflicting sources, and safety rewrites that introduce new claims.

### M5 — Stack rows mix target state with current repository reality

The Stack section reads as a current structural seed, but Next is currently 15.5.25, root manifests still declare Node `>=20.11.0`, TypeScript is declared as `^5.7.2`, and Prisma/tRPC/Clerk/Inngest/Blob are not yet installed in the scaffold packages. The plan does identify upgrades, but a builder can misread the table as verified current state.

**Disposition:** Label the table “target foundation versions” or split current and target state in the companion. Ensure Phase 0/each installation phase reconciles manifests and lockfile to the table. Do not mark the spine final while its package-manager seed is known not to bootstrap reproducibly.

### M6 — Billing/social are architecturally bound but their implementation status is easy to misread

Frontmatter binds `billing-social`, the capability map assigns their components, and AD-5/AD-11 set invariants, while the companion places them in Phase 9 and excludes them from the technical MVP. This is logically compatible, but the spine does not itself mark these capabilities post-MVP, and its Deferred section mentions only integrations.

**Disposition:** Add an explicit release-scope note or Deferred entry saying the architecture constrains billing/social when built but does not authorize them for MVP implementation. This prevents an agent from treating capability-map presence as current scope.

## Low Findings

### L1 — Environment-isolation diagram does not show isolation

The `Isolation` subgraph contains disconnected `DEV` and `PROD` nodes. It does not show which Vercel, Neon, Clerk, Blob, Upstash, or Inngest resources belong to either environment.

**Disposition:** Replace it with two small provider stacks or an environment/resource matrix.

### L2 — Several rule terms need glossary-level precision

Terms including “eligible action,” “qualifying evidence,” “fixed neutral policy,” “claim,” “accepted inputs,” and “provider data” are load-bearing but undefined. Their owners can infer different meanings.

**Disposition:** Define them in core contracts or add a short terminology convention linking each term to its owning schema/policy.

### L3 — Projection rebuild ownership is split ambiguously

The capability map places rebuild in `core`, `db`, `api`, and Inngest. The plan asks for a runbook, but it does not state whether rebuild is an offline administrative command, a background job, or an API use case, nor how writes are fenced during swap-over.

**Disposition:** Before Phase 4 acceptance, bind the rebuild execution path, checkpoint/swap strategy, write-fencing or catch-up method, and operator authorization.

## Checklist Assessment

| Rubric item | Result | Notes |
| --- | --- | --- |
| Fixes real divergence points for the level below | **Partial** | Strong boundaries; award inputs, trust ordering, relay, and operations still diverge. |
| Every AD rule is enforceable and prevents its stated divergence | **Partial** | Most do; AD-5, AD-8, AD-11, and AD-12 contain undefined policy terms or “documented/observable” obligations without gates. |
| Nothing deferred can cause incompatible implementation | **Fail** | Guest expiry/offline semantics are deferred while guest is MVP; operational choices are not deferred at all. |
| Named technology is verified/current | **Partial** | Target versions were researched, but the Stack does not distinguish target from current manifests and pnpm bootstrap is broken. |
| Ratifies rather than contradicts brownfield code | **Partial** | Contradictions are recognized, but direct client-to-AI types and generated XP coupling are not fully enumerated in the repair plan. |
| Covers spec capabilities | **Pass with reconciliation debt** | Capability map is broad; source documents still contradict the spine on XP ownership, tool rewards, paid streak/XP effects, integrations, and `MissionGenerated`. |
| Operational/environmental envelope covered | **Partial** | Provider topology and isolation are present; monitoring, SLOs, restore, relay execution, and incident operations are incomplete. |
| Companion provides implementation-ready handoff | **Fail** | Strong sequence, but only Phase 0 has acceptance criteria and no executable legacy inventory exists. |

## Recommended Gate Decision

Do not finalize yet. Resolve H1–H4 as architecture decisions, expand the companion for H5, and either bind or explicitly pre-production-defer H6. The remaining medium/low findings can be fixed directly if their policies are already known; otherwise give each a named revisit gate before the phase that depends on it.

## Closure check

**Verdict: Blocked on one remaining terminology/contract mismatch.**

- **Closed:** H2–H6. The revision now binds client-safe imports and removes web-to-AI coupling in Phase 0; selects the outbox relay, lease, acknowledgement, dedupe, and dead-letter model; defines synchronous risk and provisional award behaviour; adds phase outputs/gates and a legacy inventory register; and makes observability, restore, SLO, RPO, and RTO explicit production-launch gates.
- **Closed or safely gated:** M1–M3 and M5–M6. Guest retention is a required pre-schema feature decision, deletion and evidence lifecycles are concrete, target stack is distinguished from current state, and billing/social are explicitly post-MVP. The source-freshness policy is now owned through core `KnowledgeSnapshot`/`FreshnessDecision` contracts and Phase 1 fixtures; exact TTL values may remain content policy.
- **Remaining blocker (H1 partial):** AD-5 and the plan define MVP awards for `CHECK`, `TIMER`, `CAPTURE`, and `TOOL`, but the repository’s canonical `VerificationMethod` is `SELF | TIMER | ARTIFACT | METRIC | INTEGRATION`; `CHECK` is not a current method, while `CAPTURE` and other tools are tool kinds. As written, authoritative inputs for `SELF`, `ARTIFACT`, and `METRIC` remain unbound and implementers can confuse verification methods with tools. Before finalization, either express the policy directly for the canonical verification methods or introduce and map a separate versioned `AwardEvidenceKind` exhaustively to them. Apply the same vocabulary in AD-5 and Phases 1/6.

### Final blocker recheck

**PASS.** AD-5 now defines the exhaustive `AwardEvidenceKind = SELF | TIMER | ARTIFACT | METRIC | INTEGRATION`, binds an authoritative policy for every kind, and explicitly maps UI/tool actions without creating competing evidence kinds. Phase 1 uses the same exhaustive vocabulary. The final blocker is closed; no material finalization blocker remains from this review.
