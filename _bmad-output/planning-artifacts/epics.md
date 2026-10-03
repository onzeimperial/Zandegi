---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/specs/spec-zandegi/SPEC.md
  - _bmad-output/specs/spec-zandegi/product-rules.md
  - _bmad-output/specs/spec-zandegi/pursuit-catalog.md
  - _bmad-output/specs/spec-zandegi/source-reconciliation.md
  - _bmad-output/planning-artifacts/architecture/architecture-Zandegi-2026-09-25/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-Zandegi-2026-09-25/LEGACY-EXTRACTION-AND-REPAIR-PLAN.md
---

# Zandegi - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Zandegi, decomposing the requirements from the canonical specification and finalized architecture into implementable stories. No separate PRD or UX design contract exists; the canonical specification is the approved requirements source, and detailed UX must be completed before product-surface implementation.

## Requirements Inventory

### Functional Requirements

FR1: A visitor can submit a free-text goal together with relevant constraints such as deadline, current level, time budget, resources, and location.

FR2: The system can preserve a user's goal wording for the life of the account while keeping it exportable and deletable.

FR3: The system can match a goal to one or more versioned Pursuits with explicit confidence, or use the generic scaffold and create a PursuitCandidate when no approved threshold is met.

FR4: The system can classify goals across the permanent Mind, Edge, Coin, Body, Grit, Craft, Bond, and World domains.

FR5: An authorized operator can author, review, approve, version, and retire Pursuits without changing historical Missions.

FR6: The system can validate the complete 140-Pursuit seed catalog for schema correctness, uniqueness, domain weights, safety, sources, meaningful Chapter exits, tool fit, coverage, anti-patterns, and absence of placeholders.

FR7: The system can generate a versioned Mission containing 3-7 meaningful Chapters and 2-9 actionable Steps per Chapter, with exit conditions, guides, planning estimates, evidence methods, tools, and dated sources where factual claims are made.

FR8: The system can build and apply a freshness-approved knowledge snapshot, removing or rewriting unsupported or stale factual claims.

FR9: The system can enforce deterministic age, clinical, eating-risk, self-harm-adjacent, financial, and legal safety policy before releasing generated content.

FR10: A visitor can receive ordered, individually validated Chapter previews through a versioned stream and exactly one accepted terminal result.

FR11: The system can persist only a fully accepted Mission and emit Mission generation as an operational outbox message rather than a progression-ledger event.

FR12: The system can adapt the size and sequence of future Steps from completion and abandonment history without changing awards for completed work.

FR13: The system can enforce display rules for OUTCOME, METRIC, HABIT, PROJECT, and EXPERIENCE goals, including never showing a generic percentage for OUTCOME goals.

FR14: A person can use registered TRACKER, TIMER, CHECKLIST, TEMPLATE, CALCULATOR, PLANNER, LIBRARY, DRILL, JOURNAL, and CAPTURE tools through versioned tool-state transitions.

FR15: The system can distinguish a tool command or state transition from a server-attested fact, and can reject client-submitted trusted facts or totals.

FR16: A person can upload and retrieve private evidence through authenticated, ownership-checked flows with controlled type, size, quota, and retention.

FR17: The system can progress evidence through pending, uploaded, checked, verified or rejected, deleting, and deleted lifecycle states, including orphan cleanup and deletion retry.

FR18: The system can map eligible completion to exactly one evidence kind: SELF, TIMER, ARTIFACT, METRIC, or INTEGRATION; INTEGRATION produces no MVP award.

FR19: The system can calculate progression deterministically from the approved versioned core policy without using AI estimates, payments, subscriptions, entitlements, purchased currency, or mere tool usage.

FR20: The system can process completion as one idempotent transaction that records accepted evidence, ordered ledger facts, award details, immediate projections, and an outbox message.

FR21: The system can hold suspicious awards as visible pending progression and later promote or reverse them through typed events without updating rank, streak, spendable balance, leaderboards, or celebrations prematurely.

FR22: The system can apply typed compensating events once, preserving causation and historically reproducible award inputs.

FR23: An authorized operator can rebuild projections from ordered ledger facts, quarantine an unreadable aggregate, and allow unaffected aggregates to continue.

FR24: A person can convert Mission Steps into internal Blocks based on availability, energy preference, recovery gaps, and deadline pressure.

FR25: A person can reschedule or receive a new suggested slot for a missed Block without punishment and without an external calendar dependency.

FR26: The system can create a server-owned guest principal using a secure expiring cookie so a visitor can experience the MVP loop before signup.

FR27: A guest can claim progress exactly once into a new or existing Clerk-backed account without losing or duplicating Missions, evidence, ledger facts, or projections.

FR28: A person can complete the web MVP journey from goal intake through Mission reveal, scheduling, trusted completion, progression, account claim, export, and deletion.

FR29: An authorized operator can review Pursuit candidates, catalog content, safety failures, evidence states, outbox dead letters, and projection-rebuild operations.

FR30: The system can relay transactional outbox messages to Inngest with leases, durable deduplication, retry, dead-letter handling, and authorized replay.

FR31: A person can request a machine-readable export of their personal content and account data.

FR32: A person can request account deletion that blocks new work, revokes identity, suppresses queued jobs, removes content and evidence, purges caches, removes identity resolution, and returns a completion receipt.

FR33: The system can retain only approved non-resolvable ledger-integrity facts after deletion and must not reconnect them if the person registers again.

FR34: The system can present progression as pending until server acceptance and can show earned progression without displaying model-generated XP promises.

### NonFunctional Requirements

NFR1: First-Mission generation must target p95 below 25 seconds, with the application deadline shorter than the hosting limit.

NFR2: Raw, unsafe, stale, malformed, or rejected model output must fail closed and must never be exposed to clients.

NFR3: All authorization, age restrictions, safety, evidence trust, entitlement, and progression decisions must be server-enforced.

NFR4: Guest tokens and sessions must use secure, HTTP-only, same-site cookies, token hashing and rotation, expiry, origin checks, and CSRF protection.

NFR5: Personal text, Mission content, provider payloads, and evidence files must remain deletable and must never be stored in the immutable progression/economy ledger.

NFR6: Ledger and award replay must be deterministic across current and supported historical schema versions, ordered by aggregate sequence rather than timestamps.

NFR7: Earning, spending, projection, and outbox writes must be atomic and safe under concurrent requests using explicit database constraints, locks or checked versions, and bounded retries.

NFR8: Idempotency must be scoped by principal, operation, and client key; a reused key with a different canonical request hash must return a stable conflict.

NFR9: Background delivery must tolerate duplicate dispatch, delivery-before-ack failure, expired leases, poison messages, and provider dedupe windows without corrupting authoritative state.

NFR10: Client wire contracts must be versioned JSON with ISO-8601 UTC strings, safe integers, explicit nullability, stable error codes, and N/N-1 compatibility fixtures.

NFR11: Schema and event deployments must use tolerant readers before new writers and expand-migrate-contract until old functions and queued jobs drain.

NFR12: Production functions and stateful managed services must be explicitly configured in Sydney where available, with preview and production resource identities isolated and validated.

NFR13: Logs must propagate request and correlation IDs and include actor kind, operation, outcome, duration, and redacted error code without secrets or personal content.

NFR14: Before production, the team must define and test critical-loop availability and latency targets, alerts, quotas, budget limits, backup restore, projection rebuild, incident replay, RPO, and RTO.

NFR15: Web surfaces must meet WCAG AA, keyboard access, reduced-motion behaviour, stable loading and error states, and usable layouts at 375px and desktop widths.

NFR16: Gold presentation must be reserved for earned value, and progression or metric numerals must remain visually stable.

NFR17: The repository must install and verify from a clean checkout with pinned tooling, one valid lockfile, no hidden global dependencies, and one canonical lint/typecheck/test/build command.

NFR18: Current applications and packages must never import from `legacy/`; extracted behaviour must be reimplemented against current contracts with characterization evidence.

NFR19: Private evidence access must enforce authenticated ownership, short-lived authority, file allowlists, size and MIME checks, server-confirmed metadata and hash, per-principal quotas, and reliable cleanup.

NFR20: The product must not diagnose, treat, prescribe, provide personal financial or legal advice, accept regulated documents, or generate self-harm-adjacent Missions.

NFR21: Under-18 restrictions must survive guest claim and be enforced independently of UI visibility.

NFR22: The MVP must not require native mobile, offline completion, billing, subscriptions, purchasable currency, shops, seasons, social/competitive systems, or any third-party integration including external calendar sync.

NFR23: Detailed UX design must be completed before product-surface implementation; web and later native clients share contracts and tokens but not screens or controls.

NFR24: Provider and framework versions must match the reviewed target foundation or be changed only through an explicit compatibility review and lockfile update.

### Additional Requirements

