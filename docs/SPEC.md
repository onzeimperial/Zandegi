# Zandegi — Master Specification

Version 1.0. Place at `docs/SPEC.md`. This is the ground truth for what gets built.
`CLAUDE.md` governs *how* you build. This governs *what*.

---

# Part I — The goal universe

## 1.1 Three layers

The brief asks for "every possible goal". A finite list cannot deliver that. Zandegi uses a generator:

**Layer 1 — Domains (8, fixed forever).** These are the character's stat bars.

| Domain | Covers | Colour token |
|---|---|---|
| **Mind** | learning, study, exams, languages, reading, memory, focus | `--dom-mind` |
| **Edge** | career, ambition, admissions, competition, status, networks | `--dom-edge` |
| **Coin** | money, saving, investing, income, business, debt | `--dom-coin` |
| **Body** | strength, endurance, sport, sleep, nutrition, health | `--dom-body` |
| **Grit** | discipline, habits, addiction recovery, mental resilience | `--dom-grit` |
| **Craft** | skills, making, music, art, code, writing, building | `--dom-craft` |
| **Bond** | family, friendship, romance, community, communication | `--dom-bond` |
| **World** | travel, adventure, service, culture, environment, experience | `--dom-world` |

**Layer 2 — Pursuits (~140 curated archetypes, versioned, expandable).** A Pursuit is the reusable
skeleton behind a class of goal. Each Pursuit is a seeded database row authored by you (and later by the
admin app), carrying:

```ts
type Pursuit = {
  slug: string;                    // "strength-training"
  domains: DomainWeight[];         // [{ Body: 0.8 }, { Grit: 0.2 }] — sums to 1
  goalType: GoalType;              // OUTCOME | METRIC | HABIT | PROJECT | EXPERIENCE
  effortBand: EffortBand;          // SPRINT | SEASON | CAMPAIGN | LIFEWORK
  defaultChapters: ChapterTemplate[];
  toolKit: ToolRef[];              // which tools from the Tool Registry attach
  verification: VerificationMethod[]; // how completion is proven
  knowledgeSlots: KnowledgeSlot[]; // what must be looked up fresh (prices, dates, rules)
  difficultyPrior: number;         // 0.5–2.0, seeded, then learned from population data
  rarityCohort: string;            // which population to compute percentile against
  antiPatterns: string[];          // things the generator must not produce for this pursuit
  safetyClass: SafetyClass;        // NORMAL | CLINICAL | FINANCIAL | LEGAL | SELF_HARM_ADJACENT
};
```

**Layer 3 — User Goals (infinite).** The user types free text. The interpreter resolves it to one or more
Pursuits, extracts constraints (deadline, current level, resources, location), and generates a Mission.
If confidence against every Pursuit is below 0.62, the goal is handled by the **generic scaffold** and a
`PursuitCandidate` row is created for admin review. When 25+ candidates cluster, you author a real Pursuit.
That is how the catalog reaches "everything" over time instead of pretending to on day one.

## 1.2 Seed Pursuit catalog (author all 140 in session 2)

Ship at minimum these, grouped by domain. Each needs full authoring, not a stub.

**Mind (22):** exam-preparation, university-admissions, language-acquisition, reading-habit,
speed-reading, memory-training, deep-focus, note-system, public-speaking, academic-writing,
research-project, coding-fundamentals, mathematics-mastery, science-olympiad, music-theory,
chess-rating, general-knowledge, critical-thinking, second-degree, certification-exam,
teaching-others, curiosity-practice.

**Edge (18):** job-search, promotion, career-pivot, salary-negotiation, portfolio-build,
personal-brand, networking, interview-mastery, freelance-launch, leadership-growth, mentor-acquisition,
industry-entry, scholarship-application, competition-entry, selective-school-entry, internship-hunt,
public-profile, thought-leadership.

**Coin (17):** emergency-fund, debt-elimination, house-deposit, investing-start, budget-system,
income-increase, side-income, business-launch, business-growth, financial-literacy, retirement-planning,
frugality-practice, big-purchase-saving, tax-optimisation, insurance-setup, crypto-literacy,
charitable-giving.

**Body (21):** strength-training, muscle-gain, fat-loss, endurance-running, marathon, cycling, swimming,
sport-skill, flexibility-mobility, sleep-quality, nutrition-overhaul, hydration, injury-rehab,
posture-correction, cardiovascular-health, martial-arts, climbing, team-sport, dance,
medical-checkup-cadence, chronic-condition-management *(safetyClass: CLINICAL)*.

