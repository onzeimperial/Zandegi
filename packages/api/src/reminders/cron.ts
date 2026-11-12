/**
 * The guard on the daily trigger. Vercel's cron sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused, and with no
 * secret configured everything is refused.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type { Env } from "../demo-store";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time: comparing fixed-length digests leaks neither content nor length. */
export function isCronAuthorized(authorization: string | null, env: Env): boolean {
  const secret = env.CRON_SECRET?.trim() ?? "";
  if (secret.length === 0 || authorization === null) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}

/**
 * The public origin for links in an email: `ZANDEGI_APP_URL`, then Vercel's
 * production host, then the origin the trigger arrived on.
 */
export function appUrlFromEnv(env: Env, requestOrigin: string): string {
  const configured = env.ZANDEGI_APP_URL?.trim() ?? "";
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/+$/, "");
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ?? "";
  if (/^[A-Za-z0-9.-]+$/.test(vercelHost)) return `https://${vercelHost}`;
  return requestOrigin;
}
