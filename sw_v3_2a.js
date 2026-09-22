/* Zenith — Service Worker v3_2a
   WICHTIG: CACHE bei JEDER Auslieferung hochzaehlen, sonst werden neue
   Dateien nicht ausgeliefert (Fehler aus v1/v2). */
const CACHE = 'zenith-v3_2a';

const SHELL = [
  './',
  './index_v3_2a.html',
  './manifest_v3_2a.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

function isModel(u){ return u.pathname.endsWith('.glb'); }
function isLib(u){ return u.hostname === 'cdn.jsdelivr.net'; }
function isDoc(r){ return r.mode === 'navigate' || r.destination === 'document'; }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* Modell und Bibliotheken: Cache zuerst - sie aendern sich nur mit der Version */
  if (isModel(url) || isLib(url)){
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
    return;
  }

  /* HTML und alles andere: Netz zuerst, Cache als Rueckfall */
  if (isDoc(req) || url.origin === self.location.origin){
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index_v3_2a.html')))
    );
  }
});
