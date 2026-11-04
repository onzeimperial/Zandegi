import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  ClerkLoading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ClerkFailed: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SignIn: () => <div data-testid="clerk-sign-in" />,
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
}));

const { AccountsEnabledProvider, SignInCard, SignOut } = await import("./account");
const { default: RootLayout } = await import("@/app/layout");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("SignOut", () => {
  it("renders under the provider", () => {
    const html = renderToStaticMarkup(
      <AccountsEnabledProvider>
        <SignOut className="x" />
      </AccountsEnabledProvider>,
    );
    expect(html).toContain("Sign out");
    expect(html).toContain('class="x"');
  });

  it("renders nothing without it, because Clerk's button would throw", () => {
    expect(renderToStaticMarkup(<SignOut className="x" />)).toBe("");
  });
});

describe("RootLayout", () => {
  const page = <SignOut className="x" />;

  it("supplies the provider in Clerk mode, so the invite-only screen has a way out", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
    expect(renderToStaticMarkup(<RootLayout>{page}</RootLayout>)).toContain("Sign out");
  });

  it("supplies none in guest mode", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    expect(renderToStaticMarkup(<RootLayout>{page}</RootLayout>)).not.toContain("Sign out");
  });
});

describe("SignInCard", () => {
  it("holds loading, the form and a failed load with a retry in one reserved box", () => {
    const html = renderToStaticMarkup(<SignInCard />);
    expect(html).toContain('class="auth-sign-in"');
    expect(html).toContain("Loading sign-in");
    expect(html).toContain("clerk-sign-in");
    expect(html).toContain("Sign-in didn&#x27;t load");
    expect(html).toContain('href="/"');
  });
});
