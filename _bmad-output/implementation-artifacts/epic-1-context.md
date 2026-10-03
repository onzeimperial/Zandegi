# Epic 1 Context: Turn Any Goal into a Safe Mission

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Enable a visitor to enter a real-world goal and receive a useful, sourced, safety-checked Mission before creating an account. This epic establishes the reproducible workspace and application boundary, defines and operates the 140-Pursuit catalog, resolves arbitrary goals, creates a secure guest identity, applies freshness and deterministic safety policy, and streams only validated previews before atomically accepting one durable Mission.

## Stories

- Story 1.1: Establish a Reproducible Supported Workspace
- Story 1.2: Add Verification and Repository Guardrails
- Story 1.3: Put Mission Generation Behind the API Boundary
- Story 1.4: Define Goal, Pursuit, Mission, and Stream Contracts
- Story 1.5: Create the Pursuit Authoring and Validation Framework
- Story 1.6: Author the Mind Pursuit Catalog
- Story 1.7: Author the Edge Pursuit Catalog
- Story 1.8: Author the Coin Pursuit Catalog
- Story 1.9: Author the Body Pursuit Catalog
- Story 1.10: Author the Grit Pursuit Catalog
- Story 1.11: Author the Craft Pursuit Catalog
- Story 1.12: Author the Bond Pursuit Catalog
- Story 1.13: Author the World Pursuit Catalog
- Story 1.14: Version and Operate the Pursuit Catalog
- Story 1.15: Resolve Goals to Pursuits or a Safe Generic Scaffold
- Story 1.16: Create a Secure Guest and Persist Their Goal
- Story 1.17: Enforce Knowledge Freshness and Generation Safety
- Story 1.18: Generate a Complete Validated Mission Draft
- Story 1.19: Stream and Persist One Accepted Mission

## Requirements & Constraints

- Accept free-text goal wording plus deadline, current level, time budget, resources, location, and other constraints. Preserve personal text in exportable, deletable relational records; never place it, provider payloads, or Mission bodies in an immutable ledger.
- Classify against the permanent Mind, Edge, Coin, Body, Grit, Craft, Bond, and World domains. Match one or a bounded set of approved, eligible, versioned Pursuits with explicit confidence; otherwise use the safe generic scaffold and create a deletable candidate for review. The threshold is versioned configuration, and fallback must never bypass safety or age restrictions.
- Validate all 140 seed Pursuits for unique slug/version, domain weights summing to one, goal type, effort band, meaningful Chapter templates and exits, tools, evidence methods, knowledge slots, safety class, sources, anti-patterns, and absence of placeholders. Approved versions are immutable; retirement affects new matching only, not historical Missions.
- Missions contain 3-7 ordered Chapters with meaningful exit conditions and 2-9 actionable Steps per Chapter. Each Step has a guide, non-authoritative planning estimate, one eligible evidence method, applicable tools, and dated sources for hard factual claims. Generated XP, rank, reward, or award values are forbidden.
- Apply one request-scoped evaluation instant to freshness-approved knowledge. Missing, stale, conflicting, or insufficiently authoritative facts must be omitted, safely reframed, or fail closed. Deterministic server policy governs clinical, eating-risk, self-harm-adjacent, financial, legal, dangerous, and age-restricted content; raw or rejected model output is never client-visible.
- Stream only individually schema-, grounding-, freshness-, and safety-validated Chapter previews. Frames carry a protocol version, server run ID, monotonic sequence, stable errors, and exactly one accepted, error, or cancelled terminal result. Previewed Chapters are non-durable until final acceptance.
- Persist only a fully validated Mission. Atomically store its ownership, Pursuit versions or snapshots, Chapters, Steps, guides, sources, tools, generation metadata, and one operational outbox message; Mission generation is not a progression-ledger event. Idempotent retries return the already accepted Mission rather than duplicate it.
- Target first-Mission generation p95 below 25 seconds with an application deadline shorter than the host limit. Disconnects abort work before acceptance; once acceptance begins, it completes and is discoverable by the same idempotency key.
- The repository must install from a clean checkout using Node 24 LTS, Corepack, pnpm 12.8.2, one valid lockfile, reviewed dependency pins, and no hidden global tools. One canonical command must run lint, package type checks, tests, and production builds. Current code must never import from `legacy/`.

## Technical Decisions

- Use a modular monolith with a pure functional core and an API-owned imperative shell. `@zandegi/api` owns authorization, use cases, orchestration, cancellation, and transaction boundaries; `core` owns client-safe Goal, Pursuit, Mission, freshness, safety, and stream contracts; `ai` returns validated drafts only; `db` owns Prisma persistence and Unit of Work.
- Apps import only `@zandegi/core/contracts`, `@zandegi/api/client`, and presentation packages. They must not import AI, DB, economy, tools, server-only policy, or Prisma types. AI cannot create authoritative clocks, IDs, identities, transactions, persistence, or ledger facts.
- Wire contracts are versioned JSON with ISO-8601 UTC strings, safe integers, explicit nullability, stable error codes, and compatibility fixtures. API errors expose a safe code, message, and request ID; diagnostic logs retain correlation metadata while redacting personal content and secrets.
- Guest identity is server-created and bound to a random, hashed-at-rest, expiring and rotating token in a secure, HTTP-only, same-site cookie. Guest mutations require origin and CSRF protection; clients cannot choose principal or ownership identifiers.
- Catalog persistence uses Prisma 7 with explicit generated-client output, the PostgreSQL adapter, pooled Neon access, and forward-only reviewed migrations. Catalog import is idempotent, lifecycle changes are authorized and audited, and current reads expose only approved active versions.
- Generation is request-scoped rather than durable or resumable. The complete accepted result persists through a DB-owned atomic transaction; operational delivery uses an outbox, while correctness-critical idempotency remains PostgreSQL-backed.

## UX & Interaction Patterns

Detailed UX specifications are not yet available and must be completed before product-surface implementation. Any interim surface must use plain language, never present OUTCOME goals as generic percentages, reserve gold for earned value, support keyboard navigation and reduced motion, meet WCAG AA, provide stable loading/error states, and remain usable at 375px and desktop widths. Chapter previews must be clearly distinguishable from the durable accepted Mission.

## Cross-Story Dependencies

Workspace repair and repository guardrails precede feature implementation. The API seam and core contracts precede catalog, resolver, generation, and streaming work. The validation framework precedes all eight domain catalogs; the complete validated catalog precedes persistence, matching, and Mission generation. Guest identity and goal persistence, Pursuit resolution, freshness, and safety decisions all precede generation. Final streaming and acceptance depend on validated generation plus catalog and identity persistence, while any web surface depends on a completed UX contract.
