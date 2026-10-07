---
title: 'Demo Loop Foundation — Secure Guest Identity and Mission Persistence'
type: 'feature'
created: '2026-10-07'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '9beca56517ebb73c449e27b6c70b974d7cda5592'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Generated missions evaporate. `GenerationPersistencePort` is injected but no-op, its record carries no owner and no mission identifier, and there is no read path, so nothing can be shown again after the stream closes. There is also no identity of any kind: no cookie handling exists anywhere in the app, so a mission has nobody to belong to and a client would be free to name its own owner.

**Approach:** Give the API a server-created guest principal bound to a random token that is hashed at rest and carried in a secure, HTTP-only, same-site, expiring cookie. Extend the persistence seam so an accepted mission is stored against that principal under a server-assigned id, implement that port for real in `@zandegi/db` — Upstash Redis for the deployed demo, an in-memory twin for local development and tests — and expose an ownership-checked read so a mission can be fetched back by its owner.

## Boundaries & Constraints

**Always:** The server creates the principal and the mission id; a client may never supply or influence either. The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` outside local development, with an explicit expiry. Only the token's hash is stored. Mutating requests check origin and reject a cross-site caller before any model call. Every read is ownership-checked and returns not-found rather than forbidden when the principal does not own the record. Persistence stays behind `GenerationPersistencePort` and lives in `@zandegi/db`, so the later Prisma implementation replaces an adapter and nothing above it. Generation remains a relational record, never a ledger fact. Any new dependency is pinned exactly, per the Story 1.1 baseline.

**Decisions taken (do not re-open):** The retention window is configuration, not a constant: the demo value is 30 days of inactivity, and any request from the principal renews it. There is no expiry warning and no cleanup job — warning timing, renewal semantics beyond "any request", and evidence cleanup stay product-owned and deferred. The store has two implementations behind one port, chosen by configuration: Upstash Redis for the deployed demo, in-memory for local development and tests, so neither tests nor local work need Upstash credentials.

**Never:** Do not add Prisma, Postgres, migrations or Neon in this story. Do not implement the versioned stream protocol, the Pursuit catalog, step completion, XP, or any ledger write. Do not add Clerk or any account concept; a guest is the only principal. Do not let `apps/web` import `@zandegi/db`. Do not build the full production operations envelope — Story 5.4 owns that; this story adds only the region and environment settings a demo deploy needs. Do not implement the deferred fail-fast runtime config validation; read what is needed and fail closed with a safe message.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First visit | No cookie | Server mints a principal and token, sets the cookie, generation proceeds, the mission is stored against that principal | N/A |
| Return visit | Valid cookie | The same principal resolves from the token hash; no new principal is created and the retention window renews | N/A |
| Tampered cookie | Value altered, or a hash nothing matches | Treated as no identity: a fresh principal is minted rather than an error surfaced | No detail about why it failed |
| Expired principal | Past the retention window | Same as no identity; the old principal's missions are unreachable, not deleted | N/A |
| Cross-site mutation | Generation request with a foreign or absent origin | Rejected with a stable error before any model call | Non-2xx, no stream, no principal created |
| Client names an owner | Body carries a principal or mission id field | Rejected as an unknown field, as the existing validator already does | `INVALID_REQUEST` |
| Read own mission | Valid cookie, id the principal owns | The stored mission is returned | N/A |
| Read another's mission | Valid cookie, id owned by a different principal | Not found | Indistinguishable from a missing id |
| Accepted mission stored | Generation completes | Exactly one record, with a server-assigned id, the owning principal, and the clock port's timestamp; the terminal frame carries that id | A store failure fails the request rather than silently dropping the mission |
| Store unreachable | Upstash credentials absent or Redis failing | A safe stable error; no partial record, no secret or endpoint in the client response | Credentials never logged |

</frozen-after-approval>

## Code Map

- `packages/api/src/ports.ts:83-110` — `GeneratedMissionRecord` has `runId`, `generatedAt`, `goalText`, `pursuitSlug`, `mission`, `safetyClass`, but no owner and no mission id; `GenerationPersistencePort.record` is write-only and `noopGenerationPersistence` is what the route injects today. Extend this seam, do not replace it.
- `packages/api/src/generation/generate-mission.ts:70-110` — the use case takes `GenerateMissionPorts`, mints `runId` from the id port and `startedAt` from the clock port, then calls `knowledge.resolve` and `persistence.record`. The principal must arrive as input, not be derived inside.
- `packages/api/src/client.ts:203-213` — the terminal `outcome: "mission"` frame carries mission, safety, grounding and meta; it needs the stored mission's id. Error codes live in `packages/api/src/errors.ts` and may be added to but never renamed, so a cross-site rejection needs a new one.
- `apps/web/src/app/api/generate/route.ts:152-180` — returns `new Response(stream, { headers })`, so the cookie must be set on those headers before the body starts; there is no post-hoc `cookies()` mutation available. Note `:153-158`: in production the route returns `GENERATION_DISABLED` unless `ENABLE_UNAUTHENTICATED_GENERATION === "true"`, so a deployed demo must set it or serve 503s.
- `packages/db/src/index.ts` — scaffold (`export {}`). `@prisma/client` and `prisma` 7.10.0 are already dependencies and stay unused. Both store implementations and the port adapter live here.
- `packages/db/package.json` — needs `@upstash/redis` added. Resolve the current version and pin it exactly; do not use a range.
- `apps/web/src/lib/demo-data.ts`, `apps/web/src/app/path/page.tsx` — fixture-backed design boards; `/path` tells the user progress is not saved. Reference only: wiring real data into them is the next spec.
- `eslint.config.js` — the `apps/**` boundary already forbids `@zandegi/db`; a web import of it must keep failing lint.
- Only `ANTHROPIC_API_KEY`, `ENABLE_UNAUTHENTICATED_GENERATION` and `NODE_ENV` are read anywhere today. No Vercel project is linked and no `vercel.json` exists.

## Tasks & Acceptance

**Execution:**
- [x] `packages/api/src/identity/**` — the guest principal: token generation, hashing at rest, cookie name, attributes and expiry, resolving a token to a principal, renewing the window, and the origin check for mutations. Randomness and hashing arrive as ports rather than ambient crypto.
- [x] `packages/api/src/ports.ts` — add the owning principal and a server-assigned mission id to `GeneratedMissionRecord`, and give the port an ownership-checked read beside `record`.
- [x] `packages/api/src/generation/generate-mission.ts` — take the resolved principal as input, store the accepted mission against it, return the stored id.
- [x] `packages/api/src/client.ts`, `packages/api/src/errors.ts` — carry the mission id on the terminal frame; add the stable code for a rejected cross-site request.
- [x] `packages/db/src/**` — two implementations of the port: an in-memory store for local development and tests, and an Upstash Redis store for the deployed demo, selected by configuration. Keyed so an ownership-checked read is a lookup, not a scan. Redis values carry the retention window as a TTL.
- [x] `packages/db/package.json` — add `@upstash/redis` at an exact resolved version.
- [x] `apps/web/src/app/api/generate/route.ts` — resolve or mint the principal and check origin before validating the body, set the cookie on the streamed response, and inject the configured persistence adapter.
- [x] `apps/web/src/app/api/missions/[id]/route.ts` — return the caller's own mission, or not-found.
- [x] `vercel.json`, `.env.example` — the minimum a demo deploy needs: the Sydney region per AD-11, and the new variables documented with blank values. Story 5.4 still owns the full envelope and the deferred config-validation work stays deferred.
- [x] `packages/api/src/**.test.ts`, `packages/db/src/**.test.ts` — cover every I/O matrix row against the in-memory store, including that a tampered or expired cookie mints a fresh principal rather than erroring, that one principal cannot read another's mission, and that a store failure surfaces a safe error with no credential in it.
- [x] `docs/BUILD-LOG.md` — what is real, the retention decision and what it defers, that the Redis store is the deployed path while tests use the twin, and the exact next step.

**Acceptance Criteria:**
- Given a visitor with no cookie, when they generate a mission, then the server mints a principal and a mission id, sets an `HttpOnly` same-site cookie with an explicit expiry, stores only the token's hash, and the mission is retrievable by that principal afterwards.
- Given a request that supplies its own principal, ownership or mission identifier, or arrives from a foreign origin, when it is validated, then it is rejected before any model call and no principal or record is created from client-supplied identity.
- Given two principals, when one requests a mission belonging to the other, then the response is not-found and reveals nothing about whether the record exists.
- Given the persistence seam, when the Prisma implementation arrives later, then only a `@zandegi/db` adapter changes: no use case, route or web file depends on the store's nature, and `apps/web` importing `@zandegi/db` still fails lint.
- Given no Upstash credentials, when the test suite and local development run, then both work against the in-memory store and no test requires network access.
- Given `pnpm verify`, when it runs, then every stage passes including the new identity and persistence tests.

## Implementation Notes

- **Where the composition root lives, and why `@zandegi/db` imports nothing from `@zandegi/api`.**
  The route must inject a configured persistence adapter, and `apps/web` may not import
  `@zandegi/db`. So the adapter lives in `packages/api/src/demo-store.ts` and the dependency runs
  api -> db only. A type-only import the other way would make the two packages mutually dependent,
  so `@zandegi/db` declares its own `StoredMission` / `StoredGuest` / `DemoStore` shapes, generic over
  the mission payload and the safety class. `demo-store.ts` is the single place the two sets of shapes
  meet, so a drift between them fails `pnpm typecheck` there rather than at runtime.
- **`noopGenerationPersistence` was removed** rather than extended. Its only consumer was the generate
  route, and a port that silently drops an accepted mission now contradicts the matrix row that says a
  store failure must fail the request.
- **`GeneratedMissionRecord.mission` holds the client-safe `MissionDraft`**, not the raw pipeline
  mission. Storing the already-mapped draft means the read path needs no `@zandegi/ai` knowledge and no
  provider payload or model trace can reach the store by being spread into it. `safetyClass` was
  narrowed from `string` to `GenerationSafetyClass` for the same reason.
- **Three error codes were appended**, never reordered: `CROSS_SITE_REQUEST` (403),
  `MISSION_NOT_FOUND` (404) and `STORE_UNAVAILABLE` (503). The last covers both a write that could not
  be kept and a read the store could not answer, in generation and on the read path alike.
- **Store selection** is `ZANDEGI_MISSION_STORE` when set, otherwise inferred: Redis once both Upstash
  values are present, the in-memory twin otherwise. Asking for `redis` with no credentials is a
  configuration error rather than a silent downgrade to a store that forgets on restart.
- **The ports are memoised per resolved configuration** in `demoPortsFromEnv`. Without that memo the
  in-memory twin would be useless — every request would build a fresh store and no guest would resolve
  twice. A failed build removes its own cache entry so the next request retries.
- **Renewal, precisely.** A guest lookup renews the guest; reading a mission renews that mission. A
  mission its owner never opens still lapses on its own window while the guest stays active. That is
  the "renewal semantics beyond *any request*" the Decisions section left product-owned.
- **Not covered by the suite:** that a mission survives a real server restart. `redis.test.ts` drives a
  fake client for keys, TTLs and credential sanitisation, but durability is the one property the twin
  cannot stand in for, so it stays the manual check under Verification.

## Spec Change Log

## Review Triage Log

## Design Notes

The cookie must be written onto the streamed `Response`'s headers, because the generate route returns a `ReadableStream` and headers are gone once the body starts. That forces principal resolution before the stream opens, which is where the origin check belongs anyway — a cross-site caller should never reach the model.

A tampered or unknown cookie mints a fresh principal rather than returning an error. Telling an anonymous visitor their token failed to resolve leaks that the server recognised and rejected something, and there is no recovery action available to them. Expiry behaves identically, which means an expired guest's missions become unreachable rather than deleted; real cleanup waits on the product decision this story deliberately left open.

Ownership failures return not-found, never forbidden, because forbidden confirms the id exists.

Two store implementations rather than one is what keeps the deployed demo honest and the suite fast. Tests and local development must not need Upstash credentials or a network, so the in-memory twin is the default and Redis is selected by configuration. Both satisfy one interface, so the eventual Prisma store is a third sibling and not a rewrite — that property is the entire reason the shortcut is affordable.

Redis carries the retention window as a TTL on the stored value, so expiry is the store's job rather than a scheduled sweep. That is also why no cleanup job exists yet: for the demo, the TTL *is* the cleanup.

## Verification

**Commands:**
- `pnpm verify` — expected: exit 0 with no network access and no Upstash credentials present.
- `pnpm lint` after adding `import {} from "@zandegi/db"` to a web file — expected: non-zero naming the file. Revert.
- With a key in `.env`, `pnpm --filter @zandegi/web dev`: generate a mission, confirm the browser cookie is `HttpOnly` with an expiry, and that the terminal frame includes a mission id.
- `curl` the read endpoint with that cookie — expected: the mission. Without it, and with a second browser profile's cookie — expected: not-found both times.
- `curl -X POST` the generate endpoint with a foreign `Origin` — expected: the stable cross-site error, no stream, and no model call in the log.
- With Upstash credentials set, repeat the generate-then-read sequence and confirm the mission survives a server restart — the one behaviour the in-memory store cannot provide.