**Grit (17):** habit-formation, habit-breaking, quit-smoking, reduce-alcohol, screen-time-reduction,
porn-cessation, gambling-cessation, morning-routine, cold-exposure, meditation, journaling,
emotional-regulation, anxiety-management *(CLINICAL)*, procrastination, consistency-streak,
discomfort-training, digital-minimalism.

**Craft (20):** learn-instrument, songwriting, music-production, drawing, painting, photography,
videography, graphic-design, ui-design, creative-writing, novel, poetry, woodworking, cooking-mastery,
baking, gardening, sewing, 3d-printing, software-project, game-development.

**Bond (13):** relationship-deepening, dating, marriage-preparation, parenting, family-connection,
friendship-building, social-confidence, conflict-repair, community-contribution, mentoring-someone,
long-distance-maintenance, hosting-practice, listening-skill.

**World (12):** travel-planning, backpacking-trip, move-abroad, cultural-immersion, volunteering,
environmental-action, driving-licence, camping-outdoors, event-organising, pilgrimage,
bucket-list-experience, local-exploration.

Each row must be authored with real chapters, real tools, real verification. A Pursuit with an empty
`toolKit` is not done.

## 1.3 Goal types and what they may display

| Type | Example | Progress display | Metric bar allowed? |
|---|---|---|---|
| **OUTCOME** | "get into medicine" | chapters complete, evidence count, next action | **No** |
| **METRIC** | "bench 100kg", "save $30,000" | current → target, trend line | Yes |
| **HABIT** | "meditate daily" | streak, consistency %, calendar heatmap | Consistency only |
| **PROJECT** | "ship my app" | steps complete of defined scope | Yes (scope is finite) |
| **EXPERIENCE** | "see the northern lights" | readiness checklist, booked/not | Checklist only |

This table is enforced in code by `assertProgressDisplay(goalType, displayKind)` in `@zandegi/core`.

---

# Part II — The mission engine

## 2.1 Structure

```
Goal (user's words, preserved verbatim forever)
 └─ Mission (generated, versioned, regenerable)
     ├─ Chapters (3–7, each a meaningful phase with an exit condition)
     │   └─ Steps (2–9 per chapter, each doable in one sitting)
     │       ├─ estimatedMinutes
     │       ├─ verification: SELF | TIMER | ARTIFACT | METRIC | INTEGRATION
     │       ├─ tools: ToolInstance[]  ← the "everything you need" layer
     │       ├─ guide: { approach, materials, commonMistakes, whatGoodLooksLike }
     │       └─ sources: Source[] (required if the step asserts fact)
     └─ Milestones (rewarded moments: Shards, badge, rarity roll)
```

**Chapter exit conditions are real.** "Chapter 2: Build the base" exits when the user has logged 12
sessions AND hit a bodyweight-relative strength marker — not when they tap "next".

## 2.2 Generation pipeline (packages/ai)

Already partially built. Complete it as:

1. **Interpret** — parse free text → `{ intent, pursuitMatches[], constraints, currentLevel, timeBudget, resources, location }`. Structured output, JSON only.
2. **Resolve** — pick Pursuit(s), or fall through to generic scaffold + create `PursuitCandidate`.
3. **Hydrate knowledge** — fill `knowledgeSlots` from the knowledge layer (global entities, not per-user). Anything stale beyond its TTL triggers a web lookup and re-cache.
4. **Plan** — produce chapters + exit conditions, sized to the user's real time budget.
5. **Detail** — produce steps, guides, tool attachments, estimated minutes.
6. **Ground** — validate every factual assertion has a source with a date. Failures are rewritten as advice or dropped.
7. **Score** — `@zandegi/core` assigns XP, difficulty, rarity. **Deterministic. No model involvement.**
8. **Safety pass** — route by `safetyClass`. CLINICAL pursuits get a professional-guidance frame and never prescribe doses, calorie floors, or diagnoses. SELF_HARM_ADJACENT pursuits are not generated at all; they route to a support screen.
9. **Persist + emit** `MissionGenerated` event.

Target: **p95 under 25 seconds** for first mission, with a streaming progressive reveal so the user watches
chapters appear rather than staring at a spinner. That reveal is the single most important marketing moment
in the product — it is what people screenshot.

## 2.3 Adaptive difficulty

