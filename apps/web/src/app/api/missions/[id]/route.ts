/**
 * Read one mission back.
 *
 * For someone with access, every failure is the same failure: `MISSION_NOT_FOUND`
 * with a 404. A guest cookie that does not resolve, an id that was never issued,
 * and an id belonging to someone else are indistinguishable from outside, which
 * is the only way the id space stays unprobeable. A `403` for that would confirm
 * the mission exists. A signed-out or uninvited person is refused before any
 * lookup, so that answer says nothing about any mission.
 *
 * There is no origin check: this is a read, it mutates nothing.
 */

import {
  GenerationError,
  authModeFromEnv,
  generationErrorBody,
  readMission,
  type GenerationErrorCode,
} from "@zandegi/api";
import { ACCESS_STATUS, isAccessRefusal, resolveRequestSession } from "@/lib/session";

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
  if (authModeFromEnv(process.env) === "disabled") {
    return jsonError(503, "GENERATION_DISABLED", requestId);
  }

  const { id } = await context.params;

  try {
    // A read never mints: arriving without a resolvable cookie is arriving
    // without ownership of anything, and the answer is the same not-found.
    const session = await resolveRequestSession(_req.headers.get("cookie"), { mint: false });
    if (session === null) return jsonError(404, "MISSION_NOT_FOUND", requestId);

    const mission = await readMission(
      { principal: session.principal, missionId: id },
      { persistence: session.ports.persistence },
    );

    return Response.json(
      { mission },
      {
        headers: {
          "X-Request-Id": requestId,
          "Cache-Control": "no-store",
          // Re-written on every request so the browser-side expiry renews
          // alongside the server-side retention window.
          ...(session.setCookie === undefined ? {} : { "Set-Cookie": session.setCookie }),
        },
      },
    );
  } catch (error) {
    if (error instanceof GenerationError) {
      if (!isAccessRefusal(error.code)) logDiagnostic(requestId, error.code, error.diagnostic);
      const status = error.code === "MISSION_NOT_FOUND" ? 404 : (ACCESS_STATUS[error.code] ?? 503);
      return jsonError(status, error.code, requestId);
    }
    logDiagnostic(requestId, "STORE_UNAVAILABLE", "non-api failure");
    return jsonError(503, "STORE_UNAVAILABLE", requestId);
  }
}
