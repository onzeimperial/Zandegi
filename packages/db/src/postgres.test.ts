/**
 * Postgres behaviour with no network and no credentials: PGlite is real
 * Postgres compiled to WebAssembly, served over the wire protocol so the real
 * `@prisma/adapter-pg` driver connects to it as it would to Neon. The schema
 * comes from the migration itself, so this also proves it applies to an empty
 * database.
 */

import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresDemoStore, type PostgresDemoStore } from "./postgres";
import { describeStoreContract } from "./store-contract";
import { StoreUnavailableError } from "./store";

const MIGRATIONS = fileURLToPath(new URL("../prisma/migrations", import.meta.url));
const SLOW = 60_000;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve((address as { port: number }).port));
    });
  });
}

let database: PGlite;
let server: PGLiteSocketServer;
let url: string;
let store: PostgresDemoStore;

beforeAll(async () => {
  database = await PGlite.create();
  for (const entry of readdirSync(MIGRATIONS, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    await database.exec(readFileSync(`${MIGRATIONS}/${entry.name}/migration.sql`, "utf8"));
  }
  const port = await freePort();
  server = new PGLiteSocketServer({ db: database, port, host: "127.0.0.1", maxConnections: 8 });
  await server.start();
  url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
  store = await createPostgresDemoStore({ url });
  // The first query loads the client and connects, which can outlast the default
  // timeout of whichever test happens to run first.
  await store.listMissions("warm-up");
}, SLOW);

afterAll(async () => {
  await store?.disconnect();
  await server?.stop();
  await database?.close();
}, SLOW);

describeStoreContract("postgres", () => store);

describe("postgres durability and integrity", () => {
  async function ownerWithLedgerEntry(): Promise<string> {
    const { id } = await store.findOrCreateAccountPrincipal(`clerk-${crypto.randomUUID()}`, {
      id: crypto.randomUUID(),
      createdAt: "2026-11-04T00:00:00.000Z",
    });
    await store.appendLedger(id, { xp: 40 });
    return id;
  }

  it("keeps missions and ledger entries across a restart", async () => {
    const owner = await ownerWithLedgerEntry();
    await store.recordMission({
      missionId: `m-${owner}`,
      ownerId: owner,
      runId: "run",
      generatedAt: "2026-11-04T00:00:00.000Z",
      goalText: "goal",
      pursuitSlug: "goal",
      mission: { title: "Kept" },
      safetyClass: "NORMAL",
    });

    // A fresh client and pool is what a restarted server has.
    const restarted = await createPostgresDemoStore({ url });
    try {
      expect(await restarted.findMission(owner, `m-${owner}`)).toMatchObject({
        mission: { title: "Kept" },
      });
      expect(await restarted.readLedger(owner)).toEqual([{ xp: 40 }]);
    } finally {
      await restarted.disconnect();
    }
  });

  it.each([
    [
      "UPDATE",
      (owner: string) => `UPDATE "LedgerEntry" SET "entry" = '{}' WHERE "ownerId" = '${owner}'`,
    ],
    ["DELETE", (owner: string) => `DELETE FROM "LedgerEntry" WHERE "ownerId" = '${owner}'`],
    ["TRUNCATE", () => `TRUNCATE "LedgerEntry"`],
  ])("rejects %s on the ledger in the database itself", async (operation, sql) => {
    const owner = await ownerWithLedgerEntry();
    await expect(database.query(sql(owner))).rejects.toThrow(`append-only: ${operation}`);
    expect(await store.readLedger(owner)).toEqual([{ xp: 40 }]);
  });

  it(
    "fails with a stable error that names no host, user or password",
    async () => {
      const port = await freePort();
      const secretUrl = `postgresql://zandegi_user:hunter2secret@127.0.0.1:${port}/zandegi_db?sslmode=disable`;
      const unreachable = await createPostgresDemoStore({ url: secretUrl });
      try {
        const failure = await unreachable.listMissions("owner").catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(StoreUnavailableError);
        const { detail, message, cause } = failure as StoreUnavailableError;
        expect(cause).toBeUndefined();
        for (const secret of [
          "hunter2secret",
          "zandegi_user",
          "zandegi_db",
          "127.0.0.1",
          String(port),
        ]) {
          expect(`${detail} ${message}`).not.toContain(secret);
        }
      } finally {
        await unreachable.disconnect();
      }
    },
    SLOW,
  );

  it("refuses to build a store with no url", async () => {
    await expect(createPostgresDemoStore({ url: "  " })).rejects.toBeInstanceOf(
      StoreUnavailableError,
    );
  });
});