Each step records estimated vs actual minutes and completion/abandon. Weekly, per user:
- If 7-day completion rate > 0.85 → next generation biases steps 15% larger.
- If < 0.45 → biases 20% smaller and inserts a recovery chapter.
- Population-level completion rates update each Pursuit's `difficultyPrior` (bounded, EWMA, α = 0.15).

Users never see a difficulty number. They see missions that fit.

---

# Part III — The tool layer ("everything required to achieve the goal")

## 3.1 Tool Registry

`packages/tools` exposes typed, embeddable runtimes. A Pursuit declares which it uses; a Step instantiates
them with pre-filled config. The user never leaves Zandegi to find a spreadsheet.

| Tool kind | What it is | Example binding |
|---|---|---|
| `TRACKER` | Log a metric over time, chart it | Bodyweight, bench 1RM, savings balance, words written |
| `TIMER` | Focus/interval timer that emits verified minutes | Pomodoro for study, EMOM for training |
| `CHECKLIST` | Ordered items with state | Visa document checklist, gym-bag list |
| `TEMPLATE` | A rich document pre-structured for the task | Cover letter, business plan, training log, revision plan |
| `CALCULATOR` | Deterministic domain maths | 1RM, TDEE, compound interest, deposit-to-repayment, ATAR scaling |
| `PLANNER` | Generates a schedule into the calendar | 12-week marathon plan, 6-week exam plan |
| `LIBRARY` | Curated, freshness-dated external resources | Best free Farsi courses, ASX brokerage comparison |
| `DRILL` | Generated practice items with scoring | Language recall, maths problems, interview questions |
| `JOURNAL` | Structured reflective prompt with history | Habit-breaking urge log, gratitude, post-session notes |
| `CAPTURE` | Photo/file evidence with EXIF timestamp | Progress photo, finished artwork, certificate |

Every tool writes events to the ledger, which means **using a tool is itself verified effort and earns XP.**
This is the mechanic that makes Zandegi sticky rather than a to-do list: the tool and the progression are
the same system.

## 3.2 Integrations (verification tier INTEGRATION, 1.4× XP)

Apple Health / Google Fit (steps, sleep, workouts, weight), Strava (runs, rides), GitHub (commits, PRs),
Google/Apple/Outlook Calendar (two-way), Screen Time / Digital Wellbeing (screen-time goals), Basiq
(read-only AU bank data for Coin goals), Spotify (practice-time proxy for musicians), Duolingo (public
profile scrape fallback). Each integration is optional, revocable, and clearly scoped at connect time.

---

# Part IV — The economy

## 4.1 XP formula (published, in `packages/economy/xp.ts`)

```
stepXP = clamp(round(
    base
  × difficultyMult
  × verificationMult
  × streakMult
  × balanceMult
  × rarityMult
), 5, 900)

base             = clamp(estimatedMinutes, 5, 240)          // one minute of real effort ≈ one point
difficultyMult   = pursuit.difficultyPrior × userAdaptive   // 0.5 – 2.0
verificationMult = SELF 1.00 | TIMER 1.15 | ARTIFACT 1.25 | METRIC 1.30 | INTEGRATION 1.40
streakMult       = 1 + min(0.25, 0.01 × currentStreakDays)
balanceMult      = 1.10 if this is the user's weakest domain of 8, else 1.00
rarityMult       = 1 + (0.5 × rarityPercentile)             // rarer achievements pay more
```

**Awards above steps:** chapter completion = 2.5× the sum of its steps' base XP.
Mission completion = 4× the largest chapter award. Milestones are fixed, authored per Pursuit.

**Anti-farming (mandatory):**
- Daily XP soft cap 800; earnings from 800–1600 are halved; above 1600 are zeroed. Resets 04:00 local.
- Per-pursuit daily cap of 40% of the soft cap — you cannot only lift weights.
- Minimum 90 seconds between two completion events, server-enforced.
- Trust score per user: drops on impossible-velocity patterns, rejected artifacts, integration mismatch.
  Below 0.4, all XP is provisional and excluded from leaderboards until reviewed.

## 4.2 Levels and ranks

```
xpForLevel(n) = round(100 × n^1.6)     // cumulative
```
Level 10 ≈ 4.0k, level 25 ≈ 17.5k, level 50 ≈ 53k, level 100 ≈ 160k XP.

