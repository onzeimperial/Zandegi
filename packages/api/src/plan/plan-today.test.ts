import { createInMemoryDemoStore } from "@zandegi/db";
import { describe, expect, it, vi } from "vitest";
import type { GenerationSafetyClass, MissionDraft } from "../client";
import { demoPortsFromStore } from "../demo-store";
import type { GuestPrincipal } from "../identity/ports";
import {
  fixedClock,
  sequentialIdGenerator,
  type GeneratedMissionRecord,
  type MissionGoalContext,
} from "../ports";
import { attemptBoss } from "../boss/attempt-boss";
import { completeStep } from "../progress/complete-step";
import { upcastMission, type StoredMissionDraft } from "./ids";
import { planTimezone, planToday, validTimezone } from "./plan-today";

const OWNER: GuestPrincipal = { id: "owner-1", createdAt: "2026-11-01T00:00:00.000Z" };
const SYDNEY = "Australia/Sydney";

const step = (index: number, minutes = 40) => ({
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: minutes,
  verification: "SELF" as const,
  guide: { approach: "Do it.", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
  sources: [],
  toolKinds: [],
});

const missionWith = (minutes: number[], nextChapter: number[] = []): StoredMissionDraft => ({
  title: "Conversational Farsi",
  goalType: "PROJECT",
  primaryDomain: "Mind",
  chapters: [
    {
      index: 0,
      title: "Sounds",
      exitCondition: "Read aloud",
      steps: minutes.map((m, i) => step(i, m)),
    },
    ...(nextChapter.length === 0
      ? []
      : [
          {
            index: 1,
            title: "Words",
            exitCondition: "Order a coffee",
            steps: nextChapter.map((m, i) => step(i, m)),
          },
        ]),
  ],
});

async function setup(
  options: {
    goalContext?: MissionGoalContext;
    minutes?: number[];
    nextChapter?: number[];
    generatedAt?: string;
  } = {},
) {
  const store = createInMemoryDemoStore<MissionDraft, GenerationSafetyClass, MissionGoalContext>();
  const demo = demoPortsFromStore(store);
  await demo.persistence.record({
    missionId: "m-1",
    ownerId: OWNER.id,
    runId: "run-1",
    generatedAt: options.generatedAt ?? "2026-11-01T00:00:00.000Z",
    goalText: "learn farsi",
    pursuitSlug: "learn-farsi",
    mission: upcastMission(
      missionWith(options.minutes ?? [40, 40, 40, 40, 40], options.nextChapter),
    ),
    safetyClass: "NORMAL",
    ...(options.goalContext === undefined ? {} : { goalContext: options.goalContext }),
  });
  const at = (iso: string) => ({
    persistence: demo.persistence,
    ledger: demo.ledger,
    clock: fixedClock(new Date(iso)),
  });
  const plan = async (iso: string, principal: GuestPrincipal = OWNER, browserTimezone?: unknown) =>
    (await planToday({ principal, browserTimezone }, at(iso))).plans["m-1"];
  const complete = (stepId: string, iso: string) =>
    completeStep(
      { principal: OWNER, missionId: "m-1", stepId, evidence: { kind: "SELF" } },
      { ...at(iso), ids: sequentialIdGenerator("evt") },
    );
  const skipToBoss = (chapterId: string, iso: string) =>
    attemptBoss(
      {
        principal: OWNER,
        missionId: "m-1",
        request: {
          chapterId,
          result: "not-yet",
          skipRest: true,
          attemptKey: "key-12345",
          tips: "x",
        },
        evidence: { kind: "SELF" },
      },
      { ...at(iso), plans: demo.plans, bosses: demo.bosses, ids: sequentialIdGenerator("boss") },
    );
  const ledgerSize = async () => (await store.readLedger(OWNER.id)).length;
  return { plan, complete, skipToBoss, ledgerSize };
}

const WEEK_600 = { timezone: SYDNEY, weeklyTimeBudgetMinutes: 600 };

describe("today's plan", () => {
  it("spreads five 40-minute steps over a 600-minute week: two today, the rest after", async () => {
    const { plan } = await setup({
      goalContext: WEEK_600,
      generatedAt: "2026-11-12T00:00:00.000Z",
    });
    // 10:00 on 12 November in Sydney.
    const today = await plan("2026-11-11T23:00:00.000Z");
    expect(today).toMatchObject({
      today: "2026-11-12",
      todayStepIds: ["0:0", "0:1"],
      doneTodayStepIds: [],
      upcoming: [
        { date: "2026-11-13", stepIds: ["0:2", "0:3"] },
        { date: "2026-11-14", stepIds: ["0:4"] },
        { date: "2026-11-15", stepIds: [] },
      ],
      laterStepCount: 0,
      doneForToday: false,
      finished: false,
      returningAfterGap: false,
      dailyMinutes: 86,
    });
  });

  it("keeps the same steps leading on two days with nothing done, with no ledger write", async () => {
    const { plan, ledgerSize } = await setup({
      goalContext: WEEK_600,
      generatedAt: "2026-11-11T22:00:00.000Z", // 09:00 on the 12th in Sydney
    });
    const first = await plan("2026-11-11T23:00:00.000Z"); // the 12th
    const second = await plan("2026-11-12T23:00:00.000Z"); // the 13th
    expect(first!.todayStepIds[0]).toBe("0:0");
    expect(second!.todayStepIds[0]).toBe("0:0");
    expect(second!.today).toBe("2026-11-13");
    expect(first!.returningAfterGap).toBe(false);
    // The morning after the mission began is not a gap yet.
    expect(second!.returningAfterGap).toBe(false);
    // A day later it is: the welcome-back line, never a "missed" state.
    const third = await plan("2026-11-13T23:00:00.000Z"); // the 14th
    expect(third!.todayStepIds[0]).toBe("0:0");
    expect(third!.returningAfterGap).toBe(true);
    expect(await ledgerSize()).toBe(0);
  });

  it("says today is done once today's steps are, and pulls nothing new in", async () => {
    const { plan, complete, ledgerSize } = await setup({
      goalContext: WEEK_600,
      generatedAt: "2026-11-11T13:00:00.000Z", // midnight on the 12th in Sydney
    });
    await complete("0:0", "2026-11-11T22:00:00.000Z"); // 09:00 on the 12th
    await complete("0:1", "2026-11-12T01:00:00.000Z"); // 12:00 on the 12th
    const before = await ledgerSize();
    const done = await plan("2026-11-12T05:00:00.000Z"); // 16:00 on the 12th
    expect(done).toMatchObject({
      todayStepIds: ["0:0", "0:1"],
      doneTodayStepIds: ["0:0", "0:1"],
      doneForToday: true,
      finished: false,
      returningAfterGap: false,
    });
    expect(done!.upcoming[0]).toEqual({ date: "2026-11-13", stepIds: ["0:2", "0:3"] });
    // Planning writes nothing to the ledger.
    expect(await ledgerSize()).toBe(before);
  });

  it("lets yesterday's undone steps lead today", async () => {
    const { plan, complete } = await setup({ goalContext: WEEK_600 });
    await complete("0:0", "2026-11-10T22:00:00.000Z"); // the 11th
    const today = await plan("2026-11-11T23:00:00.000Z"); // the 12th
    expect(today!.todayStepIds[0]).toBe("0:1");
    expect(today!.returningAfterGap).toBe(false);
  });

  it("gives one long step a day of its own", async () => {
    const { plan } = await setup({
      goalContext: { timezone: SYDNEY, weeklyTimeBudgetMinutes: 420 },
      minutes: [180, 20],
      generatedAt: "2026-11-12T00:00:00.000Z",
    });
    const today = await plan("2026-11-11T23:00:00.000Z");
    expect(today!.todayStepIds).toEqual(["0:0"]);
    expect(today!.upcoming[0]!.stepIds).toEqual(["0:1"]);
  });

  it("splits 23:30 and 00:30 in Sydney into different days", async () => {
    const { plan } = await setup({ goalContext: WEEK_600 });
    expect((await plan("2026-11-12T12:30:00.000Z"))!.today).toBe("2026-11-12");
    expect((await plan("2026-11-12T13:30:00.000Z"))!.today).toBe("2026-11-13");
  });

  it("holds 30 minutes a day with no budget", async () => {
    const { plan } = await setup({
      goalContext: { timezone: SYDNEY },
      minutes: [15, 15, 15],
      generatedAt: "2026-11-12T00:00:00.000Z",
    });
    const today = await plan("2026-11-11T23:00:00.000Z");
    expect(today!.dailyMinutes).toBe(30);
    expect(today!.todayStepIds).toEqual(["0:0", "0:1"]);
  });

  it("uses the browser's zone when the mission has none, and UTC when neither is usable", async () => {
    const { plan } = await setup({ generatedAt: "2026-11-12T00:00:00.000Z" });
    const instant = "2026-11-12T13:30:00.000Z"; // 00:30 on the 13th in Sydney
    expect((await plan(instant, OWNER, SYDNEY))!.today).toBe("2026-11-13");
    expect((await plan(instant, OWNER, "Mars/Olympus"))!.today).toBe("2026-11-12");
    expect((await plan(instant))!.today).toBe("2026-11-12");
  });

  it("prefers the mission's own zone over the browser's", () => {
    expect(planTimezone({ goalContext: { timezone: SYDNEY } }, "Europe/London")).toBe(SYDNEY);
    expect(planTimezone({ goalContext: { timezone: "nope" } }, "Europe/London")).toBe(
      "Europe/London",
    );
    expect(validTimezone(42)).toBeUndefined();
    expect(validTimezone("")).toBeUndefined();
    expect(validTimezone("x".repeat(101))).toBeUndefined();
  });

  it("marks a finished mission finished, with nothing done for today", async () => {
    const { plan, complete } = await setup({ goalContext: WEEK_600, minutes: [40] });
    await complete("0:0", "2026-11-10T22:00:00.000Z");
    const today = await plan("2026-11-11T23:00:00.000Z");
    expect(today).toMatchObject({
      todayStepIds: [],
      finished: true,
      doneForToday: false,
      returningAfterGap: false,
    });
  });

  it("never plans a step skipped at a boss: a closed chapter's undone steps are gone", async () => {
    const { plan, complete, skipToBoss } = await setup({ goalContext: WEEK_600 });
    await complete("0:0", "2026-11-10T22:00:00.000Z");
    await skipToBoss("0", "2026-11-10T22:30:00.000Z");
    const today = await plan("2026-11-11T23:00:00.000Z");
    expect(today).toMatchObject({
      todayStepIds: [],
      upcoming: [
        { date: "2026-11-13", stepIds: [] },
        { date: "2026-11-14", stepIds: [] },
        { date: "2026-11-15", stepIds: [] },
      ],
      laterStepCount: 0,
      finished: true,
      doneForToday: false,
    });
  });

  it("plans no step of a chapter still locked behind a waiting boss", async () => {
    const { plan, complete } = await setup({
      goalContext: WEEK_600,
      minutes: [40],
      nextChapter: [40, 40],
    });
    await complete("0:0", "2026-11-11T22:00:00.000Z");
    const today = await plan("2026-11-11T23:00:00.000Z");
    const planned = [
      ...(today?.todayStepIds ?? []),
      ...(today?.upcoming.flatMap((day) => day.stepIds) ?? []),
    ];
    expect(planned).not.toContain("1:0");
    expect(planned).not.toContain("1:1");
    expect(today?.laterStepCount).toBe(0);
  });

  it("leaves one malformed mission without a plan, and plans the rest", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const good: GeneratedMissionRecord = {
      missionId: "m-good",
      ownerId: OWNER.id,
      runId: "run-1",
      generatedAt: "2026-11-12T00:00:00.000Z",
      goalText: "learn farsi",
      pursuitSlug: "learn-farsi",
      mission: upcastMission(missionWith([40])),
      safetyClass: "NORMAL",
      goalContext: WEEK_600,
    };
    // A stored record whose goal context cannot even be read.
    const broken = {
      ...good,
      missionId: "m-broken",
      goalContext: Object.defineProperty({}, "timezone", {
        enumerable: true,
        get() {
          throw new TypeError("Learn five letters: unreadable");
        },
      }) as MissionGoalContext,
    };
    const result = await planToday(
      { principal: OWNER },
      {
        persistence: {
          record: async () => undefined,
          findForOwner: async () => null,
          listForOwner: async () => [broken, good],
        },
        ledger: {
          claim: async () => true,
          release: async () => undefined,
          append: async () => undefined,
          read: async () => [],
        },
        clock: fixedClock(new Date("2026-11-11T23:00:00.000Z")),
      },
    );
    expect(result.missions.map((mission) => mission.missionId)).toEqual(["m-broken", "m-good"]);
    expect(result.plans["m-broken"]).toBeUndefined();
    expect(result.plans["m-good"]?.todayStepIds).toEqual(["0:0"]);
    // The error class only: no step text in the log.
    expect(JSON.stringify(errors.mock.calls)).toContain("TypeError");
    expect(JSON.stringify(errors.mock.calls)).not.toContain("Learn five letters");
  });

  it("shows nobody else's missions", async () => {
    const { plan } = await setup({ goalContext: WEEK_600 });
    const intruder = { id: "owner-2", createdAt: OWNER.createdAt };
    expect(await plan("2026-11-11T23:00:00.000Z", intruder)).toBeUndefined();
  });
});
