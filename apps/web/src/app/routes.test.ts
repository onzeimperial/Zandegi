import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe,expect,it } from "vitest";

const routes=["builder","complete","crew","customise","generate","path","profile","shop","step"];
const appDirectory=fileURLToPath(new URL(".",import.meta.url));

describe("designed route contract",()=>{
  it("implements every backendless board as a real route with no dead hash links",()=>{for(const route of routes){const file=join(appDirectory,route,"page.tsx");expect(existsSync(file),route).toBe(true);expect(readFileSync(file,"utf8"),route).not.toContain('href="#"')}});
  it("keeps backendless editing and rewards inside an explicit preview boundary",()=>{for(const route of ["builder","complete","crew","customise","path","profile","shop","step"]){const source=readFileSync(join(appDirectory,route,"page.tsx"),"utf8");expect(source,route).not.toContain("fetch(");expect(source.toLowerCase(),route).toMatch(/preview|local|not (saved|persisted|connected)|disabled/)}});
  it("keeps the responsive canvas, focus, and reduced-motion contracts",()=>{const globalCss=readFileSync(join(appDirectory,"globals.css"),"utf8");expect(globalCss).toContain("prefers-reduced-motion:reduce");expect(globalCss).toContain(":focus-visible");expect(globalCss).not.toContain("min-width:1440px");expect(globalCss).toContain("@media(max-width:440px)");expect(globalCss).not.toMatch(/font-family:[^;}]*Trebuchet/)});
  it("keeps builder edits in a tested typed local reducer",()=>{const state=readFileSync(join(appDirectory,"builder","builder-state.ts"),"utf8");expect(state).toContain("builderReducer");expect(state).toContain('type:"add-step"');expect(state).toContain('type:"remove-step"')});
  it("exposes async generator results and refusals for assistive technology",()=>{const source=readFileSync(join(appDirectory,"generate","page.tsx"),"utf8");expect(source).toContain('aria-label="Your generated mission is ready"');expect(source).toContain('reviewRegion.current?.focus()');expect(source).toContain('aria-live="assertive"')});
});