- Begin with brownfield Phase 0: repair Corepack/pnpm, the malformed lockfile, Node/CI alignment, reviewed dependency pins, environment examples, the web-to-API generation seam, legacy-import enforcement, and the canonical verification command.
- Use a modular monolith with a pure functional core, an application-layer imperative shell, and event sourcing bounded to progression and economy facts only.
- `@zandegi/api` owns authorization, use cases, orchestration, and transaction boundaries; apps use only client-safe core contracts, `@zandegi/api/client`, and presentation packages.
- `core` exclusively owns progression rules and tuning; `economy` owns currency, commerce, entitlements, and economy tuning; `db` owns persistence and Unit of Work; `ai` returns validated content; `tools` returns pure transitions and candidate facts.
- Publish an exact `LedgerEnvelopeV1`, event registry, `IdempotentCommand`, `ActorContext`, `OutboxMessageV1`, `VerifiedFact`, evidence lifecycle, stream protocol, knowledge snapshot, and client wire fixtures before implementing both sides of their boundaries.
- Persist through `db.UnitOfWork.run` without exposing Prisma types outside `db` or opening autonomous nested transactions.
- Use Prisma 7 with `prisma.config.ts`, explicit generated-client output, `@prisma/adapter-pg`, Neon pooled runtime access, bounded pools, and migrations outside request handlers.
- Use typed, shape-only upcasters, typed one-time compensation, aggregate sequence constraints, command request hashes, quarantine, replay checkpoints, and authorized projection swaps.
- Run the outbox relay through an Inngest cron-triggered API path using leased `FOR UPDATE SKIP LOCKED` batches and acknowledge only after provider acceptance.
- Use user, guest, system, and admin actor contexts; verify Clerk sessions, guest tokens, Inngest signatures, and least-privilege capabilities at adapters.
- Use request-scoped generation with ordered versioned SSE frames, one terminal frame, explicit cancellation semantics, a server run ID, and idempotent discovery after acceptance begins.
- Use one clock instant and a core-owned freshness decision for every knowledge snapshot; AI cannot choose current time or source acceptability.
- Use private Vercel Blob in Sydney behind an API-owned storage port; provider URLs and types cannot enter domain contracts.
- Deploy Vercel Node functions in `syd1`, Neon in AWS `ap-southeast-2`, Upstash Global with Sydney primary, Inngest, Clerk, and Blob using distinct environment resources and startup identity checks.
- Configure Vercel/Inngest duration and checkpointing so application cleanup occurs before the host deadline; correctness-critical idempotency remains Postgres-backed beyond provider windows.
- Implement export/deletion as an API-owned retryable saga across Clerk, PostgreSQL, Blob, Redis, jobs, projections, telemetry, and backup expiry.
- Maintain a legacy disposition inventory and do not delete `legacy/` until every capability and test group is marked extracted, rewritten, rejected, or deferred with evidence.
- Resolve the guest-retention policy before persistence schema freeze and approve exact neutral rewards, authored bands, caps, level curve, and provisional thresholds before progression implementation.
- Preserve the eight domains, goal-display rules, Mission structure, adaptive sizing policy, initial tool taxonomy, safety rules, and 140-Pursuit catalog from the reconciled product specification.
- Treat all external integrations, native mobile/offline, billing, shops, seasons, crews, feeds, duels, leaderboards, schools, referrals, and durable generation as post-MVP work requiring a new approved scope.

### UX Design Requirements

No UX design contract was included. Before product-surface implementation, run the BMad UX workflow to produce `DESIGN.md` and `EXPERIENCE.md`. The current product requirements already bind the starting violet/gold tokens, earned-only gold rule, eight-pointed life star, plain-language voice, focused motion moments, WCAG AA, keyboard navigation, reduced motion, stable states, and 375px support.

### FR Coverage Map

FR1: Epic 1 - Submit a free-text goal and constraints.
FR2: Epic 1 - Preserve deletable goal wording.
FR3: Epic 1 - Resolve Pursuits or create a generic fallback candidate.
FR4: Epic 1 - Classify goals across eight permanent domains.
FR5: Epic 1 - Author and version Pursuits.
FR6: Epic 1 - Validate the 140-Pursuit seed catalog.
FR7: Epic 1 - Generate versioned Mission structure and content.
FR8: Epic 1 - Apply fresh knowledge and grounded claims.
FR9: Epic 1 - Enforce deterministic safety and age policy.
FR10: Epic 1 - Stream ordered validated Chapter previews.
FR11: Epic 1 - Persist one accepted Mission and operational message.
FR12: Epic 3 - Adapt future Step sizing from completion history.
FR13: Epic 1 - Enforce goal-type display rules.
FR14: Epic 2 - Use registered tools through versioned transitions.
FR15: Epic 2 - Separate commands and candidate facts from trusted attestations.
FR16: Epic 2 - Upload and retrieve private evidence.
FR17: Epic 2 - Manage evidence lifecycle and cleanup.
FR18: Epic 2 - Map completion to one canonical evidence kind.
FR19: Epic 2 - Calculate deterministic server-owned progression.
FR20: Epic 2 - Commit completion, award, projections, and outbox atomically.
FR21: Epic 2 - Hold, promote, or reverse provisional progression.
FR22: Epic 2 - Apply typed one-time compensation.
FR23: Epic 5 - Rebuild and quarantine projections safely.
FR24: Epic 3 - Schedule Steps into internal Blocks.
FR25: Epic 3 - Reschedule missed Blocks without punishment.
FR26: Epic 1 - Create secure server-owned guest identity.
FR27: Epic 4 - Claim guest progress into a Clerk-backed account.
FR28: Epic 6 - Complete the full web MVP journey.
FR29: Epic 5 - Operate review and recovery workflows.
FR30: Epic 5 - Relay outbox messages reliably through Inngest.
FR31: Epic 4 - Export personal account data.
FR32: Epic 4 - Delete personal data through a retryable workflow.
FR33: Epic 4 - Retain only non-resolvable integrity facts after deletion.
FR34: Epic 2 - Present progression as pending until server acceptance.

## Epic List

### Epic 1: Turn Any Goal into a Safe Mission

A visitor can enter a real-world goal and receive a useful, sourced, safety-checked Mission before creating an account.

**FRs covered:** FR1-FR11, FR13, FR26

**Implementation notes:** Includes Phase 0 foundation repair, guest identity, Pursuit contracts and catalog, knowledge freshness, generation, validated streaming, and accepted-Mission persistence.

### Epic 2: Complete Work and Earn Trusted Progress

A person can use Zandegi tools, provide qualifying evidence, complete work, and receive deterministic server-controlled progression.

**FRs covered:** FR14-FR22, FR34

**Implementation notes:** Includes tool transitions, evidence storage and lifecycle, award policy, idempotent completion, ordered ledger facts, projections, provisional awards, and compensation.

### Epic 3: Plan Work Around Real Life

A person can schedule Mission Steps, recover from missed work without punishment, and receive better-sized future Steps.

**FRs covered:** FR12, FR24, FR25

**Implementation notes:** Uses internal scheduling only. External calendar integration remains deferred.

### Epic 4: Keep Progress and Control Personal Data

A guest can claim progress into an account, export personal data, or permanently delete it without corrupting anonymous ledger integrity.

**FRs covered:** FR27, FR31-FR33

**Implementation notes:** Includes guest-account conflicts, identity aliases, export, deletion orchestration, queued-work suppression, evidence deletion, and non-reconnection after re-registration.

### Epic 5: Operate Zandegi Safely and Reliably

Authorized operators can review content and failures, deliver background work reliably, replay dead letters, and rebuild projections.

**FRs covered:** FR23, FR29, FR30

**Implementation notes:** Includes admin workflows, outbox relay, Inngest security, quarantine, projection rebuild, observability, backups, recovery, and environment isolation.

### Epic 6: Deliver the Complete Accessible Web MVP

A person can use the full guest-to-account Zandegi journey through a polished, accessible web experience.

**FRs covered:** FR28

**Implementation notes:** Begins after the BMad UX contract is created. It integrates prior capabilities through client-safe contracts without moving rules into the UI.

## Epic 1: Turn Any Goal into a Safe Mission

A visitor can enter a real-world goal and receive a useful, sourced, safety-checked Mission before creating an account.

### Story 1.1: Establish a Reproducible Supported Workspace

**Requirements:** FR7, FR10, FR11

As a Zandegi contributor,
I want the workspace to install with one pinned, supported toolchain,
So that every later Mission feature can be built and verified from the same baseline.

**Acceptance Criteria:**

**Given** a fresh checkout with Node 24 and no globally installed pnpm
**When** Corepack activates the repository package manager and the frozen install runs
**Then** pnpm 12.8.2 installs successfully from one valid committed lockfile
**And** the installation does not depend on hidden global tooling.

**Given** the root manifests, workspace packages, and CI configuration
**When** their runtime and dependency versions are inspected
**Then** they match the reviewed architecture baseline
**And** Node engines and CI use Node 24 LTS.

**Given** the existing workspace has inconsistent dependency versions
**When** the baseline is reconciled
**Then** React/DOM, TypeScript and compatible ESLint tooling, Zod, Next.js, Tailwind, Prisma, tRPC, Anthropic SDK, and Inngest use reviewed compatible pins
**And** AI and shared contracts use Zod 4.

**Given** the existing malformed or obsolete lockfile
**When** it is replaced
**Then** the dependency delta is reviewed and recorded in `docs/BUILD-LOG.md`
**And** no unapproved major-version migration is introduced.

**Given** the repaired workspace
**When** installation is repeated from a clean state
**Then** it produces the same dependency graph
**And** existing package tests and type checks can run without package-manager bootstrap errors.

### Story 1.2: Add Verification and Repository Guardrails

**Requirements:** FR7, FR10, FR11

As a Zandegi contributor,
I want one trustworthy verification command and clear repository guardrails,
So that incomplete, insecure, or legacy-dependent changes cannot appear production-ready.

**Acceptance Criteria:**

**Given** a clean installed workspace
**When** the canonical root verification command runs
**Then** it executes linting, all package type checks, unit tests, and production builds
**And** it returns a non-zero result when any required check fails.

**Given** a current app or package imports anything from `legacy/`
**When** repository verification runs
**Then** the import-boundary check fails with the offending path
**And** characterization tests may read legacy behaviour only through an explicitly approved extraction process.

**Given** `.env.example` and environment documentation
**When** they are reviewed
**Then** legacy SQLite and NextAuth configuration is removed
**And** all credential-shaped example values are blank
**And** local, preview, and production variables are distinguished.

**Given** configuration required at runtime
**When** the application starts with a missing, malformed, client-exposed, or environment-mismatched value
**Then** startup fails with a safe actionable error
**And** no secret value is written to logs.

**Given** the existing `docs/BUILD-LOG.md`
**When** the foundation status is updated
**Then** scaffolded packages are clearly separated from implemented production capabilities
**And** verification results and known remaining failures are recorded honestly.

**Given** a fresh checkout using only documented prerequisites
**When** the canonical verification command is executed
**Then** it completes without hidden global tools
**And** its command is documented for CI and local development.

### Story 1.3: Put Mission Generation Behind the API Boundary

**Requirements:** FR7, FR10, FR11, FR34

As a Zandegi visitor,
I want Mission generation to use one stable application boundary,
So that I receive consistent results without the web client depending on internal AI implementation details.

**Acceptance Criteria:**

**Given** the current web generation route and components
**When** the boundary is refactored
**Then** web code imports no types or runtime code from `ai`, `db`, `economy`, or `tools`
**And** it uses only `@zandegi/api/client`, client-safe core contracts, and presentation packages.

**Given** a Mission generation request
**When** the web adapter handles it
**Then** it calls one API-owned use case
**And** the API use case owns orchestration while AI returns only validated draft content.

