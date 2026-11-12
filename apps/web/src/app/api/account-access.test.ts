/**
 * The three API routes with Clerk switched on: every row of the identity matrix,
 * end to end through the real session code, allowlist decision, cap and in-memory
 * store. Only two things are replaced: Clerk's session (it needs real keys) and
 * the content pipeline (it needs a model).
 */

import { resetDemoPortsCache } from "@zandegi/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  userId: null as string | null,
  emails: [] as { emailAddress: string; verification: { status: string } | null }[],
  failure: null as Error | null,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => {
    if (session.failure !== null) throw session.failure;
    return { userId: session.userId };
  },
  currentUser: async () =>
    session.userId === null ? null : { id: session.userId, emailAddresses: session.emails },
}));

const pipeline = vi.hoisted(() => ({ calls: 0, owners: [] as string[] }));

function draftOutcome() {
  return {
    draft: {
      goalText: "learn farsi",
      pursuitSlug: "learn-farsi",
      mission: {
        title: "Conversational Farsi",
        goalType: "PROJECT",
        primaryDomain: "Mind",
        chapters: [
          {
            index: 0,
            title: "Sounds",
            exitCondition: "Read the alphabet aloud",
            steps: [
              {
                index: 0,
                title: "Learn five letters",
                estimatedMinutes: 20,
                verification: "SELF",
                guide: {
                  approach: "Copy them out.",
                  materials: [],
                  commonMistakes: [],
                  whatGoodLooksLike: "You can read them.",
                },
                sources: [],
                toolKinds: [],
              },
            ],
          },
        ],
      },
      grounding: { claimsChecked: 0, ungroundedClaims: [], rewritten: 0, dropped: 0 },
      safety: {
        safetyClass: "NORMAL",
        blocked: false,
        professionalFrameApplied: false,
        redactions: [],
      },
      modelsUsed: {},
    },
  };
}

vi.mock("@zandegi/api", async () => {
  const actual = await vi.importActual<typeof import("@zandegi/api")>("@zandegi/api");
  return {
    ...actual,
    generateMission: (
      input: Parameters<typeof actual.generateMission>[0],
      ports: Parameters<typeof actual.generateMission>[1],
    ) => {
      pipeline.calls += 1;
      pipeline.owners.push(input.principal.id);
      return actual.generateMission(input, {
        ...ports,
        draftGenerator: async () => draftOutcome() as never,
      });
    },
  };
});

const { POST: generate } = await import("./generate/route");
const { GET: read } = await import("./missions/[id]/route");
const { POST: complete } = await import("./missions/[id]/complete/route");
const { PATCH: editPlanRoute } = await import("./missions/[id]/plan/route");
const { GET: readLogs, POST: writeLog } = await import("./missions/[id]/logs/route");
const { PATCH: moveLogRoute } = await import("./missions/[id]/logs/[logId]/route");
const { POST: bossRoute } = await import("./missions/[id]/boss/route");

const ORIGIN = "http://localhost";
const INVITED = "invited@example.com";

function signIn(userId: string, emailAddress = INVITED, status = "verified") {
  session.userId = userId;
  session.emails = [{ emailAddress, verification: { status } }];
}

function postGenerate() {
  return generate(
    new Request(`${ORIGIN}/api/generate`, {
      method: "POST",
      body: JSON.stringify({ rawText: "learn farsi" }),
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
    }),
  );
}

function getMission(id: string) {
  return read(new Request(`${ORIGIN}/api/missions/${id}`), {
    params: Promise.resolve({ id }),
  });
}

async function postComplete(id: string, stepId?: string) {
  const form = new FormData();
  if (stepId === undefined) {
    // The fields a page open from before stable ids still sends.
    form.set("chapter", "0");
    form.set("step", "0");
  } else {
    form.set("stepId", stepId);
  }
  form.set("evidence", "SELF");
  const encoded = new Response(form);
  const bytes = await encoded.arrayBuffer();
  return complete(
    new Request(`${ORIGIN}/api/missions/${id}/complete`, {
      method: "POST",
      body: bytes,
      headers: {
        "content-type": encoded.headers.get("content-type")!,
        "content-length": String(bytes.byteLength),
        origin: ORIGIN,
      },
    }),
    { params: Promise.resolve({ id }) },
  );
}

