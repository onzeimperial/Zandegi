import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { heuristicDecompose } from "../src/ai/heuristic";
import { applyPlanToGoal } from "../src/server/goals/service";
import { completeTask } from "../src/server/tasks/service";
import { captureSnapshot } from "../src/server/progress/snapshot";
import { evaluateAchievements } from "../src/server/achievements/evaluate";
import { ACHIEVEMENTS } from "../src/server/achievements/definitions";
import { COSMETICS } from "../src/server/cosmetics/definitions";
import { grantDefaultCosmetics } from "../src/server/cosmetics/service";
import { TRIAL_DAYS } from "../src/lib/constants";
import { subDays, startOfDay } from "date-fns";

const db = new PrismaClient();

const KNOWLEDGE: Array<{
  slug: string;
  domain: string;
  title: string;
  body: string;
  source?: string;
  sourceUrl?: string;
  confidence?: number;
  effectiveFrom?: Date;
}> = [
  {
    slug: "ucat-structure",
    domain: "exams",
    title: "UCAT — test structure and scoring (overview)",
    confidence: 60,
    effectiveFrom: new Date("2025-01-01"),
    source: "General knowledge — VERIFY against the official UCAT site for the current cycle",
    sourceUrl: "https://www.ucat.ac.uk/",
    body: `The UCAT (University Clinical Aptitude Test) has historically contained cognitive subtests — Verbal Reasoning, Decision Making, Quantitative Reasoning, Abstract Reasoning — plus a Situational Judgement Test scored separately in bands.

Cognitive subtests have typically been scaled to a range around 300–900 each, with a total roughly 1200–3600.

IMPORTANT: The number of subtests, their names, timing, question counts, and the scoring scale have changed between cycles (e.g. the removal/renaming of subtests). Always confirm the CURRENT structure, timing and scoring on the official UCAT website for the year the candidate is sitting. Treat any specific numbers here as unverified.`,
  },
  {
    slug: "atar-basics",
    domain: "exams",
    title: "ATAR — what it is",
    confidence: 75,
    effectiveFrom: new Date("2025-01-01"),
    source: "General knowledge",
    body: `The ATAR (Australian Tertiary Admission Rank) is a percentile-style rank between 0.00 and 99.95 (in 0.05 increments) indicating a student's position relative to their age cohort, not a raw mark. It is derived from scaled study scores across a student's best subjects, with scaling varying by subject and year. Exact scaling and subject rules differ by state/territory and change annually — confirm with the relevant board (e.g. VCAA/VTAC in Victoria).`,
  },
  {
    slug: "spaced-repetition",
    domain: "learning",
    title: "Spaced repetition & retrieval practice",
    confidence: 90,
    effectiveFrom: new Date("2024-01-01"),
    source: "Cognitive science literature (well established)",
    body: `Two of the most robust findings in learning science: (1) retrieval practice — actively recalling information — produces far more durable learning than re-reading; (2) spacing that practice over time beats massing it. Practical application: convert study material into questions, test yourself, and schedule reviews at expanding intervals. This generalises across exams, languages, music theory, and technical skills.`,
  },
  {
    slug: "deliberate-practice",
    domain: "skill",
    title: "Deliberate practice",
    confidence: 85,
    effectiveFrom: new Date("2024-01-01"),
    source: "Ericsson et al., widely replicated in principle",
    body: `Deliberate practice targets a specific weakness just beyond current ability, with immediate feedback and correction, in focused blocks. It is effortful and not very enjoyable. Simply "doing the activity" (playing songs you know, re-solving easy problems) plateaus quickly. Design each session around one concrete sub-skill and a way to check whether you got it right.`,
  },
  {
    slug: "running-progression",
    domain: "sports",
    title: "Endurance running — safe progression",
    confidence: 80,
    effectiveFrom: new Date("2024-01-01"),
    source: "Common coaching guidance",
    body: `Widely used guidance: increase weekly mileage gradually (a often-cited heuristic is ~10% per week, with cutback weeks), keep most easy runs genuinely easy (conversational pace), and include one quality session (intervals or tempo) per week once a base is established. Rapid mileage jumps are the main driver of overuse injury. Individual response varies — adjust to how you recover.`,
  },
  {
    slug: "degree-classifications",
    domain: "education",
    title: "Degree classifications and honours — how they vary",
    confidence: 55,
    effectiveFrom: new Date("2025-01-01"),
    source: "General knowledge — VERIFY against your own institution's rules",
    body: `Naming and thresholds for "honours" differ substantially by country and institution.

Broadly: some systems award a separate classification on a taught degree (for example first class, upper second, lower second); some require an additional research year to earn honours; and others use a grade-point average with named bands such as distinction or cum laude.

IMPORTANT: the exact thresholds, which years count toward the final result, and how borderline cases are treated are set by your institution and change over time. Always confirm the current rules in your own course handbook — including whether early-year marks are weighted differently, which is often the single most useful thing to know when planning.`,
  },
  {
    slug: "grade-targets",
    domain: "education",
    title: "Working backwards from a grade target",
    confidence: 80,
    effectiveFrom: new Date("2025-01-01"),
    source: "General study-planning practice",
    body: `To reach a grade target, work backwards rather than forwards. Establish the required overall average, then calculate what each remaining assessment must score given what is already banked and how each component is weighted.

Two things follow from this that people usually miss. First, a large, heavily-weighted assessment late in the course can matter more than every small piece before it combined. Second, once you know the required mark per unit, some targets turn out to be arithmetically out of reach — which is worth discovering early, while there is still time to change the plan.

Weightings and resit rules vary by institution; confirm yours before relying on any calculation.`,
  },
  {
    slug: "admissions-tests",
    domain: "exams",
    title: "University admissions tests — general preparation",
    confidence: 70,
    effectiveFrom: new Date("2025-01-01"),
    source: "General preparation principles — VERIFY the format for your specific test",
    body: `Admissions tests differ enormously by country and course, but preparation for timed aptitude tests follows a common shape.

Sit a full diagnostic under real timing before studying, so you know your actual starting point. Cover the content once, then shift the majority of your time to timed practice — most candidates lose marks to pace and technique rather than knowledge. Analyse every practice test properly: the value is in categorising why each mark was lost, not in the score itself. Taper in the final week rather than cramming.

IMPORTANT: section names, timings, question counts and scoring scales change between cycles. Confirm the current format on the official site for the year you are sitting.`,
  },
];

