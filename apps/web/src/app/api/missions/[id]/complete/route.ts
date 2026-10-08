/**
 * Complete one step of the caller's own mission.
 *
 * A mutation, so it is guarded like generation: the production gate, then the
 * origin check before the body is read, then the body, then the guest. It
 * never mints a guest -- completing a step means owning a mission, and a
 * caller without a resolvable cookie owns nothing.
 *
 * The body is multipart form data: `chapter`, `step`, `evidence` ("SELF" or
 * "ARTIFACT") and, for a photo, `photo`. The photo is checked and fingerprinted
 * by the use case, then discarded.
 */

import {
  GenerationError,
  allowedOriginsFromEnv,
  assertSameSiteRequest,
  completeStep,
  demoPortsFromEnv,
  generationErrorBody,
  guestCookiePolicyFromEnv,
  randomIdGenerator,
  randomTokenSource,
  resolveGuest,
  sha256TokenHasher,
  systemClock,
  trustsForwardedOrigin,
  type CompletionEvidenceInput,
  type GenerationErrorCode,
} from "@zandegi/api";
import { MAX_EVIDENCE_PHOTO_BYTES } from "@zandegi/api/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Room for the largest photo plus the multipart framing and small fields. */
const MAX_BODY_BYTES = MAX_EVIDENCE_PHOTO_BYTES + 64 * 1024;

const STATUS: Partial<Record<GenerationErrorCode, number>> = {
  INVALID_REQUEST: 400,
  CROSS_SITE_REQUEST: 403,
  MISSION_NOT_FOUND: 404,
  STEP_NOT_CURRENT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  EVIDENCE_REJECTED: 422,
  GENERATION_DISABLED: 503,
  STORE_UNAVAILABLE: 503,
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

/** A small non-negative integer from a form field, or `undefined`. */
function indexField(value: FormDataEntryValue | null): number | undefined {
  return typeof value === "string" && /^\d{1,3}$/.test(value) ? Number(value) : undefined;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_UNAUTHENTICATED_GENERATION !== "true"
  ) {
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

  const chapterIndex = indexField(form.get("chapter"));
  const stepIndex = indexField(form.get("step"));
  const kind = form.get("evidence");
  if (chapterIndex === undefined || stepIndex === undefined) {
    return jsonError("INVALID_REQUEST", requestId);
  }

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
    const ports = await demoPortsFromEnv();
    const guest = await resolveGuest(
      req.headers.get("cookie"),
      guestCookiePolicyFromEnv(process.env),
      {
        clock: systemClock,
        ids: randomIdGenerator,
        tokens: randomTokenSource,
        hasher: sha256TokenHasher,
        guests: ports.guests,
      },
    );
    if (guest === null) return jsonError("MISSION_NOT_FOUND", requestId);

    const result = await completeStep(
      { principal: guest.principal, missionId: id, chapterIndex, stepIndex, evidence },
      {
        persistence: ports.persistence,
        ledger: ports.ledger,
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
          "Set-Cookie": guest.setCookie,
        },
      },
    );
  } catch (error) {
    if (error instanceof GenerationError) {
      logDiagnostic(requestId, error.code, error.diagnostic);
      return jsonError(error.code, requestId);
    }
    logDiagnostic(requestId, "STORE_UNAVAILABLE", "non-api failure");
    return jsonError("STORE_UNAVAILABLE", requestId);
  }
}
