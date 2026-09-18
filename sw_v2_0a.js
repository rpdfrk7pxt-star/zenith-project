// Zenith Project — Service Worker  v2_0a
//
// WICHTIGE AENDERUNG GEGENUEBER v1:
// Frueher wurde auch die index.html cache-first ausgeliefert. Dadurch zeigte
// das Geraet nach einem Upload weiterhin die alte Fassung -- man sah eigene
// Aenderungen erst Tage spaeter oder gar nicht. Jetzt gilt:
//
//   index.html / Navigation -> NETWORK-FIRST (Cache nur als Notfall offline)
//   three.js von CDN        -> cache-first  (feste Version, aendert sich nie)
//   .glb Modell             -> cache-first  (5.3 MB, nach dem ersten Mal sofort da)
//   Icons / manifest        -> cache-first
//
// BEI JEDEM UPLOAD EINER NEUEN index.html DIESE ZEILE HOCHZAEHLEN:
const CACHE_VERSION = "zenith-v2-0a";

const APP_SHELL = [
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
    caches.open(CACHE_VERSION).then((cache) =>
      // einzeln statt addAll: eine fehlende Datei soll nicht die ganze
      // Installation scheitern lassen
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => null)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Grosse, unveraenderliche Brocken: erst Cache, dann Netz
function isCacheFirstAsset(url) {
  return (
    url.includes("cdnjs.cloudflare.com/ajax/libs/three.js") ||
    url.includes("cdn.jsdelivr.net/npm/three") ||
    url.includes(".glb") ||
    url.includes(".wasm") ||
    url.includes("/icons/") ||
    url.endsWith("manifest.json")
  );
}

// Das Dokument selbst: immer erst das Netz fragen
function isDocument(req, url) {
  return (
    req.mode === "navigate" ||
    url.endsWith("/") ||
    url.endsWith(".html")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = req.url;

  // 1) Dokument -> Netz zuerst, Cache nur wenn offline
  if (isDocument(req, url)) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // 2) Unveraenderliche Brocken -> Cache zuerst
  if (isCacheFirstAsset(url)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const response = await fetch(req);
          if (response && response.status === 200) cache.put(req, response.clone());
          return response;
        } catch (err) {
          return cached || Promise.reject(err);
        }
      })
    );
    return;
  }

  // 3) Alles Uebrige -> Netz zuerst, Cache als Rueckfall
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return response;
      })
      .catch(() => caches.match(req))
  );
});
