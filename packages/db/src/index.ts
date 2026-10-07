/**
 * @zandegi/db — persistence.
 *
 * Today that is the demo store behind `DemoStore`: an in-memory twin for local
 * development and the test suite, and Upstash Redis for the deployed demo,
 * chosen by configuration. Prisma, Postgres, Neon and migrations are not here
 * yet; when they arrive they are a third sibling of the same interface, not a
 * rewrite of anything above it.
 *
 * `@prisma/client` and `prisma` stay installed and unused until that story.
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
  createRedisDemoStore,
  createUpstashDemoStore,
  type RedisLike,
  type RedisStoreOptions,
  type UpstashStoreOptions,
} from "./redis";