async function postBoss(id: string) {
  const form = new FormData();
  form.set("chapterId", "0");
  form.set("result", "done");
  form.set("evidence", "SELF");
  form.set("attemptKey", "access-key-1");
  form.set("wentWell", "Read every letter");
  const encoded = new Response(form);
  const bytes = await encoded.arrayBuffer();
  return bossRoute(
    new Request(`${ORIGIN}/api/missions/${id}/boss`, {
      method: "POST",
      body: bytes,
      headers: {
        "content-type": encoded.headers.get("content-type")!,
        "content-length": String(bytes.byteLength),
        origin: ORIGIN,
      },
    }),
    { params: Promise.resolve({ id }) },
  );
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(`${ORIGIN}${url}`, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
  });
}

function patchPlan(id: string, body: unknown) {
  return editPlanRoute(jsonRequest(`/api/missions/${id}/plan`, "PATCH", body), {
    params: Promise.resolve({ id }),
  });
}

function postLog(id: string, body: unknown) {
  return writeLog(jsonRequest(`/api/missions/${id}/logs`, "POST", body), {
    params: Promise.resolve({ id }),
  });
}

function getLogs(id: string) {
  return readLogs(new Request(`${ORIGIN}/api/missions/${id}/logs`), {
    params: Promise.resolve({ id }),
  });
}

function patchLog(id: string, logId: string, body: unknown) {
  return moveLogRoute(jsonRequest(`/api/missions/${id}/logs/${logId}`, "PATCH", body), {
    params: Promise.resolve({ id, logId }),
  });
}

const RENAME = { version: 0, edit: { op: "renameChapter", chapterId: "0", title: "Warm up" } };
const NOTE = { kind: "note", text: "Practised five letters on the train" };

async function generatedMissionId(): Promise<string> {
  const response = await postGenerate();
  expect(response.status).toBe(200);
  const text = await response.text();
  const terminal = text
    .split("\n\n")
    .filter((block) => block.startsWith("data:"))
    .map((block) => JSON.parse(block.slice(5)) as { type: string; result?: { missionId: string } })
    .at(-1);
  return terminal!.result!.missionId;
}

async function expectCode(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error: { code } });
}

