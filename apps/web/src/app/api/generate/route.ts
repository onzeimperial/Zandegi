/**
 * Streams a live mission generation to the browser as Server-Sent Events.
 *
 * No auth, no database — neither exists yet (BUILD-PROMPTS sessions 3/4).
 * This is a demo endpoint: it runs the pipeline and returns the event, it
 * does not persist anything.
 */

import { generateMission, type GoalInput } from "@zandegi/ai";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.rawText !== "string" || body.rawText.trim().length === 0) {
    return Response.json({ error: "rawText is required" }, { status: 400 });
  }

  const input: GoalInput = {
    rawText: body.rawText,
    weeklyTimeBudgetMinutes:
      typeof body.weeklyTimeBudgetMinutes === "number" ? body.weeklyTimeBudgetMinutes : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    location: typeof body.location === "string" ? body.location : undefined,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const result = await generateMission(input, (event) => send({ type: "progress", event }));
        send({ type: "result", result });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "generation failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
