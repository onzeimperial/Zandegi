import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AuthError } from "./auth";
import { ALLOWED_ORIGINS } from "./env";
import { HttpError, notFound, forbidden, badRequest, tooMany } from "./errors";

export { HttpError, notFound, forbidden, badRequest, tooMany };

export type ApiError = { error: string; code: string; details?: unknown };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json<ApiError>({ error: message, code, details }, { status });
}

/**
 * Wrap a route handler so every thrown error becomes a clean JSON response.
 * Never leak stack traces or Prisma internals to the client.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response> | Response,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) return fail(401, "unauthenticated", err.message);
      if (err instanceof ZodError) {
        return fail(422, "validation_error", "Some fields are invalid", err.flatten());
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2025") return fail(404, "not_found", "Resource not found");
        if (err.code === "P2002") return fail(409, "conflict", "That already exists");
        return fail(400, "db_error", "Database request failed");
      }
      if (err instanceof HttpError) return fail(err.status, err.code, err.message, err.details);
      console.error("[api] unhandled error:", err);
      return fail(500, "internal_error", "Something went wrong on our side");
    }
  };
}

/** Basic CSRF hardening for mutating requests. */
export function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetch() often omits Origin
  if (!ALLOWED_ORIGINS.includes(origin)) {
    throw new HttpError(403, "bad_origin", "Cross-origin request rejected");
  }
}

// ── Naive fixed-window rate limiter (per process). Swap for Redis in prod. ──
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { allowed: true, remaining: limit - b.count, retryAfter: 0 };
}