**Given** generation needs a clock, identifiers, cancellation, knowledge, or persistence
**When** those dependencies are used
**Then** they are supplied through explicit application ports
**And** AI code does not create authoritative timestamps, identities, transactions, or ledger events.

**Given** existing AI scoring and web review types contain generated XP
**When** the public generation contract is revised
**Then** model-authored XP fields are removed from AI output, public response types, and preview UI
**And** planning estimates remain clearly non-authoritative.

**Given** a Mission draft is produced
**When** generation completes in this boundary story
**Then** no fake `MissionGenerated` progression event is created
**And** operational persistence or outbox behaviour remains behind an explicit port for later stories.

**Given** the API boundary tests
**When** a successful request, validation failure, cancellation, or internal error occurs
**Then** the adapter returns the documented client-safe result or stable error
**And** diagnostic details remain server-side with personal content redacted.

### Story 1.4: Define Goal, Pursuit, Mission, and Stream Contracts

**Requirements:** FR4, FR7, FR10, FR13

As a Zandegi contributor,
I want one client-safe set of Goal and Mission contracts,
So that catalog, generation, API, persistence, and web implementations agree on the same product language.

**Acceptance Criteria:**

**Given** the canonical product rules
**When** core contracts are defined
**Then** they include the eight permanent domains and the `OUTCOME`, `METRIC`, `HABIT`, `PROJECT`, and `EXPERIENCE` goal types
**And** domain weights use a validated representation that must sum to 1.

**Given** a Pursuit definition
**When** it is validated
**Then** it requires a stable slug and version, domains, goal type, effort band, meaningful Chapter templates, applicable tools, evidence methods, knowledge slots, safety class, and anti-patterns
**And** placeholders or unknown enum values fail validation.

**Given** a generated Mission
**When** it is validated
**Then** it contains 3–7 ordered Chapters with meaningful exit conditions
**And** each Chapter contains 2–9 ordered, actionable Steps with guides, planning estimates, one evidence method, applicable tools, and dated sources for factual claims.

**Given** a planning estimate appears in a Step
**When** the contract is consumed
**Then** it is explicitly non-authoritative for progression
**And** no generated XP, rank, rarity reward, or award amount exists in the Mission-generation contract.

**Given** a goal type and requested display kind
**When** the display policy is evaluated
**Then** OUTCOME rejects generic percentages
**And** METRIC, HABIT, PROJECT, and EXPERIENCE allow only their documented progress displays.

**Given** generation streaming contracts
**When** schemas and fixtures are published
**Then** they define a version, run ID, ordered validated-Chapter previews, explicit error and cancellation frames, and exactly one terminal frame
**And** their JSON representation uses ISO UTC strings, safe integers, explicit nullability, and stable error codes.

**Given** core server-only policy and client-safe contracts
**When** package exports are inspected
**Then** apps can import only the documented client-safe entry points
**And** server-only progression, safety implementation, or infrastructure types cannot enter client bundles.

### Story 1.5: Create the Pursuit Authoring and Validation Framework

**Requirements:** FR5, FR6

As a Zandegi content operator,
I want every Pursuit authored through one validated catalog framework,
So that users receive complete, safe Mission foundations rather than inconsistent or placeholder content.

**Acceptance Criteria:**

**Given** the eight permanent domains
**When** catalog source files are organized
**Then** each Pursuit has one clear owning domain file or module
**And** all Pursuits are discoverable through one catalog entry point.

**Given** a Pursuit author adds or changes an entry
**When** `validate:pursuits` runs
**Then** it validates the current Pursuit schema, unique slug and version, domain-weight sum, goal type, effort band, meaningful Chapter templates and exits, applicable tools, evidence methods, knowledge slots, safety class, and at least three anti-patterns
**And** it reports the exact Pursuit and field for every failure.

**Given** a Pursuit contains an empty tool kit, placeholder language, duplicate slug/version, missing exit condition, unsupported evidence method, or invalid domain weight
**When** validation runs
**Then** validation fails
**And** the invalid catalog cannot pass canonical repository verification.

**Given** a Pursuit contains factual or time-sensitive guidance
**When** knowledge requirements are validated
**Then** each required knowledge slot declares its type and freshness policy
**And** hard factual claims cannot be represented without a source requirement.

**Given** a Pursuit touches clinical, eating-risk, self-harm-adjacent, financial, legal, or age-restricted subject matter
**When** safety validation runs
**Then** the entry requires an explicit safety classification and applicable anti-patterns
**And** self-harm-adjacent content cannot declare a generatable Mission path.

**Given** useful ideas or cases are taken from `legacy/`
**When** they are re-authored in the catalog
**Then** no legacy module is imported
**And** the legacy inventory records the source, disposition, replacement target, evidence, and status.

**Given** the catalog validation suite
**When** representative valid and invalid fixtures run
**Then** all validation branches are covered
**And** the framework can accept later domain catalog stories without changing its validation rules.

### Story 1.6: Author the Mind Pursuit Catalog

**Requirements:** FR4, FR6

As a person pursuing learning or intellectual growth,
I want Mind Pursuits with practical phases, tools, and safety boundaries,
So that my Mission reflects the actual work required for my goal.

**Acceptance Criteria:**

**Given** the approved Mind catalog
**When** the Mind seed module is loaded
**Then** it contains exactly these 22 Pursuits: `exam-preparation`, `university-admissions`, `language-acquisition`, `reading-habit`, `speed-reading`, `memory-training`, `deep-focus`, `note-system`, `public-speaking`, `academic-writing`, `research-project`, `coding-fundamentals`, `mathematics-mastery`, `science-olympiad`, `music-theory`, `chess-rating`, `general-knowledge`, `critical-thinking`, `second-degree`, `certification-exam`, `teaching-others`, and `curiosity-practice`
**And** no unapproved Mind slug is added.

**Given** any Mind Pursuit
**When** its authored content is inspected
**Then** it has valid domain weights, goal type, effort band, 3-7 meaningful Chapter templates with measurable exits, applicable tools and evidence methods, knowledge slots, safety class, and at least three specific anti-patterns
**And** it contains no placeholder Chapter, empty tool kit, or generic "learn more" Step.

**Given** a Mind Pursuit depends on changing admissions, examination, certification, course, or eligibility information
**When** its knowledge slots are reviewed
**Then** the volatile facts require dated sources and an appropriate freshness policy
**And** unavailable fresh information causes the claim to be omitted or reframed rather than guessed.

**Given** academic pressure, focus, or performance content
**When** safety rules are applied
**Then** the Pursuit avoids diagnosis, harmful performance pressure, cheating, and unsupported outcome guarantees
**And** age-sensitive guidance remains suitable for the user's enforced policy context.

**Given** `validate:pursuits` and Mind-specific characterization tests
**When** they run
**Then** all 22 entries pass every catalog rule
**And** representative real, vague, misspelled, and local Mind goals identify the intended Pursuit among the expected candidates.

### Story 1.7: Author the Edge Pursuit Catalog

**Requirements:** FR4, FR6

As a person pursuing career, admission, leadership, or competitive growth,
I want Edge Pursuits grounded in realistic actions and current requirements,
So that my Mission helps me advance without making unsupported promises.

**Acceptance Criteria:**

**Given** the approved Edge catalog
**When** the Edge seed module is loaded
**Then** it contains exactly these 18 Pursuits: `job-search`, `promotion`, `career-pivot`, `salary-negotiation`, `portfolio-build`, `personal-brand`, `networking`, `interview-mastery`, `freelance-launch`, `leadership-growth`, `mentor-acquisition`, `industry-entry`, `scholarship-application`, `competition-entry`, `selective-school-entry`, `internship-hunt`, `public-profile`, and `thought-leadership`
**And** no unapproved Edge slug is added.

**Given** any Edge Pursuit
**When** its authored content is inspected
**Then** it contains complete domain weights, goal type, effort band, meaningful Chapters and exits, applicable tools and evidence, knowledge slots, safety class, and at least three specific anti-patterns
**And** it contains no placeholder content, empty tool kit, or guaranteed career outcome.

**Given** a Pursuit depends on current job markets, salary ranges, admissions, scholarship, competition, or application rules
**When** knowledge requirements are validated
**Then** volatile facts require dated sources and suitable freshness limits
**And** stale or unavailable information is removed or clearly reframed.

**Given** a user requests deceptive networking, fabricated credentials, application cheating, harassment, or unsafe public exposure
**When** Edge safety and anti-pattern rules run
**Then** the Mission rejects or redirects the unsafe tactic
**And** offers an honest, lawful alternative where appropriate.

**Given** `validate:pursuits` and Edge-specific characterization tests
**When** they run
**Then** all 18 entries pass every catalog rule
**And** realistic, vague, misspelled, local, and time-sensitive Edge goals resolve to the expected candidate set.

### Story 1.8: Author the Coin Pursuit Catalog

**Requirements:** FR4, FR6

As a person improving their financial knowledge or habits,
I want Coin Pursuits that provide safe educational actions,
So that I can make progress without receiving personal financial advice.

**Acceptance Criteria:**

**Given** the approved Coin catalog
**When** the Coin seed module is loaded
**Then** it contains exactly these 17 Pursuits: `emergency-fund`, `debt-elimination`, `house-deposit`, `investing-start`, `budget-system`, `income-increase`, `side-income`, `business-launch`, `business-growth`, `financial-literacy`, `retirement-planning`, `frugality-practice`, `big-purchase-saving`, `tax-optimisation`, `insurance-setup`, `crypto-literacy`, and `charitable-giving`
**And** no unapproved Coin slug is added.

**Given** any Coin Pursuit
**When** its authored content is inspected
**Then** it contains complete domain weights, goal type, effort band, meaningful Chapters and exits, applicable tools and evidence, knowledge slots, safety classification, and at least three specific anti-patterns
**And** it contains no placeholder content or unsupported financial outcome guarantee.

**Given** a Coin Mission discusses investing, credit, tax, insurance, retirement, crypto, or regulated products
**When** safety policy runs
**Then** it frames content as general education rather than personal advice
**And** includes the required jurisdiction-appropriate disclosure or routes the user to a qualified professional.

**Given** a user is under the applicable age threshold
**When** they request a restricted investing or credit Pursuit
**Then** the server policy blocks the restricted path
**And** offers an age-appropriate financial-literacy alternative where safe.

