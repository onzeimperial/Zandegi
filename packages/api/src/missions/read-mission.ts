/**
 * Read one mission back, for its owner only.
 *
 * Everything about this use case is shaped by one rule: an ownership failure
 * answers `MISSION_NOT_FOUND`, never a forbidden code. "Forbidden" confirms
 * that the id exists, which is exactly the fact a caller probing ids is after.
 *
 * So a malformed id, an id that was never issued, and an id belonging to
 * another principal all produce the same error, and the lookup is keyed on
 * (owner, id) together rather than fetching first and comparing after.
 */

import type { StoredMissionView } from "../client";
import { GenerationError, describeFailure, isGenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { upcastMission } from "../plan/ids";
import type { GenerationPersistencePort } from "../ports";

/**
 * The longest id this surface will even look up. `IdGenerator` produces a
 * UUID; the ceiling exists so an absurd path segment is rejected before it
 * reaches the store rather than becoming a key of its own.
 */
export const MAX_MISSION_ID_LENGTH = 128;
const MISSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface ReadMissionInput {
  /** The resolved owner. A read never mints one. */
  principal: GuestPrincipal;
  /** Untrusted: a path segment. */
  missionId: unknown;
}

export interface ReadMissionPorts {
  persistence: GenerationPersistencePort;
}

function notFound(): never {
  throw new GenerationError("MISSION_NOT_FOUND", "mission absent or not owned by the principal");
}

export async function readMission(
  input: ReadMissionInput,
  ports: ReadMissionPorts,
): Promise<StoredMissionView> {
  const { missionId } = input;
  if (typeof missionId !== "string" || !MISSION_ID_PATTERN.test(missionId)) notFound();

  let record;
  try {
    record = await ports.persistence.findForOwner(input.principal.id, missionId);
  } catch (error) {
    if (isGenerationError(error)) throw error;
    throw new GenerationError("STORE_UNAVAILABLE", describeFailure(error), { cause: error });
  }

  if (record === null) notFound();

  // Copied field by field rather than spread, for the same reason mapping.ts
  // does it: `ownerId`, `runId` and `goalText` are server-side record fields,
  // and a field added to the record later must not reach the wire by accident.
  return {
    missionId: record.missionId,
    generatedAt: record.generatedAt,
    pursuitSlug: record.pursuitSlug,
    safetyClass: record.safetyClass,
    // Missions stored before ids existed get them here, on every read; the
    // stored record is left as it is.
    mission: upcastMission(record.mission),
    version: record.version ?? 0,
  };
}
