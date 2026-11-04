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
import { GenerationError, foldProgress, listMissions, readProgress } from "@zandegi/api";
import type { ProgressView, StoredMissionView } from "@zandegi/api/client";
import { isAccessRefusal, resolveRequestSession } from "./session";

export type GuestMissions =
  | { status: "ready"; missions: StoredMissionView[]; progress: ProgressView }
  | { status: "unavailable" };

export async function loadGuestMissions(): Promise<GuestMissions> {
  try {
    const session = await resolveRequestSession((await headers()).get("cookie"), { mint: false });
    // No guest means a brand-new character: level 1, no XP, nothing done.
    if (session === null) return { status: "ready", missions: [], progress: foldProgress([]) };

    const [missions, progress] = await Promise.all([
      listMissions({ principal: session.principal }, { persistence: session.ports.persistence }),
      readProgress({ principal: session.principal }, { ledger: session.ports.ledger }),
    ]);
    return { status: "ready", missions, progress };
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

/** "About 30 min" or "About 1 h 15 min" — always phrased as an estimate. */
export function estimateLabel(minutes: number): string {
  if (minutes < 60) return `About ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `About ${hours} h` : `About ${hours} h ${rest} min`;
}

/** Where a step stands for this guest. */
export type StepState = "done" | "current" | "upcoming";

/**
 * Each step's state in one mission. Steps complete in order, so the first one
 * not yet done is current and everything after it is upcoming.
 */
export function stepStates(
  mission: StoredMissionView,
  progress: ProgressView,
): { state: (chapterIndex: number, stepIndex: number) => StepState; finished: boolean } {
  const done = new Set(
    progress.completions
      .filter((completion) => completion.missionId === mission.missionId)
      .map((completion) => `${completion.chapterIndex}:${completion.stepIndex}`),
  );
  // Positions, not the `index` fields: completions are recorded by position
  // and the step links are built by position, so all three must agree.
  let current: string | null = null;
  const chapters = mission.mission.chapters;
  for (let chapterIndex = 0; chapterIndex < chapters.length && current === null; chapterIndex++) {
    const steps = chapters[chapterIndex]!.steps;
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const key = `${chapterIndex}:${stepIndex}`;
      if (!done.has(key)) {
        current = key;
        break;
      }
    }
  }
  return {
    state: (chapterIndex, stepIndex) => {
      const key = `${chapterIndex}:${stepIndex}`;
      if (done.has(key)) return "done";
      return key === current ? "current" : "upcoming";
    },
    finished: current === null,
  };
}
