# Adversarial compatibility review

## Verdict

**Not implementation-safe for independently working teams yet.** The spine establishes good ownership and product invariants, but several cross-package and cross-process protocols remain described only by intent. Two teams could follow both documents and still produce incompatible event payloads, transaction APIs, idempotency behaviour, stream state machines, identity merges, evidence lifecycles, deletion workflows, or deployments. The findings below are contract gaps rather than objections to the chosen architecture.

## Findings

### 1. Progression tuning has two apparent owners

- **Location:** Architecture Spine, AD-2 and AD-3; Repair Plan, Phases 1 and 2
- **Trigger condition:** A core team implements the versioned award calculator and its tuning inputs while an economy team independently implements “tuning rules”; both can reasonably believe they own multipliers or caps.
- **Guard snippet:** State that `core` exclusively owns progression formulas, progression tuning types, and calculator versions. Restrict `economy` tuning to Shards, Crowns, commerce, and entitlements. Define the exact `AwardPolicySnapshot` that API passes into the core calculator, or move all progression policy into one named package.
- **Potential consequence:** The calculator version stored on an award does not identify the constants actually applied, and replay can produce a different award from the live path.

### 2. The ledger envelope is not a wire contract

- **Location:** Architecture Spine, AD-3 and Consistency Conventions; Repair Plan, Phase 1
- **Trigger condition:** Core defines a Zod union while DB independently chooses column types, nullability, JSON encoding, identifier formats, or whether `subject` is one string or a type/ID pair.
- **Guard snippet:** Publish one canonical `LedgerEnvelopeV1` with exact field names, scalar formats, required/nullable rules, JSON serialization, maximum sizes, and event-type registry. Generate or test the DB mapper against fixtures produced by that schema.
- **Potential consequence:** Valid core events cannot be persisted or replayed by DB without lossy adapters, and different producers serialize the same event differently.

### 3. Schema validation is not fixed at the persistence boundary

- **Location:** Architecture Spine, AD-3; Repair Plan, Phases 1 and 4
- **Trigger condition:** API validates before calling DB, but a rebuild, migration, administrative command, or later repository path writes payload JSON without the same validation.
- **Guard snippet:** Require the single DB append port to accept only a validated discriminated event value or to validate the envelope and payload itself. Store `schemaVersion`, event type, and a canonical payload hash, and test malformed direct appends.
- **Potential consequence:** The append-only ledger permanently accepts unreadable facts even though every application team believes validation belongs elsewhere.

### 4. Upcaster semantics can change historical meaning

- **Location:** Architecture Spine, AD-3; Repair Plan, Phase 1
- **Trigger condition:** One team treats upcasters as shape-only adapters while another recomputes missing values using current tuning or current external state.
- **Guard snippet:** Define upcasters as pure, deterministic, side-effect-free shape transformations that may not call current calculators, clocks, databases, or providers. Add golden fixtures from every stored version to the current in-memory type.
- **Potential consequence:** The same historical event yields different projections after a deployment, defeating historically reproducible awards.

### 5. Idempotency scope and conflict behaviour are undefined

- **Location:** Architecture Spine, AD-3, AD-4, AD-9; Repair Plan, Phases 1, 4, and 5
- **Trigger condition:** Web, mobile, and DB independently choose global, per-principal, per-device, or per-command uniqueness for an idempotency ID, or reuse an ID with a changed payload.
- **Guard snippet:** Define an `IdempotentCommand` contract containing operation name, canonical request hash, principal, and client key. Fix the uniqueness tuple, retention period, stored response shape, and rule that the same key plus a different request hash returns a stable conflict.
- **Potential consequence:** Legitimate commands collide across users, or retries with modified payloads double-award or silently return the wrong prior result.

### 6. Event ordering is not deterministic under concurrency

