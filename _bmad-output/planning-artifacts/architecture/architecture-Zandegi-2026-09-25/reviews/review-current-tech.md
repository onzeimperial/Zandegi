# Current-technology review — Zandegi architecture spine

**Review date:** 2026-10-02  
**Reviewed:** `ARCHITECTURE-SPINE.md` and `LEGACY-EXTRACTION-AND-REPAIR-PLAN.md`  
**Verdict:** **Needs revision before finalization.**

The architecture direction is sound: the selected runtime, framework, database, hosting region, job system, cache role, authentication provider, and private-object-storage pattern can work together. The document is not yet an accurate current-stack baseline, however. Several exact pins are behind current supported releases, the Anthropic SDK pin is substantially stale, and Vercel Blob private storage is incorrectly described as beta even though it is now generally available. The companion plan also omits some mandatory Prisma 7 and Inngest 4 implementation details.

No provider substitution is warranted by this review. The required changes are version hygiene, precise product-status language, and explicit runtime configuration.

## Findings requiring action

### 1. Vercel Blob private storage is GA, not beta — high

The spine describes private storage as beta and makes “Vercel Blob private storage leaves beta” a revisit trigger. Vercel announced private Blob general availability on 2026-06-30. Private client uploads, OIDC server authentication, and signed URLs are now documented production features. Sydney is an available Blob region.

**Required correction:** describe Vercel Blob private storage as GA and remove the beta-exit trigger. Keep the architecture's authorization boundary: server-mediated reads remain a valid, conservative default. Where direct browser delivery is useful, narrowly scoped, short-lived signed URLs are now an available option rather than an architectural workaround.

