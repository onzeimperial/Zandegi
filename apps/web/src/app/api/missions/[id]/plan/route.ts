/**
 * Edit the caller's own mission plan: `PATCH { version, edit }`.
 *
 * Answers the saved mission with its new version. A stale version is
 * `PLAN_EDIT_CONFLICT` (409) and saves nothing; adding or removing a chapter is
 * `INVALID_REQUEST` (400); another person's mission is `MISSION_NOT_FOUND`
 * (404), exactly like one that does not exist. Editing writes no ledger event.
 */

import { editPlan } from "@zandegi/api";
import { handleJsonRoute } from "@/lib/json-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  return handleJsonRoute(req, { tag: "plan", mutation: true }, async (session, body) => {
    const { id } = await context.params;
    const mission = await editPlan(
      { principal: session.principal, missionId: id, request: body },
      { persistence: session.ports.persistence, plans: session.ports.plans },
    );
    return { mission };
  });
}