- **Location:** Architecture Spine, AD-3, AD-4, and Time convention; Repair Plan, Phase 4
- **Trigger condition:** Two completion requests for one principal commit close together and projection folds order by `occurredAt`, `recordedAt`, UUID, or database insertion order differently.
- **Guard snippet:** Add a monotonic per-aggregate or per-principal sequence assigned inside the earning transaction, with a uniqueness constraint and documented lock/isolation strategy. Rebuilds order by that sequence, never timestamps.
- **Potential consequence:** Streak, caps, wallet balance, trust, and correction folds differ between incremental processing and replay.

### 7. API transaction ownership lacks a usable DB protocol

- **Location:** Architecture Spine, AD-2 and AD-4; Repair Plan, Phase 4
- **Trigger condition:** API owns transactions but DB is meant to hide Prisma. One team exposes `Prisma.TransactionClient`; another exposes isolated repository calls that each open their own transaction.
- **Guard snippet:** Specify a DB-owned `UnitOfWork.run(callback)` port and the complete transaction-scoped repository set passed to the callback. Forbid Prisma types outside `db`, nested autonomous transactions, and non-transactional projection writes on earning paths.
- **Potential consequence:** The packages compile only after leaking infrastructure types into API, or the allegedly atomic completion is split across commits.

### 8. Isolation and locking rules do not prevent lost updates

- **Location:** Architecture Spine, AD-4; Repair Plan, Phase 4
- **Trigger condition:** DB implements read-modify-write projection updates at default isolation while simultaneous completions or spends target the same wallet or streak.
- **Guard snippet:** Name the concurrency mechanism for each aggregate: atomic SQL updates with checked versions, row locks, advisory locks, or serializable retries. Define retryable database errors and the maximum retry policy at the Unit of Work boundary.
- **Potential consequence:** Both transactions append valid immutable facts but the immediate projection loses one award or permits overspending.

### 9. Compensation is a slogan, not a protocol

- **Location:** Architecture Spine, AD-1 and AD-3; Repair Plan, Developer Handoff Checklist
- **Trigger condition:** Core creates a generic correction event while API or economy expects typed reversal events, or a correction reverses XP without specifying effects on domains, streak milestones, caps, Shards, and downstream notifications.
- **Guard snippet:** Define typed compensation events per reversible fact, require `causationId`/`correctsEventId`, preserve the original award inputs and sign, and specify which projections and secondary rewards reverse. Include replay fixtures for correction-after-spend and repeated correction.
- **Potential consequence:** Correcting XP leaves wallet, domain stats, streaks, or competitive state inconsistent, or permits the same fact to be reversed twice.

### 10. The outbox wire format and delivery handshake are unspecified

- **Location:** Architecture Spine, AD-4 sequence; Repair Plan, Phases 4 and 7
- **Trigger condition:** DB emits an outbox row with a ledger payload while the relay expects an API notification schema, or the relay marks a row delivered before Inngest durably accepts it.
- **Guard snippet:** Publish `OutboxMessageV1` with message ID, topic, schema version, correlation/causation, created time, safe payload, partition key, and dedupe key. Define claim lease, acknowledgement point, retry/backoff, terminal state, and handler dedupe storage.
- **Potential consequence:** Messages are lost between PostgreSQL and Inngest or delivered in a form no deployed handler understands.

### 11. Background jobs have no actor or authorization contract

- **Location:** Architecture Spine diagram and AD-2; Repair Plan, Phase 7
- **Trigger condition:** Inngest handlers “call API use cases” that expect a Clerk session or guest cookie, while another team bypasses authorization by calling repositories directly.
- **Guard snippet:** Define an `ActorContext` discriminated union for user, guest, system job, and admin. Enumerate which use cases accept system actors and require a verified Inngest signature plus least-privilege capability for each handler.
- **Potential consequence:** Jobs either cannot call the application layer or acquire an undocumented authorization bypass.

### 12. Rolling deployment compatibility for event versions is absent

