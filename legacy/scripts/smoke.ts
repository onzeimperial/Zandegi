import "dotenv/config";

/**
 * End-to-end smoke test against a running dev server.
 *
 * Unit tests and `tsc` cannot catch React Server Component boundary errors
 * (calling a "use client" function from the server), hydration failures, or
 * runtime crashes inside a page — those only appear when a page is actually
 * rendered. This logs in for real and loads every route, failing on any
 * non-200 or any Next.js error marker in the HTML.
 *
 *   npm run dev      # in one terminal
 *   npm run smoke    # in another
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL ?? "demo@zandegi.app";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "demopassword1";

/** Markers Next.js injects into the HTML when a page throws. */
const ERROR_MARKERS = [
  "Attempted to call",
  "Unhandled Runtime Error",
  "Application error: a server-side exception",
  "This page could not be found",
  "__NEXT_ERROR_CODE",
];

const PUBLIC_PAGES = ["/", "/login", "/register"];

const GAME_PAGES = ["/path", "/character", "/crew", "/today"];

const GAME_APIS = ["/api/path", "/api/character", "/api/crew"];

const APP_PAGES = [
  "/dashboard",
  "/goals",
  "/goals/new",
  "/catalog",
  "/avatar",
  "/shop",
  "/league",
  "/pro",
  "/achievements",
  "/challenges",
  "/analytics",
  "/coach",
  "/friends",
  "/knowledge",
  "/settings",
];

const APP_APIS = [
  "/api/dashboard",
  "/api/goals",
  "/api/avatar",
  "/api/shop",
  "/api/catalog",
  "/api/billing",
  "/api/quests",
  "/api/league",
  "/api/streak",
  "/api/achievements",
  "/api/analytics",
  "/api/friends",
  "/api/notifications",
  "/api/profile",
  "/api/knowledge",
  "/api/challenges",
];

let failures = 0;
let checks = 0;

function report(label: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${label}${detail ? `  ${detail}` : ""}`);
}

/** Collect Set-Cookie values across requests into one Cookie header. */
class Jar {
  private jar = new Map<string, string>();

  absorb(res: Response) {
    // Node exposes multiple Set-Cookie headers via getSetCookie().
    const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair?.indexOf("=") ?? -1;
      if (!pair || eq < 1) continue;
      this.jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }

  header(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  has(nameFragment: string): boolean {
    return [...this.jar.keys()].some((k) => k.includes(nameFragment));
  }
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  // ── Public pages ─────────────────────────────────────────
  console.log("public pages:");
  for (const path of PUBLIC_PAGES) {
    const res = await fetch(BASE + path, { redirect: "manual" });
    const html = await res.text();
    const marker = ERROR_MARKERS.find((m) => html.includes(m));
    report(path, res.status === 200 && !marker, marker ? `-> ${marker}` : `${res.status}`);
  }

  // ── Log in ───────────────────────────────────────────────
  console.log("\nauthentication:");
  const jar = new Jar();

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  report("csrf token", Boolean(csrfToken));

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD }),
  });
  jar.absorb(loginRes);
  report("sign in", jar.has("session-token"), jar.has("session-token") ? "" : "no session cookie");

  if (!jar.has("session-token")) {
    console.log("\nCannot continue without a session. Is the demo user seeded?");
    process.exit(1);
  }

  const authed = { headers: { Cookie: jar.header() }, redirect: "manual" as const };

  // ── Game shell pages ─────────────────────────────────────
  console.log("\ngame shell pages:");
  for (const path of GAME_PAGES) {
    try {
      const res = await fetch(BASE + path, authed);
      const html = await res.text();
      const marker = ERROR_MARKERS.find((m) => html.includes(m));
      report(path, res.status === 200 && !marker, marker ? `-> ${marker}` : `${res.status}`);
    } catch (e) {
      report(path, false, (e as Error).message);
    }
  }

  // ── Authenticated pages ──────────────────────────────────
  console.log("\napp pages:");
  for (const path of APP_PAGES) {
    try {
      const res = await fetch(BASE + path, authed);
      const html = await res.text();
      const marker = ERROR_MARKERS.find((m) => html.includes(m));
      const redirectedToLogin = res.status === 307 || res.status === 302;
      report(
        path,
        res.status === 200 && !marker,
        marker ? `-> ${marker}` : redirectedToLogin ? "redirected (session rejected)" : `${res.status}`,
      );
    } catch (e) {
      report(path, false, (e as Error).message);
    }
  }

  // ── Game shell APIs ──────────────────────────────────────
  console.log("\ngame shell apis:");
  for (const path of GAME_APIS) {
    try {
      const res = await fetch(BASE + path, authed);
      const body = await res.text();
      let ok = res.status === 200;
      let detail = `${res.status}`;
      if (ok) {
        try {
          JSON.parse(body);
        } catch {
          ok = false;
          detail = "non-JSON response";
        }
      }
      report(path, ok, detail);
    } catch (e) {
      report(path, false, (e as Error).message);
    }
  }

  // ── Authenticated APIs ───────────────────────────────────
  console.log("\napi routes:");
  for (const path of APP_APIS) {
    try {
      const res = await fetch(BASE + path, authed);
      const body = await res.text();
      let ok = res.status === 200;
      let detail = `${res.status}`;
      if (ok) {
        try {
          JSON.parse(body);
        } catch {
          ok = false;
          detail = "non-JSON response";
        }
      }
      report(path, ok, detail);
    } catch (e) {
      report(path, false, (e as Error).message);
    }
  }

  // ── Summary ──────────────────────────────────────────────
  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
  console.log("All good.");
}

main().catch((e) => {
  console.error("Smoke run crashed:", e);
  process.exit(1);
});
