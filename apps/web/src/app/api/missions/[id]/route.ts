/**
 * Read one mission back.
 *
 * Every failure on this route is the same failure: `MISSION_NOT_FOUND` with a
 * 404. No cookie, an unresolvable cookie, an id that was never issued, and an
 * id belonging to a different guest are indistinguishable from outside, which
 * is the only way the id space stays unprobeable. A `403` here would confirm
 * that the mission exists.
 *
 * There is no origin check: this is a read, it mutates nothing, and the cookie
 * is `SameSite=Lax` so a cross-site page cannot read the response anyway.
 */

import {
  GenerationError,
  demoPortsFromEnv,
  generationErrorBody,
  guestCookiePolicyFromEnv,
  randomIdGenerator,
  randomTokenSource,
  readMission,
  resolveGuest,
  sha256TokenHasher,
  systemClock,
  type GenerationErrorCode,
} from "@zandegi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, code: GenerationErrorCode, requestId: string): Response {
  return Response.json(generationErrorBody(code, requestId), {
    status,
    headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" },
  });
}

/** Server-only. The client gets a stable code; the detail stops here. */
function logDiagnostic(requestId: string, code: GenerationErrorCode, diagnostic: string): void {
  console.error("[missions]", JSON.stringify({ requestId, code, diagnostic }));
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_UNAUTHENTICATED_GENERATION !== "true"
  ) {
    return jsonError(503, "GENERATION_DISABLED", requestId);
  }

  const { id } = await context.params;

  try {
    const ports = await demoPortsFromEnv();
    // A read never mints: arriving without a resolvable cookie is arriving
    // without ownership of anything, and the answer is the same not-found.
    const guest = await resolveGuest(
      _req.headers.get("cookie"),
      guestCookiePolicyFromEnv(process.env),
      {
        clock: systemClock,
        ids: randomIdGenerator,
        tokens: randomTokenSource,
        hasher: sha256TokenHasher,
        guests: ports.guests,
      },
    );
    if (guest === null) return jsonError(404, "MISSION_NOT_FOUND", requestId);

    const mission = await readMission(
      { principal: guest.principal, missionId: id },
      { persistence: ports.persistence },
    );

    return Response.json(
      { mission },
      {
        headers: {
          "X-Request-Id": requestId,
          "Cache-Control": "no-store",
          // Re-written on every request so the browser-side expiry renews
          // alongside the server-side retention window.
          "Set-Cookie": guest.setCookie,
        },
      },
    );
  } catch (error) {
    if (error instanceof GenerationError) {
      logDiagnostic(requestId, error.code, error.diagnostic);
      return jsonError(error.code === "MISSION_NOT_FOUND" ? 404 : 503, error.code, requestId);
    }
    logDiagnostic(requestId, "STORE_UNAVAILABLE", "non-api failure");
    return jsonError(503, "STORE_UNAVAILABLE", requestId);
  }
}
