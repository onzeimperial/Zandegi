import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routes = [
  "builder",
  "complete",
  "crew",
  "customise",
  "generate",
  "path",
  "profile",
  "shop",
  "step",
];
const appDirectory = fileURLToPath(new URL(".", import.meta.url));

describe("designed route contract", () => {
  it("implements every backendless board as a real route with no dead hash links", () => {
    for (const route of routes) {
      const file = join(appDirectory, route, "page.tsx");
      expect(existsSync(file), route).toBe(true);
      expect(readFileSync(file, "utf8"), route).not.toContain('href="#"');
    }
  });
  it("keeps backendless editing and rewards inside an explicit preview boundary", () => {
    // `path` and `step` left this list when they began rendering the guest's
    // real missions; they are pinned by the test below instead. (`path` had been
    // passing only because an aria-label happened to contain "preview".)
    for (const route of ["builder", "complete", "crew", "customise", "profile", "shop"]) {
      const source = readFileSync(join(appDirectory, route, "page.tsx"), "utf8");
      expect(source, route).not.toContain("fetch(");
      expect(source.toLowerCase(), route).toMatch(
        /preview|local|not (saved|persisted|connected)|disabled/,
      );
    }
  });
  it("renders the guest's real missions on path and step, with no fixture fabrications", () => {
    for (const route of ["path", "step"]) {
      const source = readFileSync(join(appDirectory, route, "page.tsx"), "utf8");
      // Real data, loaded server-side through the ownership-checked use case.
      expect(source, route).toContain("loadGuestMissions");
      expect(source, route).not.toContain("fetch(");
      // Numbers the fixtures invented, which would read as claims about a real
      // person: a streak, a progress percentage, a scheduled slot, promised XP.
      for (const fabrication of ["13 days straight", "72.5%", "6:30", "XP</span>", "+40"]) {
        expect(source, `${route}: ${fabrication}`).not.toContain(fabrication);
      }
    }
  });
  it("promises nothing the product does not do on the generate screen", () => {
    const source = readFileSync(join(appDirectory, "generate", "page.tsx"), "utf8");
    expect(source).not.toContain("time blocks");
    expect(source).not.toContain("/builder");
  });
  it("keeps fixture screens out of the nav, so no invented number reaches a real person", () => {
    const shell = readFileSync(join(appDirectory, "..", "components", "app-shell.tsx"), "utf8");
    for (const hidden of ["/crew", "/shop", "/profile", "/builder", "/customise", "/complete"]) {
      expect(shell, hidden).not.toContain(hidden);
    }
    expect(shell).toContain('href: "/path"');
    expect(shell).toContain('href="/generate"');
  });
  it("keeps the responsive canvas, focus, and reduced-motion contracts", () => {
    const globalCss = readFileSync(join(appDirectory, "globals.css"), "utf8");
    expect(globalCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(globalCss).toContain(":focus-visible");
    expect(globalCss).not.toMatch(/min-width:\s*1440px/);
    expect(globalCss).toMatch(/@media\s*\(\s*max-width:\s*440px\s*\)/);
    expect(globalCss).not.toMatch(/font-family:[^;}]*Trebuchet/);
  });
  it("keeps builder edits in a tested typed local reducer", () => {
    const state = readFileSync(join(appDirectory, "builder", "builder-state.ts"), "utf8");
    expect(state).toContain("builderReducer");
    expect(state).toMatch(/type:\s*"add-step"/);
    expect(state).toMatch(/type:\s*"remove-step"/);
  });
  it("exposes async generator results and refusals for assistive technology", () => {
    const source = readFileSync(join(appDirectory, "generate", "page.tsx"), "utf8");
    expect(source).toContain('aria-label="Your generated mission is ready"');
    expect(source).toContain("reviewRegion.current?.focus()");
    expect(source).toContain('aria-live="assertive"');
  });
});
