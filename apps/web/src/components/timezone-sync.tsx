"use client";

/**
 * Tells the server which zone this browser is in, so a mission with no zone of
 * its own still turns over at the person's midnight. Writes a cookie once, and
 * refreshes the page once when the zone was new. Renders nothing.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TIMEZONE_COOKIE, timezoneCookie, timezoneFromCookieHeader } from "@/lib/timezone";

export function browserTimezone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof zone === "string" && zone.length > 0 ? zone : undefined;
  } catch {
    return undefined;
  }
}

export function TimezoneSync() {
  const router = useRouter();
  useEffect(() => {
    const zone = browserTimezone();
    if (zone === undefined) return;
    if (timezoneFromCookieHeader(document.cookie) === zone) return;
    document.cookie = timezoneCookie(zone, window.location.protocol === "https:");
    // Only refresh when the cookie took, or a blocked cookie would loop.
    if (document.cookie.includes(`${TIMEZONE_COOKIE}=`)) router.refresh();
  }, [router]);
  return null;
}
