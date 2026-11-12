/**
 * The Postgres store: the third sibling of `DemoStore`, and the durable one.
 *
 * Prisma stays inside this file (AD-2). Three properties are load-bearing:
 *
 *  1. **Errors carry no detail from below.** A driver's message can quote the
 *     host, the database and the connection string. `guard` keeps only the error
 *     class and its code, and throws a `StoreUnavailableError` with no `cause`.
 *  2. **The client is imported lazily,** so a process that never configures
 *     Postgres never loads Prisma, and the test suite's other stores do not
 *     depend on it.
 *  3. **Races resolve in single statements.** Finding a principal, claiming a
 *     completion and taking a generation slot are each one atomic statement,
 *     never a read followed by a write.
 *
 * Claim then append stays non-atomic behind the existing port. Story 2.2 owns
 * the Unit of Work that replaces it.
 */

import {
  MAX_LEDGER_ENTRIES,
  MAX_LISTED_BOSS_ATTEMPTS,
  MAX_LISTED_LOGS,
  MAX_LISTED_MISSIONS,
  StoreUnavailableError,
  type DemoStore,
  type StoredBossAttempt,
  type StoredGuest,
  type StoredMissionLog,
} from "./store";
import type { Prisma, PrismaClient } from "./generated/prisma/client";

export interface PostgresStoreOptions {
  url: string;
  /** A serverless function serves one request at a time, so this stays small. */
  maxConnections?: number;
}

export interface PostgresDemoStore<
  TMission = unknown,
  TSafetyClass extends string = string,
  TContext = unknown,
> extends DemoStore<TMission, TSafetyClass, TContext> {
  /** Close the pool. For tests and scripts; a server keeps it for its lifetime. */
  disconnect(): Promise<void>;
}

const DEFAULT_MAX_CONNECTIONS = 3;
/** Fail in seconds rather than hanging a request when the database is down. */
const CONNECTION_TIMEOUT_MS = 5_000;