- **Location:** Architecture Spine, AD-3, Migrations convention, and AD-11; Repair Plan, Phases 1, 4, and 7
- **Trigger condition:** A new API starts writing schema version 2 while old Vercel instances, relay processes, or Inngest handlers still understand only version 1.
- **Guard snippet:** Define a producer/consumer rollout protocol: deploy tolerant readers first, advertise minimum consumer version, gate new writers behind a feature flag, and retain old readers until queues drain. Add compatibility fixtures for N and N-1 versions.
- **Potential consequence:** Valid new events fail closed in old workers, block projection rebuilds, or enter dead-letter during an ordinary rolling deployment.

### 13. “Fail closed” can halt unrelated replay indefinitely

- **Location:** Architecture Spine, AD-3; Repair Plan, Phases 1 and 7
- **Trigger condition:** A projection rebuild encounters one unknown or corrupt version in a principal’s stream.
- **Guard snippet:** Specify whether replay stops per principal, per aggregate, or globally; persist a quarantine record with event identity and operator action; never skip silently; and define how unaffected principals continue while earned state for the affected principal is marked unavailable.
- **Potential consequence:** One malformed event either takes the whole system offline or is skipped differently by separate projection implementations.

### 14. Generation streaming has no normative state machine

- **Location:** Architecture Spine, AD-6 and AD-8; Repair Plan, Phases 0 and 5
- **Trigger condition:** AI considers a chapter validated after local grounding, while API waits for whole-mission safety, or web accepts duplicate/late terminal frames differently from mobile.
- **Guard snippet:** Define a versioned stream protocol with allowed frame types, ordering, exactly one terminal frame, chapter-release gate, request/run ID, reconnect behaviour, and rules for errors after a released chapter. State explicitly that streamed chapters are previews until the final accepted terminal result unless they are independently durable.
- **Potential consequence:** A client displays content the server later rejects, persists a partial mission, or hangs because its terminal-event expectation differs from the adapter.

### 15. Disconnect and persistence race semantics are unclear

- **Location:** Architecture Spine, AD-8; Repair Plan, Phase 5
- **Trigger condition:** The client disconnects after model completion but before or during API persistence, or a proxy fails to propagate cancellation promptly.
- **Guard snippet:** Define the commit cutoff: for example, abort before persistence begins; once the acceptance transaction starts, finish it and make retry idempotently discover the committed mission. Give every generation attempt a server run ID and specify whether a client retry creates or retrieves a result.
- **Potential consequence:** Retrying after a network drop creates duplicate missions or loses a mission that was committed but never acknowledged.

### 16. Knowledge freshness ownership spans three packages without a handoff

- **Location:** Architecture Spine, AD-8; Capability map
- **Trigger condition:** DB stores TTL metadata, API assembles a snapshot, and AI validates sources, but each team applies freshness at a different time or with a different clock.
- **Guard snippet:** Define a core `KnowledgeSnapshot` and `FreshnessDecision` contract. API supplies one injected evaluation instant; DB returns source/fetched/expiry facts; AI may only consume entries marked acceptable or return claims for API/core validation against that same instant.
- **Potential consequence:** A mission passes AI validation using a source that API or admin considers stale, or freshness changes during one request.

### 17. Tool facts lack an authority and attestation model

- **Location:** Architecture Spine, AD-2, AD-5, and AD-10; Repair Plan, Phase 6
- **Trigger condition:** A tool team returns `{ verified: true }`, API interprets any tool result as qualifying evidence, or a client fabricates a structurally valid fact.
- **Guard snippet:** Put a versioned `VerifiedFact` union in core with issuer, method, subject, evidence reference, observed time, confidence/policy fields, and server attestation. API creates the attestation only after invoking a registered tool transition with server-owned prior state; clients can submit commands, never facts.
- **Potential consequence:** Structurally valid but untrusted client data enters the award calculator and earns XP.

### 18. Tool-state persistence is unowned