**Given** a Coin Pursuit depends on rates, limits, prices, tax rules, product terms, or legislation
**When** its knowledge slots are validated
**Then** each volatile fact requires a dated source and suitable freshness policy
**And** stale, conflicting, or unavailable information fails closed.

**Given** `validate:pursuits` and Coin-specific characterization tests
**When** they run
**Then** all 17 entries pass every catalog rule
**And** realistic, vague, risky, local, and time-sensitive Coin goals resolve to the expected candidate set.

### Story 1.9: Author the Body Pursuit Catalog

**Requirements:** FR4, FR6

As a person improving fitness, movement, sleep, or general wellbeing,
I want Body Pursuits with safe boundaries and realistic progression,
So that I can act without receiving dangerous or clinical instructions.

**Acceptance Criteria:**

**Given** the approved Body catalog
**When** the Body seed module is loaded
**Then** it contains exactly these 21 Pursuits: `strength-training`, `muscle-gain`, `fat-loss`, `endurance-running`, `marathon`, `cycling`, `swimming`, `sport-skill`, `flexibility-mobility`, `sleep-quality`, `nutrition-overhaul`, `hydration`, `injury-rehab`, `posture-correction`, `cardiovascular-health`, `martial-arts`, `climbing`, `team-sport`, `dance`, `medical-checkup-cadence`, and `chronic-condition-management`
**And** no unapproved Body slug is added.

**Given** any Body Pursuit
**When** its authored content is inspected
**Then** it contains complete domain weights, goal type, effort band, meaningful Chapters and exits, applicable tools and evidence, knowledge slots, safety classification, and at least three specific anti-patterns
**And** it contains no placeholder content, guaranteed physical outcome, or unsupported performance prescription.

**Given** a Body goal involves injury, chronic conditions, cardiovascular symptoms, medical checkups, nutrition risk, or other clinical concerns
**When** safety policy runs
**Then** the Mission does not diagnose, prescribe treatment or doses, replace care, or instruct the user to ignore symptoms
**And** it provides an appropriate professional-guidance or urgent-support route.

**Given** a fat-loss, nutrition, or body-composition goal
**When** eating-risk safeguards run
**Then** unsafe calorie floors, excessive loss rates, punitive exercise, and body-comparison competition are rejected
**And** a positive risk signal produces a safer non-metric framing or support route.

**Given** a Body Pursuit contains training volumes, event rules, health guidance, or other changing facts
**When** knowledge requirements are validated
**Then** factual claims require dated, suitable sources
**And** stale or unsupported claims are removed rather than guessed.

**Given** `validate:pursuits` and Body-specific characterization tests
**When** they run
**Then** all 21 entries pass every catalog and safety rule
**And** realistic, vague, risky, local, and age-sensitive Body goals resolve to the expected candidate set.

### Story 1.10: Author the Grit Pursuit Catalog

**Requirements:** FR4, FR6

As a person building discipline, healthier habits, or emotional resilience,
I want Grit Pursuits that support change without shame or unsafe clinical claims,
So that I can take constructive action appropriate to my situation.

**Acceptance Criteria:**

**Given** the approved Grit catalog
**When** the Grit seed module is loaded
**Then** it contains exactly these 17 Pursuits: `habit-formation`, `habit-breaking`, `quit-smoking`, `reduce-alcohol`, `screen-time-reduction`, `porn-cessation`, `gambling-cessation`, `morning-routine`, `cold-exposure`, `meditation`, `journaling`, `emotional-regulation`, `anxiety-management`, `procrastination`, `consistency-streak`, `discomfort-training`, and `digital-minimalism`
**And** no unapproved Grit slug is added.

**Given** any Grit Pursuit
**When** its authored content is inspected
**Then** it contains complete domain weights, goal type, effort band, meaningful Chapters and exits, applicable tools and evidence, knowledge slots, safety classification, and at least three specific anti-patterns
**And** it contains no placeholder content, moralising language, guaranteed recovery claim, or punishment for missed work.

**Given** a goal involves smoking, alcohol, gambling, compulsive behaviour, anxiety, emotional distress, or dangerous discomfort practices
**When** safety policy runs
**Then** the Mission avoids diagnosis, unsafe withdrawal advice, coercion, exposure beyond safe limits, or replacement of professional care
**And** it supplies an appropriate professional or crisis-support route when required.

**Given** a request is self-harm-adjacent or indicates immediate danger
**When** the server safety classifier evaluates it
**Then** Mission generation is stopped
**And** the user receives the approved support response rather than productivity instructions.

**Given** a habit or consistency Mission
**When** its exits and progress displays are reviewed
**Then** it uses concrete actions, consistency, and recovery-oriented feedback
**And** it does not treat a missed day as punishment or fabricate an outcome percentage.

**Given** `validate:pursuits` and Grit-specific characterization tests
**When** they run
**Then** all 17 entries pass every catalog and safety rule
**And** realistic, vague, distressed, risky, and age-sensitive Grit goals resolve or route safely as expected.

### Story 1.11: Author the Craft Pursuit Catalog

**Requirements:** FR4, FR6

As a person learning or completing a creative or technical craft,
I want Craft Pursuits with concrete practice and production stages,
So that I can move from learning to making finished work.

**Acceptance Criteria:**

**Given** the approved Craft catalog
**When** the Craft seed module is loaded
**Then** it contains exactly these 20 Pursuits: `learn-instrument`, `songwriting`, `music-production`, `drawing`, `painting`, `photography`, `videography`, `graphic-design`, `ui-design`, `creative-writing`, `novel`, `poetry`, `woodworking`, `cooking-mastery`, `baking`, `gardening`, `sewing`, `3d-printing`, `software-project`, and `game-development`
**And** no unapproved Craft slug is added.

**Given** any Craft Pursuit
**When** its authored content is inspected
**Then** it contains complete domain weights, goal type, effort band, meaningful Chapters and exits, applicable tools and evidence, knowledge slots, safety classification, and at least three specific anti-patterns
**And** it contains no placeholder content, empty tool kit, or vague "practice more" exit condition.

**Given** a Craft Mission involves tools, machinery, heat, food safety, chemicals, electrical work, or other physical hazards
**When** safety policy runs
**Then** the Mission includes appropriate precautions and skill-level boundaries
**And** rejects unsafe shortcuts or instructions beyond the product's competence.

**Given** a Mission involves writing, art, music, software, or design
**When** integrity rules are evaluated
**Then** it does not encourage plagiarism, copyright infringement, credential fabrication, or passing generated work off as independently produced where disclosure is required
**And** it promotes original practice and lawful source use.

**Given** a Craft Pursuit depends on changing software, platform, equipment, material, or food-safety facts
**When** knowledge slots are validated
**Then** volatile claims require dated suitable sources
**And** stale or unsupported instructions are removed or reframed.

**Given** `validate:pursuits` and Craft-specific characterization tests
**When** they run
**Then** all 20 entries pass every catalog and safety rule
**And** realistic, vague, beginner, advanced, and tool-constrained Craft goals resolve to the expected candidate set.

### Story 1.12: Author the Bond Pursuit Catalog

**Requirements:** FR4, FR6

As a person strengthening relationships or community connection,
I want Bond Pursuits based on consent, respect, and practical communication,
So that I can improve connection without manipulating or endangering others.

**Acceptance Criteria:**

**Given** the approved Bond catalog
**When** the Bond seed module is loaded
**Then** it contains exactly these 13 Pursuits: `relationship-deepening`, `dating`, `marriage-preparation`, `parenting`, `family-connection`, `friendship-building`, `social-confidence`, `conflict-repair`, `community-contribution`, `mentoring-someone`, `long-distance-maintenance`, `hosting-practice`, and `listening-skill`
**And** no unapproved Bond slug is added.

**Given** any Bond Pursuit
**When** its authored content is inspected
**Then** it contains complete domain weights, goal type, effort band, meaningful Chapters and exits, applicable tools and evidence, knowledge slots, safety classification, and at least three specific anti-patterns
**And** it contains no placeholder content or outcome that depends on controlling another person.

**Given** a Mission involves dating, conflict, parenting, mentoring, or vulnerable relationships
**When** safety policy runs
**Then** it enforces consent, privacy, age-appropriate boundaries, and respect for the other person's autonomy
**And** rejects coercion, stalking, surveillance, deception, retaliation, or manipulative persuasion.

**Given** a request indicates abuse, immediate danger, exploitation, or a safeguarding concern
**When** it is evaluated
**Then** the Mission does not provide ordinary relationship optimisation steps
**And** routes to the approved safety or professional-support response.

**Given** a Bond goal is an OUTCOME dependent on another person
**When** progress is presented
**Then** progress uses the user's own actions, completed Chapters, evidence, and next steps
**And** never represents another person's feelings or choices as a controllable percentage.

**Given** `validate:pursuits` and Bond-specific characterization tests
**When** they run
**Then** all 13 entries pass every catalog and safety rule
**And** realistic, vague, conflict-sensitive, age-sensitive, and coercive Bond goals resolve or route safely as expected.

### Story 1.13: Author the World Pursuit Catalog

**Requirements:** FR4, FR6

As a person planning travel, service, culture, or outdoor experiences,
I want World Pursuits grounded in current requirements and responsible action,
So that I can prepare safely and realistically.

**Acceptance Criteria:**

**Given** the approved World catalog
**When** the World seed module is loaded
**Then** it contains exactly these 12 Pursuits: `travel-planning`, `backpacking-trip`, `move-abroad`, `cultural-immersion`, `volunteering`, `environmental-action`, `driving-licence`, `camping-outdoors`, `event-organising`, `pilgrimage`, `bucket-list-experience`, and `local-exploration`
**And** no unapproved World slug is added.

**Given** any World Pursuit
**When** its authored content is inspected
**Then** it contains complete domain weights, goal type, effort band, meaningful Chapters and exits, applicable tools and evidence, knowledge slots, safety classification, and at least three specific anti-patterns
**And** it contains no placeholder content, empty tool kit, or guaranteed travel outcome.

**Given** a Pursuit depends on visas, entry conditions, licences, permits, closures, weather, health notices, prices, transport, or local rules
**When** knowledge slots are validated
**Then** each volatile fact requires a dated authoritative source and suitable freshness policy
**And** unavailable, stale, or conflicting information fails closed.

