"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useReducer } from "react";
import { Icon } from "@/components/icons";
import { authDestination, authReducer, initialAuthState } from "./auth-state";

const mascotSrc = "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";

export default function Home() {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const login = state.mode === "login";

  return (
    <main className="auth-page">
      <p className="sr-only">Authentication preview. No account is created, no credentials are sent and nothing is saved.</p>

      <section className="auth-hero" aria-label="Zandegi introduction">
        <Image className="mascot" src={mascotSrc} width={260} height={260} alt="Zandegi mascot" priority unoptimized />
        <div className="d wordmark">zandegi</div>
        <div className="tagline">Level up your real life.</div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="tabs" role="group" aria-label="Choose">
            <button type="button" aria-pressed={!login} onClick={() => dispatch({ type: "set-mode", mode: "signup" })}>Sign up</button>
            <button type="button" aria-pressed={login} onClick={() => dispatch({ type: "set-mode", mode: "login" })}>Log in</button>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" placeholder="you@example.com" />
          </div>

          <div className="field">
            <div className="field-head">
              <label htmlFor="password">Password</label>
              {/* Inert until auth exists; the preview note above says so. */}
              {login && <button type="button" className="link-button" disabled>Forgot password?</button>}
            </div>
            <div className="password-wrap">
              <input
                id="password"
                type={state.showPassword ? "text" : "password"}
                autoComplete={login ? "current-password" : "new-password"}
                placeholder={login ? "Your password" : "At least 8 characters"}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={state.showPassword ? "Hide password" : "Show password"}
                aria-pressed={state.showPassword}
                onClick={() => dispatch({ type: "toggle-password" })}
              >
                <Icon name="eye" strokeWidth={2.3} />
              </button>
            </div>
          </div>

          <Link className="d auth-submit" href={authDestination(state.mode)}>{login ? "Log in" : "Create account"}</Link>

          <div className="divider"><i /><span>or</span><i /></div>

          <div className="sso">
            <button type="button" disabled>Continue with Apple</button>
            <button type="button" disabled>Continue with Google</button>
          </div>

          <p className="legal">
            By continuing you agree to Zandegi&#39;s <button type="button" className="link-button" disabled>Terms</button> and{" "}
            <button type="button" className="link-button" disabled>Privacy Policy</button>.
          </p>
        </div>
      </section>
    </main>
  );
}
