"use client";

/**
 * Tells the server which zone this browser is in, so a mission with no zone of
 * its own still turns over at the person's midnight. Writes a cookie once, and
 * refreshes the page once when the zone was new. Renders nothing.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { timezoneCookie, timezoneFromCookieHeader } from "@/lib/timezone";

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
  const refreshed = useRef(false);
  useEffect(() => {
    if (refreshed.current) return;
    const zone = browserTimezone();
    if (zone === undefined) return;
    if (timezoneFromCookieHeader(document.cookie) === zone) return;
    document.cookie = timezoneCookie(zone, window.location.protocol === "https:");
    // Refresh only when the cookie now reads back as this zone, and at most
    // once per mount, so a blocked or stale cookie can never loop.
    if (timezoneFromCookieHeader(document.cookie) !== zone) return;
    refreshed.current = true;
    router.refresh();
  }, [router]);
  return null;
}
