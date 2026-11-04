/**
 * The optional detail fields, as the form holds them and as the API wants them.
 * Pure, so the rules are testable without a browser. The server repeats the
 * checks; these exist so a person hears about a problem beside the field.
 */
import {
  GENERATE_MISSION_LIMITS as LIMITS,
  type GenerateMissionDetails,
  type GenerateMissionRequest,
} from "@zandegi/api/client";

export interface DetailsFormValues {
  startingPoint: string;
  why: string;
  targetDate: string;
  hoursPerWeek: string;
  resources: string;
  planAround: string;
  location: string;
}

export type DetailsFormField = keyof DetailsFormValues;
export type DetailsFormErrors = Partial<Record<DetailsFormField, string>>;

export const emptyDetailsForm: DetailsFormValues = {
  startingPoint: "",
  why: "",
  targetDate: "",
  hoursPerWeek: "",
  resources: "",
  planAround: "",
  location: "",
};

const MINUTES_PER_HOUR = 60;
export const MAX_HOURS_PER_WEEK = LIMITS.maxWeeklyTimeBudgetMinutes / MINUTES_PER_HOUR;

const FREE_TEXT = ["startingPoint", "why", "resources", "planAround"] as const;

/** The first field that has an error, in the order the form shows them. */
export const FIELD_ORDER: readonly DetailsFormField[] = [
  "startingPoint",
  "why",
  "targetDate",
  "hoursPerWeek",
  "resources",
  "planAround",
  "location",
];

/** `today` is the person's local date as YYYY-MM-DD. */
export function validateDetailsForm(values: DetailsFormValues, today: string): DetailsFormErrors {
  const errors: DetailsFormErrors = {};

  for (const field of FREE_TEXT) {
    if (values[field].trim().length > LIMITS.maxDetailLength) {
      errors[field] = `Keep this to ${LIMITS.maxDetailLength} characters.`;
    }
  }
  if (values.location.trim().length > LIMITS.maxLocationLength) {
    errors.location = `Keep this to ${LIMITS.maxLocationLength} characters.`;
  }

  const date = values.targetDate.trim();
  if (date !== "" && date < today) errors.targetDate = "Pick today or a later date.";

  const hours = values.hoursPerWeek.trim();
  if (hours !== "") {
    const parsed = Number(hours);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_HOURS_PER_WEEK) {
      errors.hoursPerWeek = `Enter a number of hours from 0.5 to ${MAX_HOURS_PER_WEEK}.`;
    }
  }
  return errors;
}

/** Blank fields are left out entirely: skipping a field is not an empty answer. */
export function toGenerationRequest(
  rawText: string,
  values: DetailsFormValues,
  timezone: string | undefined,
): GenerateMissionRequest {
  const details: GenerateMissionDetails = {};
  for (const field of FREE_TEXT) {
    const text = values[field].trim();
    if (text !== "") details[field] = text;
  }
  const targetDate = values.targetDate.trim();
  if (targetDate !== "") details.targetDate = targetDate;

  const location = values.location.trim();
  const hours = values.hoursPerWeek.trim();

  return {
    rawText: rawText.trim(),
    ...(timezone === undefined ? {} : { timezone }),
    ...(location === "" ? {} : { location }),
    ...(hours === ""
      ? {}
      : {
          weeklyTimeBudgetMinutes: Math.max(
            LIMITS.minWeeklyTimeBudgetMinutes,
            Math.round(Number(hours) * MINUTES_PER_HOUR),
          ),
        }),
    ...(Object.keys(details).length === 0 ? {} : { details }),
  };
}

/** The browser's IANA timezone, when it will say. */
export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** The browser's local date as YYYY-MM-DD. */
export function browserToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
