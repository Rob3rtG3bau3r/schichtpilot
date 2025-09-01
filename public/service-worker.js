// public/service-worker.js
const CACHE_VERSION = "v7-schichtpilot";
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// Alles, was immer verfügbar sein soll (Start + Shell + Icons + Manifest)
const PRECACHE_URLS = [
  "/",               // Root (falls jemand direkt auf / kommt)
  "/mobile",         // Deine start_url
  "/index.html",     // SPA-Shell
  "/manifest.json",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Hilfsfunktion: in Cache schreiben (kl. Helper für saubere Fehlerbehandlung)
async function putInCache(request, response) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    await cache.put(request, response.clone());
  } catch (e) {
    // z.B. Opaque-Responses (cross-origin) nicht cachen
  }
  return response;
}

// Install: wichtige Assets vorcachen
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      // SW sofort aktivieren (skip waiting), damit PWA schneller nutzbar ist
      await self.skipWaiting();
    })()
  );
});

// Activate: alte Caches aufräumen
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch-Strategien:
// 1) Navigations-Requests (SPA): Network-First mit Fallback auf index.html (offline)
// 2) Statische Assets (css/js/png/svg/...): Cache-First
// 3) Sonst: Network-First als Standard
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur GET behandeln
  if (req.method !== "GET") return;

  // 1) SPA-Navigation (HTML-Navigationen)
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Versuche aus dem Netz (damit Updates ankommen)
          const netRes = await fetch(req);
          // index.html aktualisiert cachen (Shell aktuell halten)
          await putInCache("/index.html", netRes.clone());
          return netRes;
        } catch {
          // Offline-Fallback: index.html aus Cache
          const cache = await caches.open(STATIC_CACHE);
          const cached = await cache.match("/index.html");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 2) Statische First-Party-Assets -> Cache-First
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset =
    isSameOrigin &&
    (url.pathname.startsWith("/assets/") || // Vite-Build-Assets
     url.pathname.startsWith("/icons/")  ||
     url.pathname.endsWith(".js") ||
     url.pathname.endsWith(".css") ||
     url.pathname.endsWith(".png") ||
     url.pathname.endsWith(".svg") ||
     url.pathname.endsWith(".webp") ||
     url.pathname.endsWith(".jpg") ||
     url.pathname.endsWith(".jpeg") ||
     url.pathname.endsWith(".woff") ||
     url.pathname.endsWith(".woff2"));

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const netRes = await fetch(req);
          return await putInCache(req, netRes);
        } catch {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 3) Standard: Network-First (mit Cache-Fallback)
  event.respondWith(
    (async () => {
      try {
        const netRes = await fetch(req);
        if (isSameOrigin) await putInCache(req, netRes.clone());
        return netRes;
      } catch {
        const cached = await caches.match(req);
        return cached || Response.error();
      }
    })()
  );
});