Sources: [Private Blob GA](https://vercel.com/changelog/vercel-private-blob-is-now-generally-available), [private client uploads](https://vercel.com/docs/vercel-blob/client-upload), [Blob regions](https://vercel.com/docs/vercel-blob/manage-blob-storage), [OIDC authentication](https://vercel.com/changelog/vercel-blob-now-supports-oidc-authentication), [signed URLs](https://vercel.com/changelog/signed-urls-are-now-available-for-vercel-blob).

### 2. The package-manager baseline is stale and the repository cannot reproduce it — high

The specified pnpm `12.3.4` is not current; pnpm `12.8.2` is the current release at review time. Later pnpm 12 releases also contain explicitly identified security fixes. Node 24 still bundles Corepack, so the plan's Corepack-based repair path remains viable, but it must select and pin a current pnpm version rather than restoring the old pin.

Repository reality raises the severity: the root declares pnpm `12.3.4`, while `pnpm-lock.yaml` is malformed as two YAML documents. Until the package manager and lockfile are repaired together, none of the intended version baselines are reproducible.

**Required correction:** update the baseline to pnpm `12.8.2` (or the then-current pnpm 12 patch at implementation), activate it explicitly through Corepack, regenerate one valid lockfile, and review the resulting dependency delta before accepting Phase 0.

Sources: [pnpm releases](https://github.com/pnpm/pnpm/releases), [pnpm 12.4.2 security-fix release](https://github.com/pnpm/pnpm/releases/tag/v12.4.2), [pnpm Node compatibility](https://github.com/pnpm/pnpm/blob/main/pnpm/docs/installation.md), [Corepack distribution policy](https://github.com/nodejs/corepack).

### 3. Anthropic SDK `0.65.0` is substantially behind — high

The current official TypeScript SDK is `0.131.0`, not `0.65.0`. The current SDK accepts Zod 3.25 or Zod 4 as a peer, removing the technical reason to keep the AI package on Zod 3. Because this is still a pre-1.0 SDK and the version jump is large, the upgrade must be tested rather than treated as a mechanical pin change.

**Required correction:** target `@anthropic-ai/sdk` `0.131.0` (or the then-current reviewed patch), unify the AI package on Zod 4, and add regression coverage for streaming/non-streaming responses, error mapping, timeouts, aborts, model selection, and any tool schemas used by `generateInsights`.

Sources: [Anthropic TypeScript SDK releases](https://github.com/anthropics/anthropic-sdk-typescript/releases), [current SDK package manifest and peer dependencies](https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/package.json).

### 4. Zod `4.5.4` is not the current patch — medium

Zod `4.6.5` is current. The 4.6 line includes fixes after 4.5.x, including memory-retention and other correctness fixes. The repository also currently splits core on Zod 4 and AI on Zod 3, contrary to the spine's one-version intent.

**Required correction:** use Zod `4.6.5` (or the then-current reviewed 4.x patch) across the workspace and test shared schema/error formatting boundaries.

Source: [Zod releases](https://github.com/colinhacks/zod/releases).

### 5. React `19.2.8` is compatible but not current — medium

React `19.3.0` is the current stable release. Next `15.5.27` declares React and React DOM peer compatibility with `^19`, so React 19.3 is semver-compatible with the chosen Next release. The existing `19.2.8` pin can still run and is not inherently unsupported; it is simply not an honest “current” baseline.

**Required correction:** either update React and React DOM together to `19.3.0` after a production build and UI regression pass, or label `19.2.8` explicitly as a deliberate conservative pin with a scheduled upgrade. Do not describe it as current.

Sources: [React 19.3 announcement](https://react.dev/blog/2026/09/09/react-19-3), [React releases](https://github.com/facebook/react/releases), [Next 15.5.27 package peer requirements](https://raw.githubusercontent.com/vercel/next.js/v15.5.27/packages/next/package.json).

### 6. TypeScript `5.9.3` is supportable but two stable majors behind — medium

TypeScript 6.0 and 7.0 are released; `7.0.2` is current. However, the current `typescript-eslint` v8 line declares support below TypeScript 6.1, so moving this repository directly to TypeScript 7 would put its lint stack outside the declared peer range. TypeScript 6 support is present in modern v8 releases.

**Required correction:** use TypeScript `6.0.3` with `typescript-eslint` at least `8.58.0` (prefer the current reviewed v8 patch), run the TypeScript migration/config audit, and defer TypeScript 7 until the lint/tooling chain declares support. Keeping 5.9.3 is lower risk, but must be presented as a temporary compatibility choice, not the current language baseline.

Sources: [TypeScript releases](https://github.com/microsoft/TypeScript/releases), [TypeScript 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [typescript-eslint TypeScript 6 support](https://github.com/typescript-eslint/typescript-eslint/releases/tag/v8.58.0), [current typescript-eslint peer range](https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/typescript-eslint/package.json).

### 7. Prisma 7 is the correct stable major, but the plan omits mandatory v7 mechanics — high

Prisma ORM/Client `7.10.x` is a sound choice. Prisma 8 is still a release candidate and is not the appropriate MVP baseline. Node 24 is supported. The companion plan nevertheless treats the upgrade too generically: Prisma 7 requires a driver adapter, moves CLI/database configuration into `prisma.config.ts`, and expects generated-client output to be configured explicitly. For PostgreSQL on Neon, this means an explicit `@prisma/adapter-pg`/`pg` setup and deliberate pool limits/timeouts suitable for Vercel functions and Neon's pooled connection endpoint.

**Required correction:** add to Phase 0/1: create `prisma.config.ts`; define generator output; install and instantiate the PostgreSQL driver adapter; use Neon's pooled connection string for runtime; set conservative `pg` pool size, idle timeout, and connection timeout; keep migrations in a controlled non-request path; verify generation, migration, and one real pooled query in CI or a preview environment.

Sources: [Prisma release status](https://www.prisma.io/docs/orm/release-status), [Prisma 7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements), [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7).

### 8. Inngest 4 is current, but deployment limits need to be explicit — medium

Inngest TypeScript SDK 4 is current; `4.21.0` is the current patch. The architecture correctly requires app-level idempotency: Inngest's idempotency keys have a 24-hour window and are not a permanent correctness guarantee. The plan should also configure Vercel function duration for the Inngest serve route and set Inngest checkpointing `maxRuntime` below the host limit, as the v4 migration guidance recommends.

**Required correction:** pin the current v4 patch, explicitly configure the serve endpoint's Vercel `maxDuration`, set checkpointing `maxRuntime` to roughly 60–80% of that limit, and retain Postgres-backed durable idempotency for operations that matter beyond 24 hours.

Sources: [Inngest TypeScript SDK v4 reference](https://www.inngest.com/docs/reference/typescript/intro), [Inngest SDK releases](https://github.com/inngest/inngest-js/releases), [v4 serve handler](https://www.inngest.com/docs/reference/typescript/v4/serve), [v3-to-v4 runtime guidance](https://www.inngest.com/docs/reference/typescript/v4/migrations/v3-to-v4), [idempotency behavior](https://www.inngest.com/docs/guides/handling-idempotency).

### 9. Sydney compute must be configured; it is not the default — medium

Vercel supports Node 24 and Fluid Compute in Sydney (`syd1`), and the proposed execution envelope is supportable. Vercel's default function region is not Sydney, however. The architecture's co-location claim only becomes true after an explicit `syd1` configuration and deployment verification.

**Required correction:** add explicit Vercel region configuration and an acceptance check showing functions run in `syd1`. Keep Neon in AWS `ap-southeast-2`; select Sydney as the Upstash Global primary; provision Blob in Sydney. Record these choices in environment/runbook setup rather than relying on provider defaults.

Sources: [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region), [Fluid Compute regions and limits](https://vercel.com/docs/functions/usage-and-pricing), [Node 24 on Vercel](https://vercel.com/changelog/node-js-24-lts-is-now-generally-available-for-builds-and-functions), [Neon regional latency/regions](https://neon.com/demos/regional-latency), [Upstash Global databases](https://upstash.com/docs/redis/features/globaldatabase), [Vercel Blob regions](https://vercel.com/docs/vercel-blob/manage-blob-storage).

## Complete technology disposition

| Technology named in the spine | Review result | Current/support status and compatibility |
|---|---|---|
| Node.js 24 LTS | **Pass** | Node 24 is the appropriate LTS baseline and is supported by Vercel, Next 15.5.27, Prisma 7, pnpm 12, and Clerk Core 3. Node 26 is Current, not LTS. Node 20 has reached EOL. Sources: [Node release schedule](https://nodejs.org/en/about/previous-releases), [Node EOL](https://nodejs.org/en/about/eol). |
| pnpm 12.3.4 | **Revise** | Compatible with Node 24 but stale; use current pnpm 12 patch and repair the invalid lockfile. |
| TypeScript 5.9.3 | **Revise or document exception** | Compatible, but not current. TypeScript 6.0.3 is the best current-toolchain-compatible target; TypeScript 7 currently conflicts with typescript-eslint's declared range. |
| Next.js 15.5.27 | **Pass** | This is the patched 15.x release published 2026-09-30. Next 15 is Maintenance LTS while Next 16 is Active LTS, so deferring a major migration for MVP is supportable and honestly conservative. Sources: [Next support policy](https://nextjs.org/support-policy), [Next release blog](https://nextjs.org/blog). |
| React / React DOM 19.2.8 | **Revise or document exception** | Compatible with Next 15.5.27; current stable is 19.3.0. Upgrade both packages together. |
| Tailwind CSS 4.3.3 | **Pass** | Current release and compatible with the selected frontend stack. Source: [Tailwind releases](https://github.com/tailwindlabs/tailwindcss/releases). |
| Zod 4.5.4 | **Revise** | Valid major but stale patch; use current 4.6.5 and converge the workspace on one Zod major. |
| Prisma ORM / Client 7.10.x | **Pass with plan changes** | Correct stable major/line and Node 24 compatible; the plan must implement the v7 driver-adapter and configuration model. Pin the exact patch in the lockfile. |
| tRPC 11.x | **Pass with precision change** | Current major; `11.19.0` is current at review time. Pin a reviewed exact patch rather than leaving an open `11.x` baseline. Sources: [tRPC releases](https://github.com/trpc/trpc/releases), [tRPC v11 documentation](https://trpc.io/docs/client/links). |
| Clerk Core 3 | **Pass with precision change** | Active Clerk generation. Current `@clerk/nextjs` major 7 requires Next `>=15.2.8` and Node `>=20.9`, so the selected stack qualifies. “Core 3” is a release-generation label, not a reproducible package version; name and pin the concrete Clerk packages. Sources: [Core 3 upgrade guide](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3), [Clerk versioning](https://clerk.com/docs/guides/development/upgrading/versioning). |
| `@anthropic-ai/sdk` 0.65.0 | **Revise** | Far behind current 0.131.0; upgrade with API and streaming regression tests. |
| Neon Postgres, Sydney | **Pass** | Sydney/AWS `ap-southeast-2` is available and aligns with Vercel `syd1`. Configure pooling explicitly for Prisma 7. |
| Inngest TypeScript SDK 4.x | **Pass with plan changes** | Current major; pin the current patch and add host-duration/checkpointing configuration. |
| Upstash Redis Global, Sydney primary | **Pass** | Sydney primary is available. Global replication is eventually consistent, so the spine is correct to restrict Redis to disposable cache/rate-limit roles and keep correctness in Postgres. |
| Vercel Blob private storage, Sydney | **Pass technically; description fails** | Product/region are suitable, but private storage is GA, not beta. |
| Vercel Node functions + Fluid Compute, Sydney | **Pass with explicit configuration** | Supported. Set `syd1` explicitly and verify it in deployment. |
| Expo mobile client | **Deferred / unversioned** | No Expo version is selected and mobile is intentionally post-MVP. Choose and compatibility-test the then-current Expo SDK only when that client is scheduled; it should not block the web MVP. |

## Companion-plan corrections

The extraction and repair sequence remains credible, but these additions are needed before it can be treated as an executable technology migration plan:

1. **Phase 0 must repair versions as a set.** Update pnpm, regenerate the lockfile, align CI and `engines` on Node 24, then install the revised React, Zod, Anthropic, TypeScript/tooling, tRPC, and Inngest pins. A green install with the old exact pins is not sufficient.
2. **Phase 0/1 must make Prisma 7 concrete.** Add the driver adapter, `prisma.config.ts`, generated-client output, Neon pooled runtime URL, bounded pool settings, and a migration/generation smoke test.
3. **Phase 1/4 must configure physical deployment.** Set Vercel functions to `syd1`, create Neon in `ap-southeast-2`, create the Upstash Global database with Sydney primary, create Blob in Sydney, and verify actual deployed regions.
4. **Phase 2/3 must acknowledge Redis consistency.** Never use a Global Redis read as authoritative evidence of ownership, idempotency, consent, or job completion; those decisions remain Postgres-backed.
5. **Phase 4 must configure the Inngest/Vercel runtime contract.** Set the serve route duration and checkpointing runtime, test retries after partial completion, and verify application idempotency beyond Inngest's 24-hour window.
6. **Blob language and triggers must be updated.** Remove the beta caveat and replace it with a cost/throughput/egress or portability review trigger. Prefer OIDC for server access and short-lived signed URLs only where direct client delivery is deliberately accepted.
7. **Major-family labels must resolve to exact installs.** `tRPC 11.x`, `Inngest 4.x`, `Prisma 7.10.x`, and “Clerk Core 3” are reasonable architectural constraints, but the repaired manifests and lockfile must carry exact reviewed package versions.

## Acceptance recommendation

Accept the provider topology and the major architectural boundaries. Do **not** mark the current-tech gate complete until the spine and companion plan:

- remove the obsolete Vercel Blob beta claim;
- replace or explicitly justify every stale exact pin;
- add the Prisma 7 adapter/configuration/pooling steps;
- add the Inngest/Vercel duration and checkpointing steps;
- make `syd1` and other Sydney-region selections explicit; and
- reconcile manifests, CI, and one valid lockfile with the documented baseline.

After those revisions, the proposed stack is internally compatible and supportable for the MVP as of 2026-10-02.

## Closure check

**Result: PASS — all material technology corrections are now reflected.**

The revised spine now records the reviewed targets for pnpm 12.8.2, TypeScript 6.0.3 with compatible `typescript-eslint` v8, React/DOM 19.3.0, Zod 4.6.5 workspace-wide, Anthropic SDK 0.131.0, tRPC 11.19.0, and Inngest 4.21.0. It correctly describes private Vercel Blob as GA and explicitly places Vercel execution in `syd1`, Neon in `ap-southeast-2`, Upstash with Sydney primary, and Blob in Sydney.

The companion plan now covers the malformed-lockfile repair, Node 24 CI/runtime alignment, exact manifest/lock reconciliation, Prisma 7's driver adapter, `prisma.config.ts`, generated-client output and bounded Neon pooling, plus Vercel/Inngest duration and checkpoint configuration. It also preserves Postgres as the authoritative store despite Upstash Global's eventual consistency. No material current-technology or provider blocker remains; implementation still has to execute and verify these documented target-state changes.
