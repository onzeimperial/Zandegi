import { GenerationError } from "@zandegi/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRequestSession = vi.fn();
const redirect = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  email: "invited@example.com",
  failure: null as Error | null,
}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => {
    if (clerk.failure !== null) throw clerk.failure;
    return { userId: clerk.userId };
  },
  currentUser: async () => ({
    emailAddresses: [{ emailAddress: clerk.email, verification: { status: "verified" } }],
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (target: string) => redirect(target) }));
vi.mock("./session", async () => {
  const actual = await vi.importActual<typeof import("./session")>("./session");
  return { ...actual, resolveRequestSession: () => resolveRequestSession() };
});

const { loadGuestMissions } = await import("./guest-missions");
const { default: GenerateLayout } = await import("@/app/generate/layout");

beforeEach(() => {
  redirect.mockClear();
  resolveRequestSession.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("loading a person's missions for a page", () => {
  it.each(["SIGN_IN_REQUIRED", "ACCOUNT_NOT_ALLOWED", "GENERATION_DISABLED"] as const)(
    "sends %s home with no data",
    async (code) => {
      resolveRequestSession.mockRejectedValue(new GenerationError(code));
      await expect(loadGuestMissions()).rejects.toThrow("redirect:/");
    },
  );

  it("reports a store failure as unavailable rather than redirecting", async () => {
    resolveRequestSession.mockRejectedValue(new GenerationError("STORE_UNAVAILABLE"));
    await expect(loadGuestMissions()).resolves.toEqual({ status: "unavailable" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("treats guest mode with no cookie as a brand-new character", async () => {
    resolveRequestSession.mockResolvedValue(null);
    await expect(loadGuestMissions()).resolves.toMatchObject({
      status: "ready",
      missions: [],
      progress: { totalXp: 0, level: 1 },
    });
  });
});

describe("the generate page's guard", () => {
  const children = "the form";

  it("lets guest mode through", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    await expect(GenerateLayout({ children })).resolves.toBe(children);
    vi.unstubAllEnvs();
  });

  it("sends production with no keys home", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    await expect(GenerateLayout({ children })).rejects.toThrow("redirect:/");
    vi.unstubAllEnvs();
  });
});

describe("the generate page's guard with Clerk active", () => {
  const children = "the form";

  beforeEach(() => {
    clerk.userId = null;
    clerk.email = "invited@example.com";
    clerk.failure = null;
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    vi.stubEnv("ZANDEGI_ALLOWED_EMAILS", "invited@example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the form for an invited person", async () => {
    clerk.userId = "user_a";
    await expect(GenerateLayout({ children })).resolves.toBe(children);
  });

  it("sends someone not invited home", async () => {
    clerk.userId = "user_b";
    clerk.email = "stranger@example.com";
    await expect(GenerateLayout({ children })).rejects.toThrow("redirect:/");
  });

  it("sends a signed-out person home", async () => {
    await expect(GenerateLayout({ children })).rejects.toThrow("redirect:/");
  });

  it("sends everyone home when Clerk cannot answer", async () => {
    clerk.failure = new Error("clerk down");
    await expect(GenerateLayout({ children })).rejects.toThrow("redirect:/");
  });
});
