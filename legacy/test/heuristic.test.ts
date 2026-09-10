import { describe, it, expect } from "vitest";
import { heuristicDecompose } from "@/ai/heuristic";
import { goalPlanSchema } from "@/ai/schemas";
import { normalisePlan } from "@/ai/plan-normalize";

const base = { dailyMinutes: 45, weeklyDays: 5, targetDate: null as Date | null };

describe("heuristicDecompose", () => {
  it("produces a plan that passes the strict goalPlan schema", () => {
    const plan = heuristicDecompose({ ...base, rawInput: "I want to learn to play piano" });
    expect(() => goalPlanSchema.parse(plan)).not.toThrow();
  });

  it("classifies common goals into sensible categories", () => {
    expect(heuristicDecompose({ ...base, rawInput: "Score 2900 on the UCAT" }).category).toBe("exam");
    expect(heuristicDecompose({ ...base, rawInput: "Learn Python and data structures" }).category).toBe("programming");
    expect(heuristicDecompose({ ...base, rawInput: "Become fluent in Japanese" }).category).toBe("language");
    expect(heuristicDecompose({ ...base, rawInput: "Train for a half marathon" }).category).toBe("sport");
    expect(heuristicDecompose({ ...base, rawInput: "asdfghjkl random nonsense" }).category).toBe("general");
  });

  it("always emits at least 3 tasks and 1 milestone and 1 skill", () => {
    const plan = heuristicDecompose({ ...base, rawInput: "Get my life together" });
    expect(plan.tasks.length).toBeGreaterThanOrEqual(3);
    expect(plan.milestones.length).toBeGreaterThanOrEqual(1);
    expect(plan.skills.length).toBeGreaterThanOrEqual(1);
  });

  it("every task references a skill/milestone that exists in the plan (or null)", () => {
    const plan = heuristicDecompose({ ...base, rawInput: "Learn calculus" });
    const skills = new Set(plan.skills.map((s) => s.name));
    const ms = new Set(plan.milestones.map((m) => m.title));
    for (const t of plan.tasks) {
      if (t.skill) expect(skills.has(t.skill)).toBe(true);
      if (t.milestone) expect(ms.has(t.milestone)).toBe(true);
    }
  });

  it("respects a target date when setting the timeline", () => {
    const target = new Date(Date.now() + 70 * 864e5); // 10 weeks
    const plan = heuristicDecompose({ ...base, rawInput: "Prepare for exams", targetDate: target });
    expect(plan.recommendedTimelineWeeks).toBeGreaterThanOrEqual(9);
    expect(plan.recommendedTimelineWeeks).toBeLessThanOrEqual(11);
  });

  it("scales task effort down for very limited time budgets", () => {
    const busy = heuristicDecompose({ rawInput: "Learn guitar", dailyMinutes: 15, weeklyDays: 2, targetDate: null });
    const recurring = busy.tasks.filter((t) => t.recurrence);
    expect(recurring.every((t) => t.estimatedMinutes <= 20)).toBe(true);
  });

  it("extracts a numeric metric where present", () => {
    const plan = heuristicDecompose({ ...base, rawInput: "I want a 99 ATAR" });
    expect(plan.metric).not.toBeNull();
    expect(plan.metric?.name).toBe("ATAR");
    expect(plan.metric?.target).toBe(99);
  });

  it("extracts metrics that aren't tied to one country's exams", () => {
    const cases: Array<[string, number]> = [
      ["Score 2400 on the UCAT", 2400],
      ["Reach a GPA of 3.8", 3.8],
      ["Get a 1500 rating in chess", 1500],
      ["Reach an IELTS of 7", 7],
      ["Read 30 books this year", 30],
      ["Get down to 75 kg", 75],
      ["Type at 80 wpm", 80],
    ];
    for (const [input, target] of cases) {
      const plan = heuristicDecompose({ ...base, rawInput: input });
      expect(plan.metric, `no metric from "${input}"`).not.toBeNull();
      expect(plan.metric?.target, `wrong target for "${input}"`).toBe(target);
    }
  });

  it("rates region-neutral ambition wording as difficult", () => {
    // Regression: difficulty used to hinge on the literal strings 99 and 2400.
    for (const input of [
      "Graduate with first-class honours",
      "Become a world-class violinist",
      "Finish in the top 1% of my cohort",
      "Complete a PhD",
    ]) {
      const plan = heuristicDecompose({ ...base, rawInput: input });
      expect(plan.difficulty, `"${input}" rated too easy`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("normalisePlan", () => {
  it("drops dangling skill parents and task links", () => {
    const plan = heuristicDecompose({ ...base, rawInput: "Learn to draw" });
    const broken = {
      ...plan,
      skills: plan.skills.map((s, i) => (i === 1 ? { ...s, parent: "Nonexistent Skill" } : s)),
      tasks: plan.tasks.map((t, i) => (i === 0 ? { ...t, skill: "Ghost Skill", milestone: "Ghost Milestone" } : t)),
    };
    const fixed = normalisePlan(broken);
    expect(fixed.skills[1]!.parent).toBeNull();
    expect(fixed.tasks[0]!.skill).toBeNull();
    expect(fixed.tasks[0]!.milestone).toBeNull();
  });

  it("guarantees targetLevel > startLevel", () => {
    const plan = heuristicDecompose({ ...base, rawInput: "Learn chess" });
    const fixed = normalisePlan({ ...plan, startLevel: 20, targetLevel: 3 });
    expect(fixed.targetLevel).toBeGreaterThan(fixed.startLevel);
  });
});
