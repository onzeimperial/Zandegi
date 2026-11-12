import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readAccountAccess = vi.fn();
const redirect = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

vi.mock("@/lib/session", () => ({ readAccountAccess: () => readAccountAccess() }));
vi.mock("next/navigation", () => ({ redirect: (target: string) => redirect(target) }));
vi.mock("@/components/account", () => ({
  SignInCard: () => <div data-testid="clerk-sign-in" />,
  SignOut: () => <button type="button">Sign out</button>,
}));

const { default: Home } = await import("./page");

async function render(access: unknown) {
  readAccountAccess.mockImplementation(async () => {
    if (access instanceof Error) throw access;
    return access;
  });
  return renderToStaticMarkup(await Home());
}

beforeEach(() => {
  redirect.mockClear();
});

describe("the home page", () => {
  it("offers real sign-in to a signed-out person, with no fake form", async () => {
    const html = await render({ kind: "signed-out" });
    expect(html).toContain("clerk-sign-in");
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('type="email"');
  });

  it("sends an allowed person straight to Today", async () => {
    await expect(render({ kind: "allowed", clerkUserId: "u", emails: [] })).rejects.toThrow(
      "redirect:/today",
    );
  });

  it("shows someone not invited the invite-only screen, with a way out", async () => {
    const html = await render({ kind: "not-invited" });
    expect(html).toContain("invite-only");
    expect(html).toContain("Sign out");
    expect(html).not.toContain('href="/path"');
    expect(html).not.toContain('href="/today"');
    expect(html).not.toContain('href="/generate"');
  });

  it("says the app is closed when production has no keys or allowlist", async () => {
    const html = await render({ kind: "disabled" });
    expect(html).toContain("isn&#x27;t open right now");
    expect(html).not.toContain('href="/generate"');
    expect(html).not.toContain("clerk-sign-in");
  });

  it("explains an identity outage rather than guessing", async () => {
    const html = await render(new Error("clerk down"));
    expect(html).toContain("can&#x27;t check your account");
    expect(html).toContain('role="alert"');
  });

  it("is honest in guest mode, linking to the built screens", async () => {
    const html = await render({ kind: "guest-mode" });
    expect(html).toContain("Guest mode");
    expect(html).toContain('href="/generate"');
    expect(html).toContain('href="/today"');
  });
});
