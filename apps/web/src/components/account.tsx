"use client";

import { ClerkFailed, ClerkLoading, SignIn, SignOutButton } from "@clerk/nextjs";
import { createContext, useContext } from "react";

/**
 * Whether a Clerk provider is above this tree. Clerk's components throw without
 * one, and guest mode has none, so anything shared with guest mode asks first.
 */
const AccountsEnabled = createContext(false);

export function AccountsEnabledProvider({ children }: { children: React.ReactNode }) {
  return <AccountsEnabled.Provider value={true}>{children}</AccountsEnabled.Provider>;
}

export function SignOut({ className }: { className: string }) {
  const enabled = useContext(AccountsEnabled);
  if (!enabled) return null;
  return (
    <SignOutButton redirectUrl="/">
      <button type="button" className={className}>
        Sign out
      </button>
    </SignOutButton>
  );
}

/**
 * One form for signing in and for an invited person's first visit. Loading, the
 * form and a failed load share one reserved box, so nothing jumps when Clerk
 * arrives. The retry is a full page load, because that is what reloads Clerk.
 */
export function SignInCard() {
  return (
    <div className="auth-sign-in">
      <ClerkLoading>
        <p className="auth-loading" role="status">
          Loading sign-in
        </p>
      </ClerkLoading>
      <ClerkFailed>
        <div className="auth-card" role="alert">
          <h1 className="d">Sign-in didn&#39;t load</h1>
          <p>Check your connection, then try again.</p>
          <a className="d flow-primary" href="/">
            Try again
          </a>
        </div>
      </ClerkFailed>
      <SignIn routing="hash" withSignUp forceRedirectUrl="/today" />
    </div>
  );
}