**Given** a Mission involves outdoor risk, unfamiliar locations, volunteering, cultural interaction, or pilgrimage
**When** safety and ethics rules run
**Then** it addresses relevant preparation, consent, local law, cultural respect, environmental impact, and emergency planning
**And** rejects trespass, exploitation, unsafe travel, or unsupported guarantees.

**Given** a World goal is an EXPERIENCE outcome
**When** progress is presented
**Then** it uses readiness checklists, confirmed bookings where applicable, and completed preparation
**And** does not show a fabricated generic completion percentage.

**Given** `validate:pursuits` and World-specific characterization tests
**When** they run
**Then** all 12 entries pass every catalog and safety rule
**And** realistic, vague, local, time-sensitive, and unsafe World goals resolve or route safely as expected.

### Story 1.14: Version and Operate the Pursuit Catalog

**Requirements:** FR5

As an authorized Zandegi content operator,
I want to approve, version, and retire Pursuits safely,
So that catalog improvements do not change historical Missions or expose unfinished content.

**Acceptance Criteria:**

**Given** this is the first database-backed capability
**When** catalog persistence is introduced
**Then** Prisma 7 configuration, generated-client output, PostgreSQL adapter, pooled connection settings, and migration path are established
**And** the migration creates only the catalog and audit entities required by this story.

**Given** the validated 140-Pursuit seed catalog
**When** the catalog import runs against an empty database
**Then** every approved Pursuit and version is persisted through the database package
**And** running the same import again is idempotent.

**Given** a Pursuit slug already has an approved version
**When** an operator changes load-bearing content
**Then** a new immutable version is created
**And** the existing approved version is not overwritten.

**Given** an existing Mission references a Pursuit version
**When** a newer Pursuit version is approved or the old version is retired
**Then** the Mission continues to reference its original version or accepted snapshot
**And** replay or display does not silently adopt the newer content.

**Given** a draft Pursuit or proposed version
**When** an unauthorized actor attempts to approve, publish, retire, or modify it
**Then** the operation is rejected with a stable authorization error
**And** no catalog state changes.

**Given** an authorized operator reviews a proposed Pursuit version
**When** validation fails for schema, safety, sources, Chapters, tools, evidence, anti-patterns, or coverage
**Then** approval is blocked with actionable field-level failures
**And** the previous approved version remains active.

**Given** an approved Pursuit is retired
**When** new goal matching queries the active catalog
**Then** the retired version is excluded from new matches
**And** historical Missions and audit records remain readable.

**Given** any catalog lifecycle change
**When** it commits
**Then** the actor, action, Pursuit slug/version, timestamp, and outcome are auditable without storing unnecessary personal content
**And** current catalog reads return only approved active versions.

### Story 1.15: Resolve Goals to Pursuits or a Safe Generic Scaffold

**Requirements:** FR1, FR3, FR4

As a Zandegi visitor,
I want my own words understood even when my goal is vague or unusual,
So that I receive the best available Mission path without being forced into the wrong category.

**Acceptance Criteria:**

**Given** a visitor submits free-text goal wording and optional constraints
**When** goal intake validates the request
**Then** the accepted wording and constraints are represented through client-safe contracts
**And** malformed, oversized, or unsupported input returns a stable safe error.

**Given** a valid goal request
**When** the interpreter processes it
**Then** it returns structured intent, applicable domains, constraints, current level, time budget, resources, and location
**And** model output is schema-validated before the resolver can use it.

**Given** the active approved Pursuit catalog
**When** the resolver evaluates an interpreted goal
**Then** it returns ranked Pursuit matches with explicit confidence
**And** retired, draft, age-ineligible, or safety-ineligible Pursuits are excluded.

**Given** a goal genuinely spans multiple Pursuits
**When** each approved match contributes necessary Mission structure
**Then** the resolver may return a bounded multi-Pursuit result
**And** domain weights and conflicting rules are resolved deterministically.

**Given** no eligible Pursuit meets the approved confidence threshold
**When** resolution completes
**Then** the visitor receives the safe generic scaffold
**And** a deletable `PursuitCandidate` linked to the request is created for authorized review.

**Given** the proposed starting threshold of `0.62`
**When** product tuning changes it
**Then** the threshold is versioned configuration rather than a hard-coded domain invariant
**And** the resolution record identifies which threshold version was used.

**Given** a self-harm-adjacent, prohibited, or age-restricted goal
**When** it is interpreted or resolved
**Then** generic fallback cannot bypass the applicable safety route
**And** restricted content is not sent to ordinary Mission generation.

**Given** the resolver evaluation suite
**When** real, vague, misspelled, impossible, multi-domain, local, volatile, and adversarial goals run
**Then** expected candidate sets and fallback decisions are reported by domain and failure class
**And** no test relies on importing legacy resolver code.

### Story 1.16: Create a Secure Guest and Persist Their Goal

**Requirements:** FR2, FR26

As a first-time Zandegi visitor,
I want my goal and Mission journey to begin before signup,
So that I can experience value without losing ownership or privacy.

**Acceptance Criteria:**

**Given** a visitor has no Clerk session or valid guest cookie
**When** they begin goal intake
**Then** the API creates an internal guest principal
**And** the client cannot choose or modify that principal's identifier.

**Given** a guest principal is created
**When** the server issues its cookie
**Then** the token is random, hashed at rest, expiring, HTTP-only, secure in production, and same-site
**And** origin and CSRF protections apply to guest mutations.

**Given** the approved guest-retention policy
**When** a guest performs qualifying renewal activity or reaches expiry
**Then** expiry and renewal follow that policy consistently
**And** expired guest content and evidence enter the approved cleanup process.

**Given** a guest submits an accepted goal
**When** the goal is persisted
**Then** the original wording and constraints are stored in deletable relational records owned by that guest
**And** neither the text nor provider/model payloads enter the immutable ledger.

**Given** the same browser makes a later valid request
**When** the guest cookie resolves
**Then** the same active guest principal and owned records are used
**And** an invalid, expired, rotated, or replayed token returns a stable safe response.

**Given** concurrent requests attempt to initialize the same guest session
**When** identity creation commits
**Then** only one active guest principal is bound to the session
**And** duplicate or abandoned records are not created.

**Given** guest identity and goal persistence tests
**When** creation, reuse, expiry, rotation, CSRF failure, concurrent initialization, and cleanup cases run
**Then** ownership remains server-controlled
**And** no secret, token, or raw goal content appears in logs.

### Story 1.17: Enforce Knowledge Freshness and Generation Safety

**Requirements:** FR8, FR9

As a Zandegi visitor,
I want Mission guidance to use current sources and firm safety boundaries,
So that the generated plan is trustworthy and appropriate for me.

**Acceptance Criteria:**

**Given** a resolved Pursuit declares knowledge slots
**When** the API builds a `KnowledgeSnapshot`
**Then** each entry includes its source, retrieval time, expiry facts, and content type
**And** one injected evaluation instant is used for the entire request.

**Given** an entry is stale, missing, conflicting, or below its approved source-quality rule
**When** freshness is evaluated
**Then** the hard claim cannot enter generation as accepted knowledge
**And** lookup failure causes the claim to be omitted, safely reframed, or the request to fail closed according to policy.

**Given** AI receives knowledge for generation
**When** the request is assembled
**Then** it receives only the explicit freshness-approved snapshot
**And** it cannot choose the clock, approve its own sources, or access raw provider data.

**Given** a goal or candidate Mission touches clinical, eating-risk, self-harm-adjacent, financial, legal, age-restricted, or dangerous content
**When** deterministic server policy evaluates it
**Then** the appropriate restriction, professional-guidance frame, safer alternative, or support route is applied
**And** the model cannot weaken that decision.

**Given** a self-harm-adjacent request or immediate-danger signal
**When** pre-generation safety routing runs
**Then** ordinary Mission generation does not begin
**And** the approved support response is returned.

**Given** model output introduces an unsupported fact or new safety risk
**When** grounding and post-generation safety checks run
**Then** the affected content is rewritten, rejected, or withheld
**And** no unsafe or unvalidated Chapter becomes streamable.

**Given** safety and freshness tests
**When** stale caches, lookup outages, conflicting sources, unsafe rewrites, age restrictions, prompt injection, and support-routing cases run
**Then** decisions fail closed and remain deterministic
**And** logs contain policy codes and correlation IDs without personal content.

### Story 1.18: Generate a Complete Validated Mission Draft

**Requirements:** FR7, FR8, FR9

As a Zandegi visitor,
I want a Mission tailored to my goal, circumstances, and available time,
So that I receive a practical path I can begin following.

**Acceptance Criteria:**

**Given** an authorized guest, persisted Goal, resolved Pursuit set or generic scaffold, approved knowledge snapshot, and safety decision
**When** the API starts Mission generation
**Then** it supplies AI with only the explicit request snapshot and bounded generation budget
**And** identity, clocks, IDs, persistence, transactions, and ledger access remain outside AI.

**Given** the generation pipeline runs
**When** it interprets, plans, details, grounds, and validates the draft
**Then** the result contains 3-7 meaningful Chapters with exit conditions
**And** every Chapter contains 2-9 actionable Steps appropriate to the visitor's constraints.

**Given** a generated Step
**When** it is validated
**Then** it has a clear action, guide, planning estimate, one eligible evidence method, applicable tools, and dated sources for hard factual claims
**And** its planning estimate, difficulty, priority, or rarity cannot determine or promise XP.

**Given** a generic-scaffold goal
**When** generation runs
**Then** it receives the same structure, grounding, safety, and validation rules as a catalog-backed Mission
**And** generic fallback cannot weaken restricted-content policy.

**Given** generated content fails schema, grounding, source freshness, safety, Chapter-exit, Step-actionability, or tool-fit validation
**When** bounded repair attempts are exhausted
**Then** the complete draft is rejected with a stable safe error
**And** no partial Mission is persisted as accepted.

**Given** the visitor disconnects or the application deadline is reached before acceptance begins
**When** cancellation is observed
**Then** model work is aborted where supported
**And** the attempt ends without an accepted Mission or progression event.

