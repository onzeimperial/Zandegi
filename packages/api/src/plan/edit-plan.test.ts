import { createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it } from "vitest";
import type { GenerationSafetyClass, MissionDraft, MissionStep, PlanEdit } from "../client";
import { demoPortsFromStore } from "../demo-store";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { readMission } from "../missions/read-mission";
import { fixedClock, sequentialIdGenerator, type MissionGoalContext } from "../ports";
import { completeStep, readProgress } from "../progress/complete-step";
import { applyPlanEdit, editPlan, parsePlanEditRequest } from "./edit-plan";
import { upcastMission, type StoredMissionDraft } from "./ids";

const OWNER: GuestPrincipal = { id: "owner-1", createdAt: "2026-11-12T00:00:00.000Z" };
const INTRUDER: GuestPrincipal = { id: "owner-2", createdAt: "2026-11-12T00:00:00.000Z" };

function legacyStep(index: number): StoredMissionDraft["chapters"][number]["steps"][number] {
  return {
    index,
    title: `Step ${index + 1}`,
    estimatedMinutes: 30,
    verification: "SELF",
    guide: { approach: "Do it.", materials: ["Shoes"], commonMistakes: [], whatGoodLooksLike: "" },
    sources: [{ title: "A source", date: "2026-01-01" }],
    toolKinds: [],
  };
}

/** Two chapters of two steps, stored as the release before ids stored them. */
const LEGACY: StoredMissionDraft = {
  title: "Half Marathon",
  goalType: "METRIC",
  primaryDomain: "Body",
  chapters: [
    { index: 0, title: "Base", exitCondition: "Run 5km", steps: [legacyStep(0), legacyStep(1)] },
    { index: 1, title: "Build", exitCondition: "Run 10km", steps: [legacyStep(0), legacyStep(1)] },
  ],
};

async function failure(run: () => Promise<unknown>): Promise<GenerationError> {
  const caught = await run().then(
    () => null,
    (error: unknown) => error,
  );
  expect(caught).toBeInstanceOf(GenerationError);
  return caught as GenerationError;
}

async function setup() {
  const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>();
  const demo = demoPortsFromStore(store);
  await demo.persistence.record({
    missionId: "m-1",
    ownerId: OWNER.id,
    runId: "run-1",
    generatedAt: "2026-11-12T00:00:00.000Z",
    goalText: "run a half marathon",
    pursuitSlug: "run-a-half-marathon",
    // why: a legacy record, stored without ids.
    mission: LEGACY as MissionDraft,
    safetyClass: "NORMAL",
  });
  const ports = {
    persistence: demo.persistence,
    ledger: demo.ledger,
    plans: demo.plans,
    clock: fixedClock(new Date("2026-11-12T09:00:00.000Z")),
    ids: sequentialIdGenerator("event"),
  };
  const read = (principal: GuestPrincipal = OWNER) =>
    readMission({ principal, missionId: "m-1" }, ports);
  const edit = async (change: PlanEdit, principal: GuestPrincipal = OWNER, version?: number) =>
    editPlan(
      {
        principal,
        missionId: "m-1",
        request: { version: version ?? (await read()).version, edit: change },
      },
      ports,
    );
  const complete = (stepId: string) =>
    completeStep({ principal: OWNER, missionId: "m-1", stepId, evidence: { kind: "SELF" } }, ports);
  const xp = async () => (await readProgress({ principal: OWNER }, ports)).totalXp;
  const stepIds = async () =>
    (await read()).mission.chapters.map((chapter) => chapter.steps.map((step) => step.id));
  return { store, ports, read, edit, complete, xp, stepIds };
}

