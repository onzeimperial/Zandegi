# Zandegi

A LifeMaxxing application designed to track achievements, fulfil goals, and build
discipline to level up your character in game and in real life.

State any ambition — "get into medicine", "bench 100kg", "learn Farsi", "save a house
deposit" — and Zandegi turns it into a structured mission with chapters, steps,
scheduled time blocks, real tools, and XP. Your character levels up across eight life
domains.

## Governing documents

- **`CLAUDE.md`** — build constitution. Highest authority. How to build.
- **`docs/SPEC.md`** — master specification. What to build.
- **`docs/BUILD-PROMPTS.md`** — the ten build sessions, in order.
- **`docs/BUILD-LOG.md`** — running log of what shipped each session.

## Layout

```
apps/
  web/          Next.js 15 — marketing site + full app
  mobile/       Expo — placeholder, built session 9
  admin/        Internal tools — placeholder, built session 6+
packages/
  core/         Pure domain logic. No I/O.
  db/           Prisma schema, migrations, seed
  api/          tRPC routers
  ai/           Generation pipeline
  ui/           Component library + design tokens
  tools/        Tool Registry runtimes
  economy/      XP, currencies, seasons, entitlements
  integrations/ Health / fitness / calendar / git connectors
legacy/         The pre-monorepo prototype, kept for reference. Not part of the build.
```

## Getting started

```powershell
# from repo root
node --version                    # Node >=24.15.0 and <25
npm install --global corepack@0.36.0
corepack enable
corepack prepare pnpm@12.8.2 --activate
pnpm install
pnpm --filter @zandegi/web dev    # http://localhost:3000
pnpm verify                       # the canonical check — run this before pushing
```

`pnpm verify` is the single canonical verification command, used identically in CI and
locally. It runs, in order and stopping at the first failure: the Prettier format check,
ESLint with zero tolerated warnings, every package type check plus the repository contract
files, the unit tests, and the production builds.

If the format check fails, run `pnpm format` and commit the result. Prettier is not always
idempotent in one pass, so if `pnpm format:check` still fails immediately afterwards, run
`pnpm format` once more before investigating.

It is scoped to the current pnpm workspace, which contains only `apps/*` and `packages/*`.
The `legacy/` directory is an independent npm project with its own lockfile: it is never
installed, entered, or modified by `pnpm verify`. It is verified by its own CI job, which
runs `npm ci`, `npm run typecheck` and `npm test` directly inside `legacy/`; the root
`pnpm verify:legacy` script is the local equivalent and also needs `npm ci` there first.
Current workspace code must never import from `legacy/`; `pnpm lint` fails if it does,
including through a dynamic `import()`.

## When generation fails

The error screen shows a reference, which is the request id. Development records every failure, and
every model response the pipeline rejected, in `apps/web/logs/generation-incidents.jsonl`. To see
them grouped by cause:

```powershell
# from repo root
node scripts/generation-incidents.mjs
```

A healthy log is empty or missing. Repeated rejections of one field mean a stage needs attention,
even when retries are keeping missions alive. Hosted deployments log the same entries to the
platform under the `[generate]` prefix.

## Deploying the two-person test

The test runs on Vercel, Neon and Clerk. `vercel.json` pins Sydney, and on production
builds its build command applies migrations before building, never inside a request.
Preview builds do not migrate. Nothing below is needed to run `pnpm verify`, which uses no
network and no credentials.

Vercel builds Production only from the production branch, so that branch must hold this work.

1. **Create the database.** In Neon, create a project in AWS Sydney (`ap-southeast-2`).
   Copy both connection strings: the pooled one and the direct one. Success: both start
   with `postgresql://`.
2. **Create the sign-in.** In Clerk, create an application with email sign-in and keep email
   verification on. Use its development instance: a production instance needs a domain you own
   with DNS records, and `*.vercel.app` does not allow them. Expect Clerk's development banner on
   the sign-in screens. Copy the publishable and secret keys. Success: the keys start with
   `pk_test_` and `sk_test_`.