**Given** generation evaluation fixtures across all eight domains
**When** normal, vague, impossible, local, volatile, generic-fallback, and adversarial goals run
**Then** results are scored for specificity, actionability, grounding, sequencing, tool fit, and honesty
**And** failure patterns and latency are recorded without exposing personal content.

### Story 1.19: Stream and Persist One Accepted Mission

**Requirements:** FR10, FR11

As a Zandegi visitor,
I want validated Mission Chapters to appear progressively and survive network retries,
So that I can see useful progress quickly without receiving partial or duplicated Missions.

**Acceptance Criteria:**

**Given** an active generation run
**When** a Chapter completes all schema, grounding, freshness, and safety checks
**Then** the API may emit an ordered validated-Chapter preview containing the stream version and run ID
**And** raw tokens, unvalidated drafts, and rejected Chapters are never emitted.

**Given** a client consumes the stream
**When** frames arrive
**Then** Chapter sequence numbers are monotonic and duplicates can be recognized
**And** exactly one accepted, error, or cancelled terminal frame ends the run.

**Given** Chapter previews have been emitted
**When** the complete Mission later fails final validation
**Then** no Mission is persisted as accepted
**And** the terminal error makes clear that previews were not durable without exposing unsafe content.

**Given** a complete Mission passes final acceptance
**When** persistence begins
**Then** Goal ownership, Pursuit versions or snapshots, Mission, Chapters, Steps, guides, sources, tools, and generation metadata are committed atomically
**And** one operational outbox message is created without appending a progression-ledger event.

**Given** the client disconnects before persistence begins
**When** cancellation reaches the server
**Then** the run is aborted and remains unaccepted
**And** a retry starts a fresh run.

**Given** persistence has begun or committed before the response reaches the client
**When** the client retries with the same idempotency key
**Then** the API completes or returns the already accepted Mission
**And** it does not create a duplicate Mission or second operational message.

**Given** the Mission stream is measured in a production-like environment
**When** generation completes across the evaluation suite
**Then** first-Mission completion targets p95 below 25 seconds
**And** the application deadline leaves cleanup time before the host limit.

**Given** stream and persistence integration tests
**When** duplicate frames, late frames, malformed frames, disconnects, timeouts, retry races, validation failure, and delivery loss are exercised
**Then** clients observe one consistent terminal result
**And** the database contains either one accepted Mission or none.

## Epic 2: Complete Work and Earn Trusted Progress

A person can use Zandegi tools, provide qualifying evidence, complete work, and receive deterministic server-controlled progression.

### Story 2.1: Publish the Versioned Progression and Ledger Contracts

**Requirements:** FR18, FR19

As a Zandegi participant,
I want every eligible action evaluated by one transparent progression policy,
So that my earned progress is consistent and historically explainable.

**Acceptance Criteria:**

**Given** the product owner has approved neutral rewards, authored bands, caps, level curve, and provisional thresholds
**When** the core progression policy is published
**Then** it is identified by calculator and policy versions
**And** every tunable value and rationale is represented in versioned core configuration.

**Given** an award request
**When** its evidence is classified
**Then** it maps exhaustively to `SELF`, `TIMER`, `ARTIFACT`, `METRIC`, or `INTEGRATION`
**And** `INTEGRATION` produces no MVP award.

**Given** the core calculator receives accepted inputs
**When** it calculates an award
**Then** it records the evidence kind, accepted inputs, breakdown, amount, calculator version, and policy version
**And** it rejects AI estimates, payments, subscriptions, entitlements, purchased currency, and mere tool usage as inputs.

**Given** a domain fact is appended
**When** it is serialized as `LedgerEnvelopeV1`
**Then** it includes event ID, aggregate ID and sequence, event type and schema version, subject and principal references, occurred and recorded times, correlation and causation IDs, and idempotency data
**And** its exact JSON form, limits, nullability, and payload hash are covered by golden fixtures.

**Given** stored event versions N and N-1
**When** current readers load them
**Then** pure shape-only upcasters produce the current in-memory form deterministically
**And** unknown or corrupt versions return a quarantine result rather than being skipped.

### Story 2.2: Persist Atomic Ledger State through a Unit of Work

**Requirements:** FR20, FR22

As a Zandegi participant,
I want earned state committed as one indivisible operation,
So that retries or concurrent actions cannot lose or duplicate progress.

**Acceptance Criteria:**

**Given** Prisma 7 and Neon PostgreSQL configuration
**When** the persistence package is initialized
**Then** it uses `prisma.config.ts`, explicit generated-client output, `@prisma/adapter-pg`, the pooled runtime endpoint, and bounded connection settings
**And** migration commands remain outside request handlers.

**Given** an API earning use case
**When** it calls `db.UnitOfWork.run`
**Then** it receives transaction-scoped repositories without Prisma types escaping `db`
**And** no repository opens an autonomous nested transaction.

**Given** a new aggregate fact
**When** it is appended
**Then** event ID, aggregate sequence, command identity, request hash, and correction constraints are enforced by PostgreSQL
**And** malformed or unvalidated envelopes are rejected at the persistence boundary.

**Given** concurrent commands target the same aggregate or wallet
**When** they execute
**Then** explicit version checks, locks, or atomic updates prevent lost updates and overspending
**And** recognized serialization or constraint conflicts use bounded retries.

**Given** an empty database or previous compatible release
**When** migrations and compatibility tests run
**Then** the schema reaches the current state through expand-migrate-contract
**And** old compatible readers continue working until contraction is permitted.

### Story 2.3: Execute Registered Tool State Transitions

**Requirements:** FR14, FR15

As a person working on a Mission Step,
I want built-in tools to retain their state and produce trustworthy candidate facts,
So that I can do the work inside Zandegi without clients inventing evidence.

**Acceptance Criteria:**

**Given** the registered tool taxonomy
**When** a tool instance is created for a Step or Mission
**Then** its kind, versioned configuration, owner, state, and optimistic version are persisted
**And** unsupported kinds or configurations are rejected.

**Given** a client submits a tool command
**When** the API authorizes and executes it
**Then** the tool package receives server-loaded prior state and returns a pure transition plus candidate facts
**And** the API saves the new state through one Unit of Work.

**Given** concurrent commands target one tool instance
**When** both attempt to save a transition
**Then** only a transition based on the current optimistic version commits
**And** the stale command receives a stable retryable conflict.

**Given** a tool returns a candidate fact
**When** API verification succeeds
**Then** the API creates a versioned server-attested `VerifiedFact` with issuer, method, subject, observed time, evidence reference, and policy fields
**And** clients cannot submit or modify the trusted attestation.

**Given** a user merely opens a tool or performs a non-qualifying transition
**When** progression eligibility is evaluated
**Then** no award command is created
**And** the state change remains available without pretending effort was verified.

### Story 2.4: Store and Verify Private Evidence

**Requirements:** FR16, FR17

As a person completing an evidence-backed Step,
I want my files stored privately and verified against my action,
So that they can support completion without becoming public or permanent personal records.

**Acceptance Criteria:**

**Given** an authorized owner requests an evidence upload
**When** API policy accepts the request
**Then** it creates a `pending` evidence record and one-time, short-lived Blob upload authority bound to that owner and record
**And** file allowlist, maximum size, and per-principal quota are enforced before issuance.

**Given** the client reports upload completion
**When** the server confirms the object
**Then** it independently checks existence, size, sniffed MIME, hash, ownership binding, and permitted content posture
**And** client headers or hashes are not trusted as proof.

**Given** evidence passes or fails its checks
**When** lifecycle processing completes
**Then** state advances through the defined uploaded and checked states to `verified` or `rejected`
**And** only verified evidence can produce an ARTIFACT attestation.

**Given** another principal or an expired authority requests the object
**When** read or mutation authorization runs
**Then** access is denied without revealing object existence
**And** provider URLs and types remain outside domain contracts.

**Given** an upload is abandoned, rejected, expired, or marked for deletion
**When** cleanup runs
**Then** orphaned objects and metadata progress idempotently to `deleted` with retry on partial failure
**And** operational logs contain no file contents or sensitive metadata.

### Story 2.5: Complete a Step and Receive an Atomic Award

**Requirements:** FR18, FR19, FR20, FR34

As a person who has completed meaningful work,
I want the server to verify and award it exactly once,
So that my progression reflects accepted effort rather than client claims.

**Acceptance Criteria:**

**Given** an authorized completion command
**When** the API receives its principal, operation, client key, and canonical request hash
**Then** retrying identical input returns the stored result
**And** reusing the key with changed input returns a stable conflict.

**Given** completion uses SELF, TIMER, ARTIFACT, or METRIC evidence
**When** verification runs
**Then** the server applies the corresponding fixed, bounded-time, authored-band, or registered-metric policy
**And** client totals, unbounded timestamps, model estimates, and unverified facts are rejected.

**Given** synchronous risk evaluation accepts a final award
**When** the Unit of Work commits
**Then** it appends ordered ledger facts, stores the award and breakdown, updates allowed immediate projections, and inserts one outbox message atomically
**And** the response reflects only committed state.

**Given** any write in the earning transaction fails
**When** rollback occurs
**Then** no partial event, award, projection, wallet, streak, or outbox state remains
**And** a retry can safely execute the command.

**Given** the client waits for completion
**When** the command is unresolved or provisionally accepted
**Then** progression is displayed as pending
**And** no generated or optimistic XP promise is shown.

### Story 2.6: Promote, Reverse, and Correct Progression Safely

**Requirements:** FR21, FR22

As a Zandegi participant,
I want suspicious or mistaken awards resolved transparently,
So that my progression stays fair without silently rewriting history.

**Acceptance Criteria:**

**Given** synchronous risk policy marks an award provisional
**When** the earning transaction commits
**Then** the award is visible as pending
**And** it does not update spendable balance, rank, streak, leaderboard state, or celebrations.

**Given** review accepts a provisional award
**When** a typed promotion command commits
**Then** it appends one promotion event and updates the applicable projections atomically
**And** duplicate promotion attempts return the original result.

**Given** review rejects a provisional award or an accepted fact requires correction
**When** a typed reversal or compensation command commits
**Then** it identifies the corrected event through causation and `correctsEventId`, preserves the original inputs, and applies all specified projection effects
**And** the same fact cannot be corrected twice.

**Given** an award has already contributed to later balances or milestones
**When** correction policy evaluates it
**Then** the documented dependent effects are reversed or explicitly retained through typed facts
**And** replay produces the same result as incremental processing.

