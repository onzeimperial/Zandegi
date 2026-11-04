import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordIncident } from "./incidents";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "zandegi-incidents-"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});

describe("recordIncident", () => {
  it("appends one timestamped JSON line per incident, creating the folder", () => {
    const path = join(directory, "nested", "incidents.jsonl");
    vi.stubEnv("ZANDEGI_INCIDENT_LOG", path);

    recordIncident({ event: "generation_failed", requestId: "a" });
    recordIncident({ event: "generation_failed", requestId: "b" });

    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines.map((line) => (JSON.parse(line) as { requestId: string }).requestId)).toEqual([
      "a",
      "b",
    ]);
    expect((JSON.parse(lines[0]!) as { at: string }).at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("writes nothing outside development unless a path is configured", () => {
    vi.stubEnv("ZANDEGI_INCIDENT_LOG", "");
    vi.stubEnv("NODE_ENV", "production");
    const cwd = vi.spyOn(process, "cwd");

    recordIncident({ event: "generation_failed", requestId: "a" });

    expect(cwd).not.toHaveBeenCalled();
  });

  it("does not throw when the file cannot be written", () => {
    // A path under a regular file can never be created.
    const blocker = join(directory, "blocker");
    writeFileSync(blocker, "");
    vi.stubEnv("ZANDEGI_INCIDENT_LOG", join(blocker, "incidents.jsonl"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => recordIncident({ event: "generation_failed", requestId: "a" })).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