3. **Set these on the Vercel project**, for Production, before the first deploy:

   | Variable                            | Value                                                                                                                                                     |
   | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `ANTHROPIC_API_KEY`                 | Generation cannot run without it.                                                                                                                         |
   | `ENABLE_EXPERIMENTAL_COREPACK`      | `1`. Without it Vercel picks pnpm from the lockfile version rather than `packageManager`.                                                                 |
   | `DATABASE_URL`                      | The pooled Neon string. With neither URL set, the production build fails at migration. If it is lost after a successful build, every request answers 503. |
   | `DATABASE_URL_UNPOOLED`             | The direct Neon string, used only by migrations.                                                                                                          |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From Clerk. Needed at build time as well as at run time.                                                                                                  |
   | `CLERK_SECRET_KEY`                  | From Clerk.                                                                                                                                               |
   | `ZANDEGI_ALLOWED_EMAILS`            | The two invited emails, comma-separated. Empty means the app stays off.                                                                                   |
   | `ZANDEGI_DAILY_GENERATION_LIMIT`    | Optional. Builds per person per UTC day. Defaults to 5.                                                                                                   |
   | `CRON_SECRET`                       | A long random string. Vercel sends it to the daily reminder trigger; with it unset the trigger refuses every call.                                        |
   | `REMINDER_GMAIL_USER`               | Optional. The Gmail address that sends the daily reminder. With it or the password unset, reminders stay off and nothing else changes.                    |
   | `REMINDER_GMAIL_APP_PASSWORD`       | Optional. A Google app password for that address (Google Account, Security, 2-Step Verification, App passwords). Never logged.                            |
   | `ZANDEGI_APP_URL`                   | Optional. The public origin used for links in the reminder, such as `https://zandegi.vercel.app`. Defaults to Vercel's production host.                   |

   `ENABLE_UNAUTHENTICATED_GENERATION` no longer does anything. Remove it if it is set.

   Changing the invite list or the daily limit needs a redeploy before it takes effect.

4. **Deploy,** then check each of these yourself, because the test suite cannot reach them:
   - Sign in with an invited email. Success: you land on Today.
   - Sign up for the first time with an invited email. Success: you land on Today.
   - Sign in with an email that is not invited. Success: the invite-only screen, and nothing else.
   - Build a mission with details filled in, then open it on a second device. Success: the same
     mission and XP.
   - Redeploy, then read it again. Success: nothing has changed.
   - Complete two steps, then on the path choose Edit plan: reorder, delete a done step, add one.
     Log a note on Today, then reload on the second device. Success: every change is there, and
     the XP total moved only when a step was completed.

Plan editing and logs need the Postgres store. The `own_the_plan` migration only adds a `version`
column (default 0) to `Mission` and a new `MissionLog` table, so it applies to a live database with
no downtime and leaves existing missions and XP as they were. The dormant Redis store refuses plan
edits and logs with `STORE_UNAVAILABLE`.

The `daily_reminder` migration only adds a `ReminderPreference` table, so it is additive too.

### The daily reminder

`vercel.json` runs `/api/cron/reminder` once a day at 21:00 UTC, which is 08:00 in Sydney in
summer and 07:00 in winter. On the Hobby plan Vercel may run it any time within that hour. Each
opted-in person gets at most one email per local day, and only while today still has steps waiting.
People opt in and out on Today, under Daily reminder. Turning it off deletes the stored address.

To check the trigger by hand on a running dev server (`http://localhost:3000`):

1. In `apps\web\.env.local`, set `CRON_SECRET` to any value, and set the two `REMINDER_GMAIL_*`
   variables if you want a real email. Restart the dev server.
2. In a second PowerShell window, from any directory, run:

   ```powershell
   try { Invoke-WebRequest http://localhost:3000/api/cron/reminder -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
   (Invoke-WebRequest http://localhost:3000/api/cron/reminder -UseBasicParsing -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }).Content
   ```

   Success: the first prints `401`. The second prints counts such as `{"considered":1,"sent":1,...}`
   (set `$env:CRON_SECRET` in that window first). Running it again the same day prints
   `"sent":0,"alreadySent":1`.

To apply migrations to a database by hand:

```powershell
# from repo root, with DATABASE_URL_UNPOOLED set in this terminal
pnpm --filter @zandegi/db db:deploy
```

Success looks like `All migrations have been successfully applied`.

`ZANDEGI_ALLOWED_ORIGINS` is normally not needed on Vercel: the app derives its own
origin from `X-Forwarded-Host`, which the platform sets. Off the platform those headers
are ignored, since a caller could forge them.

### How the app decides what to run on

| Clerk keys | Environment    | Allowlist | Result                                                        |
| ---------- | -------------- | --------- | ------------------------------------------------------------- |
| Present    | Any            | Has names | Sign-in required; only invited, verified emails get in.       |
| Absent     | Not production | Any       | Guest mode: a browser cookie, no sign-in. For local work.     |
| Absent     | Production     | Any       | Off: `/` says so and every API answers `GENERATION_DISABLED`. |
| Present    | Production     | Empty     | Off, as above.                                                |
| Present    | Not production | Empty     | Clerk on, and nobody is allowed in.                           |

Screens with fixture data (crew, shop, profile, builder, customise, complete) are out of the nav.
With Clerk on, they redirect to the path. They stay reachable in guest mode for design work.

## Status

In a two-person test. See the newest entry in `docs/BUILD-LOG.md` for what shipped and what is next.
