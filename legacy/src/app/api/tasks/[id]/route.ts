import { route, ok, assertSameOrigin } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody, updateTaskSchema } from "@/lib/validation";
import { getOwnedTask } from "@/server/tasks/service";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  await getOwnedTask(user.id, id);
  const body = await parseBody(req, updateTaskSchema);

  const task = await db.task.update({
    where: { id },
    data: {
      ...body,
      ...(body.status === "in_progress" ? {} : {}),
    },
  });
  return ok({ task });
});

export const DELETE = route(async (req: Request, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireUser();
  const { id } = await params;
  await getOwnedTask(user.id, id);
  await db.task.delete({ where: { id } });
  return ok({ deleted: true });
});
