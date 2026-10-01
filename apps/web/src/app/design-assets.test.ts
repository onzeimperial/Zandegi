import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../..");
const publicDesign = resolve(repositoryRoot, "apps/web/public/design");
const referenceDesign = resolve(repositoryRoot, "_bmad-output/implementation-artifacts/claude-reference");
const manifest = JSON.parse(readFileSync(resolve(publicDesign, "manifest.json"), "utf8")) as {
  mascot: { file: string; bytes: number; sha256: string };
  fonts: Array<{ file: string; sha256: string }>;
  boards: Array<{ index: number; title: string }>;
};

describe("Claude Design extraction", () => {
  it("has no generated drift", () => {
    expect(() => execFileSync(process.execPath, [resolve(repositoryRoot, "scripts/extract-claude-design.cjs"), "--check"], { cwd: repositoryRoot })).not.toThrow();
  });

  it("deduplicates and verifies the canonical binaries", () => {
    expect(manifest.boards).toHaveLength(12);
    expect(manifest.fonts).toHaveLength(9);
    expect(manifest.mascot.bytes).toBe(353767);
    const bytes = readFileSync(resolve(publicDesign, manifest.mascot.file));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29");
    expect(new Set(manifest.fonts.map((font) => font.sha256)).size).toBe(9);
  });

  it("keeps executable references out of production while retaining verification artifacts", () => {
    expect(existsSync(resolve(publicDesign, "reference"))).toBe(false);
    for (const board of manifest.boards) {
      const html = readFileSync(resolve(referenceDesign, `board-${String(board.index).padStart(2, "0")}.html`), "utf8");
      expect(html).toContain("__bundler/manifest");
      expect(html).toContain(board.title);
      expect(html).toContain("width: 1440px");
    }
  });
});