- **Location:** Architecture Spine, AD-2 and Structural Seed; Repair Plan, Phase 6
- **Trigger condition:** Tools implement state machines but cannot import DB or API, while DB has no stated schema or repository contract for tool instances and transitions.
- **Guard snippet:** Define tool state and transition contracts in `tools`, persistence records and optimistic versions in `db`, and an API orchestration sequence that loads state, invokes the pure transition, validates facts, and saves through one Unit of Work.
- **Potential consequence:** Each tool invents its own persistence escape hatch or transitions race and overwrite one another.

### 19. Evidence lifecycle states and trust checks are incomplete

- **Location:** Architecture Spine, AD-10; Repair Plan, Phase 6 and handoff checklist
- **Trigger condition:** Storage issues a direct-upload token and DB independently treats the upload callback, client-reported hash, MIME header, or object existence as proof of a completed artifact.
- **Guard snippet:** Define states such as `pending`, `uploaded`, `scanned`, `verified`, `rejected`, and `deleted`; require server retrieval of object metadata, size, MIME sniffing, hash, ownership, and one-time token binding before verification. Add per-principal quotas and malware policy.
- **Potential consequence:** Missing, replaced, oversized, mislabeled, or malicious blobs become qualifying evidence or create unbounded storage cost.

### 20. Evidence deletion conflicts with immutable completion facts

- **Location:** Architecture Spine, AD-10 and AD-12
- **Trigger condition:** Evidence is deleted with its owning relational record while a ledger event or award retains an evidence reference required for audit or later correction.
- **Guard snippet:** Store only an opaque evidence attestation ID and minimal verification snapshot in the ledger. Define deletion semantics for the referenced attestation, prohibit ledger foreign keys with cascading deletion, and state whether deletion leaves an unavailable attestation without reversing an already accepted award.
- **Potential consequence:** Account deletion breaks replay through dangling constraints, or preserving auditability accidentally preserves personal file identifiers and metadata.

### 21. Guest claim does not specify merge identity semantics

- **Location:** Architecture Spine, AD-7 and Auth convention; Repair Plan, Phase 5
- **Trigger condition:** A guest with events signs into an existing Clerk-backed principal. One team reassigns relational rows, another aliases principals, and projection code expects one stable principal ID.
- **Guard snippet:** Choose and document one model: promote the guest principal in place, or create an immutable alias/ownership mapping and aggregate streams through a canonical principal. Specify conflict behaviour when the target already owns data, projection merge/rebuild, idempotency namespaces, and referential updates.
- **Potential consequence:** Claimed XP disappears, duplicates, or remains split across two characters and wallets.

### 22. Guest cookie security and callback races are underspecified

- **Location:** Architecture Spine, AD-7 and AD-10; Repair Plan, Phase 5
- **Trigger condition:** A claim occurs while an upload callback or completion using the old guest cookie is in flight, or an attacker fixes/replays a guest cookie before signup.
- **Guard snippet:** Rotate and invalidate the guest token on claim; bind a hashed, expiring token to the principal; require CSRF/origin checks; define same-site/domain settings for the Clerk flow; and make old-principal operations resolve atomically to the canonical principal or fail with a retryable code.
- **Potential consequence:** Evidence or awards land on an abandoned guest after claim, or another browser claims the guest’s progress.

### 23. Deferred guest retention blocks an MVP dependency

- **Location:** Architecture Spine, Deferred; Repair Plan, MVP Boundary and Phase 5
- **Trigger condition:** DB implements guest expiry and API implements claim before the exact expiry period, activity extension rules, and deletion treatment are decided.
- **Guard snippet:** Promote guest retention from “Deferred” to a prerequisite feature specification before Phase 4 schema work. Fix expiry anchor, renewal activity, warning UX, cleanup ownership, in-flight command handling, and whether evidence expires on the same schedule.
- **Potential consequence:** DB and API encode different expiry rules that lose claimable progress or retain personal content indefinitely.

### 24. Shared API contracts do not define transport representation

