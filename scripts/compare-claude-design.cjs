#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const captureRoot = path.join(root, "_bmad-output", "implementation-artifacts", "visual-diffs");
const maximumChangedPercent = 0.5;
const maximumMeanDelta = 1;

/* Boards 02 and 03 are the live build and review screens. They only exist
   once a real generation has run, so they cannot be reached by URL and are
   not part of the automated sweep. */
const UNREACHABLE = new Set([2, 3]);

/* Where the implementation deliberately departs from the mock, the allowance
   records why. Anything above these bounds is a regression. */
const ALLOWANCES = {
  1: { changedPercent: 2.6, meanDelta: 2.3, why: "the mock pre-highlights a chip while leaving the ambition empty, which would enable Build my mission with nothing typed" },
  4: { changedPercent: 1.5, meanDelta: 2.0, why: "step XP comes from core's verification multipliers rather than the mock's 20/40/60, core has no peer-confirmation method, and the draft pill says local-only instead of saved" },
  8: { changedPercent: 0.5, meanDelta: 0.5, why: "the eight domains use the names fixed by SPEC 1.1 rather than the mock's placeholders" },
};
const sharpPackage = fs
  .readdirSync(path.join(root, "node_modules", ".pnpm"))
  .find((entry) => entry.startsWith("sharp@"));
if (!sharpPackage) throw new Error("Sharp is not installed");
const sharp = require(path.join(root, "node_modules", ".pnpm", sharpPackage, "node_modules", "sharp"));

async function compare(index) {
  const name = `board-${String(index).padStart(2, "0")}.png`;
  const referencePath = path.join(captureRoot, "reference", name);
  const appPath = path.join(captureRoot, "app", name);
  const reference = await sharp(referencePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const app = await sharp(appPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (reference.info.width !== app.info.width || reference.info.height !== app.info.height) {
    throw new Error(`${name}: dimensions differ`);
  }
  const output = Buffer.alloc(reference.data.length);
  let changed = 0;
  let totalDelta = 0;
  for (let offset = 0; offset < reference.data.length; offset += 4) {
    const delta = Math.max(
      Math.abs(reference.data[offset] - app.data[offset]),
      Math.abs(reference.data[offset + 1] - app.data[offset + 1]),
      Math.abs(reference.data[offset + 2] - app.data[offset + 2]),
    );
    totalDelta += delta;
    const differs = delta > 24;
    if (differs) changed += 1;
    output[offset] = differs ? 255 : Math.round(reference.data[offset] * 0.2);
    output[offset + 1] = differs ? 28 : Math.round(reference.data[offset + 1] * 0.2);
    output[offset + 2] = differs ? 70 : Math.round(reference.data[offset + 2] * 0.2);
    output[offset + 3] = 255;
  }
  const pixels = reference.info.width * reference.info.height;
  await sharp(output, { raw: reference.info }).png().toFile(path.join(captureRoot, "diff", name));
  return {
    board: index,
    width: reference.info.width,
    height: reference.info.height,
    changedPixels: changed,
    changedPercent: Number(((changed / pixels) * 100).toFixed(3)),
    meanMaxChannelDelta: Number((totalDelta / pixels).toFixed(3)),
  };
}

async function main() {
  fs.mkdirSync(path.join(captureRoot, "diff"), { recursive: true });
  const requested = process.argv.slice(2).map(Number);
  const indexes = (requested.length ? requested : Array.from({ length: 12 }, (_, index) => index)).filter((index) => {
    if (!UNREACHABLE.has(index)) return true;
    console.log(`board ${String(index).padStart(2, "0")}: skipped, only reachable after a live generation`);
    return false;
  });
  const comparisons = [];
  for (const index of indexes) comparisons.push(await compare(index));
  for (const row of comparisons) console.log(`board ${String(row.board).padStart(2, "0")}: ${row.changedPercent}% changed, mean delta ${row.meanMaxChannelDelta}`);
  for (const row of comparisons) {
    const allowance = ALLOWANCES[row.board];
    if (allowance) console.log(`  board ${String(row.board).padStart(2, "0")} allowance ${allowance.changedPercent}%: ${allowance.why}`);
  }
  const failures = comparisons.filter((row) => {
    const allowance = ALLOWANCES[row.board];
    return row.changedPercent > (allowance?.changedPercent ?? maximumChangedPercent)
      || row.meanMaxChannelDelta > (allowance?.meanDelta ?? maximumMeanDelta);
  });
  if (failures.length) {
    throw new Error(`visual fidelity limit exceeded for board(s): ${failures.map((row) => String(row.board).padStart(2, "0")).join(", ")}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
