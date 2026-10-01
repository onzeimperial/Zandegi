#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9444;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zandegi-design-capture-"));
const outputRoot = path.join(root, "_bmad-output", "implementation-artifacts", "visual-diffs", "app");
const routes = [
  "/",
  "/generate",
  "/generate",
  "/generate",
  "/builder",
  "/path",
  "/step",
  "/complete",
  "/profile",
  "/crew",
  "/shop",
  "/customise",
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDebugger() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
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
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function capture(index, route) {
  const url = `http://localhost:3100${route}`;
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Could not create a Chrome target for ${url}`);
  const target = await targetResponse.json();
  const client = connect(target.webSocketDebuggerUrl);
  try {
    await client.ready;
    await client.send("Page.enable");
    await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.send("Page.navigate", { url });
    await delay(900);
    await client.send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true, returnByValue: true });
    await client.send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)", returnByValue: true });
    await delay(100);
    const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const number = String(index).padStart(2, "0");
    fs.writeFileSync(path.join(outputRoot, `board-${number}.png`), Buffer.from(screenshot.data, "base64"));
    console.log(`captured board ${number}: ${route}`);
  } finally {
    client.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => undefined);
  }
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const child = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--disable-gpu",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  try {
    await waitForDebugger();
    const requested = process.argv.slice(2).map(Number);
    const indexes = requested.length ? requested : routes.map((_, index) => index);
    for (const index of indexes) {
      if (!Number.isInteger(index) || index < 0 || index >= routes.length) throw new Error(`Invalid board index: ${index}`);
      await capture(index, routes[index]);
    }
  } finally {
    child.kill();
    if (process.platform === "win32" && child.pid) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