async function seedKnowledge() {
  for (const k of KNOWLEDGE) {
    await db.knowledgeEntry.upsert({
      where: { slug_version: { slug: k.slug, version: 1 } },
      create: {
        slug: k.slug,
        domain: k.domain,
        title: k.title,
        body: k.body,
        version: 1,
        confidence: k.confidence ?? 70,
        source: k.source ?? null,
        sourceUrl: k.sourceUrl ?? null,
        effectiveFrom: k.effectiveFrom ?? new Date(),
        isCurrent: true,
      },
      update: { body: k.body, confidence: k.confidence ?? 70, title: k.title },
    });
  }
  console.log(`  knowledge: ${KNOWLEDGE.length} entries`);
}

async function seedAchievements() {
  for (const a of ACHIEVEMENTS) {
    await db.achievement.upsert({
      where: { key: a.key },
      create: {
        key: a.key,
        name: a.name,
        description: a.description,
        icon: a.icon,
        category: a.category,
        tier: a.tier,
        xpReward: a.xpReward,
        secret: a.secret ?? false,
        criteria: JSON.stringify({ key: a.key, note: "evaluated in code" }),
      },
      update: { name: a.name, description: a.description, xpReward: a.xpReward, tier: a.tier },
    });
  }
  console.log(`  achievements: ${ACHIEVEMENTS.length}`);
}

async function seedCosmetics() {
  for (const c of COSMETICS) {
    const data = {
      name: c.name,
      description: c.description,
      slot: c.slot,
      rarity: c.rarity,
      price: c.price,
      unlockAchievementKey: c.unlockAchievementKey ?? null,
      isDefault: c.isDefault ?? false,
      secret: c.secret ?? false,
      sortIndex: c.sortIndex ?? 0,
    };
    await db.cosmeticItem.upsert({
      where: { key: c.key },
      create: { key: c.key, ...data },
      update: data,
    });
  }
  console.log(`  cosmetics: ${COSMETICS.length}`);
}

