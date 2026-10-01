#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

/* Builds a reference-vs-implementation contact sheet for human review.
   Pixel equality is not the goal: the port is responsive and component-based,
   so this exists so a person can judge the match, not a threshold. */

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const captureRoot = path.join(root, "_bmad-output", "implementation-artifacts", "visual-diffs");
const outputRoot = path.join(captureRoot, "side-by-side");
const sharpPackage = fs.readdirSync(path.join(root, "node_modules", ".pnpm")).find((entry) => entry.startsWith("sharp@"));
if (!sharpPackage) throw new Error("Sharp is not installed");
const sharp = require(path.join(root, "node_modules", ".pnpm", sharpPackage, "node_modules", "sharp"));

const gap = 24;
const labelHeight = 40;

async function build(index) {
  const name = `board-${String(index).padStart(2, "0")}.png`;
  const reference = path.join(captureRoot, "reference", name);
  const app = path.join(captureRoot, "app", name);
  if (!fs.existsSync(reference) || !fs.existsSync(app)) return null;

  const [left, right] = await Promise.all([sharp(reference).toBuffer(), sharp(app).toBuffer()]);
  const meta = await sharp(left).metadata();
  const width = meta.width * 2 + gap * 3;
  const height = meta.height + labelHeight + gap * 2;

  const label = Buffer.from(
    `<svg width="${width}" height="${height}">
       <rect width="${width}" height="${height}" fill="#241257"/>
       <text x="${gap + meta.width / 2}" y="28" fill="#ffffff" font-size="20" font-family="sans-serif" font-weight="700" text-anchor="middle">Claude Design reference</text>
       <text x="${gap * 2 + meta.width + meta.width / 2}" y="28" fill="#ffc53d" font-size="20" font-family="sans-serif" font-weight="700" text-anchor="middle">Zandegi implementation</text>
     </svg>`,
  );

  await sharp(label)
    .composite([
      { input: left, left: gap, top: labelHeight + gap },
      { input: right, left: gap * 2 + meta.width, top: labelHeight + gap },
    ])
    .png()
    .toFile(path.join(outputRoot, name));
  return name;
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const requested = process.argv.slice(2).map(Number);
  const indexes = requested.length ? requested : Array.from({ length: 12 }, (_, index) => index);
  for (const index of indexes) {
    const built = await build(index);
    console.log(built ? `composed ${built}` : `skipped board ${index}: missing capture`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
