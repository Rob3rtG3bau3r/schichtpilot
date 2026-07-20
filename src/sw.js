/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// ----------------------------------------------------
// 1) Workbox Precache (VitePWA injectManifest)
// ----------------------------------------------------
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

const CACHE_VERSION = "v25-schichtpilot"; 
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// Alles, was immer verfügbar sein soll (Start + Shell + Icons + Manifest)
const PRECACHE_URLS = [
  "/",                  
  "/mobile/login",      
  "/index.html",       
  "/manifest.json",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Hilfsfunktion: in Cache schreiben
async function putInCache(request, response) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    await cache.put(request, response.clone());
  } catch (e) {
    // z.B. Opaque-Responses (cross-origin) nicht cachen
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
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
          if (key !== STATIC_CACHE) return caches.delete(key);
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch-Strategien:
// 1) Navigations-Requests (SPA): Network-First mit Fallback auf index.html
// 2) Statische Assets: Cache-First
// 3) Sonst: Network-First
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur GET behandeln
  if (req.method !== "GET") return;

  const isSameOrigin = url.origin === self.location.origin;

  // 1) SPA-Navigation
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Online: normale Route laden
          const netRes = await fetch(req);

          // Nur erfolgreiche HTML-Antworten zurückgeben
          if (netRes && netRes.ok) {
            return netRes;
          }

          // Falls /dashboard etc. keine saubere Antwort gibt:
          const indexRes = await fetch("/index.html");
          if (indexRes && indexRes.ok) {
            return indexRes;
          }

          // Letzter Fallback aus Cache
          const cachedIndex = await caches.match("/index.html");
          if (cachedIndex) return cachedIndex;

          return new Response("SchichtPilot konnte nicht geladen werden.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        } catch (e) {
          // Offline-Fallback
          const cachedIndex = await caches.match("/index.html");
          if (cachedIndex) return cachedIndex;

          return new Response("SchichtPilot ist offline nicht verfügbar.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })()
    );
    return;
  }

  // 2) Statische First-Party-Assets -> Cache-First
  const isStaticAsset =
    isSameOrigin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/icons/") ||
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
          if (netRes && netRes.ok) {
            return await putInCache(req, netRes);
          }

          return new Response("", {
            status: netRes?.status || 404,
            statusText: netRes?.statusText || "Not Found",
          });
        } catch (e) {
          return new Response("", {
            status: 503,
            statusText: "Service Unavailable",
          });
        }
      })()
    );
    return;
  }

  // 3) Standard: Network-First mit Cache-Fallback
  event.respondWith(
    (async () => {
      try {
        const netRes = await fetch(req);

        if (netRes && netRes.ok && isSameOrigin) {
          await putInCache(req, netRes.clone());
        }

        return netRes;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;

        return new Response("", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }
    })()
  );
});
// ----------------------------------------------------