| Rank | Levels | Visual |
|---|---|---|
| Wanderer | 1–9 | matte slate |
| Seeker | 10–19 | violet edge |
| Adept | 20–34 | violet fill + glow |
| Vanguard | 35–54 | gold trim |
| Ascendant | 55–79 | gold + animated aura |
| Mythic | 80–99 | prismatic |
| Eternal | 100+ | prismatic + personal sigil generated from the user's domain profile |

Rank is per-account. Each **domain** also has its own level (same curve, domain XP only) — this is the
eight-pointed "life star" radial. Balanced players get a distinctive full star; specialists get a spike.
Both are aesthetically desirable, deliberately.

## 4.3 Rarity

Rarity is a **population percentile of achievement**, computed nightly per `rarityCohort`, never authored.

| Tier | Percentile of users who have done it | Colour |
|---|---|---|
| Common | > 40% | `#9BA1AE` |
| Uncommon | 15–40% | `#3FCF8E` |
| Rare | 5–15% | `#5B9DFF` |
| Epic | 1–5% | `#A855F7` |
| Legendary | 0.1–1% | `#F5C451` |
| Mythic | < 0.1% | animated prismatic |

Shown on completion cards: "Only 0.7% of Zandegi have finished a marathon." That line is the share asset.

## 4.4 Currencies

| Currency | Earned | Spent on | Purchasable |
|---|---|---|---|
| **XP** | verified effort only | nothing — it is progression | **Never** |
| **Shards** | milestones, chapter/mission completion, streak rewards, season track, crew quests, referrals | cosmetics, shop items, mission regenerations, streak repair (1/month max) | Yes |
| **Crowns** | purchase and subscription grants only | premium season track, exclusive cosmetics, gifting | Yes |

Baseline earn rate: an active free user earns ~450 Shards/week. A mid-tier skin costs 800. That gap is
the conversion pressure, and it must be tuned in `packages/economy/tuning.ts` where every constant lives
in one file with a comment explaining its intent.

---

# Part V — Money

Revenue is a first-class feature, not an afterthought bolted on at the end. Build billing in session 6,
not session 12.

## 5.1 Tiers

| | **Free** | **Plus — A$12.99/mo, A$89/yr** | **Prime — A$24.99/mo, A$199/yr** |
|---|---|---|---|
| Active missions | 3 | Unlimited | Unlimited |
| Mission regenerations | 1/month | 15/month | Unlimited |
| Tool Registry | Core 5 tools | All tools | All tools |
| Calendar sync | Read-only | Two-way | Two-way + auto-scheduling |
| Integrations | 1 | All | All |
| Crew size | 5 | 12 | 12 + create 3 crews |
| Analytics | Last 30 days | Full history, trends, forecasts | + weekly written review |
| AI Coach check-ins | — | — | Daily, context-aware |
| Shards/month | — | 500 | 1,500 |
| Season pass | Free track | Premium track included | Premium track + 20 tier skips |
| Cosmetics | Base set | Plus-exclusive set | Prime-exclusive animated set |
| Priority generation | — | Yes | Yes, plus deep-research missions |

## 5.2 Seasons — the primary revenue line

Ten-week seasons, themed, with a **free track (50 tiers)** and a **premium track (100 tiers)**. Premium is
included with Plus/Prime or sold standalone at **A$14.99**. Tiers advance on XP earned during the season.
Rewards: cosmetics, Shards, emotes, character frames, crew banners, title cards.

Why this is the money engine: it converts the thing users are already doing (earning XP) into a recurring
purchase with a deadline, and it resets every ten weeks. Model it explicitly — season pass attach rate is
the north-star revenue metric.

**Season 1 theme: "First Light."** Violet-to-dawn palette. Track it in `docs/SEASONS.md`.

## 5.3 Other lines

- **Shard packs:** 500 / A$4.99 · 1,200 / A$9.99 · 3,000 / A$19.99 · 7,000 / A$39.99. Fixed value, no gacha.
- **Daily shop:** 6 rotating slots, real 24h timer, priced 400–2,500 Shards. Featured slot rotates weekly.
- **Direct cosmetic purchase** with Crowns for anyone who refuses grinding.
- **Crew Boost — A$4.99/mo:** crew-wide +5% XP, custom banner, private crew channel. One member pays,
  twelve benefit — the cheapest acquisition channel you will have.
