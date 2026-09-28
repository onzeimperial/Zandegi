"use client";
import React, { useReducer } from "react";
import { Mascot } from "../components/brand";
import { authDestination, authReducer, initialAuthState } from "./auth-state";

export default function Home() {
  const [{mode,showPassword}, dispatch] = useReducer(authReducer,initialAuthState);
  return <main className="auth-page">
    <section className="auth-hero" aria-label="Zandegi introduction"><Mascot /><h1 className="display">zandegi</h1><p>Level up your real life.</p></section>
    <section className="auth-panel"><form className="auth-card" action={authDestination(mode)} method="get">
      <div className="tabs" role="group" aria-label="Choose account action">
        <button type="button" aria-pressed={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => dispatch({type:"set-mode",mode:"signup"})}>Sign up</button>
        <button type="button" aria-pressed={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => dispatch({type:"set-mode",mode:"login"})}>Log in</button>
      </div>
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" placeholder="you@example.com" /></div>
      <div className="field"><label htmlFor="password">Password</label><div style={{position:"relative"}}><input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Your password" : "At least 8 characters"} /><button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => dispatch({type:"toggle-password"})}>{showPassword ? "Hide" : "Show"}</button></div></div>
      <button className="button button-primary" type="submit">{mode === "login" ? "Log in" : "Create account"}</button>
      <div className="divider">or</div>
      <button type="button" className="button button-secondary" disabled>Continue with Apple</button><button type="button" className="button button-secondary" disabled>Continue with Google</button>
      <p className="muted small" style={{textAlign:"center"}}>Preview only — authentication is not connected yet.</p>
    </form></section>
  </main>;
}
