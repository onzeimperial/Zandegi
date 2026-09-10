import { describe, it, expect } from "vitest";
import { ALL_TEMPLATES, DOMAINS, DOMAIN_OF } from "@/server/catalog";
import { templateToPlan } from "@/server/catalog/expand";
import { browseCatalog, getTemplate } from "@/server/catalog/service";
import { goalPlanSchema } from "@/ai/schemas";
import { GOAL_CATEGORIES } from "@/lib/constants";

describe("catalogue integrity", () => {
  it("has globally unique template keys", () => {
    const keys = ALL_TEMPLATES.map((t) => t.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes, `duplicate keys: ${dupes.join(", ")}`).toEqual([]);
  });

  it("has unique domain keys", () => {
    const keys = DOMAINS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses only known goal categories", () => {
    for (const t of ALL_TEMPLATES) {
      expect(GOAL_CATEGORIES, `${t.key} has category "${t.category}"`).toContain(t.category);
    }
  });

  it("keeps difficulty in 1..5 and weeks positive", () => {
    for (const t of ALL_TEMPLATES) {
      expect(t.difficulty, t.key).toBeGreaterThanOrEqual(1);
      expect(t.difficulty, t.key).toBeLessThanOrEqual(5);
      expect(t.weeks, t.key).toBeGreaterThan(0);
    }
  });

  it("gives every template skills, milestones and tags", () => {
    for (const t of ALL_TEMPLATES) {
      expect(t.skills.length, `${t.key} has no skills`).toBeGreaterThan(0);
      expect(t.milestones.length, `${t.key} has no milestones`).toBeGreaterThan(0);
      expect(t.tags.length, `${t.key} has no tags`).toBeGreaterThan(0);
      expect(t.summary.length, `${t.key} has no summary`).toBeGreaterThan(10);
    }
  });

  it("stays inside the plan schema's skill and milestone caps", () => {
    for (const t of ALL_TEMPLATES) {
      expect(t.skills.length, `${t.key} exceeds 30 skills`).toBeLessThanOrEqual(30);
      expect(t.milestones.length, `${t.key} exceeds 12 milestones`).toBeLessThanOrEqual(12);
    }
  });

  it("maps every template to a domain", () => {
    for (const t of ALL_TEMPLATES) {
      expect(DOMAIN_OF.get(t.key), `${t.key} has no domain`).toBeTruthy();
    }
  });

  it("has no duplicate skill names inside one template", () => {
    for (const t of ALL_TEMPLATES) {
      expect(new Set(t.skills).size, `${t.key} repeats a skill`).toBe(t.skills.length);
    }
  });
});

describe("templateToPlan", () => {
  it("produces a schema-valid plan for every template", () => {
    for (const t of ALL_TEMPLATES) {
      const plan = templateToPlan(t, { dailyMinutes: 45, weeklyDays: 5 });
      const parsed = goalPlanSchema.safeParse(plan);
      expect(parsed.success, `${t.key}: ${JSON.stringify(parsed.error?.issues?.[0])}`).toBe(true);
    }
  });

  it("honours an overridden timeline", () => {
    const t = ALL_TEMPLATES[0]!;
    const plan = templateToPlan(t, { dailyMinutes: 45, weeklyDays: 5, timelineWeeks: 7 });
    expect(plan.recommendedTimelineWeeks).toBe(7);
  });

  it("falls back to the template's own duration", () => {
    const t = ALL_TEMPLATES[0]!;
    const plan = templateToPlan(t, { dailyMinutes: 45, weeklyDays: 5, timelineWeeks: null });
    expect(plan.recommendedTimelineWeeks).toBe(t.weeks);
  });

  it("orders milestones by ascending target level", () => {
    for (const t of ALL_TEMPLATES) {
      const plan = templateToPlan(t, { dailyMinutes: 45, weeklyDays: 5 });
      const levels = plan.milestones.map((m) => m.targetLevel);
      expect([...levels].sort((a, b) => a - b), t.key).toEqual(levels);
    }
  });

  it("uses recurring practice only when training most days", () => {
    const t = ALL_TEMPLATES[0]!;
    const daily = templateToPlan(t, { dailyMinutes: 45, weeklyDays: 6 });
    const weekly = templateToPlan(t, { dailyMinutes: 45, weeklyDays: 2 });
    expect(daily.tasks.some((x) => x.type === "daily")).toBe(true);
    expect(weekly.tasks.some((x) => x.type === "daily")).toBe(false);
  });

  it("beats the heuristic's stated confidence", () => {
    const plan = templateToPlan(ALL_TEMPLATES[0]!, { dailyMinutes: 45, weeklyDays: 5 });
    expect(plan.confidence).toBeGreaterThan(45);
  });
});

describe("browseCatalog", () => {
  it("returns everything by default", () => {
    expect(browseCatalog().total).toBe(ALL_TEMPLATES.length);
  });

  it("filters by domain", () => {
    const d = DOMAINS[0]!;
    const res = browseCatalog({ domain: d.key });
    expect(res.total).toBe(d.templates.length);
  });

  it("finds templates by title text", () => {
    const res = browseCatalog({ q: "pull-up" });
    expect(res.items.some((i) => i.key === "fitness-first-pullup")).toBe(true);
  });

  it("finds templates by tag", () => {
    const res = browseCatalog({ q: "marathon" });
    expect(res.total).toBeGreaterThan(0);
  });

  it("returns nothing for nonsense", () => {
    expect(browseCatalog({ q: "zzzzqqqxyz" }).total).toBe(0);
  });

  it("handles multi-word queries", () => {
    // Regression: token-less substring matching returned 0 for these.
    for (const q of ["save money", "learn guitar", "quit smoking", "run a marathon"]) {
      expect(browseCatalog({ q }).total, `"${q}" found nothing`).toBeGreaterThan(0);
    }
  });

  it("requires every query token to match", () => {
    // "guitar" matches plenty; "zzzz" matches nothing, so together: nothing.
    expect(browseCatalog({ q: "guitar zzzzqqq" }).total).toBe(0);
  });

  it("ranks the exact subject above longer variants of it", () => {
    // Regression: "bass guitar" outranked "guitar" on an alphabetical tiebreak.
    const top = browseCatalog({ q: "guitar" }).items[0];
    expect(top?.key).toBe("music-guitar-beginner");
  });

  it("matches whole words rather than fragments", () => {
    const res = browseCatalog({ q: "go" });
    // Should find the game Go, not every title containing "go" inside a word.
    expect(res.items.some((i) => i.key.includes("hobbies-go"))).toBe(true);
  });

  it("respects maxDifficulty", () => {
    const res = browseCatalog({ maxDifficulty: 2 });
    expect(res.items.every((i) => i.difficulty <= 2)).toBe(true);
  });

  it("paginates without overlapping", () => {
    const a = browseCatalog({ limit: 5, offset: 0 });
    const b = browseCatalog({ limit: 5, offset: 5 });
    const overlap = a.items.filter((x) => b.items.some((y) => y.key === x.key));
    expect(overlap).toEqual([]);
  });
});

describe("getTemplate", () => {
  it("returns a known template", () => {
    expect(getTemplate(ALL_TEMPLATES[0]!.key).key).toBe(ALL_TEMPLATES[0]!.key);
  });

  it("throws for an unknown key", () => {
    expect(() => getTemplate("does-not-exist")).toThrow();
  });
});