describe("parsing a plan edit", () => {
  const parse = (body: unknown) => {
    try {
      parsePlanEditRequest(body);
      return "ok";
    } catch (error) {
      return (error as GenerationError).code;
    }
  };

  it("accepts each operation", () => {
    for (const edit of [
      { op: "renameChapter", chapterId: "0", title: "Warm up" },
      { op: "editStep", stepId: "0:0", title: "Jog" },
      { op: "editStep", stepId: "0:0", approach: "" },
      { op: "reorderSteps", chapterId: "0", stepIds: ["0:1", "0:0"] },
      { op: "addStep", chapterId: "0", title: "Stretch" },
      { op: "deleteStep", stepId: "0:1" },
    ]) {
      expect(parse({ version: 0, edit }), edit.op).toBe("ok");
    }
  });

  it.each([
    ["adding a chapter", { op: "addChapter", title: "Extra" }],
    ["removing a chapter", { op: "deleteChapter", chapterId: "1" }],
    [
      "editing an exit condition",
      { op: "renameChapter", chapterId: "0", title: "A", exitCondition: "B" },
    ],
    ["an empty step edit", { op: "editStep", stepId: "0:0" }],
    ["a blank title", { op: "addStep", chapterId: "0", title: "   " }],
    ["a title over two lines", { op: "addStep", chapterId: "0", title: "a\nb" }],
    ["a title over the limit", { op: "addStep", chapterId: "0", title: "x".repeat(201) }],
    ["an unknown field", { op: "deleteStep", stepId: "0:0", xp: 40 }],
    ["a malformed id", { op: "deleteStep", stepId: "../0" }],
  ])("refuses %s", (_label, edit) => {
    expect(parse({ version: 0, edit })).toBe("INVALID_REQUEST");
  });

  it("refuses a bad version and an extra top-level field", () => {
    const edit = { op: "deleteStep", stepId: "0:0" };
    expect(parse({ version: -1, edit })).toBe("INVALID_REQUEST");
    expect(parse({ version: "0", edit })).toBe("INVALID_REQUEST");
    expect(parse({ version: 0, edit, missionId: "m-2" })).toBe("INVALID_REQUEST");
  });
});

describe("applying a plan edit", () => {
  const mission = upcastMission(LEGACY);

  it("marks an edited generated step as the person's own and drops its sources", () => {
    const edited = applyPlanEdit(mission, { op: "editStep", stepId: "0:1", title: "Jog 2km" });
    const step = edited.chapters[0]!.steps[1]!;
    expect(step).toMatchObject({ id: "0:1", title: "Jog 2km", writtenBy: "person", sources: [] });
    // The rest of the guide is untouched, and so is the input.
    expect(step.guide.materials).toEqual(["Shoes"]);
    expect(mission.chapters[0]!.steps[1]!.writtenBy).toBeUndefined();
  });

  it("renames a chapter and nothing else", () => {
    const edited = applyPlanEdit(mission, { op: "renameChapter", chapterId: "1", title: "Peak" });
    expect(edited.chapters[1]).toMatchObject({ title: "Peak", exitCondition: "Run 10km" });
  });

  it("refuses a reorder that is not a permutation of the chapter", () => {
    for (const stepIds of [["0:0"], ["0:0", "0:0"], ["0:0", "1:0"], ["0:1", "0:0", "own-9"]]) {
      expect(() => applyPlanEdit(mission, { op: "reorderSteps", chapterId: "0", stepIds })).toThrow(
        GenerationError,
      );
    }
  });

  it("never reuses an added step's id, even after deleting it", () => {
    const added = applyPlanEdit(mission, { op: "addStep", chapterId: "0", title: "Stretch" });
    const step = added.chapters[0]!.steps[2] as MissionStep;
    expect(step).toMatchObject({ id: "own-1", writtenBy: "person", sources: [], index: 2 });
    const deleted = applyPlanEdit(added, { op: "deleteStep", stepId: "own-1" });
    const again = applyPlanEdit(deleted, { op: "addStep", chapterId: "0", title: "Stretch" });
    expect(again.chapters[0]!.steps.map((entry) => entry.id)).toEqual(["0:0", "0:1", "own-2"]);
  });

  it("refuses to delete a chapter's last step, which would remove the chapter", () => {
    const one = applyPlanEdit(mission, { op: "deleteStep", stepId: "0:0" });
    expect(() => applyPlanEdit(one, { op: "deleteStep", stepId: "0:1" })).toThrow(GenerationError);
  });

  it("refuses an id that is not in the mission", () => {
    expect(() => applyPlanEdit(mission, { op: "deleteStep", stepId: "7:0" })).toThrow(
      GenerationError,
    );
    expect(() =>
      applyPlanEdit(mission, { op: "renameChapter", chapterId: "9", title: "Nope" }),
    ).toThrow(GenerationError);
  });
});

