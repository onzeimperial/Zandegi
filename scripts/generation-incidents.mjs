#!/usr/bin/env node
/**
 * Summarise local generation incidents, grouped so a repeating cause stands out.
 *
 * From the repo root:  node scripts/generation-incidents.mjs [path]
 * Exits 0 even with incidents: this reports, it does not gate.
 */

import console from "node:console";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const path =
  process.argv[2] ??
  process.env.ZANDEGI_INCIDENT_LOG ??
  join("apps", "web", "logs", "generation-incidents.jsonl");

if (!existsSync(path)) {
  console.log(`No incidents recorded. Looked in ${path}`);
  process.exit(0);
}

const entries = readFileSync(path, "utf8")
  .split("\n")
  .filter((line) => line.trim().length > 0)
  .flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

function printCounts(title, keys) {
  const counts = new Map();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  console.log(`\n${title}`);
  if (counts.size === 0) console.log("  none");
  for (const [key, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${key}`);
  }
}

const failed = entries.filter((entry) => entry.event === "generation_failed");
const rejected = entries.filter((entry) => entry.event === "model_output_rejected");
const failedRequests = new Set(failed.map((entry) => entry.requestId));
const recovered = new Set(
  rejected.map((entry) => entry.requestId).filter((id) => !failedRequests.has(id)),
);

console.log(`${entries.length} incidents in ${path}`);
console.log(`${failedRequests.size} requests failed`);
console.log(`${recovered.size} requests recovered by a retry`);

printCounts(
  "Failures by code",
  failed.map((entry) => entry.code),
);
printCounts(
  "Rejected model output by cause",
  rejected.flatMap((entry) =>
    entry.issues.length === 0
      ? [`${entry.stage} ${entry.kind}`]
      : entry.issues.map((issue) => {
          // Step and chapter numbers would split one cause into many rows.
          const field = issue.path.replace(/\.\d+/g, ".*");
          const received = issue.received === undefined ? "" : ` received ${issue.received}`;
          return `${entry.stage} ${field} ${issue.code}${received}`;
        }),
  ),
);

console.log("\nMost recent failures");
if (failed.length === 0) console.log("  none");
for (const entry of failed.slice(-5)) {
  console.log(`  ${entry.at}  ${entry.requestId}  ${entry.code}`);
  console.log(`    ${entry.diagnostic}`);
}
