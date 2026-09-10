import { describe, it, expect } from "vitest";
import { DOMAINS, DOMAIN_LABELS, CATEGORY_TO_DOMAIN, CATEGORY_DOMAINS, domainForCategory } from "@/server/domains";
import { GOAL_CATEGORIES } from "@/lib/constants";

describe("domain mapping", () => {
  it("maps every real goal category to a domain", () => {
    for (const cat of GOAL_CATEGORIES) {
      expect(domainForCategory(cat), `"${cat}" has no domain`).not.toBeNull();
    }
  });

  it("only ever maps into a known domain", () => {
    for (const cat of GOAL_CATEGORIES) {
      const d = domainForCategory(cat);
      if (d) expect(DOMAINS).toContain(d);
    }
  });

  it("never maps a category onto bond", () => {
    // Bond has no corresponding goal category by design — see src/server/domains/index.ts.
    for (const cat of GOAL_CATEGORIES) {
      expect(domainForCategory(cat)).not.toBe("bond");
    }
  });

  it("has a label for every domain", () => {
    for (const d of DOMAINS) expect(DOMAIN_LABELS[d]).toBeTruthy();
  });

  it("excludes bond from the category-linked domain list", () => {
    expect(CATEGORY_DOMAINS).not.toContain("bond");
    expect(CATEGORY_DOMAINS).toHaveLength(DOMAINS.length - 1);
  });

  it("gives every category-linked domain at least one category", () => {
    for (const d of CATEGORY_DOMAINS) {
      const has = Object.values(CATEGORY_TO_DOMAIN).includes(d);
      expect(has, `domain "${d}" has no categories mapped to it`).toBe(true);
    }
  });
});
