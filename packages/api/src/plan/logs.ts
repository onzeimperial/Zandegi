/**
 * Logging progress the plan did not foresee (Story 8.2, lite).
 *
 * A log is a one-line note or a number with an optional unit. It is filed under
 * the mission's current chapter and can be moved to another chapter of the same
 * mission. It uses no model and pays no XP: there is no ledger write here, and
 * the only ledger use is a read to find the current chapter.
 *
 * Log text is personal content. It is never put in a diagnostic, so it can
 * never reach a log line, an incident record or the ledger.
 */

import { MISSION_LOG_LIMITS, type MissionLogInput, type MissionLogView } from "../client";
import { GenerationError } from "../errors";
import type { GuestPrincipal } from "../identity/ports";
import { readMission } from "../missions/read-mission";
import type {
  Clock,
  GenerationPersistencePort,
  IdGenerator,
  MissionLogRecord,
  MissionLogStorePort,
} from "../ports";
import { completedStepIds, foldProgress, nextStep, readEvents } from "../progress/fold";
import type { ProgressLedgerPort } from "../progress/ledger";
import { storeCall } from "./store-call";

function invalid(diagnostic: string): never {
  throw new GenerationError("INVALID_REQUEST", diagnostic);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) invalid("log has an unknown field");
  }
}

/** One line: trimmed, no line breaks, within `max`. Empty is reported as `""`. */
function line(value: unknown, max: number, field: string): string {
  if (typeof value !== "string") invalid(`${field} is not text`);
  const trimmed = value.trim();
  if (trimmed.length > max) invalid(`${field} too long`);
  if (/[\r\n]/.test(trimmed)) invalid(`${field} spans lines`);
  return trimmed;
}

/** Strict: a note with text, or a number with an optional unit. Nothing else. */
export function parseLogInput(value: unknown): MissionLogInput {
  if (!isRecord(value)) invalid("log is not an object");
  if (value.kind === "note") {
    onlyKeys(value, ["kind", "text"]);
    const text = line(value.text, MISSION_LOG_LIMITS.maxTextLength, "text");
    if (text.length === 0) invalid("note is empty");
    return { kind: "note", text };
  }
  if (value.kind === "number") {
    onlyKeys(value, ["kind", "value", "unit"]);
    const amount = value.value;
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      Math.abs(amount) > MISSION_LOG_LIMITS.maxValue
    ) {
      invalid("value is not a finite number in range");
    }
    const unit =
      value.unit === undefined ? "" : line(value.unit, MISSION_LOG_LIMITS.maxUnitLength, "unit");
    return { kind: "number", value: amount, ...(unit.length === 0 ? {} : { unit }) };
  }
  invalid("unknown log kind");
}

const LOG_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CHAPTER_ID_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;

/** Copied field by field, so the owner never reaches the wire. */
function toView(record: MissionLogRecord): MissionLogView {
  return {
    logId: record.logId,
    missionId: record.missionId,
    chapterId: record.chapterId,
    kind: record.kind,
    ...(record.text === undefined ? {} : { text: record.text }),
    ...(record.value === undefined ? {} : { value: record.value }),
    ...(record.unit === undefined ? {} : { unit: record.unit }),
    loggedAt: record.loggedAt,
  };
}

export interface LogProgressInput {
  principal: GuestPrincipal;
  /** Untrusted: from the URL. */
  missionId: unknown;
  /** Untrusted: the parsed JSON body. */
  request: unknown;
}

export interface LogProgressPorts {
  persistence: GenerationPersistencePort;
  ledger: ProgressLedgerPort;
  logs: MissionLogStorePort;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * File a log under the mission's current chapter: the chapter of the next step,
 * or the last chapter once every step is done.
 */
export async function logProgress(
  input: LogProgressInput,
  ports: LogProgressPorts,
): Promise<MissionLogView> {
  const entry = parseLogInput(input.request);
  const view = await readMission(
    { principal: input.principal, missionId: input.missionId },
    { persistence: ports.persistence },
  );
  const ownerId = input.principal.id;
  const progress = foldProgress(readEvents(await storeCall(() => ports.ledger.read(ownerId))));
  const { chapters } = view.mission;
  const next = nextStep(chapters, completedStepIds(progress, view.missionId));
  const chapterId = next?.chapterId ?? chapters[chapters.length - 1]?.id;
  if (chapterId === undefined) invalid("mission has no chapters");

  const record: MissionLogRecord = {
    logId: ports.ids.newId(),
    ownerId,
    missionId: view.missionId,
    chapterId,
    ...(entry.kind === "note"
      ? { kind: "note" as const, text: entry.text }
      : {
          kind: "number" as const,
          value: entry.value,
          ...(entry.unit === undefined ? {} : { unit: entry.unit }),
        }),
    loggedAt: ports.clock.now().toISOString(),
  };
  await storeCall(() => ports.logs.record(record));
  return toView(record);
}

export interface ListLogsPorts {
  persistence: GenerationPersistencePort;
  logs: MissionLogStorePort;
}

/** One mission's logs, newest first, for its owner only. */
export async function listLogs(
  input: { principal: GuestPrincipal; missionId: unknown },
  ports: ListLogsPorts,
): Promise<MissionLogView[]> {
  const view = await readMission(
    { principal: input.principal, missionId: input.missionId },
    { persistence: ports.persistence },
  );
  const records = await storeCall(() => ports.logs.list(input.principal.id, view.missionId));
  return records.map(toView);
}

export interface MoveLogInput {
  principal: GuestPrincipal;
  /** Untrusted: from the URL. */
  missionId: unknown;
  /** Untrusted: from the URL. */
  logId: unknown;
  /** Untrusted: the parsed JSON body, `{ chapterId }`. */
  request: unknown;
}

/** Move a log to another chapter of the same mission. */
export async function moveLog(input: MoveLogInput, ports: ListLogsPorts): Promise<MissionLogView> {
  const { request } = input;
  if (!isRecord(request)) invalid("body is not an object");
  onlyKeys(request, ["chapterId"]);
  const { chapterId } = request;
  if (typeof chapterId !== "string" || !CHAPTER_ID_PATTERN.test(chapterId)) {
    invalid("chapterId is not an id");
  }

  const view = await readMission(
    { principal: input.principal, missionId: input.missionId },
    { persistence: ports.persistence },
  );
  if (!view.mission.chapters.some((chapter) => chapter.id === chapterId)) {
    invalid("chapter id is not in this mission");
  }
  const { logId } = input;
  if (typeof logId !== "string" || !LOG_ID_PATTERN.test(logId)) {
    throw new GenerationError("MISSION_NOT_FOUND", "log id malformed");
  }

  const moved = await storeCall(() =>
    ports.logs.move(input.principal.id, view.missionId, logId, chapterId),
  );
  // An unknown log and another person's log are the same answer.
  if (moved === null) throw new GenerationError("MISSION_NOT_FOUND", "log absent or not owned");
  return toView(moved);
}
