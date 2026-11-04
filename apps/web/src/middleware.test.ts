import { NextRequest, type NextFetchEvent } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: null as string | null, entered: 0 }));

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: (auth: () => Promise<{ userId: string | null }>, request: NextRequest) => unknown) =>
    (request: NextRequest) => {
      session.entered += 1;
      return handler(async () => ({ userId: session.userId }), request);
    },
}));

/** Reads its environment at import, so each case stubs first and imports after. */
async function run(path: string): Promise<{ location: string | null }> {
  vi.resetModules();
  const { default: middleware } = await import("./middleware");
  const request = new NextRequest(`http://localhost${path}`);
  const response = await middleware(request, {} as NextFetchEvent);
  return { location: (response as Response).headers.get("location") };
}

function withKeys(secret = "sk_test_x", publishable = "pk_test_x") {
  vi.stubEnv("CLERK_SECRET_KEY", secret);
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", publishable);
}

beforeEach(() => {
  session.userId = null;
  session.entered = 0;
  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the middleware", () => {
  describe("with Clerk, signed out", () => {
    beforeEach(() => withKeys());

    it.each(["/path", "/generate", "/shop"])("sends %s home", async (path) => {
      expect((await run(path)).location).toBe("http://localhost/");
      expect(session.entered).toBe(1);
    });

    it("leaves home and the API alone", async () => {
      expect((await run("/")).location).toBeNull();
      expect((await run("/api/generate")).location).toBeNull();
    });
  });

  describe("with Clerk, signed in", () => {
    beforeEach(() => {
      withKeys();
      session.userId = "user_a";
    });

    it.each(["/shop", "/crew", "/profile", "/builder", "/customise", "/complete"])(
      "keeps %s out of reach, sending them to their path",
      async (path) => {
        expect((await run(path)).location).toBe("http://localhost/path");
      },
    );

    it("lets the built screens through", async () => {
      expect((await run("/path")).location).toBeNull();
      expect((await run("/generate")).location).toBeNull();
    });
  });

  describe("with no keys", () => {
    beforeEach(() => withKeys("", ""));

    it("never enters Clerk, and hides the boards in production", async () => {
      expect((await run("/shop")).location).toBe("http://localhost/");
      expect((await run("/path")).location).toBeNull();
      expect(session.entered).toBe(0);
    });

    it("leaves the boards reachable outside production", async () => {
      vi.stubEnv("NODE_ENV", "development");
      expect((await run("/shop")).location).toBeNull();
    });

    it("treats a whitespace-only key as no key", async () => {
      withKeys("   ", "pk_test_x");
      expect((await run("/shop")).location).toBe("http://localhost/");
      expect(session.entered).toBe(0);
    });
  });
});
