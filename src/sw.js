/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// ----------------------------------------------------
// 1) Workbox Precache (VitePWA injectManifest)
// ----------------------------------------------------
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ----------------------------------------------------
// 2) Dein bisheriges Cache-System (wie vorher)
// ----------------------------------------------------
const CACHE_VERSION = "v18-schichtpilot"; // ✅ hochgezählt, damit Updates sicher greifen
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// Alles, was immer verfügbar sein soll (Start + Shell + Icons + Manifest)
const PRECACHE_URLS = [
  "/",                  // Root (falls jemand direkt auf / kommt)
  "/mobile/login",      // ✅ echte Start-URL (damit Install & Offline sauber sind)
  "/index.html",        // SPA-Shell
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

// Install: wichtige Assets vorcachen
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
// 1) Navigations-Requests (SPA): Network-First mit Fallback auf index.html (offline)
// 2) Statische Assets: Cache-First
// 3) Sonst: Network-First
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur GET behandeln
  if (req.method !== "GET") return;

  // 1) SPA-Navigation
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const netRes = await fetch(req);
          await putInCache("/index.html", netRes.clone());
          return netRes;
        } catch {
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

// ----------------------------------------------------
// 3) PUSH: Notification anzeigen + Klick öffnen
// ----------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {}

  const title = data.title || "SchichtPilot";

  // ✅ Wichtig: Fallback-url, sonst passiert beim Klick oft "nichts"
  const url = (data?.data?.url) || "/mobile/login";

  const options = {
    body: data.body || "Neue Nachricht",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url }, // ✅ immer als {url} speichern
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/mobile/login";

  event.waitUntil(
    (async () => {
      // Falls schon ein Tab offen ist -> fokussieren
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => c.url.includes("/mobile"));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })()
  );
});