- **Gifting:** any user can gift Plus or a cosmetic. Ship this before the first December.
- **Zandegi for Schools — A$6/student/year:** via SACify Classroom distribution. Teacher dashboard,
  class crews, curriculum-aligned Pursuits, safe-mode (no shop, no global leaderboard). This is your
  unfair advantage — an existing pipeline of Victorian secondary students.
- **Referral:** both parties get 300 Shards; referrer gets 7 days of Plus at the referee's first purchase.

## 5.4 Conversion architecture

Design these deliberately; do not let paywalls land randomly.

- **First-run:** goal input → streaming mission reveal → first step completed → first XP → *then* account
  creation. Value before friction. Target: first XP within 180 seconds of landing.
- **Trial:** 7-day Plus trial, card required, on the annual plan. 3-day card-less on monthly.
  Build both behind a flag and A/B them; do not guess.
- **Paywall moments (the only five):** attempting a 4th mission · connecting a 2nd integration ·
  opening full analytics · viewing the premium season track · attempting two-way calendar sync.
- **Never** show a purchase prompt within 60 seconds of a missed streak, an abandoned mission, or a
  failure state. Enforce this in code, not policy.
- **Win-back:** at cancellation, offer a pause (up to 3 months) before an offer. Pauses out-retain discounts.

## 5.5 Money metrics to instrument from day one

Activation (first mission completed), D1/D7/D30 retention, weekly active goal-workers, trial start rate,
trial→paid, free→paid at 30 days, season pass attach rate, ARPDAU, Shard sink/faucet ratio, LTV by
acquisition channel, crew-membership retention lift, referral k-factor.

---

# Part VI — Social

- **Crews:** up to 12. Shared feed, weekly crew quest (collective XP target → Shard pot), crew level,
  crew banner. Crews are the retention mechanic; a user in a crew of 4+ should retain measurably better,
  and if they don't, the crew design is wrong.
- **Feed:** mission started, chapter cleared, rarity unlocked, streak milestone, level-up. Reactions and
  nudges. No comments in v1 (moderation cost); reactions and preset nudges only.
- **Duels:** 1v1, 7-day XP race, both parties opt in, winner takes a Shard pot and a duel record.
- **Leaderboards:** crew, friends, global-by-rank-tier, and domain-specific. Weekly reset for the
  competitive board; all-time for the prestige board. Provisional-XP users excluded.
- **Privacy defaults:** profile discoverable by username only; goals private unless shared per-mission;
  under-18 accounts default to crew-only visibility, no global board, no shop.

---

# Part VII — Calendar

Missions produce steps; steps become **blocks**. The scheduler places blocks respecting: declared
availability windows, existing calendar events (two-way sync), declared energy profile (morning/evening),
minimum recovery gaps for Body pursuits, and deadline pressure. Rescheduling is one drag. A missed block
is never a punishment — it is auto-offered a new slot within 48 hours.

Views: Today (the default home on mobile), Week, Mission timeline (Gantt-lite), Calendar heatmap of
consistency.

---

# Part VIII — Design direction

Full tokens in `docs/DESIGN.md`. The essentials:

**Palette.** Deep violet is the brand and it must not read as a generic SaaS gradient.
```
--void:      #0A0714   app background, near-black with violet bias
--surface:   #150F26   raised panels
--edge:      #241A3D   hairlines and borders
--violet:    #7C3AED   primary brand
--violet-lo: #4C1D95   depth, gradients
--violet-hi: #A855F7   glow, active states
--gold:      #F5C451   rank, rarity, reward — used sparingly, only for earned things
--paper:     #FFFFFF   the marketing site and light mode
--ink:       #120C1F   text on light
```
Rule: **gold only ever appears on something the user earned.** Never on a buy button. That single
constraint is what makes rewards feel valuable.

**Type.** Display: a wide, confident geometric sans with real character — Clash Display (or General Sans
if a single family is preferred). Body: Inter, 16px base, 1.6 line-height, max 68ch. Numerals:
tabular-lining everywhere XP or metrics appear, so counters don't jitter as they roll.

**The one bold thing:** the eight-pointed life star. It is the character, the avatar, the share asset, and
the loading state. Everything else stays quiet and disciplined around it. Do not add competing hero
graphics.

**Motion.** Three orchestrated moments only:
1. Mission generation — chapters materialising one by one as the stream lands.
2. XP award — counter roll-up with a violet sweep, the star point extending.
3. Milestone — a shard burst sized to rarity. Mythic gets the full screen; Common gets a small flourish.
Everything else is functional: 180ms ease-out on state changes, no decorative section entrances.

