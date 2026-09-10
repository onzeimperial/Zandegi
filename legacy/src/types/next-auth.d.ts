import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}

/**
 * NextAuth v5 resolves the JWT type from @auth/core, so augmenting only
 * "next-auth/jwt" leaves token.id and token.role typed as {} inside the
 * callbacks in src/lib/auth.config.ts.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
