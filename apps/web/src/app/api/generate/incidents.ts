/**
 * Keeps generation incidents after the terminal scrolls away.
 *
 * Console output is the record on a hosted platform, which retains it. Locally
 * it vanishes with the server, and that is how the same failure got diagnosed
 * twice. So development also appends each incident to a JSONL file, which
 * `pnpm incidents` summarises. Set `ZANDEGI_INCIDENT_LOG` to choose the file.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

function incidentLogPath(): string | null {
  const configured = process.env.ZANDEGI_INCIDENT_LOG?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "development") return null;
  return join(process.cwd(), "logs", "generation-incidents.jsonl");
}

/** Callers pass codes, paths and ids only. The goal's text must never reach this. */
export function recordIncident(entry: Record<string, unknown>): void {
  const path = incidentLogPath();
  if (path === null) return;
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
  } catch (error) {
    // The console line already went out, and a full disk must not fail a mission.
    console.warn("[generate] incident log unavailable", String(error));
  }
}
