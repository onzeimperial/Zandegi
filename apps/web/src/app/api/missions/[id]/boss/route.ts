/**
 * Attempt a chapter's boss on the caller's own mission.
 *
 * Guarded like the complete route: the auth mode, then the origin check before
 * the body is read, then the body, then the session, which never mints.
 *
 * The body is multipart form data, so a photo can ride along: `chapterId`,
 * `result` ("done" or "not-yet"), `evidence` ("SELF" or "ARTIFACT"), `photo`
 * for a photo, `skipRest` ("true" to skip undone steps), `attemptKey`, and the
 * debrief answers `tips`, `wentWell`, `didntGoWell` and `improve`. Any other
 * field is refused. The photo is checked and fingerprinted, then discarded.
 *
 * Debrief text is personal content: it is never logged. A diagnostic carries
 * only the code and the use case's own redacted reason.
 */

import {
  GenerationError,
  allowedOriginsFromEnv,
  assertSameSiteRequest,
  attemptBoss,
  authModeFromEnv,
  generationErrorBody,
  randomIdGenerator,
  systemClock,
  trustsForwardedOrigin,
  type CompletionEvidenceInput,
  type GenerationErrorCode,
} from "@zandegi/api";
import { BOSS_ATTEMPT_FIELDS, MAX_EVIDENCE_PHOTO_BYTES } from "@zandegi/api/client";
import { ACCESS_STATUS, isAccessRefusal, resolveRequestSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Room for the largest photo plus the multipart framing and the debrief. */
const MAX_BODY_BYTES = MAX_EVIDENCE_PHOTO_BYTES + 64 * 1024;

const STATUS: Partial<Record<GenerationErrorCode, number>> = {
  ...ACCESS_STATUS,
  INVALID_REQUEST: 400,
  CROSS_SITE_REQUEST: 403,
  MISSION_NOT_FOUND: 404,
  BOSS_NOT_READY: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  EVIDENCE_REJECTED: 422,
};

function jsonError(code: GenerationErrorCode, requestId: string): Response {
  return Response.json(generationErrorBody(code, requestId), {
    status: STATUS[code] ?? 500,
    headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" },
  });
}

function logDiagnostic(requestId: string, code: GenerationErrorCode, diagnostic: string): void {
  console.error("[boss]", JSON.stringify({ requestId, code, diagnostic }));
}

const TEXT_FIELDS = [
  "chapterId",
  "result",
  "attemptKey",
  "tips",
  "wentWell",
  "didntGoWell",
  "improve",
];

/** The form's text fields as the use case's request, or `null` for an unknown or repeated field. */
function requestFields(form: FormData): Record<string, unknown> | null {
  const request: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const [key, value] of form.entries()) {
    if (!(BOSS_ATTEMPT_FIELDS as readonly string[]).includes(key) || seen.has(key)) return null;
    seen.add(key);
    if (TEXT_FIELDS.includes(key)) {
      if (typeof value !== "string") return null;
      request[key] = value;
    }
  }
  const skip = form.get("skipRest");
  if (skip !== null) {
    if (skip !== "true" && skip !== "false") return null;
    request.skipRest = skip === "true";
  }
  return request;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  if (authModeFromEnv(process.env) === "disabled") {
    return jsonError("GENERATION_DISABLED", requestId);
  }

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
    return jsonError("CROSS_SITE_REQUEST", requestId);
  }

  const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "multipart/form-data") return jsonError("UNSUPPORTED_MEDIA_TYPE", requestId);

  // A browser always sends a length with a form upload; requiring one bounds
  // how much this route will buffer before it has checked anything.
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) return jsonError("INVALID_REQUEST", requestId);
  if (declared > MAX_BODY_BYTES) return jsonError("PAYLOAD_TOO_LARGE", requestId);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("INVALID_REQUEST", requestId);
  }

  const request = requestFields(form);
  if (request === null) return jsonError("INVALID_REQUEST", requestId);

  let evidence: CompletionEvidenceInput;
  const kind = form.get("evidence");
  if (kind === "SELF") {
    evidence = { kind: "SELF" };
  } else if (kind === "ARTIFACT") {
    const photo = form.get("photo");
    if (!(photo instanceof File)) return jsonError("INVALID_REQUEST", requestId);
    if (photo.size > MAX_EVIDENCE_PHOTO_BYTES) return jsonError("PAYLOAD_TOO_LARGE", requestId);
    evidence = { kind: "ARTIFACT", bytes: new Uint8Array(await photo.arrayBuffer()) };
  } else {
    // METRIC, TIMER and INTEGRATION are not accepted for a boss (law 3).
    return jsonError("INVALID_REQUEST", requestId);
  }

  try {
    const { id } = await context.params;
    const session = await resolveRequestSession(req.headers.get("cookie"), { mint: false });
    if (session === null) return jsonError("MISSION_NOT_FOUND", requestId);

    const result = await attemptBoss(
      { principal: session.principal, missionId: id, request, evidence },
      {
        persistence: session.ports.persistence,
        ledger: session.ports.ledger,
        plans: session.ports.plans,
        bosses: session.ports.bosses,
        clock: systemClock,
        ids: randomIdGenerator,
      },
    );

    return Response.json(
      { result },
      {
        headers: {
          "X-Request-Id": requestId,
          "Cache-Control": "no-store",
          ...(session.setCookie === undefined ? {} : { "Set-Cookie": session.setCookie }),
        },
      },
    );
  } catch (error) {
    if (error instanceof GenerationError) {
      if (!isAccessRefusal(error.code)) logDiagnostic(requestId, error.code, error.diagnostic);
      return jsonError(error.code, requestId);
    }
    logDiagnostic(requestId, "STORE_UNAVAILABLE", "non-api failure");
    return jsonError("STORE_UNAVAILABLE", requestId);
  }
}
