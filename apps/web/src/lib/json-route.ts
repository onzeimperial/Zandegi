/**
 * The shared shape of the plan and log routes: the same guards, in the same
 * order, as the complete route.
 *
 *   1. The auth mode: production with no Clerk keys is off.
 *   2. For a mutation, the same-site check, before the body is read.
 *   3. A small JSON body, bounded before it is parsed.
 *   4. The session, which refuses a signed-out or uninvited person with 401 or
 *      403 and never mints a guest.
 *   5. The use case, whose `GenerationError` becomes a stable code.
 *
 * A diagnostic is logged for failures only, and it never holds the body: plan
 * text and log text are personal content.
 */

import {
  GenerationError,
  allowedOriginsFromEnv,
  assertSameSiteRequest,
  authModeFromEnv,
  generationErrorBody,
  trustsForwardedOrigin,
  type GenerationErrorCode,
} from "@zandegi/api";
import {
  ACCESS_STATUS,
  isAccessRefusal,
  resolveRequestSession,
  type RequestSession,
} from "./session";

/** Plan edits and logs are a few lines of text. */
export const MAX_JSON_BODY_BYTES = 16 * 1024;

const STATUS: Partial<Record<GenerationErrorCode, number>> = {
  ...ACCESS_STATUS,
  INVALID_JSON: 400,
  INVALID_REQUEST: 400,
  CROSS_SITE_REQUEST: 403,
  MISSION_NOT_FOUND: 404,
  PLAN_EDIT_CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
};

export function jsonError(code: GenerationErrorCode, requestId: string): Response {
  return Response.json(generationErrorBody(code, requestId), {
    status: STATUS[code] ?? 503,
    headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" },
  });
}

export function jsonOk(body: unknown, requestId: string, session: RequestSession): Response {
  return Response.json(body, {
    headers: {
      "X-Request-Id": requestId,
      "Cache-Control": "no-store",
      ...(session.setCookie === undefined ? {} : { "Set-Cookie": session.setCookie }),
    },
  });
}

class Refused extends Error {
  constructor(readonly code: GenerationErrorCode) {
    super(code);
  }
}

/** Steps 2 and 3. Throws `Refused` with the code to answer. */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    assertSameSiteRequest({
      origin: req.headers.get("origin"),
      requestUrl: req.url,
      allowedOrigins: allowedOriginsFromEnv(process.env.ZANDEGI_ALLOWED_ORIGINS),
      forwardedHost: req.headers.get("x-forwarded-host"),
      forwardedProto: req.headers.get("x-forwarded-proto"),
      trustForwarded: trustsForwardedOrigin(process.env.VERCEL),
    });
  } catch {
    throw new Refused("CROSS_SITE_REQUEST");
  }

  const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Refused("UNSUPPORTED_MEDIA_TYPE");

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
    throw new Refused("PAYLOAD_TOO_LARGE");
  }
  // The declared length is a hint; the text read is what is actually bounded.
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new Refused("PAYLOAD_TOO_LARGE");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Refused("INVALID_JSON");
  }
}

/**
 * Run one plan or log request. `run` receives the resolved session and the
 * parsed body (`undefined` for a read), and returns the success body.
 */
export async function handleJsonRoute(
  req: Request,
  options: { tag: string; mutation: boolean },
  run: (session: RequestSession, body: unknown) => Promise<unknown>,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const log = (code: GenerationErrorCode, diagnostic: string) =>
    console.error(`[${options.tag}]`, JSON.stringify({ requestId, code, diagnostic }));

  if (authModeFromEnv(process.env) === "disabled") {
    return jsonError("GENERATION_DISABLED", requestId);
  }

  let body: unknown;
  if (options.mutation) {
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return jsonError(error instanceof Refused ? error.code : "INVALID_REQUEST", requestId);
    }
  }

  try {
    const session = await resolveRequestSession(req.headers.get("cookie"), { mint: false });
    // Guest mode with no cookie owns nothing: the same answer as a missing mission.
    if (session === null) return jsonError("MISSION_NOT_FOUND", requestId);
    return jsonOk(await run(session, body), requestId, session);
  } catch (error) {
    if (error instanceof GenerationError) {
      if (!isAccessRefusal(error.code)) log(error.code, error.diagnostic);
      return jsonError(error.code, requestId);
    }
    log("STORE_UNAVAILABLE", "non-api failure");
    return jsonError("STORE_UNAVAILABLE", requestId);
  }
}
