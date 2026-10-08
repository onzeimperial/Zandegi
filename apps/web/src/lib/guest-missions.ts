/**
 * Server-side loading of the current guest's missions, for server components.
 *
 * It is the page-level twin of `GET /api/missions/[id]`: the same guest
 * resolution, the same rule that a read never mints a principal, and the same
 * ownership-checked use case behind it. Visiting a page without a cookie is
 * visiting it without any missions, not an error.
 *
 * One thing a page cannot do that the route can: write a cookie. A server
 * component renders after headers are committed, so viewing the path renews the
 * guest's window in the store but not the browser cookie's own expiry.
 * Generating a mission does both.
 */

import { headers } from "next/headers";
import {
  demoPortsFromEnv,
  guestCookiePolicyFromEnv,
  listMissions,
  randomIdGenerator,
  randomTokenSource,
  resolveGuest,
  sha256TokenHasher,
  systemClock,
} from "@zandegi/api";
import type { StoredMissionView } from "@zandegi/api/client";

export type GuestMissions =
  { status: "ready"; missions: StoredMissionView[] } | { status: "unavailable" };

export async function loadGuestMissions(): Promise<GuestMissions> {
  try {
    const ports = await demoPortsFromEnv();
    const guest = await resolveGuest(
      (await headers()).get("cookie"),
      guestCookiePolicyFromEnv(process.env),
      {
        clock: systemClock,
        ids: randomIdGenerator,
        tokens: randomTokenSource,
        hasher: sha256TokenHasher,
        guests: ports.guests,
      },
    );
    if (guest === null) return { status: "ready", missions: [] };

    const missions = await listMissions(
      { principal: guest.principal },
      { persistence: ports.persistence },
    );
    return { status: "ready", missions };
  } catch (error) {
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