**Given** random valid event sequences include provisional, promotion, reversal, spend, and correction cases
**When** incremental projections and full replay are compared
**Then** their serialized states are equivalent
**And** unknown event versions quarantine only the affected aggregate.

## Epic 3: Plan Work Around Real Life

A person can schedule Mission Steps, recover from missed work without punishment, and receive better-sized future Steps.

### Story 3.1: Schedule Mission Steps into Internal Blocks

**Requirements:** FR24

As a person following a Mission,
I want Steps placed into realistic time blocks,
So that I know what to do and when without connecting an external calendar.

**Acceptance Criteria:**

**Given** a person has unscheduled Mission Steps and a valid timezone
**When** they provide availability windows and energy preferences
**Then** the scheduler proposes internal Blocks within those windows
**And** each proposal identifies its Step, start, end, timezone, and scheduling rationale.

**Given** Body or other recovery-sensitive Steps
**When** the scheduler evaluates placement
**Then** configured minimum recovery gaps are respected
**And** deadline pressure cannot override a hard safety constraint.

**Given** several eligible Steps compete for limited time
**When** scheduling runs
**Then** deadlines, Chapter order, estimated duration, and user preferences are applied deterministically
**And** unschedulable Steps return a clear reason instead of overlapping silently.

**Given** a person accepts or manually changes a proposal
**When** the Block is saved
**Then** only the needed Block records are created or updated with optimistic concurrency
**And** the underlying Mission Step remains authoritative for its work definition.

**Given** external calendar features are not in MVP
**When** scheduling code and contracts are inspected
**Then** no provider token, external event ID, or calendar API is required
**And** internal Blocks remain fully usable on their own.

**Given** timezone, daylight-saving, boundary, overlap, recovery, and deadline fixtures
**When** scheduler tests run
**Then** persisted UTC instants and policy-relevant IANA timezones produce the expected local schedule
**And** invalid or ambiguous times are handled explicitly.

### Story 3.2: Recover Missed Work and Adapt Future Step Size

**Requirements:** FR12, FR25

As a person whose schedule changes,
I want missed work rescheduled and future work resized compassionately,
So that one disruption does not punish me or make the Mission unrealistic.

**Acceptance Criteria:**

**Given** an internal Block passes without accepted completion
**When** it becomes missed
**Then** no XP, streak, trust, or other punishment is applied merely because it was missed
**And** the person may request or receive a new eligible slot within 48 hours.

**Given** a missed Block is rescheduled
**When** a new slot is selected
**Then** the original scheduling history remains auditable and the active Block points to the new plan
**And** duplicate reschedule commands do not create duplicate active Blocks.

**Given** a person's seven-day completion rate exceeds 0.85
**When** future Mission sizing policy runs
**Then** future Steps may be biased 15% larger within safety and time-budget limits
**And** already authored or completed awards remain unchanged.

**Given** the completion rate falls below 0.45
**When** future sizing policy runs
**Then** future Steps may be biased 20% smaller and a recovery Chapter may be proposed
**And** the language remains supportive rather than punitive.

**Given** population completion data proposes a Pursuit adjustment
**When** the bounded EWMA policy with starting alpha 0.15 evaluates it
**Then** it creates a versioned tuning candidate for approval
**And** it cannot silently mutate an approved Pursuit or historical Mission.

**Given** completion history is sparse, deleted, contradictory, or outside policy bounds
**When** adaptation runs
**Then** the neutral sizing policy is used
**And** no personal content is copied into immutable progression events.

## Epic 4: Keep Progress and Control Personal Data

A guest can claim progress into an account, export personal data, or permanently delete it without corrupting anonymous ledger integrity.

### Story 4.1: Claim Guest Progress into a Clerk Account

**Requirements:** FR27

As a guest who has experienced Zandegi's value,
I want to create or sign into an account without losing my progress,
So that I can continue the same Mission securely.

**Acceptance Criteria:**

**Given** an unclaimed guest completes Clerk signup for a new Zandegi account
**When** claim commits
**Then** the Clerk identity is attached to the existing guest principal atomically
**And** owned Goals, Missions, evidence, tools, events, and projections remain linked once.

**Given** the Clerk identity already has a canonical Zandegi principal
**When** an eligible guest claim is requested
**Then** the account principal remains canonical and the guest becomes an immutable alias
**And** claimable relational ownership transfers under explicit conflict rules.

**Given** guest and account streams both contain progression facts
**When** claim completes
**Then** projections combine the aliased streams without rewriting immutable ledger events
**And** duplicate facts or idempotency namespaces do not produce duplicate awards.

**Given** the claim succeeds
**When** subsequent requests arrive with the old guest token
**Then** the token is rotated and invalidated
**And** in-flight requests resolve to the canonical principal or receive a stable retryable conflict.

**Given** a claim is retried, already completed, expired, ineligible, or targets conflicting ownership
**When** claim policy evaluates it
**Then** the original successful result or a stable safe conflict is returned
**And** no partial transfer or second claim occurs.

**Given** the guest was subject to age or safety restrictions
**When** account claim completes
**Then** those restrictions are recomputed from authoritative account policy without becoming weaker
**And** restricted generated content does not become accessible through the merge.

### Story 4.2: Export Personal Account Data

**Requirements:** FR31

As a Zandegi account holder,
I want a portable export of my personal information,
So that I can understand and retain the data associated with my account.

**Acceptance Criteria:**

**Given** an authenticated account holder requests export
**When** the API authorizes the request
**Then** it creates an idempotent export job scoped only to the canonical principal
**And** another principal cannot enumerate or request that data.

**Given** the export job runs
**When** data is assembled
**Then** it includes owned profile data, Goals, Missions, schedules, tool state, evidence metadata, award explanations, and applicable settings in a documented machine-readable schema
**And** it excludes secrets, other people's data, internal security signals, and provider credentials.

**Given** binary evidence is included or referenced
**When** the export is delivered
**Then** access is short-lived and authenticated
**And** private Blob URLs are not made permanent or public.

**Given** data changes while an export is prepared
**When** consistency policy is applied
**Then** the export records its evaluation time and completeness boundary
**And** it does not silently combine incompatible partial snapshots.

**Given** export succeeds, expires, or fails
**When** the account holder checks status
**Then** they receive a safe status and retry path
**And** temporary export artifacts are removed under the documented retention policy.

### Story 4.3: Delete Personal Data without Breaking Ledger Integrity

**Requirements:** FR32, FR33

As a Zandegi account holder,
I want to permanently delete my personal information,
So that leaving the service does not leave identifiable content behind.

**Acceptance Criteria:**

**Given** an authenticated account holder confirms deletion
**When** the API starts the deletion saga
**Then** it writes a tombstone, blocks new user work, revokes Clerk and guest credentials, and suppresses queued jobs
**And** repeated requests return the same saga status.

**Given** deletion progresses across services
**When** each step runs
**Then** personal relational content, private evidence and exports, caches, tool state, schedules, and identity mappings are deleted or irreversibly detached
**And** partial failure is recorded for idempotent retry.

**Given** immutable ledger integrity facts must remain where approved
**When** identity resolution is removed
**Then** they retain only a salted non-resolvable pseudonym and minimal facts
**And** no personal text, Blob identifier, provider payload, or reversible mapping remains.

**Given** projections or shared records reference the deleted principal
**When** rebuild or read occurs
**Then** erased principals are ignored and shared records lose personal attribution
**And** database constraints do not cascade-delete or corrupt unrelated ledger history.

**Given** the same person registers again later
**When** the new identity is created
**Then** historical pseudonymous facts are not reconnected
**And** old idempotency or ownership data does not block legitimate new activity.

**Given** primary deletion completes
**When** the saga reaches its terminal state
**Then** the person receives a completion receipt describing backup expiry boundaries
**And** backup-retention evidence is available to authorized operators without restoring application identity.

## Epic 5: Operate Zandegi Safely and Reliably

Authorized operators can review content and failures, deliver background work reliably, replay dead letters, and rebuild projections.

### Story 5.1: Deliver Outbox Messages Reliably through Inngest

**Requirements:** FR30

As a Zandegi operator,
I want committed operational messages delivered reliably,
So that side effects can recover from outages without blocking or duplicating earned state.

**Acceptance Criteria:**

**Given** undelivered outbox rows exist
**When** the Inngest cron-triggered relay runs
**Then** it claims a bounded batch using a recoverable lease and `FOR UPDATE SKIP LOCKED`
**And** concurrent relay invocations cannot own the same active lease.

**Given** a claimed `OutboxMessageV1`
**When** the relay sends it to Inngest
**Then** topic, schema version, correlation, causation, partition, and stable dedupe identifiers are preserved
**And** the row is acknowledged only after Inngest durably accepts it.

**Given** delivery fails before or after provider acceptance
**When** retry and lease recovery run
**Then** the message is retried without losing it
**And** handlers use Postgres-backed idempotency beyond provider dedupe windows.

**Given** a message repeatedly fails or has an unsupported schema
**When** terminal retry policy is reached
**Then** it enters a dead-letter state with a safe diagnostic code
**And** an authorized operator can replay it after correction without changing its identity.

**Given** an Inngest handler calls an API use case
**When** authorization runs
**Then** the Inngest signature and least-privilege system `ActorContext` are verified
**And** the handler cannot bypass the application layer or call unauthorized user operations.

**Given** Vercel and Inngest runtime configuration
**When** the serve route executes
**Then** checkpoint runtime is configured at 60-80% of host `maxDuration`
**And** timeout tests prove leases and idempotency recover safely.

### Story 5.2: Review Content, Safety, Evidence, and Delivery Failures

**Requirements:** FR29

As an authorized Zandegi operator,
I want one auditable place to review exceptional states,
So that unsafe content and failed work can be resolved without direct database edits.

**Acceptance Criteria:**

**Given** an authorized operator opens review workflows
**When** candidate data is loaded
**Then** they can inspect PursuitCandidates, draft catalog versions, safety failures, evidence states, and outbox dead letters through API use cases
**And** access is restricted by explicit admin capabilities.

**Given** an operator reviews a candidate or failure
**When** they approve, reject, retire, retry, or escalate it
**Then** the applicable version and state-transition rules are enforced
**And** prohibited direct edits to immutable ledger facts remain unavailable.

