import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { env } from "./env";

/**
 * Edge-safe auth config: no Prisma, no bcrypt, no Node APIs.
 * Consumed by middleware and merged into the full config in auth.ts.
 * The Credentials provider (which needs bcrypt + Prisma) lives in auth.ts.
 */

const oauthProviders = [];
if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
  oauthProviders.push(GitHub({ clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET }));
}
if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  oauthProviders.push(Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }));
}

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: oauthProviders,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedPrefixes = [
        "/dashboard",
        "/goals",
        "/coach",
        "/analytics",
        "/achievements",
        "/challenges",
        "/friends",
        "/knowledge",
        "/settings",
        "/onboarding",
      ];
      const isProtected = protectedPrefixes.some((p) => nextUrl.pathname.startsWith(p));
      if (isProtected && !isLoggedIn) return false;
      if (isLoggedIn && (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "user";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.role = token.role ?? "user";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