describe("editing a plan (the I/O matrix)", () => {
  it("saves an edit, bumps the version, and keeps it for the next read", async () => {
    const { edit, read } = await setup();
    const saved = await edit({ op: "renameChapter", chapterId: "0", title: "Warm up" });
    expect(saved.version).toBe(1);
    expect((await read()).mission.chapters[0]!.title).toBe("Warm up");
    expect((await read()).version).toBe(1);
  });

  it("reorder: a done step stays done, and the next step is the first undone in the new order", async () => {
    const { edit, complete, read, ports } = await setup();
    await complete("0:0");
    await edit({ op: "reorderSteps", chapterId: "0", stepIds: ["0:1", "0:0"] });

    const progress = await readProgress({ principal: OWNER }, ports);
    expect(progress.completions.map((entry) => entry.stepId)).toEqual(["0:0"]);
    expect((await read()).mission.chapters[0]!.steps.map((step) => step.id)).toEqual([
      "0:1",
      "0:0",
    ]);
    // 0:1 is now the next step, and the first one that can be completed.
    expect((await failure(() => complete("1:0"))).code).toBe("STEP_NOT_CURRENT");
    expect((await complete("0:1")).awards).toEqual([
      { kind: "step", xp: 40 },
      { kind: "chapter", xp: 200 },
    ]);
  });

  it("delete paid step: XP is unchanged and the step leaves the path", async () => {
    const { edit, complete, xp, stepIds, store } = await setup();
    await complete("0:0");
    const ledgerBefore = await store.readLedger(OWNER.id);
    await edit({ op: "deleteStep", stepId: "0:0" });

    expect(await xp()).toBe(40);
    expect((await stepIds())[0]).toEqual(["0:1"]);
    // Laws 3 and 4: editing writes, rewrites and removes no ledger event.
    expect(await store.readLedger(OWNER.id)).toEqual(ledgerBefore);
  });

  it("stale edit: nothing is saved, and the code is PLAN_EDIT_CONFLICT", async () => {
    const { edit, read } = await setup();
    await edit({ op: "renameChapter", chapterId: "0", title: "First" });
    const error = await failure(() =>
      edit({ op: "renameChapter", chapterId: "0", title: "Stale" }, OWNER, 0),
    );
    expect(error.code).toBe("PLAN_EDIT_CONFLICT");
    expect((await read()).mission.chapters[0]!.title).toBe("First");
  });

  it("stale edit: a version that moves during the edit is a conflict too", async () => {
    const { ports, read } = await setup();
    const racing = {
      ...ports,
      plans: { update: async () => "conflict" as const },
    };
    const error = await failure(() =>
      editPlan(
        {
          principal: OWNER,
          missionId: "m-1",
          request: { version: 0, edit: { op: "deleteStep", stepId: "0:0" } },
        },
        racing,
      ),
    );
    expect(error.code).toBe("PLAN_EDIT_CONFLICT");
    expect((await read()).version).toBe(0);
  });

  it("chapter add or remove: nothing is saved, and the code is INVALID_REQUEST", async () => {
    const { ports, read } = await setup();
    for (const change of [
      { op: "addChapter", title: "Extra" },
      { op: "deleteChapter", chapterId: "1" },
    ]) {
      const error = await failure(() =>
        editPlan(
          { principal: OWNER, missionId: "m-1", request: { version: 0, edit: change } },
          ports,
        ),
      );
      expect(error.code).toBe("INVALID_REQUEST");
    }
    expect((await read()).version).toBe(0);
    expect((await read()).mission.chapters).toHaveLength(2);
  });

  it("re-add after delete: the new step gets a new id and can never collect the old claim", async () => {
    const { edit, complete, xp, stepIds } = await setup();
    await complete("0:0");
    await edit({ op: "deleteStep", stepId: "0:0" });
    await edit({ op: "addStep", chapterId: "0", title: "Step 1" });
    expect((await stepIds())[0]).toEqual(["0:1", "own-1"]);

    await complete("0:1");
    // The look-alike is a new step: completing it pays nothing and is recorded
    // under its own id, never the deleted step's.
    const result = await complete("own-1");
    expect(result.awards[0]).toEqual({ kind: "step", xp: 0 });
    expect(result.progress.completions.map((entry) => entry.stepId)).toEqual([
      "0:0",
      "0:1",
      "own-1",
    ]);
    expect(await xp()).toBe(40 + 40 + 0 + 200);
  });

  it("an added step pays nothing, must be done to finish its chapter, and cannot raise the bonus", async () => {
    const { edit, complete, xp } = await setup();
    await edit({ op: "addStep", chapterId: "0", title: "Stretch" });
    await complete("0:0");
    const second = await complete("0:1");
    // The chapter is not finished: the added step is still to do.
    expect(second.awards).toEqual([{ kind: "step", xp: 40 }]);
    const added = await complete("own-1");
    // Priced from the two generated steps completed: the same 200 as unedited.
    expect(added.awards).toEqual([
      { kind: "step", xp: 0 },
      { kind: "chapter", xp: 200 },
    ]);
    expect(await xp()).toBe(280);
  });

  it("deleting an undone step can only lower a bonus, never raise it", async () => {
    const { edit, complete } = await setup();
    await edit({ op: "deleteStep", stepId: "0:1" });
    const finishing = await complete("0:0");
    expect(finishing.awards).toEqual([
      { kind: "step", xp: 40 },
      { kind: "chapter", xp: 100 },
    ]);
  });

  it("foreign mission: nothing is saved or revealed", async () => {
    const { edit, read } = await setup();
    const error = await failure(() =>
      edit({ op: "renameChapter", chapterId: "0", title: "Mine now" }, INTRUDER, 0),
    );
    expect(error.code).toBe("MISSION_NOT_FOUND");
    expect(error.message).toBe("That mission is not available.");
    expect((await read()).mission.chapters[0]!.title).toBe("Base");
  });
});

