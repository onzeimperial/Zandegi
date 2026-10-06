/**
 * Request validation for the generation use case.
 *
 * It lives here, not in the web adapter, so the use case validates its own
 * input even when a future adapter (mobile, a job) forgets to. The adapter
 * still checks transport concerns — media type, body size — that this layer
 * cannot see.
 */

import {
  GENERATE_MISSION_LIMITS as LIMITS,
  GENERATE_MISSION_REQUEST_FIELDS,
  type GenerateMissionRequest,
} from "../client";
import { GenerationError } from "../errors";

const ALLOWED_FIELDS: ReadonlySet<string> = new Set(GENERATE_MISSION_REQUEST_FIELDS);

function invalid(field: string): never {
  // The field name is a contract name, never user content.
  throw new GenerationError("INVALID_REQUEST", `invalid field: ${field}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse an untrusted body into the request contract. Unknown keys are a
 * failure rather than something to drop silently: a client sending a field we
 * do not understand is a client we do not understand.
 */
export function parseGenerateMissionRequest(body: unknown): GenerateMissionRequest {
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

  return {
    rawText,
    ...(weeklyTimeBudgetMinutes === undefined ? {} : { weeklyTimeBudgetMinutes }),
    ...(location === undefined ? {} : { location: location as string }),
    ...(timezone === undefined ? {} : { timezone: timezone as string }),
  };
}
