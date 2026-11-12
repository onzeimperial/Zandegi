/**
 * The composition root for the demo's persistence.
 *
 * It lives in `@zandegi/api` rather than in the web app for one reason: an app
 * must not import `@zandegi/db` (AD-2, and `eslint.config.js` enforces it).
 * So the adapter that turns a `DemoStore` into this package's ports is here,
 * and a route asks for ports, not for a store.
 *
 * The dependency runs api -> db and never back, which is why `@zandegi/db`
 * declares its own record shapes. This file is the one place the two sets of
 * shapes meet, so a drift between them fails `pnpm typecheck` here.
 *
 * Configuration, not a constant: the driver and the retention window are read
 * from the environment. This is deliberately *not* the fail-fast runtime
 * config validation story 5.4 owns — it reads what it needs and fails closed
 * with a safe, stable code.
 */
import type { ProgressLedgerPort } from "./progress/ledger";

import {
  DEMO_RETENTION_DAYS,
  createInMemoryDemoStore,
  createPostgresDemoStore,
  createUpstashDemoStore,
  isStoreUnavailableError,
  type DemoStore,
} from "@zandegi/db";
import type { GenerationSafetyClass, MissionDraft } from "./client";
import { GenerationError } from "./errors";
import type { GuestCookiePolicy } from "./identity/cookie";
import type { GenerationUsagePort } from "./generation/usage";
import type { AccountPrincipalStorePort } from "./identity/account";
import type { GuestPrincipalStorePort } from "./identity/ports";
import type {
  GenerationPersistencePort,
  MissionGoalContext,
  MissionLogStorePort,
  MissionPlanStorePort,
} from "./ports";

/**
 * The store as this package instantiates it. Naming the mission payload and
 * the safety class here is what makes the two packages' record shapes line up
 * at compile time instead of by convention.
 */
export type StoredDemoStore = DemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>;

export type DemoStoreDriver = "memory" | "redis" | "postgres";

export interface DemoStoreConfig {
  driver: DemoStoreDriver;
  retentionSeconds: number;
  /** Present only when `driver` is `"redis"`. */
  redis?: { url: string; token: string };
  /** Present only when `driver` is `"postgres"`. */
  postgres?: { url: string };
}

export interface DemoPorts {
  persistence: GenerationPersistencePort;
  guests: GuestPrincipalStorePort;
  ledger: ProgressLedgerPort;
  accounts: AccountPrincipalStorePort;
  usage: GenerationUsagePort;
  plans: MissionPlanStorePort;
  logs: MissionLogStorePort;
}

export type Env = Record<string, string | undefined>;

const SECONDS_PER_DAY = 24 * 60 * 60;
/** Clamped so a typo cannot produce a zero-length or absurd window. */
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;

export function guestRetentionSecondsFromEnv(env: Env): number {
  const raw = Number(env.ZANDEGI_GUEST_RETENTION_DAYS);
  const days = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEMO_RETENTION_DAYS;
  return Math.min(Math.max(days, MIN_RETENTION_DAYS), MAX_RETENTION_DAYS) * SECONDS_PER_DAY;
}

/**
 * The cookie policy. `Secure` is dropped only for local development, because
 * that is the one place the app is served over plain HTTP; every other
 * environment, test included, gets it.
 */
export function guestCookiePolicyFromEnv(env: Env): GuestCookiePolicy {
  return {
    retentionSeconds: guestRetentionSecondsFromEnv(env),
    secure: env.NODE_ENV !== "development",
  };
}

const POSTGRES_URL = /^postgres(ql)?:\/\//i;

/**
 * Pick the store. Postgres when `DATABASE_URL` is a Postgres URL, then Redis when
 * it is configured, the in-memory twin otherwise, so neither the test suite nor
 * local development needs credentials or a network. The scheme check matters:
 * `.env.example` long carried a SQLite `file:` URL, which must not read as a
 * database.
 *
 * An explicit `ZANDEGI_MISSION_STORE` overrides the inference, and asking for a
 * driver without its credentials is a configuration error rather than a silent
 * downgrade to a store that forgets everything on restart.
 *
 * Production never gets a store that forgets. Memory is refused outright, and
 * Redis, whose records expire, only runs if it was asked for by name, so a
 * deployment that loses its `DATABASE_URL` fails instead of quietly losing data.
 */