**Voice.** Second person, present tense, plain verbs. "Log today's session", not "Submit entry".
Empty states name the next action. Errors say what happened and what to do. Never congratulate someone
for opening the app — only for doing the thing.

---

# Part IX — Data model (core tables)

```prisma
User            id, clerkId, handle, displayName, timezone, birthYear, energyProfile, trustScore, createdAt
Character       userId, level, totalXp, rank, activeSkinId, frameId, titleId, sigilSeed
DomainStat      userId, domain, xp, level, lastActivityAt
Pursuit         slug, version, domains(json), goalType, effortBand, difficultyPrior, rarityCohort,
                toolKit(json), knowledgeSlots(json), safetyClass, antiPatterns(json), authoredBy
PursuitCandidate rawGoals(json), clusterLabel, count, status
Goal            id, userId, rawText, createdAt, archivedAt
Mission         id, goalId, pursuitId, version, title, status, generatedAt, generationMeta(json)
Chapter         id, missionId, index, title, exitCondition(json), status
Step            id, chapterId, index, title, estimatedMinutes, verification, guide(json),
                sources(json), status, scheduledBlockId
ToolInstance    id, stepId|missionId, kind, config(json), state(json)
Event           id, userId, type, payload(json), occurredAt, recordedAt   // APPEND ONLY
XpAward         id, userId, eventId, amount, breakdown(json), domain, provisional
Block           id, userId, stepId, startsAt, endsAt, externalCalendarId, status
Streak          userId, current, longest, lastQualifyingDate, repairsUsedThisMonth
Crew            id, name, bannerId, level, boostActiveUntil
CrewMember      crewId, userId, role, joinedAt
Duel            id, challengerId, opponentId, startsAt, endsAt, potShards, winnerId
Season          id, slug, theme, startsAt, endsAt
SeasonProgress  userId, seasonId, tier, xpThisSeason, premiumUnlocked, claimedTiers(json)
CosmeticItem    id, kind, name, rarity, shardPrice, crownPrice, seasonId, tierRequired, exclusiveTo
Inventory       userId, cosmeticItemId, acquiredAt, source
Wallet          userId, shards, crowns
Purchase        id, userId, provider, providerRef, sku, amountCents, currency, status
Subscription    userId, tier, provider, status, currentPeriodEnd, trialEndsAt, pausedUntil
Integration     userId, provider, scopes, status, lastSyncAt
KnowledgeEntity slug, kind, payload(json), sources(json), fetchedAt, ttlSeconds   // GLOBAL, not per-user
```

`Event` is the source of truth. `Character`, `DomainStat`, `Streak`, and `Wallet` are **projections** —
rebuildable from the ledger by a single command. Write that rebuild command in session 3 and test that a
full replay reproduces state exactly. You will need it.

---

# Part X — Safety and compliance

- **Age:** 13+ (16+ in EU without parental consent). Under-18: no shop, no global leaderboards, no
  purchases, crew-only social, and no Coin pursuits involving investing or credit.
- **Clinical boundary:** CLINICAL pursuits never diagnose, prescribe doses, set calorie floors, or replace
  care. They frame everything as "bring this to your GP".
- **Disordered eating:** fat-loss and nutrition pursuits enforce guardrails — no calorie targets below
  clinical floors, no weight-loss-rate targets above safe bounds, no body-comparison leaderboards ever.
  Screening prompt at pursuit start; positive screen routes to support resources and a non-metric framing.
- **Self-harm adjacent:** never generated. Route to support. This is hard-coded, not a model judgement.
- **Financial:** Coin pursuits are education, never personal advice. Required disclosure on any pursuit
  touching investing. Australian context: mind ASIC's rules on financial product advice.
- **Privacy:** health and financial integration data is encrypted at rest with a separate key, never
  enters LLM prompts in raw form, and is deletable independently of the account.
- **Store compliance:** because nothing purchasable affects progression, you avoid the loot-box regimes
  entirely. Keep it that way — it's also a genuine competitive moat as regulation tightens.

---

# Part XI — Build sequence

See `BUILD-PROMPTS.md`. The order is deliberate: prove generation quality → seed the universe → make the
ledger unbreakable → build the loop → make it beautiful → take money → add the social layer → launch.
Do not reorder. Infrastructure before validated generation is how this project dies.
