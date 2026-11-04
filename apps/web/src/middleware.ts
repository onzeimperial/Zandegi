import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { pageRedirect } from "@/lib/route-guard";

const production = process.env.NODE_ENV === "production";
// Mirrors `authModeFromEnv`'s test for keys. Middleware cannot import the server
// packages, and getting this wrong only moves a redirect: each route and page
// still checks for itself.
const clerk = Boolean(
  process.env.CLERK_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
);

function follow(request: NextRequest, target: string | null): NextResponse {
  return target === null
    ? NextResponse.next()
    : NextResponse.redirect(new URL(target, request.url));
}

const withClerk = clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  return follow(
    request,
    pageRedirect(request.nextUrl.pathname, { clerk: true, signedIn: userId !== null, production }),
  );
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (clerk) return withClerk(request, event);
  return follow(
    request,
    pageRedirect(request.nextUrl.pathname, { clerk: false, signedIn: false, production }),
  );
}

export const config = {
  // Clerk's recommended matcher: everything but Next internals and static files.
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