export function demoStoreConfigFromEnv(env: Env): DemoStoreConfig {
  const retentionSeconds = guestRetentionSecondsFromEnv(env);
  const url = env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  const requested = env.ZANDEGI_MISSION_STORE?.trim().toLowerCase() ?? "";
  const databaseUrl = env.DATABASE_URL?.trim() ?? "";
  const production = env.NODE_ENV === "production";
  const hasPostgres = POSTGRES_URL.test(databaseUrl);

  if (requested === "postgres" || (requested === "" && hasPostgres)) {
    if (!hasPostgres) {
      throw new GenerationError(
        "STORE_UNAVAILABLE",
        "ZANDEGI_MISSION_STORE=postgres without a postgres DATABASE_URL",
      );
    }
    return { driver: "postgres", retentionSeconds, postgres: { url: databaseUrl } };
  }

  const refuseInProduction = (reason: string) => {
    if (production) throw new GenerationError("STORE_UNAVAILABLE", reason);
  };

  if (requested === "memory") {
    refuseInProduction("production refuses the in-memory store");
    return { driver: "memory", retentionSeconds };
  }

  const configured = url.length > 0 && token.length > 0;
  const wantsRedis = requested === "redis" || (requested === "" && configured);
  if (!wantsRedis) {
    refuseInProduction("production has no durable store: set a postgres DATABASE_URL");
    return { driver: "memory", retentionSeconds };
  }
  if (requested === "") refuseInProduction("production will not infer the expiring redis store");

  if (!configured) {
    // Fail closed. The detail names the missing variables, never their values.
    throw new GenerationError(
      "STORE_UNAVAILABLE",
      "ZANDEGI_MISSION_STORE=redis without UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    );
  }
  return { driver: "redis", retentionSeconds, redis: { url, token } };
}

/**
 * Wrap a `DemoStore` as this package's ports.
 *
 * Every call is funnelled through `guard`, which turns a store failure into
 * the stable `STORE_UNAVAILABLE` code. `@zandegi/db` has already sanitised the
 * detail — the REST endpoint and the token are gone before it reaches here —
 * and the client only ever sees the code and its published message.
 */
export function demoPortsFromStore(store: StoredDemoStore): DemoPorts {
  async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof GenerationError) throw error;
      const detail = isStoreUnavailableError(error)
        ? `${error.operation}: ${error.detail}`
        : `${operation}: store call failed`;
      throw new GenerationError("STORE_UNAVAILABLE", detail);
    }
  }

  return {
    persistence: {
      record: (record) => guard("record", () => store.recordMission(record)),
      findForOwner: (ownerId, missionId) =>
        guard("findForOwner", () => store.findMission(ownerId, missionId)),
      listForOwner: (ownerId) => guard("listForOwner", () => store.listMissions(ownerId)),
    },
    plans: {
      update: (ownerId, missionId, expectedVersion, mission) =>
        guard("updateMission", () =>
          store.updateMission(ownerId, missionId, expectedVersion, mission),
        ),
    },
    logs: {
      record: (log) => guard("recordLog", () => store.recordLog(log)),
      list: (ownerId, missionId) => guard("listLogs", () => store.listLogs(ownerId, missionId)),
      move: (ownerId, missionId, logId, chapterId) =>
        guard("moveLog", () => store.moveLog(ownerId, missionId, logId, chapterId)),
    },
    guests: {
      findByTokenHash: (tokenHash) =>
        guard("findByTokenHash", async () => {
          const found = await store.findGuest(tokenHash);
          return found === null ? null : { id: found.id, createdAt: found.createdAt };
        }),
      save: (tokenHash, principal) =>
        guard("save", () =>
          store.saveGuest(tokenHash, { id: principal.id, createdAt: principal.createdAt }),
        ),
      renew: (tokenHash) => guard("renew", () => store.renewGuest(tokenHash)),
    },
    accounts: {
      findOrCreate: (clerkUserId, candidate) =>
        guard("findOrCreate", async () => {
          const found = await store.findOrCreateAccountPrincipal(clerkUserId, {
            id: candidate.id,
            createdAt: candidate.createdAt,
          });
          return { id: found.id, createdAt: found.createdAt };
        }),
    },
    usage: {
      claimSlot: (ownerId, day, limit) =>
        guard("claimSlot", () => store.claimGenerationSlot(ownerId, day, limit)),
    },
    ledger: {
      claim: (ownerId, claimId) => guard("claim", () => store.claimCompletion(ownerId, claimId)),
      release: (ownerId, claimId) =>
        guard("release", () => store.releaseCompletion(ownerId, claimId)),
      append: (ownerId, event) => guard("append", () => store.appendLedger(ownerId, event)),
      read: (ownerId) => guard("read", () => store.readLedger(ownerId)),
    },
  };
}