- **Location:** Architecture Spine, AD-9 and Consistency Conventions; Repair Plan, Phases 5 and 8
- **Trigger condition:** tRPC, SSE, web, and Expo independently serialize dates, big integers, discriminated errors, optional fields, or Zod defaults.
- **Guard snippet:** Name the transport codec and version policy for tRPC and the separate SSE wire schema. Publish contract fixtures consumed by web and mobile, prohibit transport-only types in core, and define additive versus breaking changes.
- **Potential consequence:** A response typechecks through shared TypeScript source but decodes differently at runtime on web and native clients.

### 25. Offline completion policy is deferred past the contract-freezing phase

- **Location:** Architecture Spine, AD-9 and Deferred; Repair Plan, Phases 1, 5, and 8
- **Trigger condition:** Core and API freeze event/cap/streak semantics before product decides eligible offline methods, accepted timestamp window, timezone validation, and rejected-command UX.
- **Guard snippet:** Define an `OfflineCompletionCommandV1` before Phase 1 closes, including eligibility by verification method, device timestamp bounds, effective policy date, timezone-change rules, signature/attestation needs, expiry, and rejection codes. Explicitly state whether caps and streaks use accepted `occurredAt` or `recordedAt`.
- **Potential consequence:** Mobile cannot implement offline sync without changing supposedly stable ledger contracts, or backdated commands evade caps and repair streaks.

### 26. Deletion is not assigned an implementation phase or cross-service workflow

- **Location:** Architecture Spine, AD-12; Repair Plan, Dependency-Safe Build Sequence
- **Trigger condition:** API, DB, Blob, Clerk, Redis, Inngest, logs, and backups are built independently with no deletion coordinator even though deletion binds all of them.
- **Guard snippet:** Add an MVP deletion/export phase or explicit work items to Phases 4-7. Define a retryable deletion saga, tombstone state, credential revocation, object deletion, cache purge, queued-job suppression, pseudonymization, export schema, completion receipt, and backup expiry evidence.
- **Potential consequence:** “Delete account” succeeds in one system while personal data, active jobs, evidence, or identity links remain elsewhere.

### 27. Pseudonymization can invalidate uniqueness and future account semantics

- **Location:** Architecture Spine, AD-12 and AD-3
- **Trigger condition:** Principal-to-ledger mapping is erased, then the same Clerk identity or email later creates a new principal, while idempotency and subject uniqueness still refer to old pseudonymous facts.
- **Guard snippet:** Define which stable pseudonym, if any, survives deletion, who can resolve it, and whether re-registration links or never links to historical facts. Separate legal audit identifiers from application identity and salt/rotate pseudonyms under a documented policy.
- **Potential consequence:** A returning person unexpectedly recovers deleted progress, or old and new commands collide while the system cannot explain why.

### 28. Migration rollback compatibility is not executable guidance

- **Location:** Architecture Spine, Migrations convention and AD-11; Repair Plan, Phases 0 and 4
- **Trigger condition:** DB deploys a forward-only schema change while old Vercel functions are still live, or an application rollback expects a dropped/renamed column.
- **Guard snippet:** Require expand-migrate-contract deployments, an explicit minimum compatible app version per migration, no destructive contract step until old instances and jobs drain, and automated empty-state plus previous-release compatibility tests.
- **Potential consequence:** A safe application rollback becomes impossible, or rolling instances fail against the new schema despite every migration being “forward-only.”

### 29. Environment isolation is a rule without an enforceable resource identity

- **Location:** Architecture Spine, AD-11; Repair Plan, Phase 0
- **Trigger condition:** A preview build receives a production-looking Neon, Upstash, Blob, Clerk, or Inngest credential through misconfigured Vercel environment variables.
- **Guard snippet:** Give every resource a required environment/tenant identifier and validate it against `VERCEL_ENV` at startup and deployment. Add a CI/deploy check that resolves resource identities without exposing secrets and refuses preview-to-production combinations.
- **Potential consequence:** A preview can mutate production data while all individual credentials remain technically valid.

