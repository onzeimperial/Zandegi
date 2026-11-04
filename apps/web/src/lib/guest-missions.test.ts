import { GenerationError } from "@zandegi/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveRequestSession = vi.fn();
const redirect = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

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