**Given** a review item contains personal or sensitive content
**When** it is displayed or logged
**Then** the minimum necessary information is shown to the authorized operator
**And** redaction, access audit, and retention policy are applied.

**Given** two operators act on the same review item
**When** their changes conflict
**Then** optimistic versioning allows only one current transition
**And** the other operator receives a stable conflict with refreshed state.

**Given** any operator action commits
**When** the audit record is written
**Then** it captures actor, capability, target reference, prior and resulting state, reason, time, and correlation ID
**And** it does not copy raw evidence or Mission content unnecessarily.

### Story 5.3: Rebuild Projections and Quarantine Corrupt Streams

**Requirements:** FR23

As an authorized Zandegi operator,
I want to rebuild derived state from immutable facts,
So that projections can be repaired without rewriting earned history.

**Acceptance Criteria:**

**Given** an authorized rebuild request for one aggregate or all eligible aggregates
**When** the rebuild starts
**Then** it uses current readers and pure upcasters, orders by aggregate sequence, and writes to isolated rebuild state
**And** ordinary clients cannot invoke the operation.

**Given** writes continue during a rebuild
**When** checkpoint and catch-up processing run
**Then** facts after the snapshot boundary are applied before swap
**And** no committed fact is lost or applied twice.

**Given** an event has an unknown or corrupt version
**When** its aggregate is replayed
**Then** that aggregate is quarantined with an operator-action record
**And** unaffected aggregates continue rebuilding without silently skipping the event.

**Given** rebuilt state reaches a swap point
**When** equivalence and completeness checks pass
**Then** an authorized atomic swap makes it active
**And** failure leaves the previous projection active and recoverable.

**Given** golden and randomized event histories
**When** incremental state and rebuilt state are compared
**Then** their serialized results are equivalent
**And** correction, provisional, promotion, deletion, and alias cases are included.

### Story 5.4: Establish the Production Operations Envelope

**Requirements:** FR29, FR30

As a Zandegi operator,
I want isolated, observable, recoverable production services,
So that the MVP can be launched without preview leakage or blind failure.

**Acceptance Criteria:**

**Given** production infrastructure is provisioned
**When** deployment configuration is evaluated
**Then** Vercel functions run in `syd1`, Neon in AWS `ap-southeast-2`, Upstash Global uses Sydney primary, and Blob uses Sydney
**And** managed services use the target architecture and reviewed package versions.

**Given** local, preview, and production deployments
**When** startup identity checks resolve their credentials and resources
**Then** each environment matches its expected tenant and resource identifiers
**And** preview-to-production combinations fail before serving requests.

**Given** an API request, generation run, relay message, or deletion saga executes
**When** telemetry is emitted
**Then** request and correlation IDs, actor kind, operation, outcome, duration, and safe error code are available
**And** secrets and personal content are redacted.

**Given** the critical user loop and background operations
**When** production readiness is evaluated
**Then** measurable availability, latency, oldest-undelivered-age, error, quota, and budget alerts are configured
**And** documented SLO, RPO, and RTO targets have named owners.

**Given** backup, restore, projection rebuild, rollback, and incident replay procedures
**When** the production-like drill runs
**Then** each procedure is executed and recorded in `RUNBOOK.md`
**And** failures block launch until corrected or explicitly accepted by the product owner.

## Epic 6: Deliver the Complete Accessible Web MVP

A person can use the full guest-to-account Zandegi journey through a polished, accessible web experience.

### Story 6.1: Implement the Accessible Web Design Foundation

**Requirements:** FR28

As a Zandegi visitor,
I want a consistent and accessible interface,
So that I can understand and use the product across screen sizes and input methods.

**Acceptance Criteria:**

**Given** approved BMad `DESIGN.md` and `EXPERIENCE.md` artifacts
**When** the web design foundation is implemented
**Then** platform-neutral tokens and web primitives reflect the approved visual and behavioural contract
**And** missing UX decisions are not invented inside components.

**Given** the retained brand commitments
**When** tokens are rendered
**Then** the violet palette, typography, spacing, stable numerals, and eight-pointed life-star direction are represented consistently
**And** gold is used only for earned value and never for purchase or ordinary action controls.

**Given** common application states
**When** shared primitives are used
**Then** loading, empty, success, pending, error, confirmation, focus, and disabled states are available with plain-language copy
**And** server errors map to safe actionable messages.

**Given** keyboard, screen-reader, reduced-motion, light/dark, 375px, and desktop use
**When** the design-system accessibility suite runs
**Then** the applicable WCAG AA requirements pass
**And** essential information never depends on animation, colour, hover, or pointer input alone.

### Story 6.2: Deliver Guest Goal Intake and Validated Mission Reveal

**Requirements:** FR28

As a first-time visitor,
I want to describe my goal and watch a safe Mission take shape,
So that I experience useful value before being asked to create an account.

**Acceptance Criteria:**

**Given** a visitor opens the web experience
**When** they enter a goal and optional constraints
**Then** the form uses client-safe contracts, explains required fields, and preserves input across recoverable errors
**And** it does not expose internal Pursuit, model, or provider implementation details.

**Given** generation begins
**When** validated Chapter frames arrive
**Then** the interface renders them in sequence with clear preview status and a stable loading state
**And** raw, duplicate, late, or malformed frames are ignored or handled through the documented error path.

**Given** generation completes successfully
**When** the accepted terminal frame arrives
**Then** the interface switches from preview to the durable Mission
**And** no model-generated XP promise, rank, rarity reward, or OUTCOME percentage is displayed.

**Given** safety routing, cancellation, timeout, disconnect, or validation failure occurs
**When** the terminal result is presented
**Then** the visitor receives the approved support, retry, or correction action
**And** unsafe diagnostic or rejected content is not displayed.

**Given** the flow is used with keyboard, screen reader, reduced motion, or a 375px viewport
**When** the visitor completes intake and reveal
**Then** focus, announcements, progress, cancellation, and terminal status remain understandable and operable
**And** the Mission reveal has a non-animated equivalent.

### Story 6.3: Deliver Mission, Schedule, Tool, and Evidence Workflows

**Requirements:** FR28

As a person following a Mission,
I want to understand the next action, schedule it, use its tools, and provide evidence,
So that I can make real progress without leaving Zandegi.

**Acceptance Criteria:**

**Given** an accepted Mission
**When** the person opens it
**Then** Chapters, exits, Steps, guides, sources, applicable tools, evidence method, and next action are presented clearly
**And** progress display follows the Mission's goal type.

**Given** an eligible Step
**When** the person schedules or reschedules it
**Then** they can select from internal Block proposals, see timezone and constraints, and recover a missed Block without punishment
**And** no external calendar connection is requested.

**Given** a Step has an applicable tool
**When** the person uses it
**Then** commands and server-returned state are rendered through the API client
**And** the interface never claims that opening or merely using the tool earns XP.

**Given** a Step requires ARTIFACT evidence
**When** upload and verification proceed
**Then** the interface communicates allowlist, size, quota, upload, checking, verified, rejected, and deletion states
**And** private evidence is accessible only through authorized short-lived delivery.

**Given** a Step is completed
**When** the completion command is pending, accepted, provisional, rejected, or retried
**Then** the UI reflects authoritative server state and stable errors
**And** client-side estimates or duplicated submissions cannot appear as earned progression.

### Story 6.4: Deliver Progression, Account Claim, Export, and Deletion Controls

**Requirements:** FR28

As a person who has begun making progress,
I want to keep it in an account and control my personal data,
So that I can continue confidently or leave cleanly.

**Acceptance Criteria:**

**Given** final or provisional awards exist
**When** progression is displayed
**Then** earned and pending values are visibly distinct with stable numerals and accessible labels
**And** pending values are not represented as rank, streak, balance, leaderboard, or celebration gains.

**Given** a guest chooses to create or sign into an account
**When** claim is in progress, succeeds, conflicts, or requires retry
**Then** the interface preserves the current Mission context and presents authoritative status
**And** it never asks the guest to submit ownership identifiers or totals.

**Given** an account holder requests export
**When** export progresses
**Then** they can view status, securely retrieve the result before expiry, and understand its completeness boundary
**And** another user's data cannot be inferred from UI or errors.

**Given** an account holder begins deletion
**When** confirmation and saga status are presented
**Then** consequences, blocked work, retry state, backup-expiry boundary, and completion receipt are explained plainly
**And** deletion is not disguised, obstructed, or coupled to a purchase flow.

**Given** under-18 or otherwise restricted policy applies
**When** these surfaces render
**Then** server-authorized capabilities determine available actions
**And** hidden controls are not treated as the security boundary.

### Story 6.5: Prove the Complete Web MVP Journey

**Requirements:** FR28

As a Zandegi product owner,
I want the full MVP journey demonstrated and verified in a production-like environment,
So that launch represents working user value rather than disconnected green tests.

**Acceptance Criteria:**

**Given** a clean production-like environment
**When** the primary vertical slice runs
**Then** a new guest can submit a goal, receive validated Mission previews, obtain one accepted Mission, schedule and complete an eligible Step, receive authoritative progression, and claim an account
**And** the flow traverses the real API, PostgreSQL ledger and projections, outbox, and client decode paths.

**Given** the claimed account
**When** export and deletion journeys run
**Then** export completes through its real delivery path and deletion removes personal data through the real saga
**And** projection replay remains valid after identity erasure.

**Given** failure-path end-to-end tests
**When** unsafe goals, stale knowledge, generation timeout, disconnect, duplicate command, forged fact, invalid evidence, claim race, outbox duplicate, and partial deletion are exercised
**Then** every path reaches the documented safe state
**And** no personal data or unsafe output leaks through the interface or telemetry.

**Given** supported web viewports and access methods
**When** automated and manual accessibility checks run
**Then** the core journey passes WCAG AA expectations, keyboard operation, screen-reader announcements, reduced-motion behaviour, and 375px and desktop layouts
**And** light and dark presentations preserve meaning and contrast.

**Given** release readiness checks
**When** canonical verification, latency and generation measurements, cost evidence, security and privacy checks, backup/restore, rollback, and runbook drills run
**Then** all required gates pass or have explicit product-owner acceptance
**And** no MVP flow depends on mobile, billing, social features, or an external integration.

