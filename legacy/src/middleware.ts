import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge middleware runs the lightweight config (no Prisma / bcrypt).
// The `authorized` callback in auth.config.ts performs the redirect logic.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
