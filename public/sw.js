const CACHE_NAME = "lighthouse-v1";

const PRECACHE_URLS = ["/", "/feed"];

const NO_CACHE_PATTERNS = [
  /\/api\//,
  /\/_next\/webpack-hmr/,
  /\/auth\//,
];

// ── Install: pre-cache shell ───────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: enable navigation preload + delete old caches ───────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.navigationPreload?.enable(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
          )
        ),
    ]).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first with cache fallback ───────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (!request.url.startsWith("http")) return;
  if (NO_CACHE_PATTERNS.some((p) => p.test(request.url))) return;

  // Next.js static chunks — cache-first (content-hashed, never stale)
  if (request.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  // Navigation requests — use preloadResponse to avoid the warning
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Use the preloaded response if available
          const preloaded = await event.preloadResponse;
          if (preloaded) {
            const clone = preloaded.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            return preloaded;
          }
          // Fall back to network
          const res = await fetch(request);
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        } catch {
          const cached = await caches.match(request);
          return cached || new Response("Network error", { status: 503 });
        }
      })()
    );
    return;
  }

  // Everything else — network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached || new Response("Network error", { status: 503 })
        )
      )
  );
});
