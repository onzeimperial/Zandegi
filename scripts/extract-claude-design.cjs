#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "design", "WebsiteDesign.html");
const outputRoot = path.join(root, "apps", "web", "public", "design");
const referenceRoot = path.join(root, "_bmad-output", "implementation-artifacts", "claude-reference");
const checkOnly = process.argv.includes("--check");

function fail(message) {
  throw new Error(`[extract-claude-design] ${message}`);
}

function scriptPayload(html, type) {
  const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(`<script[^>]*type=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/script>`),
  );
  if (!match) fail(`missing ${type} payload`);
  return match[1];
}

function parseJsonScript(html, type) {
  try {
    return JSON.parse(scriptPayload(html, type));
  } catch (error) {
    fail(`invalid ${type} JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function decodeEntry(entry, label) {
  if (!entry || typeof entry !== "object" || typeof entry.data !== "string") {
    fail(`${label} has an invalid manifest entry`);
  }
  const bytes = Buffer.from(entry.data, "base64");
  return entry.compressed ? zlib.gunzipSync(bytes) : bytes;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function safeWrite(filePath, contents) {
  if (checkOnly) {
    if (!fs.existsSync(filePath)) fail(`missing generated file ${path.relative(root, filePath)}`);
    const current = fs.readFileSync(filePath);
    const expected = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    if (!current.equals(expected)) fail(`generated file drift: ${path.relative(root, filePath)}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function titleOf(html) {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "Untitled board";
}

function main() {
  const source = fs.readFileSync(sourcePath, "utf8");
  const rootManifest = parseJsonScript(source, "__bundler/manifest");
  const pageOrder = parseJsonScript(source, "__bundler/page_order");
  if (!Array.isArray(pageOrder) || pageOrder.length !== 12) {
    fail(`expected 12 ordered pages, found ${Array.isArray(pageOrder) ? pageOrder.length : "invalid data"}`);
  }

  const uniqueAssets = new Map();
  const boards = [];
  for (const [index, pageId] of pageOrder.entries()) {
    const pageBytes = decodeEntry(rootManifest[pageId], `page ${index}`);
    const pageBundle = pageBytes.toString("utf8");
    const manifest = parseJsonScript(pageBundle, "__bundler/manifest");
    const template = parseJsonScript(pageBundle, "__bundler/template");
    const resourceNames = new Map();

    for (const [resourceId, entry] of Object.entries(manifest)) {
      if (entry.mime !== "image/png" && entry.mime !== "font/woff2") continue;
      const bytes = decodeEntry(entry, `page ${index} resource ${resourceId}`);
      const hash = sha256(bytes);
      const ext = entry.mime === "image/png" ? "png" : "woff2";
      const fileName = `${ext === "png" ? "mascot" : "font"}-${hash}.${ext}`;
      resourceNames.set(resourceId, fileName);
      const existing = uniqueAssets.get(hash);
      if (existing && (!existing.bytes.equals(bytes) || existing.mime !== entry.mime)) {
        fail(`hash collision for ${hash}`);
      }
      uniqueAssets.set(hash, { bytes, mime: entry.mime, fileName });
    }

    boards.push({
      index,
      id: pageId,
      title: titleOf(template),
      template,
      reference: pageBundle,
      resources: [...resourceNames.values()],
    });
  }

  const pngs = [...uniqueAssets.entries()].filter(([, asset]) => asset.mime === "image/png");
  const fonts = [...uniqueAssets.entries()].filter(([, asset]) => asset.mime === "font/woff2");
  if (pngs.length !== 1) fail(`expected one unique mascot PNG, found ${pngs.length}`);
  if (fonts.length !== 9) fail(`expected nine unique WOFF2 files, found ${fonts.length}`);
  const [mascotHash, mascot] = pngs[0];
  if (mascot.bytes.length !== 353767) fail(`mascot byte length is ${mascot.bytes.length}, expected 353767`);
  if (!mascotHash.startsWith("abe2675e") || !mascotHash.endsWith("69d29")) {
    fail(`unexpected mascot hash ${mascotHash}`);
  }

  for (const asset of uniqueAssets.values()) {
    safeWrite(path.join(outputRoot, asset.fileName), asset.bytes);
  }
  for (const board of boards) {
    const number = String(board.index).padStart(2, "0");
    safeWrite(path.join(referenceRoot, `board-${number}.source.html`), board.template);
    safeWrite(path.join(referenceRoot, `board-${number}.html`), board.reference);
  }

  const manifest = {
    source: "design/WebsiteDesign.html",
    sourceSha256: sha256(Buffer.from(source)),
    mascot: { file: mascot.fileName, bytes: mascot.bytes.length, sha256: mascotHash },
    fonts: fonts.map(([hash, asset]) => ({ file: asset.fileName, bytes: asset.bytes.length, sha256: hash })),
    boards: boards.map(({ index, id, title, resources }) => ({ index, id, title, resources })),
  };
  safeWrite(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `[extract-claude-design] ${checkOnly ? "verified" : "extracted"} ${boards.length} pages, ` +
      `${pngs.length} mascot hash, ${fonts.length} font hashes, no drift`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
