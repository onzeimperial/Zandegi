#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

/* Compares the laid-out geometry of a reference board against the implemented
   route, matching elements by their trimmed text. Reports boxes whose position
   or size differs, which pinpoints a porting defect far faster than reading a
   pixel diff. Usage: node scripts/geometry-diff.cjs <boardIndex> */

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9483;
const referencePort = 9494;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zandegi-geometry-"));
const referenceRoot = path.join(root, "_bmad-output", "implementation-artifacts", "claude-reference");
const routes = ["/", "/generate", "/generate", "/generate", "/builder", "/path", "/step", "/complete", "/profile", "/crew", "/shop", "/customise"];
const tolerance = 1.5;

const COLLECT = `(() => {
  const rows = [];
  const walk = (el) => {
    for (const child of el.children) {
      const text = (child.textContent || "").replace(/\\s+/g, " ").trim();
      const r = child.getBoundingClientRect();
      if (text && r.width && r.height) {
        rows.push({ text: text.slice(0, 60), tag: child.tagName.toLowerCase(),
          t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) });
      }
      walk(child);
    }
  };
  walk(document.body);
  return JSON.stringify(rows);
})()`;

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitForDebugger() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${port}/json/version`); if (response.ok) return; } catch { /* starting */ }
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    }),
    send(method, params = {}) {
      return new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    },
    close() { socket.close(); },
  };
}

async function collect(url) {
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const target = await targetResponse.json();
  const client = connect(target.webSocketDebuggerUrl);
  try {
    await client.ready;
    await client.send("Page.enable");
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.send("Page.navigate", { url });
    await delay(2600);
    await client.send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true, returnByValue: true });
    const result = await client.send("Runtime.evaluate", { expression: COLLECT, returnByValue: true });
    return JSON.parse(result.result.value);
  } finally {
    client.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => undefined);
  }
}

function report(reference, app) {
  const appByText = new Map();
  for (const row of app) {
    if (!appByText.has(row.text)) appByText.set(row.text, []);
    appByText.get(row.text).push(row);
  }
  const seen = new Map();
  const issues = [];
  for (const row of reference) {
    const candidates = appByText.get(row.text);
    if (!candidates || !candidates.length) { issues.push({ kind: "missing", row }); continue; }
    const used = seen.get(row.text) ?? 0;
    const match = candidates[Math.min(used, candidates.length - 1)];
    seen.set(row.text, used + 1);
    const dt = match.t - row.t, dl = match.l - row.l, dw = match.w - row.w, dh = match.h - row.h;
    if (Math.abs(dt) > tolerance || Math.abs(dl) > tolerance || Math.abs(dw) > tolerance || Math.abs(dh) > tolerance) {
      issues.push({ kind: "moved", row, match, dt, dl, dw, dh });
    }
  }
  return issues;
}

async function main() {
  const index = Number(process.argv[2] ?? 5);
  const server = http.createServer((request, response) => {
    const match = request.url?.match(/^\/board-(\d{2})\.html$/);
    if (!match) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    fs.createReadStream(path.join(referenceRoot, `board-${match[1]}.html`)).pipe(response);
  });
  await new Promise((resolve) => server.listen(referencePort, "127.0.0.1", resolve));
  const child = spawn(chrome, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--disable-gpu", "--no-sandbox", "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1440,900", "about:blank"], { stdio: ["ignore", "ignore", "inherit"] });
  try {
    await waitForDebugger();
    const number = String(index).padStart(2, "0");
    const reference = await collect(`http://127.0.0.1:${referencePort}/board-${number}.html`);
    const app = await collect(`http://localhost:3100${routes[index]}`);
    const issues = report(reference, app);
    console.log(`board ${number}: ${reference.length} reference boxes, ${issues.length} differing`);
    for (const issue of issues.slice(0, 40)) {
      if (issue.kind === "missing") console.log(`  MISSING  "${issue.row.text}"`);
      else console.log(`  MOVED    ref[t=${issue.row.t} l=${issue.row.l} w=${issue.row.w} h=${issue.row.h}] app[t=${issue.match.t} l=${issue.match.l} w=${issue.match.w} h=${issue.match.h}]  <${issue.row.tag}> "${issue.row.text}"`);
    }
    if (issues.length > 40) console.log(`  ... and ${issues.length - 40} more`);
  } finally {
    child.kill();
    if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