beforeEach(() => {
  resetDemoPortsCache();
  session.userId = null;
  session.emails = [];
  session.failure = null;
  pipeline.calls = 0;
  pipeline.owners = [];
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
  vi.stubEnv("ZANDEGI_ALLOWED_EMAILS", INVITED);
  vi.stubEnv("ZANDEGI_DAILY_GENERATION_LIMIT", "");
  vi.stubEnv("ZANDEGI_MISSION_STORE", "memory");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("ZANDEGI_ALLOWED_ORIGINS", "");
  vi.stubEnv("VERCEL", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("signed out", () => {
  it("is refused by every route, with no model call", async () => {
    await expectCode(await postGenerate(), 401, "SIGN_IN_REQUIRED");
    await expectCode(await getMission("m-1"), 401, "SIGN_IN_REQUIRED");
    await expectCode(await postComplete("m-1"), 401, "SIGN_IN_REQUIRED");
    await expectCode(await patchPlan("m-1", RENAME), 401, "SIGN_IN_REQUIRED");
    await expectCode(await postLog("m-1", NOTE), 401, "SIGN_IN_REQUIRED");
    await expectCode(await getLogs("m-1"), 401, "SIGN_IN_REQUIRED");
    await expectCode(await patchLog("m-1", "l-1", { chapterId: "0" }), 401, "SIGN_IN_REQUIRED");
    await expectCode(await postBoss("m-1"), 401, "SIGN_IN_REQUIRED");
    expect(pipeline.calls).toBe(0);
  });
});

describe("signed in but not invited", () => {
  it.each([
    ["an address not on the list", "stranger@example.com", "verified"],
    ["an invited address it has not verified", INVITED, "unverified"],
  ])("refuses %s on every route, with no spend", async (_label, email, status) => {
    signIn("user_stranger", email, status);
    await expectCode(await postGenerate(), 403, "ACCOUNT_NOT_ALLOWED");
    await expectCode(await getMission("m-1"), 403, "ACCOUNT_NOT_ALLOWED");
    await expectCode(await postComplete("m-1"), 403, "ACCOUNT_NOT_ALLOWED");
    await expectCode(await patchPlan("m-1", RENAME), 403, "ACCOUNT_NOT_ALLOWED");
    await expectCode(await postLog("m-1", NOTE), 403, "ACCOUNT_NOT_ALLOWED");
    await expectCode(await getLogs("m-1"), 403, "ACCOUNT_NOT_ALLOWED");
    await expectCode(await patchLog("m-1", "l-1", { chapterId: "0" }), 403, "ACCOUNT_NOT_ALLOWED");
    await expectCode(await postBoss("m-1"), 403, "ACCOUNT_NOT_ALLOWED");
    expect(pipeline.calls).toBe(0);
  });

  it("is told no even when an account has no verification record", async () => {
    session.userId = "user_x";
    session.emails = [{ emailAddress: INVITED, verification: null }];
    await expectCode(await postGenerate(), 403, "ACCOUNT_NOT_ALLOWED");
  });
});

describe("an invited person", () => {
  it("generates, reads and completes, and no guest cookie is involved", async () => {
    signIn("user_a");
    const generated = await postGenerate();
    expect(generated.headers.get("set-cookie")).toBeNull();
    await generated.text();

    const id = await generatedMissionId();
    const reading = await getMission(id);
    expect(reading.status).toBe(200);
    expect(reading.headers.get("set-cookie")).toBeNull();
    expect(await reading.json()).toMatchObject({ mission: { missionId: id } });

    const done = await postComplete(id);
    expect(done.status).toBe(200);
    const { result } = (await done.json()) as {
      result: { awards: { kind: string; xp: number }[] };
    };
    expect(result.awards[0]).toEqual({ kind: "step", xp: 40 });
  });

  it("has the same principal on a second device, because identity is the account", async () => {
    signIn("user_a");
    await (await postGenerate()).text();
    await (await postGenerate()).text();
    expect(new Set(pipeline.owners).size).toBe(1);
    expect(pipeline.owners[0]).not.toBe("user_a");
  });

  it("gets one principal from two concurrent first requests", async () => {
    signIn("user_a");
    const [first, second] = await Promise.all([postGenerate(), postGenerate()]);
    await Promise.all([first.text(), second.text()]);
    expect(pipeline.owners).toHaveLength(2);
    expect(new Set(pipeline.owners).size).toBe(1);
  });

  it("cannot see another invited person's mission", async () => {
    signIn("user_a");
    const id = await generatedMissionId();
    signIn("user_b");
    await expectCode(await getMission(id), 404, "MISSION_NOT_FOUND");
    await expectCode(await postComplete(id), 404, "MISSION_NOT_FOUND");
    await expectCode(await patchPlan(id, RENAME), 404, "MISSION_NOT_FOUND");
    await expectCode(await postLog(id, NOTE), 404, "MISSION_NOT_FOUND");
    await expectCode(await getLogs(id), 404, "MISSION_NOT_FOUND");
    await expectCode(await postBoss(id), 404, "MISSION_NOT_FOUND");
    signIn("user_a");
    expect(await (await getMission(id)).json()).toMatchObject({
      mission: { version: 0, mission: { chapters: [{ title: "Sounds" }] } },
    });
  });

  it("edits and logs on one device and finds it all on another, with XP moved only by steps", async () => {
    signIn("user_a");
    const id = await generatedMissionId();
    expect((await postComplete(id)).status).toBe(200);

    expect((await patchPlan(id, RENAME)).status).toBe(200);
    const added = await patchPlan(id, {
      version: 1,
      edit: { op: "addStep", chapterId: "0", title: "Say them aloud" },
    });
    expect(added.status).toBe(200);
    const logged = await postLog(id, NOTE);
    expect(logged.status).toBe(200);
    const { log } = (await logged.json()) as { log: { logId: string; chapterId: string } };
    expect(log.chapterId).toBe("0");

    // A second device is a fresh request with the same account.
    const reread = (await (await getMission(id)).json()) as {
      mission: {
        version: number;
        mission: { chapters: { title: string; steps: { id: string }[] }[] };
      };
    };
    expect(reread.mission.version).toBe(2);
    expect(reread.mission.mission.chapters[0]!.title).toBe("Warm up");
    expect(reread.mission.mission.chapters[0]!.steps.map((step) => step.id)).toEqual([
      "0:0",
      "own-1",
    ]);
    expect(await (await getLogs(id)).json()).toMatchObject({
      logs: [{ logId: log.logId, text: NOTE.text }],
    });
    expect((await patchLog(id, log.logId, { chapterId: "0" })).status).toBe(200);

    // The added step pays nothing, and nothing the edits did moved the total.
    const finishing = await postComplete(id, "own-1");
    const { result } = (await finishing.json()) as {
      result: { awards: { kind: string; xp: number }[]; progress: { totalXp: number } };
    };
    expect(result.awards).toEqual([{ kind: "step", xp: 0 }]);
    expect(result.progress.totalXp).toBe(40);

    // The chapter's boss, beaten on this device, closes the one-chapter
    // mission: the done band and the fixed mission reward.
    const boss = await postBoss(id);
    expect(boss.status).toBe(200);
    const beaten = (await boss.json()) as {
      result: { awards: { kind: string; xp: number }[]; progress: { totalXp: number } };
    };
    expect(beaten.result.awards).toEqual([
      { kind: "boss", xp: 400 },
      { kind: "mission", xp: 1500 },
    ]);
    expect(beaten.result.progress.totalXp).toBe(40 + 400 + 1500);
  });
});

describe("the daily cap", () => {
  beforeEach(() => {
    vi.stubEnv("ZANDEGI_DAILY_GENERATION_LIMIT", "2");
    signIn("user_a");
  });

  it("stops the model call, keeps missions usable, and sells nothing", async () => {
    const id = await generatedMissionId();
    await generatedMissionId();
    expect(pipeline.calls).toBe(2);

    const capped = await postGenerate();
    expect(capped.status).toBe(429);
    const body = (await capped.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("DAILY_LIMIT_REACHED");
    expect(body.error.message).not.toMatch(/upgrade|buy|premium|hurry|only|left|tomorrow|built/i);
    expect(pipeline.calls).toBe(2);

    expect((await getMission(id)).status).toBe(200);
    expect((await postComplete(id)).status).toBe(200);
  });

  it("counts each person separately", async () => {
    await generatedMissionId();
    await generatedMissionId();
    signIn("user_b");
    expect(await generatedMissionId()).toBeTruthy();
  });

  it("uses five as the default", async () => {
    vi.stubEnv("ZANDEGI_DAILY_GENERATION_LIMIT", "");
    for (let run = 0; run < 5; run += 1) await generatedMissionId();
    expect((await postGenerate()).status).toBe(429);
  });
});

describe("failing closed", () => {
  it.each<[string, Record<string, string>]>([
    ["no Clerk keys", { CLERK_SECRET_KEY: "", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "" }],
    ["an empty allowlist", { ZANDEGI_ALLOWED_EMAILS: "" }],
  ])("disables the APIs in production with %s", async (_label, env) => {
    vi.stubEnv("NODE_ENV", "production");
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    signIn("user_a");
    await expectCode(await postGenerate(), 503, "GENERATION_DISABLED");
    await expectCode(await getMission("m-1"), 503, "GENERATION_DISABLED");
    await expectCode(await postComplete("m-1"), 503, "GENERATION_DISABLED");
    expect(pipeline.calls).toBe(0);
  });

  it("refuses the memory store in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    signIn("user_a");
    await expectCode(await postGenerate(), 503, "STORE_UNAVAILABLE");
    expect(pipeline.calls).toBe(0);
  });

  it("treats a Clerk outage as unavailable rather than as anyone's identity", async () => {
    session.failure = new Error("clerk failed with key sk_test_x");
    const response = await postGenerate();
    const text = await response.clone().text();
    await expectCode(response, 503, "STORE_UNAVAILABLE");
    expect(text).not.toContain("sk_test_x");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("sk_test_x");
    expect(pipeline.calls).toBe(0);
  });

  it("answers a database outage with the stable code, logging no URL or password", async () => {
    vi.stubEnv("ZANDEGI_MISSION_STORE", "postgres");
    vi.stubEnv("DATABASE_URL", "postgresql://zuser:hunter2@127.0.0.1:1/zdb?sslmode=disable");
    signIn("user_a");
    const response = await postGenerate();
    const text = await response.clone().text();
    await expectCode(response, 503, "STORE_UNAVAILABLE");

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("STORE_UNAVAILABLE");
    for (const secret of ["hunter2", "zuser", "zdb", "127.0.0.1"]) {
      expect(logged).not.toContain(secret);
      expect(text).not.toContain(secret);
    }
    expect(pipeline.calls).toBe(0);
  }, 30_000);
});
