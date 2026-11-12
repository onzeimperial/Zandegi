/**
 * Request validation for the generation use case.
 *
 * It lives here, not in the web adapter, so the use case validates its own
 * input even when a future adapter (mobile, a job) forgets to. The adapter
 * still checks transport concerns — media type, body size — that this layer
 * cannot see.
 */

import { localDate } from "@zandegi/ai";
import {
  GENERATE_MISSION_DETAIL_FIELDS,
  GENERATE_MISSION_LIMITS as LIMITS,
  GENERATE_MISSION_REQUEST_FIELDS,
  type GenerateMissionDetails,
  type GenerateMissionRequest,
} from "../client";
import { GenerationError } from "../errors";

const ALLOWED_FIELDS: ReadonlySet<string> = new Set(GENERATE_MISSION_REQUEST_FIELDS);
const ALLOWED_DETAIL_FIELDS: ReadonlySet<string> = new Set(GENERATE_MISSION_DETAIL_FIELDS);

function invalid(field: string): never {
  // The field name is a contract name, never user content.
  throw new GenerationError("INVALID_REQUEST", `invalid field: ${field}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether `value` is an IANA zone this runtime knows. */
export function isSupportedTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** A real calendar date in strict YYYY-MM-DD form; a roll like 02-31 is rejected. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function parseDetails(
  value: unknown,
  timezone: string | undefined,
  now: Date,
): GenerateMissionDetails | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) invalid("details");
  for (const key of Object.keys(value)) {
    if (!ALLOWED_DETAIL_FIELDS.has(key)) invalid("details");
  }

  const details: GenerateMissionDetails = {};
  for (const field of ["startingPoint", "why", "resources", "planAround"] as const) {
    const text = value[field];
    if (text === undefined) continue;
    if (
      typeof text !== "string" ||
      text.trim().length === 0 ||
      text.length > LIMITS.maxDetailLength
    ) {
      invalid(`details.${field}`);
    }
    details[field] = text;
  }

  const { targetDate } = value;
  if (targetDate !== undefined) {
    // "Past" is judged where the person is, so someone whose day is behind UTC
    // is not told that today has gone.
    if (
      typeof targetDate !== "string" ||
      !isCalendarDate(targetDate) ||
      targetDate < localDate(now, timezone)
    ) {
      invalid("details.targetDate");
    }
    details.targetDate = targetDate;
  }

  return Object.keys(details).length === 0 ? undefined : details;
}

/**
 * Parse an untrusted body into the request contract. Unknown keys are a
 * failure rather than something to drop silently: a client sending a field we
 * do not understand is a client we do not understand.
 *
 * `now` comes from the caller's clock port, so a past target date is judged
 * against the request's instant and never an ambient clock.
 */
export function parseGenerateMissionRequest(body: unknown, now: Date): GenerateMissionRequest {
  if (!isRecord(body)) invalid("body");
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) invalid(key);
  }

  const { rawText, weeklyTimeBudgetMinutes, location, timezone } = body;

  if (
    typeof rawText !== "string" ||
    rawText.trim().length === 0 ||
    rawText.length > LIMITS.maxGoalLength
  ) {
    invalid("rawText");
  }

  if (
    weeklyTimeBudgetMinutes !== undefined &&
    (typeof weeklyTimeBudgetMinutes !== "number" ||
      !Number.isInteger(weeklyTimeBudgetMinutes) ||
      weeklyTimeBudgetMinutes < LIMITS.minWeeklyTimeBudgetMinutes ||
      weeklyTimeBudgetMinutes > LIMITS.maxWeeklyTimeBudgetMinutes)
  ) {
    invalid("weeklyTimeBudgetMinutes");
  }

  if (
    location !== undefined &&
    (typeof location !== "string" ||
      location.trim().length === 0 ||
      location.length > LIMITS.maxLocationLength)
  ) {
    invalid("location");
  }

  if (
    timezone !== undefined &&
    (typeof timezone !== "string" ||
      timezone.length === 0 ||
      timezone.length > LIMITS.maxTimezoneLength ||
      !isSupportedTimezone(timezone))
  ) {
    invalid("timezone");
  }

  // After the timezone check above, so the date check can trust the zone.
  const details = parseDetails(body.details, timezone as string | undefined, now);

  return {
    rawText,
    ...(weeklyTimeBudgetMinutes === undefined ? {} : { weeklyTimeBudgetMinutes }),
    ...(location === undefined ? {} : { location: location as string }),
    ...(timezone === undefined ? {} : { timezone: timezone as string }),
    ...(details === undefined ? {} : { details }),
  };
}
