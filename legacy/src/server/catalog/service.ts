import { notFound } from "@/lib/errors";
import type { GoalCategory } from "@/lib/constants";
import { ALL_TEMPLATES, DOMAINS, DOMAIN_OF, TEMPLATE_BY_KEY, type TemplateSpec } from "./index";

export interface CatalogEntry {
  key: string;
  title: string;
  summary: string;
  category: GoalCategory;
  domain: string;
  difficulty: number;
  weeks: number;
  tags: string[];
  skillCount: number;
  milestoneCount: number;
}

export interface BrowseParams {
  q?: string;
  domain?: string;
  category?: string;
  maxDifficulty?: number;
  limit?: number;
  offset?: number;
}

function toEntry(t: TemplateSpec): CatalogEntry {
  return {
    key: t.key,
    title: t.title,
    summary: t.summary,
    category: t.category,
    domain: DOMAIN_OF.get(t.key) ?? "general",
    difficulty: t.difficulty,
    weeks: t.weeks,
    tags: t.tags,
    skillCount: t.skills.length,
    milestoneCount: t.milestones.length,
  };
}

/** Whole-word match, so "guitar" hits "the guitar" but not "guitarist". */
function hasWord(haystack: string, word: string): boolean {
  const i = haystack.indexOf(word);
  if (i === -1) return false;
  const before = i === 0 ? " " : haystack[i - 1]!;
  const after = haystack[i + word.length] ?? " ";
  return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
}

/** Relevance for a single query token. */
function scoreToken(t: TemplateSpec, token: string): number {
  const title = t.title.toLowerCase();
  const summary = t.summary.toLowerCase();
  const tags = t.tags.map((x) => x.toLowerCase());

  if (title === token) return 100;
  if (hasWord(title, token)) return 70;
  if (title.includes(token)) return 45;
  if (tags.some((tag) => tag === token)) return 50;
  if (tags.some((tag) => hasWord(tag, token))) return 40;
  if (tags.some((tag) => tag.includes(token))) return 25;
  if (hasWord(summary, token)) return 15;
  if (summary.includes(token)) return 8;
  return 0;
}

/**
 * Multi-token relevance. Every token must match something (AND semantics),
 * otherwise a two-word query like "save money" finds nothing useful when only
 * one word appears. Shorter titles win ties so an exact subject beats a
 * longer variant of it — "guitar" should rank above "bass guitar".
 */
function score(t: TemplateSpec, tokens: string[]): number {
  let total = 0;
  for (const token of tokens) {
    const s = scoreToken(t, token);
    if (s === 0) return 0;
    total += s;
  }
  // Whole-phrase hit in the title is a strong signal on top of the tokens.
  if (tokens.length > 1 && t.title.toLowerCase().includes(tokens.join(" "))) {
    total += 40;
  }
  return total / tokens.length;
}

/**
 * Browse and search the catalogue. Runs entirely in memory — the templates
 * are a static module, so no DB round-trip is needed to list them.
 */
export function browseCatalog(params: BrowseParams = {}) {
  const limit = Math.min(200, Math.max(1, params.limit ?? 60));
  const offset = Math.max(0, params.offset ?? 0);
  const needle = params.q?.trim().toLowerCase() ?? "";

  let matches = ALL_TEMPLATES.filter((t) => {
    if (params.domain && DOMAIN_OF.get(t.key) !== params.domain) return false;
    if (params.category && t.category !== params.category) return false;
    if (params.maxDifficulty != null && t.difficulty > params.maxDifficulty) return false;
    return true;
  });

  if (needle) {
    const tokens = needle.split(/\s+/).filter(Boolean);
    matches = matches
      .map((t) => ({ t, s: score(t, tokens) }))
      .filter((r) => r.s > 0)
      .sort(
        (a, b) =>
          b.s - a.s ||
          a.t.title.length - b.t.title.length ||
          a.t.title.localeCompare(b.t.title),
      )
      .map((r) => r.t);
  } else {
    matches = [...matches].sort(
      (a, b) => a.difficulty - b.difficulty || a.title.localeCompare(b.title),
    );
  }

  return {
    total: matches.length,
    items: matches.slice(offset, offset + limit).map(toEntry),
    domains: DOMAINS.map((d) => ({
      key: d.key,
      label: d.label,
      blurb: d.blurb,
      count: d.templates.length,
    })),
  };
}

export function getTemplate(key: string): TemplateSpec {
  const t = TEMPLATE_BY_KEY.get(key);
  if (!t) throw notFound("Goal template");
  return t;
}

export function catalogSize(): number {
  return ALL_TEMPLATES.length;
}