describe("edits after review", () => {
  it("writes no bonus for a chapter finished with no generated step done", async () => {
    const { edit, complete, store } = await setup();
    await edit({ op: "addStep", chapterId: "0", title: "My own way in" });
    await edit({ op: "deleteStep", stepId: "0:0" });
    await edit({ op: "deleteStep", stepId: "0:1" });

    const result = await complete("own-1");
    expect(result.awards).toEqual([{ kind: "step", xp: 0 }]);
    const types = (await store.readLedger(OWNER.id)).map(
      (entry) => (entry as { type: string }).type,
    );
    // The claim stays unspent, so a later reward policy can still pay it.
    expect(types).toEqual(["StepCompleted"]);
  });

  it("an added step cannot raise the mission bonus", async () => {
    const unedited = await setup();
    for (const id of ["0:0", "0:1", "1:0"]) await unedited.complete(id);
    const plain = (await unedited.complete("1:1")).awards.find((a) => a.kind === "mission");

    const edited = await setup();
    await edited.edit({ op: "addStep", chapterId: "0", title: "Stretch" });
    for (const id of ["0:0", "0:1", "own-1", "1:0"]) await edited.complete(id);
    const withAdded = (await edited.complete("1:1")).awards.find((a) => a.kind === "mission");

    expect(plain).toEqual({ kind: "mission", xp: 800 });
    expect(withAdded).toEqual(plain);
  });

  it("deleting undone steps can only lower the mission bonus", async () => {
    const { edit, complete } = await setup();
    await edit({ op: "deleteStep", stepId: "0:1" });
    await edit({ op: "deleteStep", stepId: "1:1" });
    await complete("0:0");
    const last = await complete("1:0");
    expect(last.awards.find((a) => a.kind === "mission")).toEqual({ kind: "mission", xp: 400 });
  });

  it("treats an edit that changes nothing as a no-op that keeps sources and version", async () => {
    const { edit, read } = await setup();
    const mission = upcastMission(LEGACY);
    expect(
      applyPlanEdit(mission, {
        op: "editStep",
        stepId: "0:0",
        title: "Step 1",
        approach: "Do it.",
      }),
    ).toBe(mission);

    const saved = await edit({ op: "editStep", stepId: "0:0", title: "Step 1" });
    expect(saved.version).toBe(0);
    expect((await read()).mission.chapters[0]!.steps[0]).toMatchObject({
      sources: [{ title: "A source" }],
    });
    expect((await read()).mission.chapters[0]!.steps[0]!.writtenBy).toBeUndefined();
  });

  it("drops a model-written claim that would lose its source when the step is edited", () => {
    const mission = upcastMission(LEGACY);
    const first = mission.chapters[0]!;
    const claimy = {
      ...mission,
      chapters: [
        {
          ...first,
          steps: [
            {
              ...first.steps[0]!,
              guide: {
                approach: "Do it.",
                materials: ["Shoes", "You must pay a $50 entry fee."],
                commonMistakes: ["Going too fast."],
                whatGoodLooksLike: "You finish.",
              },
            },
            first.steps[1]!,
          ],
        },
        mission.chapters[1]!,
      ],
    };
    const edited = applyPlanEdit(claimy, { op: "editStep", stepId: "0:0", title: "Jog" });
    expect(edited.chapters[0]!.steps[0]!.guide).toEqual({
      approach: "Do it.",
      materials: ["Shoes"],
      commonMistakes: ["Going too fast."],
      whatGoodLooksLike: "You finish.",
    });
  });
});
