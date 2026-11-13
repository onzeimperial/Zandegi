import { renderToStaticMarkup } from "react-dom/server";
import { foldProgress } from "@zandegi/api";
import type { StoredMissionView, TodayPlan } from "@zandegi/api/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GuestMissions } from "@/lib/guest-missions";

const loaded = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("@/lib/guest-missions", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/guest-missions")>("@/lib/guest-missions");
  // The real `stepStates` and labels; only the loading is replaced.
  return { ...actual, loadGuestMissions: async () => loaded.value };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
  redirect: (target: string) => {
    throw new Error(`redirect:${target}`);
  },
}));
vi.mock("@/components/account", () => ({
  SignOut: () => <button type="button">Sign out</button>,
}));

const { default: TodayPage } = await import("./page");

const step = (index: number) => ({
  id: `0:${index}`,
  index,
  title: `Step ${index + 1}`,
  estimatedMinutes: 30,
  verification: "SELF" as const,
  guide: { approach: "", materials: [], commonMistakes: [], whatGoodLooksLike: "" },
  sources: [],
  toolKinds: [],
});

const mission = (missionId: string, title: string): StoredMissionView => ({
  missionId,
  generatedAt: "2026-11-01T00:00:00.000Z",
  pursuitSlug: "x",
  safetyClass: "NORMAL",
  version: 0,
  mission: {
    title,
    goalType: "PROJECT",
    primaryDomain: "Mind",
    chapters: [
      { id: "0", index: 0, title: "Sounds", exitCondition: "", steps: [0, 1, 2].map(step) },
    ],
  },
});

const plan = (missionId: string, overrides: Partial<TodayPlan>): TodayPlan => ({
  missionId,
  today: "2026-11-12",
  todayStepIds: [],
  doneTodayStepIds: [],
  upcoming: [],
  laterStepCount: 0,
  doneForToday: false,
  finished: false,
  returningAfterGap: false,
  dailyMinutes: 60,
  ...overrides,
});

function fixture(): Extract<GuestMissions, { status: "ready" }> {
  const progress = foldProgress([]);
  progress.completions.push({
    missionId: "m-done",
    chapterId: "0",
    stepId: "0:0",
    evidence: "SELF",
    xp: 40,
    recordedAt: "2026-11-12T01:00:00.000Z",
  });
  return {
    status: "ready",
    missions: [mission("m-open", "Learn Farsi"), mission("m-done", "Run a 5k")],
    progress,
    logs: {},
    plans: {
      "m-open": plan("m-open", {
        todayStepIds: ["0:0", "0:1"],
        upcoming: [{ date: "2026-11-13", stepIds: ["0:2"] }],
        returningAfterGap: true,
      }),
      "m-done": plan("m-done", {
        todayStepIds: ["0:0"],
        doneTodayStepIds: ["0:0"],
        doneForToday: true,
        upcoming: [{ date: "2026-11-13", stepIds: ["0:1", "0:2"] }],
      }),
    },
    reminder: { enabled: true, available: false },
  };
}

async function render(value: GuestMissions): Promise<string> {
  loaded.value = value;
  return renderToStaticMarkup(await TodayPage());
}

/** The markup of each mission card, in order. */
const cards = (html: string) => html.split('<li class="card today-card">').slice(1);

beforeEach(() => {
  loaded.value = null;
});

describe("the Today page", () => {
  it("offers Start step only on the current row of a mission with steps left", async () => {
    const [open] = cards(await render(fixture()));
    const rows = open!.split('<li class="today-step-row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("is-current");
    expect(rows[0]).toContain("Start step");
    expect(rows[1]).not.toContain("Start step");
  });

  it("greets the person back gently after a gap", async () => {
    const [open, done] = cards(await render(fixture()));
    expect(open).toContain("Welcome back");
    expect(done).not.toContain("Welcome back");
  });

  it("says done for today and offers the next step without pressing", async () => {
    const [, done] = cards(await render(fixture()));
    expect(done).toContain("Done for today");
    expect(done).toContain("Want to keep going?");
    expect(done).toContain("/step?mission=m-done&amp;step=0%3A1");
    expect(done).not.toContain("Start step");
    expect(done).toContain("Tomorrow");
  });

  it("shows the reminder toggle to someone with reminders on, even when email is off", async () => {
    const html = await render(fixture());
    expect(html).toContain("Daily reminder");
    expect(html).toContain("Stop reminders");
  });

  it("invites a first mission when there are none", async () => {
    const html = await render({ ...fixture(), missions: [], plans: {}, reminder: null });
    expect(html).toContain("Nothing on today yet");
    expect(html).toContain('href="/generate"');
  });
});
