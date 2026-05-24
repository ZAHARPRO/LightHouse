const CACHE_NAME = "lighthouse-v2";

const NO_CACHE_PATTERNS = [
  /\/api\//,
  /\/_next\/webpack-hmr/,
  /\/auth\//,
];

// ── Install: skip waiting immediately ─────────────────────────────────────
self.addEventListener("install", () => self.skipWaiting());

// ── Activate: delete old caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (!request.url.startsWith("http")) return;
  if (NO_CACHE_PATTERNS.some((p) => p.test(request.url))) return;

  // Navigation (HTML pages) — always network-first, never cache
  // Stale HTML references old JS/CSS hashes → broken styles on rebuild
  if (request.mode === "navigate") return;

  // Next.js static chunks — cache-first (content-hashed, never stale)
  if (request.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
  }
});
