/**
 * Minimal, hand-written service worker — installability + basic offline
 * resilience, no build-tool plugin. Two strategies only:
 *
 *   - /_next/static/*  → cache-first (these are content-hashed and immutable)
 *   - navigations (HTML pages) → network-first, falling back to a cached
 *     copy of that page if offline, and to /offline if it was never visited
 *
 * Everything else (API calls, auth) always goes to the network untouched —
 * caching a POST or a session-bearing response would be actively wrong.
 */

const CACHE = "zandegi-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache mutating requests

  const url = new URL(request.url);

  // Next.js's hashed static assets — safe to cache forever.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Page navigations — prefer the network, fall back to whatever was last
  // cached for this exact URL, and finally to the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, res.clone());
          return res;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(request)) ?? (await cache.match(OFFLINE_URL));
        }
      })(),
    );
  }
});
