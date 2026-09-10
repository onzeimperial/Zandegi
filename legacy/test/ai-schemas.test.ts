import { describe, it, expect } from "vitest";
import { extractJson } from "@/ai/client";
import { goalPlanSchema, coachReplySchema, decompositionResultSchema } from "@/ai/schemas";

describe("extractJson", () => {
  it("pulls a bare JSON object out of surrounding prose", () => {
    const out = extractJson('Sure! Here you go:\n{"a":1,"b":[2,3]}\nHope that helps.');
    expect(out).toEqual({ a: 1, b: [2, 3] });
  });

  it("handles ```json fenced blocks", () => {
    const out = extractJson('```json\n{"x": true}\n```');
    expect(out).toEqual({ x: true });
  });

  it("does not get confused by braces inside strings", () => {
    const out = extractJson('{"note": "use {curly} braces", "n": 1}');
    expect(out).toEqual({ note: "use {curly} braces", n: 1 });
  });

  it("returns null when there is no JSON", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});

describe("goalPlanSchema", () => {
  const minimal = {
    needsClarification: false,
    title: "Learn X",
    summary: "A plan.",
    category: "education",
    difficulty: 3,
    confidence: 60,
    recommendedTimelineWeeks: 12,
    milestones: [{ title: "M1" }],
    skills: [{ name: "S1" }],
    tasks: [{ title: "T1" }, { title: "T2" }, { title: "T3" }],
  };

  it("accepts a minimal plan and fills defaults", () => {
    const p = goalPlanSchema.parse(minimal);
    expect(p.startLevel).toBe(1);
    expect(p.targetLevel).toBeGreaterThan(1);
    expect(p.tasks[0]!.type).toBe("once");
    expect(p.tasks[0]!.priority).toBe("medium");
    expect(p.resources).toEqual([]);
  });

  it("rejects an unknown category", () => {
    expect(() => goalPlanSchema.parse({ ...minimal, category: "underwater-basket-weaving" })).toThrow();
  });

  it("rejects a plan with too few tasks", () => {
    expect(() => goalPlanSchema.parse({ ...minimal, tasks: [{ title: "only one" }] })).toThrow();
  });

  it("clamps/validates difficulty range", () => {
    expect(() => goalPlanSchema.parse({ ...minimal, difficulty: 9 })).toThrow();
  });
});

describe("decompositionResultSchema", () => {
  it("accepts a clarification request", () => {
    const r = decompositionResultSchema.parse({
      needsClarification: true,
      questions: ["What's your current level?"],
      interpretationSoFar: "You want to learn something.",
    });
    expect("needsClarification" in r && r.needsClarification).toBe(true);
  });
});

describe("coachReplySchema", () => {
  it("accepts a plain reply with defaults", () => {
    const r = coachReplySchema.parse({ reply: "Do task A first." });
    expect(r.focusToday).toEqual([]);
    expect(r.recommendations).toEqual([]);
    expect(r.proposedActions).toEqual([]);
    expect(r.confidence).toBe(70);
  });

  it("validates proposed action shapes", () => {
    const r = coachReplySchema.parse({
      reply: "Adding a task.",
      proposedActions: [
        { type: "create_task", goalIdRef: "g1", title: "New task" },
        { type: "adjust_timeline", goalIdRef: "g1", newTimelineWeeks: 10, reason: "slipping" },
      ],
    });
    expect(r.proposedActions).toHaveLength(2);
  });

  it("rejects an unknown action type", () => {
    expect(() =>
      coachReplySchema.parse({ reply: "x", proposedActions: [{ type: "delete_everything", goalIdRef: "g1" }] }),
    ).toThrow();
  });
});
