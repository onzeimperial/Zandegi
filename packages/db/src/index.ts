/**
 * @zandegi/db — persistence.
 *
 * The store behind `DemoStore`, chosen by configuration: Postgres (Neon) when a
 * person's data has to last, an in-memory twin for local development and the
 * test suite, and Upstash Redis for the earlier expiring demo. Prisma types
 * never leave this package (AD-2).
 */

export {
  DEMO_KEY_PREFIX,
  DEMO_RETENTION_DAYS,
  DEMO_RETENTION_SECONDS,
  StoreUnavailableError,
  guestKey,
  isStoreUnavailableError,
  missionKey,
  type DemoStore,
  type StoredGuest,
  type StoredMission,
} from "./store";

export {
  createInMemoryDemoStore,
  type InMemoryDemoStore,
  type InMemoryStoreOptions,
} from "./memory";

export {
  createPostgresDemoStore,
  type PostgresDemoStore,
  type PostgresStoreOptions,
} from "./postgres";

export {
  createRedisDemoStore,
  createUpstashDemoStore,
  type RedisLike,
  type RedisStoreOptions,
  type UpstashStoreOptions,
} from "./redis";
