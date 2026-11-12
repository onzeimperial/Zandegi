/**
 * Complete one step of the caller's own mission.
 *
 * A mutation, so it is guarded like generation: the auth mode, then the origin
 * check before the body is read, then the body, then the session. It never
 * mints a guest -- completing a step means owning a mission, and a caller
 * without a resolvable cookie owns nothing.
 *
 * The body is multipart form data: `stepId`, `evidence` ("SELF" or "ARTIFACT")
 * and, for a photo, `photo`. The photo is checked and fingerprinted by the use
 * case, then discarded. A page open from before stable ids sends `chapter` and
 * `step` positions instead; a position is exactly the id of the step generated
 * there, and no edit can predate the deploy, so it names the same step.
 */

import {
  GenerationError,
  allowedOriginsFromEnv,
  assertSameSiteRequest,
  authModeFromEnv,
  completeStep,
  generationErrorBody,
  randomIdGenerator,
  systemClock,
  trustsForwardedOrigin,
  type CompletionEvidenceInput,
  type GenerationErrorCode,
} from "@zandegi/api";
import { MAX_EVIDENCE_PHOTO_BYTES } from "@zandegi/api/client";
import { ACCESS_STATUS, isAccessRefusal, resolveRequestSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Room for the largest photo plus the multipart framing and small fields. */
const MAX_BODY_BYTES = MAX_EVIDENCE_PHOTO_BYTES + 64 * 1024;

const STATUS: Partial<Record<GenerationErrorCode, number>> = {
  ...ACCESS_STATUS,
  INVALID_REQUEST: 400,
  CROSS_SITE_REQUEST: 403,
  MISSION_NOT_FOUND: 404,
  STEP_NOT_CURRENT: 409,
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
  console.error("[complete]", JSON.stringify({ requestId, code, diagnostic }));
}

/** The step id from the form, or `undefined`. */
function stepIdField(form: FormData): string | undefined {
  const stepId = form.get("stepId");
  if (typeof stepId === "string") {
    return /^[A-Za-z0-9:_-]{1,64}$/.test(stepId) ? stepId : undefined;
  }
  const chapter = form.get("chapter");
  const step = form.get("step");
  return typeof chapter === "string" &&
    typeof step === "string" &&
    /^\d{1,3}$/.test(chapter) &&
    /^\d{1,3}$/.test(step)
    ? `${chapter}:${step}`
    : undefined;
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

  // A browser always sends a length with a form upload. Requiring one is what
  // bounds how much this route will buffer before it has checked anything.
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) return jsonError("INVALID_REQUEST", requestId);
  if (declared > MAX_BODY_BYTES) return jsonError("PAYLOAD_TOO_LARGE", requestId);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("INVALID_REQUEST", requestId);
  }

  const stepId = stepIdField(form);
  const kind = form.get("evidence");
  if (stepId === undefined) return jsonError("INVALID_REQUEST", requestId);

  let evidence: CompletionEvidenceInput;
  if (kind === "SELF") {
    evidence = { kind: "SELF" };
  } else if (kind === "ARTIFACT") {
    const photo = form.get("photo");
    if (!(photo instanceof File)) return jsonError("INVALID_REQUEST", requestId);
    if (photo.size > MAX_EVIDENCE_PHOTO_BYTES) return jsonError("PAYLOAD_TOO_LARGE", requestId);
    evidence = { kind: "ARTIFACT", bytes: new Uint8Array(await photo.arrayBuffer()) };
  } else {
    return jsonError("INVALID_REQUEST", requestId);
  }

  try {
    const { id } = await context.params;
    const session = await resolveRequestSession(req.headers.get("cookie"), { mint: false });
    if (session === null) return jsonError("MISSION_NOT_FOUND", requestId);

    const result = await completeStep(
      { principal: session.principal, missionId: id, stepId, evidence },
      {
        persistence: session.ports.persistence,
        ledger: session.ports.ledger,
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
