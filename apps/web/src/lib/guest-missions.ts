/**
 * Server-side loading of the current person's missions, for server components.
 *
 * It is the page-level twin of `GET /api/missions/[id]`: the same session
 * resolution, the same rule that a read never mints a guest, and the same
 * ownership-checked use case behind it. An invited person's first read does create
 * their account principal. In guest mode, visiting a page without a
 * cookie is visiting it without any missions, not an error. Someone who may not
 * be here at all goes home, which explains why.
 *
 * One thing a page cannot do that the route can: write a cookie. A server
 * component renders after headers are committed, so viewing the path renews a
 * guest's window in the store but not the browser cookie's own expiry.
 * Generating a mission does both.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GenerationError, foldProgress, listLogs, listMissions, readProgress } from "@zandegi/api";
import type { MissionLogView, ProgressView, StoredMissionView } from "@zandegi/api/client";
import { isAccessRefusal, resolveRequestSession } from "./session";

export type GuestMissions =
  | {
      status: "ready";
      missions: StoredMissionView[];
      progress: ProgressView;
      /** Each mission's logs, newest first. Empty unless asked for. */
      logs: Record<string, MissionLogView[]>;
    }
  | { status: "unavailable" };

export async function loadGuestMissions(
  options: { withLogs?: boolean } = {},
): Promise<GuestMissions> {
  try {
    const session = await resolveRequestSession((await headers()).get("cookie"), { mint: false });
    // No guest means a brand-new character: level 1, no XP, nothing done.
    if (session === null) {
      return { status: "ready", missions: [], progress: foldProgress([]), logs: {} };
    }

    const [missions, progress] = await Promise.all([
      listMissions({ principal: session.principal }, { persistence: session.ports.persistence }),
      readProgress({ principal: session.principal }, { ledger: session.ports.ledger }),
    ]);
    const logs: Record<string, MissionLogView[]> = {};
    if (options.withLogs === true) {
      // One mission's logs failing must not take Today down: that mission
      // shows no logs, and everything else still loads.
      const lists = await Promise.allSettled(
        missions.map((mission) =>
          listLogs(
            { principal: session.principal, missionId: mission.missionId },
            { persistence: session.ports.persistence, logs: session.ports.logs },
          ),
        ),
      );
      missions.forEach((mission, index) => {
        const result = lists[index]!;
        logs[mission.missionId] = result.status === "fulfilled" ? result.value : [];
      });
      if (lists.some((result) => result.status === "rejected")) {
        console.error("[guest-missions]", JSON.stringify({ outcome: "logs-unavailable" }));
      }
    }
    return { status: "ready", missions, progress, logs };
  } catch (error) {
    // `redirect` works by throwing, so it belongs here rather than in the try.
    if (error instanceof GenerationError && isAccessRefusal(error.code)) redirect("/");
    // The detail stays in the server log. A page only ever learns that the
    // store could not answer, never why.
    console.error(
      "[guest-missions]",
      JSON.stringify({
        outcome: "unavailable",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return { status: "unavailable" };
  }
}

/**
 * The mission the page should show: the one the URL names if the guest owns
 * it, otherwise their newest. A URL naming somebody else's mission falls back
 * silently, exactly as the read endpoint answers not-found for it.
 */
export function selectMission(
  missions: readonly StoredMissionView[],
  requestedId: string | undefined,
): StoredMissionView | undefined {
  if (requestedId !== undefined) {
    const requested = missions.find((entry) => entry.missionId === requestedId);
    if (requested !== undefined) return requested;
  }
  return missions[0];
}

/** Plain-language meaning of each verification method, shown beside a step. */
export const VERIFICATION_LABEL: Record<
  StoredMissionView["mission"]["chapters"][number]["steps"][number]["verification"],
  string
> = {
  SELF: "You mark it done yourself",
  TIMER: "A focus timer confirms it",
  ARTIFACT: "A photo or file shows it",
  METRIC: "A tracked number moves",
  INTEGRATION: "A connected app confirms it",
};

/**
 * "About 30 min" or "About 1 h 15 min" — always phrased as an estimate. `null`
 * for 0: a step the person added has no estimate, and none is invented.
 */
export function estimateLabel(minutes: number): string | null {
  if (minutes <= 0) return null;
  if (minutes < 60) return `About ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `About ${hours} h` : `About ${hours} h ${rest} min`;
}

/** Where a step stands for this guest. */
export type StepState = "done" | "current" | "upcoming";

type Step = StoredMissionView["mission"]["chapters"][number]["steps"][number];
type Chapter = StoredMissionView["mission"]["chapters"][number];

export interface MissionStepStates {
  state: (stepId: string) => StepState;
  /** The current step and its chapter, or `null` once every step is done. */
  current: { chapter: Chapter; chapterNumber: number; step: Step } | null;
  finished: boolean;
  /** Steps on the path that are done. A deleted step is no longer on the path. */
  doneOnPath: number;
}

/**
 * Each step's state in one mission, by stable id. Steps complete in their
 * current order, so the first one not yet done is current and everything after
 * it is upcoming. A reorder moves the current step; it never undoes a done one.
 */
export function stepStates(mission: StoredMissionView, progress: ProgressView): MissionStepStates {
  const done = new Set(
    progress.completions
      .filter((completion) => completion.missionId === mission.missionId)
      .map((completion) => completion.stepId),
  );
  let current: MissionStepStates["current"] = null;
  let doneOnPath = 0;
  const { chapters } = mission.mission;
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
    const chapter = chapters[chapterIndex]!;
    for (const step of chapter.steps) {
      if (done.has(step.id)) doneOnPath += 1;
      else if (current === null) current = { chapter, chapterNumber: chapterIndex + 1, step };
    }
  }
  const currentId = current?.step.id ?? null;
  return {
    state: (stepId) => {
      if (done.has(stepId)) return "done";
      return stepId === currentId ? "current" : "upcoming";
    },
    current,
    finished: current === null,
    doneOnPath,
  };
}

/**
 * The step id a link names. Links are `?step=<id>`. A link from before stable
 * ids named a position, `?chapter=c&step=s`, and a position is exactly the id
 * of the step generated there, so old links still open the right step.
 */
export function stepIdParam(params: {
  chapter?: string | string[];
  step?: string | string[];
}): string | undefined {
  const single = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;
  const step = single(params.step);
  const chapter = single(params.chapter);
  if (step === undefined) return undefined;
  if (chapter !== undefined) {
    return /^\d{1,3}$/.test(chapter) && /^\d{1,3}$/.test(step) ? `${chapter}:${step}` : undefined;
  }
  return /^[A-Za-z0-9:_-]{1,64}$/.test(step) ? step : undefined;
}

/** The link to one step's guide. */
export function stepHref(missionId: string, stepId: string): string {
  return `/step?${new URLSearchParams({ mission: missionId, step: stepId }).toString()}`;
}
