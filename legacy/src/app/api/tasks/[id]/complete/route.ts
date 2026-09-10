import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody, completeTaskSchema } from "@/lib/validation";
import { completeTask } from "@/server/tasks/service";
import { captureSnapshot } from "@/server/progress/snapshot";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  const body = await parseBody(req, completeTaskSchema);

  const result = await completeTask({
    userId: user.id,
    taskId: id,
    minutesSpent: body.minutesSpent ?? null,
    performance: body.performance ?? null,
    note: body.note ?? null,
  });

  await captureSnapshot(user.id, null).catch(() => {});

  return ok(result);
});