const DEMO_GOALS = [
  { raw: "Graduate with honours — I need to lift my average over the next two semesters", target: 40 },
  { raw: "Get into medical school and prepare for the admissions test", target: 30 },
  { raw: "Learn enough Python and data structures to pass a junior developer technical interview", target: null },
  { raw: "Become conversational in Japanese", target: null },
  { raw: "Learn to play piano to a solid intermediate level", target: null },
  { raw: "Train for a half marathon", target: 18 },
];

async function seedDemoUser() {
  const email = "demo@zandegi.app";
  await db.user.deleteMany({ where: { email } });

  const user = await db.user.create({
    data: {
      email,
      name: "Demo Explorer",
      passwordHash: await hashPassword("demopassword1"),
      profile: {
        create: { displayName: "Demo Explorer", dailyMinutes: 60, weeklyDays: 6, timezone: "UTC", onboardedAt: new Date(), showXp: true, showStreak: true },
      },
      streak: { create: { current: 4, longest: 9, lastActiveDate: startOfDay(new Date()) } },
    },
  });
  console.log(`  user: ${email} / demopassword1`);

  await grantDefaultCosmetics(user.id);

  // Put the demo account mid-trial: it showcases Pro, and keeps its six goals
  // consistent with the three-goal free cap.
  const trialStarted = subDays(new Date(), 3);
  await db.subscription.create({
    data: {
      userId: user.id,
      plan: "pro",
      status: "trialing",
      trialStartedAt: trialStarted,
      trialEndsAt: new Date(trialStarted.getTime() + TRIAL_DAYS * 86_400_000),
    },
  });

  for (const g of DEMO_GOALS) {
    const plan = heuristicDecompose({ rawInput: g.raw, dailyMinutes: 60, weeklyDays: 6, targetDate: g.target ? subDays(new Date(), -g.target * 7) : null });
    const goal = await db.goal.create({
      data: {
        userId: user.id,
        title: plan.title,
        rawInput: g.raw,
        targetDate: g.target ? subDays(new Date(), -g.target * 7) : null,
        decompositionStatus: "generating",
        startedAt: subDays(new Date(), 21),
      },
    });
    await applyPlanToGoal(goal.id, plan, { provider: "heuristic", model: null, dailyMinutes: 60, weeklyDays: 6 });
    console.log(`  goal: ${plan.title} (${plan.milestones.length} milestones, ${plan.skills.length} skills, ${plan.tasks.length} tasks)`);
  }

  // Simulate progress on the first three goals
  const goals = await db.goal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 3, include: { tasks: { where: { status: "todo" }, take: 6 } } });
  let completed = 0;
  for (const goal of goals) {
    for (const task of goal.tasks.slice(0, 4)) {
      await completeTask({ userId: user.id, taskId: task.id, minutesSpent: 45, performance: 55 + Math.round(Math.random() * 35) });
      completed++;
    }
  }
  console.log(`  simulated ${completed} task completions`);

  // Backfill a few daily snapshots so trend charts have shape
  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  for (let d = 14; d >= 1; d--) {
    const date = startOfDay(subDays(new Date(), d));
    // Prisma rejects null inside a composite unique `where`, so find-then-create.
    const existing = await db.progressSnapshot.findFirst({
      where: { userId: user.id, goalId: null, date },
      select: { id: true },
    });
    if (!existing) {
      await db.progressSnapshot.create({
        data: {
          userId: user.id,
          goalId: null,
          date,
          xp: Math.round(((profile?.totalXp ?? 0) * (14 - d)) / 14),
          level: 1,
          tasksCompleted: d % 3 === 0 ? 0 : 1 + (d % 3),
          minutesSpent: d % 3 === 0 ? 0 : 45 * (1 + (d % 3)),
          streakDays: Math.max(0, 4 - Math.floor(d / 3)),
          progressPct: 0,
          velocity: 0,
        },
      });
    }
  }
  await captureSnapshot(user.id, null);
  await evaluateAchievements(user.id);
  console.log(`  snapshots + achievements evaluated`);
}

async function main() {
  console.log("Seeding Zandegi…");
  await seedAchievements();
  await seedCosmetics();
  await seedKnowledge();
  await seedDemoUser();
  console.log("Done. Sign in with demo@zandegi.app / demopassword1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
