"use client";

import { SignIn, SignOutButton } from "@clerk/nextjs";
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

/** One form for signing in and for an invited person's first visit. */
export function SignInCard() {
  return (
    <SignIn
      routing="hash"
      withSignUp
      forceRedirectUrl="/path"
      fallback={
        <p className="auth-loading" role="status">
          Loading sign-in
        </p>
      }
    />
  );
}
