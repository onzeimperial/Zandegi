/**
 * Which page a person may reach, decided at the edge. Pure, and free of
 * `@zandegi/api`, because middleware cannot load the server packages.
 *
 * API routes are never redirected: they refuse for themselves with a stable
 * code. `/` is never redirected either, since it explains every other state.
 * Being invited is checked on the server, where Clerk's user record is available.
 */

/** Design boards with fixture data. Real people are kept away from their numbers. */
export const UNBUILT_ROUTES = ["/builder", "/complete", "/crew", "/customise", "/profile", "/shop"];

export function pageRedirect(
  pathname: string,
  state: { clerk: boolean; signedIn: boolean; production: boolean },
): string | null {
  if (pathname === "/" || pathname === "/api" || pathname.startsWith("/api/")) return null;

  const unbuilt = UNBUILT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (state.clerk) {
    if (!state.signedIn) return "/";
    return unbuilt ? "/today" : null;
  }
  // Guest mode keeps the boards for design work. Production without Clerk is off.
  return unbuilt && state.production ? "/" : null;
}
