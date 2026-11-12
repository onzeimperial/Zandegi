/**
 * List the principal's own missions, newest first.
 *
 * The same ownership rule as `readMission` applies, from the other direction:
 * the list is looked up by the principal's id, so there is no input a caller
 * could vary to see somebody else's missions. A principal with no missions gets
 * an empty list, which is a normal answer and not an error.
 */

import type { StoredMissionView } from "../client";
import { GenerationError, describeFailure, isGenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { upcastMission } from "../plan/ids";
import type { GeneratedMissionRecord, GenerationPersistencePort } from "../ports";

export interface ListMissionsInput {
  /** The resolved owner. A list never mints one. */
  principal: GuestPrincipal;
}

export interface ListMissionsPorts {
  persistence: GenerationPersistencePort;
}

/**
 * Copied field by field rather than spread, for the same reason as
 * `readMission`: `ownerId`, `runId` and `goalText` are server-side record
 * fields, and a field added to the record later must not reach the wire.
 */
function toView(record: GeneratedMissionRecord): StoredMissionView {
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

export async function listMissions(
  input: ListMissionsInput,
  ports: ListMissionsPorts,
): Promise<StoredMissionView[]> {
  let records: GeneratedMissionRecord[];
  try {
    records = await ports.persistence.listForOwner(input.principal.id);
  } catch (error) {
    if (isGenerationError(error)) throw error;
    throw new GenerationError("STORE_UNAVAILABLE", describeFailure(error), { cause: error });
  }
  return records.map(toView);
}
