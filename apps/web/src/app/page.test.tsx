import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import Home from "./page";
import {authDestination,authReducer,initialAuthState} from "./auth-state";

describe("authentication preview semantics",()=>{
  it("submits sign-up and login modes to their correct preview routes without serialising credentials",()=>{expect(authDestination("signup")).toBe("/generate");expect(authDestination("login")).toBe("/path");const html=renderToStaticMarkup(<Home/>);expect(html).toContain('<form class="auth-card" action="/generate" method="get">');expect(html).toContain('type="submit"');expect(html).not.toContain('name="password"');});
  it("uses named keyboard-operable tabs and a password visibility control",()=>{const html=renderToStaticMarkup(<Home/>);expect(html).toContain('role="group"');expect(html).toContain('aria-pressed="true"');expect(html).toContain('aria-label="Show password"');expect(html).toContain('type="button"');expect(html).toContain('type="password"');});
  it("handles mode and password visibility transitions",()=>{const login=authReducer(initialAuthState,{type:"set-mode",mode:"login"});expect(login).toMatchObject({mode:"login",showPassword:false});const shown=authReducer(login,{type:"toggle-password"});expect(shown).toMatchObject({mode:"login",showPassword:true});expect(authReducer(shown,{type:"toggle-password"}).showPassword).toBe(false)});
});
