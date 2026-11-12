import { describe, expect, it } from "vitest";
import { pageRedirect, UNBUILT_ROUTES } from "./route-guard";

const clerk = { clerk: true, production: true };

describe("the page guard", () => {
  it("sends a signed-out person home from every page", () => {
    for (const path of ["/today", "/path", "/step", "/generate", ...UNBUILT_ROUTES]) {
      expect(pageRedirect(path, { ...clerk, signedIn: false }), path).toBe("/");
    }
  });

  it("keeps a signed-in person away from fixture boards", () => {
    for (const path of UNBUILT_ROUTES) {
      expect(pageRedirect(path, { ...clerk, signedIn: true }), path).toBe("/today");
    }
    expect(pageRedirect("/crew/anything", { ...clerk, signedIn: true })).toBe("/today");
  });

  it("lets a signed-in person reach the built screens", () => {
    for (const path of ["/today", "/path", "/step", "/generate"]) {
      expect(pageRedirect(path, { ...clerk, signedIn: true }), path).toBeNull();
    }
  });

  it("never redirects home or the API, which answer for themselves", () => {
    for (const path of ["/", "/api/generate", "/api/missions/1"]) {
      expect(pageRedirect(path, { ...clerk, signedIn: false }), path).toBeNull();
    }
  });

  it("does not mistake a route that merely starts with a board's name", () => {
    expect(pageRedirect("/shopping", { ...clerk, signedIn: true })).toBeNull();
  });

  it("leaves guest mode alone outside production", () => {
    const guest = { clerk: false, signedIn: false, production: false };
    for (const path of ["/path", "/generate", ...UNBUILT_ROUTES]) {
      expect(pageRedirect(path, guest), path).toBeNull();
    }
  });

  it("hides the boards in production with no Clerk", () => {
    const off = { clerk: false, signedIn: false, production: true };
    expect(pageRedirect("/shop", off)).toBe("/");
  });
});
