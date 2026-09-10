/**
 * The eight life domains — fixed forever (SPEC §1.1). These are the
 * character's stat bars and the axes of the life star.
 */

export const DOMAINS = [
  "Mind",
  "Edge",
  "Coin",
  "Body",
  "Grit",
  "Craft",
  "Bond",
  "World",
] as const;

export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_COVERS: Record<Domain, string> = {
  Mind: "learning, study, exams, languages, reading, memory, focus",
  Edge: "career, ambition, admissions, competition, status, networks",
  Coin: "money, saving, investing, income, business, debt",
  Body: "strength, endurance, sport, sleep, nutrition, health",
  Grit: "discipline, habits, addiction recovery, mental resilience",
  Craft: "skills, making, music, art, code, writing, building",
  Bond: "family, friendship, romance, community, communication",
  World: "travel, adventure, service, culture, environment, experience",
};

export function isDomain(value: string): value is Domain {
  return (DOMAINS as readonly string[]).includes(value);
}

/** A Pursuit's domain split. Weights must sum to 1 (SPEC §1.2). */
export type DomainWeight = Partial<Record<Domain, number>>;

const WEIGHT_SUM_EPSILON = 1e-6;

export function domainWeightSum(weights: DomainWeight): number {
  return Object.values(weights).reduce((sum, w) => sum + (w ?? 0), 0);
}

export function assertDomainWeights(weights: DomainWeight): void {
  const entries = Object.entries(weights) as [Domain, number][];
  if (entries.length === 0) {
    throw new Error("domain weights: at least one domain is required");
  }
  for (const [domain, w] of entries) {
    if (!isDomain(domain)) throw new Error(`domain weights: unknown domain "${domain}"`);
    if (typeof w !== "number" || Number.isNaN(w) || w <= 0 || w > 1) {
      throw new Error(`domain weights: ${domain} must be in (0, 1], got ${w}`);
    }
  }
  const sum = domainWeightSum(weights);
  if (Math.abs(sum - 1) > WEIGHT_SUM_EPSILON) {
    throw new Error(`domain weights must sum to 1, got ${sum}`);
  }
}

/** The single domain carrying the most weight — used for primary attribution. */
export function primaryDomain(weights: DomainWeight): Domain {
  const entries = Object.entries(weights) as [Domain, number][];
  if (entries.length === 0) throw new Error("primaryDomain: empty weights");
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}
