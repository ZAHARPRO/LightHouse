const CACHE_NAME = "lighthouse-v1";

// Static assets to pre-cache on install
const PRECACHE_URLS = ["/", "/feed"];

// Routes that should never be cached
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

// ── Activate: delete old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first with cache fallback ───────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip non-http(s) requests (chrome-extension, etc.)
  if (!request.url.startsWith("http")) return;

  // Never cache API calls, HMR, auth routes
  if (NO_CACHE_PATTERNS.some((p) => p.test(request.url))) return;

  // Next.js internal chunks — cache-first (they're content-hashed)
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

  // Everything else — network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        // Only cache successful responses
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response("Network error", { status: 503 })))
  );
});