### 30. The outbox relay has no deployment home or singleton/concurrency design

- **Location:** Architecture Spine, AD-4 and AD-11 diagrams; Repair Plan, Phase 7
- **Trigger condition:** One team implements a Vercel cron relay, another an Inngest poller, or multiple serverless invocations claim the same rows without a shared lease protocol.
- **Guard snippet:** Name the relay runtime, schedule/trigger, batch size, `FOR UPDATE SKIP LOCKED` or equivalent claim mechanism, lease recovery, regional placement, and health metric proving oldest-undelivered age.
- **Potential consequence:** Duplicate dispatch, stuck leases, or no relay at all because each team assumed another platform owned it.

### 31. Serverless duration and streaming settings are not part of the contract

- **Location:** Architecture Spine, AD-8, AD-11, and Stack; Repair Plan, Phases 0 and 5
- **Trigger condition:** AI honors an internal call budget but the Vercel route/function has a shorter platform duration, buffered streaming, or a different region/configuration in preview.
- **Guard snippet:** Commit route runtime, region, maximum duration, Fluid Compute, streaming headers, and proxy-buffer tests as deployment configuration. Make the API budget lower than the platform deadline with an explicit cleanup margin.
- **Potential consequence:** Correct application cancellation code is terminated by the platform, producing premature EOF, abandoned model calls, or unacknowledged commits.

### 32. Acceptance checks do not prove independently built adapters interoperate

- **Location:** Repair Plan, all phase acceptance and Developer Handoff Checklist
- **Trigger condition:** Each package passes its own unit tests using locally invented fakes, but no test runs core fixtures through API, DB, outbox, web, and replay together.
- **Guard snippet:** Add cross-package contract test kits and at least one Postgres-backed vertical slice: guest command -> API -> ledger/award/projections/outbox -> replay -> client decode. Run the same golden fixtures against current and previous compatible versions.
- **Potential consequence:** Every team reports green tests while integration fails at serialization, transaction, identity, or retry boundaries.

## Required closure before parallel implementation

The architecture can support parallel teams after it adds four normative companion contracts:

1. A versioned ledger/idempotency/compensation protocol with golden fixtures and ordering rules.
2. A DB Unit of Work plus outbox protocol, including concurrency, relay, and deployment compatibility.
3. Versioned generation-stream, tool-fact, evidence-lifecycle, and client transport protocols.
4. Canonical identity/guest-claim, offline timestamp, deletion, and environment-isolation workflows.

Until those exist, adjacent teams should not independently implement both sides of these boundaries.

## Closure check

### Verdict

**Pass at architecture altitude.** The revised spine and plan close the compatibility blockers or turn the remaining detail into explicit, dependency-ordered gates. Independent foundational implementation is safe only after each upstream contract/gate is accepted; the documents no longer imply that both sides of an unfixed boundary may be built concurrently.

### Closed by the revised architecture

