// Zenith Project — Service Worker
// Cache-Strategie:
// - App-Shell (HTML/Manifest/Icons): cache-first, damit die App auch offline startet
// - Three.js CDN-Skripte: cache-first (ändern sich praktisch nie für eine fixe Version)
// - GLB-Modell: cache-first nach erstem Laden (großes Asset, danach sofort verfügbar)
// - Alles andere: network-first mit Cache-Fallback

const CACHE_VERSION = "zenith-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-16.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isCacheFirstAsset(url) {
  return (
    url.includes("cdnjs.cloudflare.com/ajax/libs/three.js") ||
    url.includes("cdn.jsdelivr.net/npm/three") ||
    url.endsWith(".glb") ||
    url.includes(".glb")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = req.url;

  // Cache-first for CDN libs and the heavy GLB model
  if (isCacheFirstAsset(url)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const response = await fetch(req);
          if (response && response.status === 200) {
            cache.put(req, response.clone());
          }
          return response;
        } catch (err) {
          return cached || Promise.reject(err);
        }
      })
    );
    return;
  }

  // App shell + same-origin: cache-first, falling back to network, then update cache
  const sameOrigin = url.startsWith(self.location.origin);
  if (sameOrigin) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const networkFetch = fetch(req)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(req, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Everything else (other external resources): network-first, cache fallback
  event.respondWith(
    fetch(req)
      .then((response) => {
        caches.open(CACHE_VERSION).then((cache) => {
          if (response && response.status === 200) {
            cache.put(req, response.clone());
          }
        });
        return response;
      })
      .catch(() => caches.match(req))
  );
});
