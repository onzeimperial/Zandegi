/**
 * Helpers for JSON stored as TEXT columns (SQLite/Postgres portable).
 * Always parse defensively — a bad blob must never crash a request.
 */

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