/** The error's class and code. Deliberately never its message. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return `non-error: ${typeof error}`;
  const code = (error as { code?: unknown }).code;
  const safeCode = typeof code === "string" && /^[A-Za-z0-9_]{1,16}$/.test(code) ? ` ${code}` : "";
  return `${error.name}${safeCode}`;
}

async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new StoreUnavailableError(operation, describe(error));
  }
}

export async function createPostgresDemoStore<
  TMission = unknown,
  TSafetyClass extends string = string,
  TContext = unknown,
>(options: PostgresStoreOptions): Promise<PostgresDemoStore<TMission, TSafetyClass, TContext>> {
  const url = options.url.trim();
  if (url.length === 0) throw new StoreUnavailableError("configure", "database url missing");

  const prisma: PrismaClient = await guard("configure", async () => {
    const [{ PrismaClient: Client }, { PrismaPg }] = await Promise.all([
      import("./generated/prisma/client"),
      import("@prisma/adapter-pg"),
    ]);
    return new Client({
      adapter: new PrismaPg({
        connectionString: url,
        max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      }),
      // Prisma writes query errors to stderr by default, which is a route for
      // connection details and personal content to reach a log.
      log: [],
      errorFormat: "minimal",
    });
  });

  type Row = {
    id: string;
    ownerId: string;
    runId: string;
    generatedAt: Date;
    goalText: string;
    pursuitSlug: string;
    mission: unknown;
    safetyClass: string;
    goalContext: unknown;
    version: number;
  };

  const toStored = (row: Row) => ({
    missionId: row.id,
    ownerId: row.ownerId,
    runId: row.runId,
    generatedAt: row.generatedAt.toISOString(),
    goalText: row.goalText,
    pursuitSlug: row.pursuitSlug,
    mission: row.mission as TMission,
    safetyClass: row.safetyClass as TSafetyClass,
    // Absent rather than null, so every store returns the record it was given.
    ...(row.goalContext === null ? {} : { goalContext: row.goalContext as TContext }),
    version: row.version,
  });

  type LogRow = {
    id: string;
    ownerId: string;
    missionId: string;
    chapterId: string;
    kind: string;
    text: string | null;
    value: number | null;
    unit: string | null;
    loggedAt: Date;
  };

  const toLog = (row: LogRow): StoredMissionLog => ({
    logId: row.id,
    ownerId: row.ownerId,
    missionId: row.missionId,
    chapterId: row.chapterId,
    kind: row.kind === "number" ? "number" : "note",
    ...(row.text === null ? {} : { text: row.text }),
    ...(row.value === null ? {} : { value: row.value }),
    ...(row.unit === null ? {} : { unit: row.unit }),
    loggedAt: row.loggedAt.toISOString(),
  });

  type AttemptRow = {
    id: string;
    ownerId: string;
    missionId: string;
    chapterId: string;
    result: string;
    evidence: string;
    tips: string | null;
    wentWell: string | null;
    didntGoWell: string | null;
    improve: string | null;
    attemptedAt: Date;
  };

  const toAttempt = (row: AttemptRow): StoredBossAttempt => ({
    attemptId: row.id,
    ownerId: row.ownerId,
    missionId: row.missionId,
    chapterId: row.chapterId,
    result: row.result === "done" ? "done" : "not-yet",
    evidence: row.evidence === "ARTIFACT" ? "ARTIFACT" : "SELF",
    ...(row.tips === null ? {} : { tips: row.tips }),
    ...(row.wentWell === null ? {} : { wentWell: row.wentWell }),
    ...(row.didntGoWell === null ? {} : { didntGoWell: row.didntGoWell }),
    ...(row.improve === null ? {} : { improve: row.improve }),
    attemptedAt: row.attemptedAt.toISOString(),
  });

  const toGuest = (row: { id: string; createdAt: Date }): StoredGuest => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
  });

  return {
    recordMission: (record) =>
      guard("recordMission", async () => {
        await prisma.mission.create({
          data: {
            id: record.missionId,
            ownerId: record.ownerId,
            runId: record.runId,
            generatedAt: new Date(record.generatedAt),
            goalText: record.goalText,
            pursuitSlug: record.pursuitSlug,
            // why: the store holds these opaquely; the caller's types are not Prisma's.
            mission: record.mission as Prisma.InputJsonValue,
            safetyClass: record.safetyClass,
            ...(record.goalContext === undefined
              ? {}
              : { goalContext: record.goalContext as Prisma.InputJsonValue }),
          },
        });
      }),

    findMission: (ownerId, missionId) =>
      guard("findMission", async () => {
        const row = await prisma.mission.findFirst({ where: { id: missionId, ownerId } });
        return row === null ? null : toStored(row);
      }),

    listMissions: (ownerId) =>
      guard("listMissions", async () => {
        const rows = await prisma.mission.findMany({
          where: { ownerId },
          orderBy: { generatedAt: "desc" },
          take: MAX_LISTED_MISSIONS,
        });
        return rows.map(toStored);
      }),

    updateMission: (ownerId, missionId, expectedVersion, mission) =>
      guard("updateMission", async () => {
        // The version in the WHERE makes this one atomic compare-and-set.
        const { count } = await prisma.mission.updateMany({
          where: { id: missionId, ownerId, version: expectedVersion },
          data: {
            // why: the store holds the mission opaquely; the caller's type is not Prisma's.
            mission: mission as Prisma.InputJsonValue,
            version: { increment: 1 },
          },
        });
        if (count === 1) return "updated";
        const exists = await prisma.mission.count({ where: { id: missionId, ownerId } });
        return exists === 0 ? "missing" : "conflict";
      }),

    recordLog: (log) =>
      guard("recordLog", async () => {
        await prisma.missionLog.create({
          data: {
            id: log.logId,
            ownerId: log.ownerId,
            missionId: log.missionId,
            chapterId: log.chapterId,
            kind: log.kind,
            text: log.text ?? null,
            value: log.value ?? null,
            unit: log.unit ?? null,
            loggedAt: new Date(log.loggedAt),
          },
        });
      }),

    listLogs: (ownerId, missionId) =>
      guard("listLogs", async () => {
        const rows = await prisma.missionLog.findMany({
          where: { ownerId, missionId },
          // `id` breaks ties, matching `newestLogsFirst`.
          orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
          take: MAX_LISTED_LOGS,
        });
        return rows.map(toLog);
      }),

    moveLog: (ownerId, missionId, logId, chapterId) =>
      guard("moveLog", async () => {
        const { count } = await prisma.missionLog.updateMany({
          where: { id: logId, ownerId, missionId },
          data: { chapterId },
        });
        if (count === 0) return null;
        const row = await prisma.missionLog.findFirst({ where: { id: logId, ownerId } });
        return row === null ? null : toLog(row);
      }),

    recordBossAttempt: (attempt) =>
      guard("recordBossAttempt", async () => {
        await prisma.bossAttempt.create({
          data: {
            id: attempt.attemptId,
            ownerId: attempt.ownerId,
            missionId: attempt.missionId,
            chapterId: attempt.chapterId,
            result: attempt.result,
            evidence: attempt.evidence,
            tips: attempt.tips ?? null,
            wentWell: attempt.wentWell ?? null,
            didntGoWell: attempt.didntGoWell ?? null,
            improve: attempt.improve ?? null,
            attemptedAt: new Date(attempt.attemptedAt),
          },
        });
      }),

    listBossAttempts: (ownerId, missionId) =>
      guard("listBossAttempts", async () => {
        const rows = await prisma.bossAttempt.findMany({
          where: { ownerId, missionId },
          // `id` breaks ties, matching `newestAttemptsFirst`.
          orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
          take: MAX_LISTED_BOSS_ATTEMPTS,
        });
        return rows.map(toAttempt);
      }),

    deleteBossAttempt: (ownerId, attemptId) =>
      guard("deleteBossAttempt", async () => {
        const { count } = await prisma.bossAttempt.deleteMany({
          where: { id: attemptId, ownerId },
        });
        return count === 1;
      }),

    findGuest: (tokenHash) =>
      guard("findGuest", async () => {
        const row = await prisma.principal.findUnique({ where: { tokenHash } });
        return row === null ? null : toGuest(row);
      }),

    saveGuest: (tokenHash, guest) =>
      guard("saveGuest", async () => {
        await prisma.principal.create({
          data: { id: guest.id, tokenHash, createdAt: new Date(guest.createdAt) },
        });
      }),

    // Nothing expires here, so there is no window to renew.
    renewGuest: async () => undefined,

    findOrCreateAccountPrincipal: (clerkUserId, candidate) =>
      guard("findOrCreateAccountPrincipal", async () => {
        // INSERT .. ON CONFLICT DO NOTHING, then read whichever insert won.
        await prisma.principal.createMany({
          data: [{ id: candidate.id, clerkUserId, createdAt: new Date(candidate.createdAt) }],
          skipDuplicates: true,
        });
        return toGuest(await prisma.principal.findUniqueOrThrow({ where: { clerkUserId } }));
      }),

    claimGenerationSlot: (ownerId, day, limit) =>
      guard("claimGenerationSlot", async () => {
        if (limit <= 0) return false;
        // The WHERE makes the increment conditional inside one statement, so two
        // requests at once cannot both take the last slot.
        const rows = await prisma.$queryRaw<{ count: number }[]>`
          INSERT INTO "GenerationUsage" ("principalId", "day", "count")
          VALUES (${ownerId}, ${day}, 1)
          ON CONFLICT ("principalId", "day") DO UPDATE
            SET "count" = "GenerationUsage"."count" + 1
            WHERE "GenerationUsage"."count" < ${limit}::int
          RETURNING "count"`;
        return rows.length === 1;
      }),

    claimCompletion: (ownerId, completionId) =>
      guard("claimCompletion", async () => {
        const { count } = await prisma.completionClaim.createMany({
          data: [{ ownerId, completionId }],
          skipDuplicates: true,
        });
        return count === 1;
      }),

    releaseCompletion: (ownerId, completionId) =>
      guard("releaseCompletion", async () => {
        await prisma.completionClaim.deleteMany({ where: { ownerId, completionId } });
      }),

    appendLedger: (ownerId, entry) =>
      guard("appendLedger", async () => {
        await prisma.ledgerEntry.create({
          data: { ownerId, entry: entry as Prisma.InputJsonValue },
        });
      }),

    readLedger: (ownerId) =>
      guard("readLedger", async () => {
        const rows = await prisma.ledgerEntry.findMany({
          where: { ownerId },
          orderBy: { position: "asc" },
          take: MAX_LEDGER_ENTRIES,
          select: { entry: true },
        });
        return rows.map((row) => row.entry as unknown);
      }),

    disconnect: () => prisma.$disconnect(),
  };
}