export async function createDemoStore(config: DemoStoreConfig): Promise<StoredDemoStore> {
  if (config.driver === "memory") {
    return createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>({
      retentionSeconds: config.retentionSeconds,
    });
  }
  if (config.driver === "postgres") {
    if (config.postgres === undefined) {
      throw new GenerationError("STORE_UNAVAILABLE", "postgres driver selected with no url");
    }
    try {
      return await createPostgresDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>(
        { url: config.postgres.url },
      );
    } catch (error) {
      const detail = isStoreUnavailableError(error)
        ? `${error.operation}: ${error.detail}`
        : "postgres store could not be created";
      throw new GenerationError("STORE_UNAVAILABLE", detail);
    }
  }
  if (config.redis === undefined) {
    throw new GenerationError("STORE_UNAVAILABLE", "redis driver selected with no credentials");
  }
  try {
    return await createUpstashDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>({
      url: config.redis.url,
      token: config.redis.token,
      retentionSeconds: config.retentionSeconds,
    });
  } catch (error) {
    const detail = isStoreUnavailableError(error)
      ? `${error.operation}: ${error.detail}`
      : "redis store could not be created";
    throw new GenerationError("STORE_UNAVAILABLE", detail);
  }
}

/**
 * The process-wide ports.
 *
 * Memoised, and that memo is what makes the in-memory twin usable at all:
 * without it every request would build a fresh store and no guest would ever
 * resolve twice. The key is the resolved configuration, so changing the
 * environment between calls builds a new store rather than returning a stale
 * one.
 *
 * It hangs off `globalThis` because a module variable does not last: a dev
 * recompile re-evaluates this module, and Next can load it once per route. Either
 * would wipe the in-memory store or leak a database pool per reload.
 */
const CACHE_KEY = Symbol.for("zandegi.demoPorts");
type GlobalWithCache = typeof globalThis & { [CACHE_KEY]?: Map<string, Promise<DemoPorts>> };

function portsCache(): Map<string, Promise<DemoPorts>> {
  const holder = globalThis as GlobalWithCache;
  return (holder[CACHE_KEY] ??= new Map());
}

/** The database's host and name only: the key must never hold a password. */
function postgresCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "unparsed";
  }
}

export function demoPortsFromEnv(env: Env = process.env): Promise<DemoPorts> {
  const config = demoStoreConfigFromEnv(env);
  // The key names the driver, the window and the endpoint. No token or password
  // ever enters it.
  const endpoint = config.postgres ? postgresCacheKey(config.postgres.url) : config.redis?.url;
  const key = `${config.driver}:${config.retentionSeconds}:${endpoint ?? ""}`;
  const cache = portsCache();
  const existing = cache.get(key);
  if (existing !== undefined) return existing;

  const created = createDemoStore(config)
    .then(demoPortsFromStore)
    .catch((error: unknown) => {
      // A failed build must not poison the cache: the next request should get
      // a fresh attempt rather than a rejected promise for the process's life.
      cache.delete(key);
      throw error;
    });
  cache.set(key, created);
  return created;
}

/** Test and local-development affordance. */
export function resetDemoPortsCache(): void {
  portsCache().clear();
}
