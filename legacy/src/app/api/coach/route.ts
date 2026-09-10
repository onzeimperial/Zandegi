import { route, ok, assertSameOrigin, rateLimit, tooMany, forbidden, HttpError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { parseBody, coachMessageSchema } from "@/lib/validation";
import { runCoach, type CoachTurn } from "@/ai/coach";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import { startOfDay } from "@/lib/utils";
import { env } from "@/lib/env";
import { getEntitlements } from "@/server/billing/service";

export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const conversationId = url.searchParams.get("conversationId");

  if (conversationId) {
    const convo = await db.aiConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!convo || convo.userId !== user.id) throw forbidden();
    return ok({ conversation: convo });
  }

  const conversations = await db.aiConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: { _count: { select: { messages: true } } },
  });
  return ok({ conversations });
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireUser();

  const rl = rateLimit(`coach:${user.id}`, env.ZANDEGI_AI_RATE_LIMIT, 60_000);
  if (!rl.allowed) throw tooMany(rl.retryAfter);

  // Free accounts get a daily allowance of coaching messages.
  const ent = await getEntitlements(user.id);
  if (ent.limits.coachMessagesPerDay !== Infinity) {
    const sentToday = await db.aiMessage.count({
      where: {
        role: "user",
        conversation: { userId: user.id },
        createdAt: { gte: startOfDay() },
      },
    });
    if (sentToday >= ent.limits.coachMessagesPerDay) {
      throw new HttpError(
        402,
        "upgrade_required",
        `Free accounts get ${ent.limits.coachMessagesPerDay} coaching messages a day. Start your free trial for unlimited coaching.`,
      );
    }
  }

  const body = await parseBody(req, coachMessageSchema);

  // Resolve / create conversation
  let conversation = body.conversationId
    ? await db.aiConversation.findUnique({ where: { id: body.conversationId }, include: { messages: { orderBy: { createdAt: "asc" } } } })
    : null;
  if (conversation && conversation.userId !== user.id) throw forbidden();

  if (body.goalId) {
    const g = await db.goal.findUnique({ where: { id: body.goalId }, select: { userId: true } });
    if (!g || g.userId !== user.id) throw forbidden();
  }

  if (!conversation) {
    conversation = await db.aiConversation.create({
      data: {
        userId: user.id,
        goalId: body.goalId ?? null,
        title: body.message.slice(0, 60),
      },
      include: { messages: true },
    });
  }

  const history: CoachTurn[] = conversation.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  await db.aiMessage.create({ data: { conversationId: conversation.id, role: "user", content: body.message } });

  const result = await runCoach({
    userId: user.id,
    goalId: body.goalId ?? conversation.goalId ?? undefined,
    message: body.message,
    history,
  });

  await db.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: result.reply.reply,
      meta: stringifyJson({
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        fallbackReason: result.fallbackReason,
        focusToday: result.reply.focusToday,
        proposedActions: result.reply.proposedActions,
        confidence: result.reply.confidence,
      }),
    },
  });
  await db.aiConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  // Persist recommendations the coach surfaced
  for (const rec of result.reply.recommendations ?? []) {
    await db.aiRecommendation.create({
      data: {
        userId: user.id,
        goalId: body.goalId ?? conversation.goalId ?? null,
        kind: rec.kind,
        title: rec.title,
        body: rec.body,
        priority: rec.priority ?? 3,
        rationale: "Surfaced by the AI Coach",
      },
    });
  }

  return ok({
    conversationId: conversation.id,
    reply: result.reply.reply,
    focusToday: result.reply.focusToday,
    recommendations: result.reply.recommendations,
    proposedActions: result.reply.proposedActions,
    provider: result.provider,
    model: result.model,
    confidence: result.reply.confidence,
    fallbackReason: result.fallbackReason ?? null,
  });
});
