import { readFileSync,existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe,expect,it } from "vitest";

const routes=["builder","complete","crew","customise","generate","path","profile","shop","step"];
const appDirectory=fileURLToPath(new URL(".",import.meta.url));

describe("designed route contract",()=>{
  it("implements every backendless board as a real route with no dead hash links",()=>{for(const route of routes){const file=join(appDirectory,route,"page.tsx");expect(existsSync(file),route).toBe(true);expect(readFileSync(file,"utf8"),route).not.toContain('href="#"')}});
  it("keeps backendless editing and rewards inside an explicit preview boundary",()=>{for(const route of ["builder","complete","crew","customise","path","profile","shop","step"]){const source=readFileSync(join(appDirectory,route,"page.tsx"),"utf8");expect(source,route).not.toContain("fetch(");expect(source.toLowerCase(),route).toMatch(/preview|local|not (saved|persisted|connected)|disabled/)}});
  it("keeps tablet, phone, focus, and reduced-motion rules in the shared design system",()=>{const css=readFileSync(join(appDirectory,"globals.css"),"utf8");expect(css).toContain("@media(max-width:768px)");expect(css).toContain("@media(max-width:440px)");expect(css).toContain("prefers-reduced-motion:reduce");expect(css).toContain(":focus-visible")});
  it("keeps the builder continuation reachable in both desktop and mobile layouts",()=>{const builder=readFileSync(join(appDirectory,"builder","page.tsx"),"utf8");const css=readFileSync(join(appDirectory,"globals.css"),"utf8");expect(builder).toContain("desktop-continuation");expect(builder).toContain("mobile-continuation");expect(builder.match(/View example path/g)).toHaveLength(2);expect(css).toContain(".mobile-continuation{display:none}");const mobile=css.slice(css.indexOf("@media(max-width:768px)"));expect(mobile).toContain(".mobile-continuation{display:inline-flex}")});
  it("keeps chapter disclosure in typed local state across builder rerenders",()=>{const builder=readFileSync(join(appDirectory,"builder","page.tsx"),"utf8");expect(builder).not.toContain("defaultOpen=");expect(builder).toContain("useState<ReadonlySet<number>>");expect(builder).toContain("open={openChapters.has(chapter.id)}");expect(builder).toContain("onToggle=")});
  it("exposes async generator results and refusals for assistive technology",()=>{const source=readFileSync(join(appDirectory,"generate","page.tsx"),"utf8");expect(source).toContain('aria-label="Your generated mission is ready"');expect(source).toContain('reviewRegion.current?.focus()');expect(source).toContain('aria-live="assertive"')});
});