- **Finding 1 — progression ownership:** AD-2 now gives progression formulas and progression tuning exclusively to `core`; `economy` is limited to currency, commerce, entitlement, and economy tuning.
- **Findings 2-4 — ledger shape, persistence validation, and upcasters:** AD-3 now requires `LedgerEnvelopeV1`, an event registry, exact wire rules and fixtures, canonical hashing, DB-boundary revalidation, and pure shape-only upcasters.
- **Findings 5-9 — idempotency, ordering, Unit of Work, concurrency, and compensation:** AD-3/AD-4 now fix the command uniqueness tuple and request hash, monotonic aggregate sequence, `db.UnitOfWork.run`, non-leaking transaction repositories, lock/version checks, bounded retries, typed corrections, and one-correction semantics. Phase 1 and Phase 4 make the executable contracts and concurrency tests prerequisites.
- **Findings 10-13 — outbox, job actors, rolling versions, and quarantine:** AD-4 names `OutboxMessageV1`, leased `SKIP LOCKED` delivery, acceptance acknowledgement, durable dedupe, dead-letter/replay, and signed system actors. AD-3 scopes quarantine to the affected aggregate; the deployment convention requires N/N-1 readers before N writers.
- **Findings 14-16 — stream protocol, disconnect race, and knowledge freshness:** AD-8 now owns versioned stream, knowledge snapshot, and freshness contracts in `core`, fixes frame/terminal behaviour, defines the persistence cutoff and idempotent discovery after acceptance begins, and uses one API-supplied clock instant.
- **Findings 17-18 — tool attestation and state ownership:** AD-2/AD-5 define pure tool transitions, candidate facts, server-attested `VerifiedFact`, core-owned progression policy, DB persistence, and API orchestration. Phase 6 cannot begin before the relevant Phase 1 and Phase 4 contracts exist.
- **Findings 19-20 — evidence lifecycle and immutable-ledger deletion:** AD-10 now fixes lifecycle states, one-time authority, independent object checks, quotas, a narrow allowlist, opaque attestations, non-cascading ledger references, deletion semantics, and orphan cleanup.
- **Findings 21-22 — guest merge and cookie races:** AD-7 now selects promotion-in-place for new accounts and canonical-principal/immutable-alias semantics for existing accounts, with idempotent claim, cookie rotation, origin/CSRF protection, ownership transfer, rebuild combination, and retryable in-flight conflicts.
- **Finding 24 — transport representation:** AD-9 and the transport convention now require versioned JSON fixtures, ISO UTC strings, safe integers, explicit nullability, stable errors, and a separate versioned SSE union.
- **Findings 26-27 — deletion and pseudonymization:** AD-12 now defines the API-owned deletion saga, tombstone, credential/job/cache/object handling, non-resolvable salted pseudonym, projection treatment, non-reconnection on registration, and backup-expiry evidence. Phases 5 and 7 assign implementation and launch gates.
- **Findings 28-31 — migrations, environment isolation, relay deployment, and serverless limits:** The deployment conventions and AD-11 now require expand-migrate-contract, N/N-1 compatibility, explicit Sydney resources, environment identity checks, an Inngest cron-triggered leased relay, route duration/checkpoint margins, and pre-launch operational gates.
- **Finding 32 — cross-package proof:** Phase 8 now requires the Postgres-backed guest-to-web vertical slice, while earlier phases require golden fixtures and N/N-1, concurrency, replay, and migration tests.

### Intentionally gated rather than over-specified here

- **Finding 23 — guest retention:** The exact period, renewal events, warning, cleanup, and evidence treatment remain a feature-spec decision, but AD-7 and Phases 4/5 now prohibit the schema freeze until that specification is approved. This is a valid implementation gate, not an architecture blocker.
- **Finding 25 — offline completion:** Timestamp windows, eligible methods, timezone changes, expiry, and rejection UX remain deferred because mobile is post-foundation. AD-9 and Phase 8 prohibit mobile implementation until `OfflineCompletionCommandV1` fixes them.
- **Finding 19 follow-on — broader file scanning:** MVP is constrained to a narrow inactive-content allowlist. Malware policy is explicitly required before that allowlist expands; it does not block the bounded MVP evidence path.
- **Findings 2, 10, 14, 17, and 24 — field-level schemas and golden fixtures:** The spine fixes owners and interoperability rules; Phase 1 or Phase 4 must produce the concrete schemas/fixtures before downstream teams start. Requiring those phase outputs is appropriately below the architecture document's altitude.
- **Findings 28-31 — numeric operational values:** Exact capacity, retry counts, SLO, RPO, RTO, and provider-plan values are deliberately owned by code/infrastructure and the Phase 7 launch gate. Their absence does not prevent contract-first foundational work.

### Remaining blocker

**None at architecture altitude.** The only constraint on independent work is procedural: do not parallelize downstream adapters across a boundary until the plan's upstream phase has published and accepted its versioned schema, fixture set, or feature-spec gate.
