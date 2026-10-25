// MechToolBox service worker: the site keeps working offline once it has been opened.
// The build (scripts/postbuild.mjs) fills in the version and the file list below, so each release gets a fresh cache.
const VERSION = '__VERSION__'
const CACHE = 'mechtoolbox-' + VERSION
const PRECACHE = __PRECACHE__
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mechtoolbox-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Pages: the newest from the network, the cached copy when offline.
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./'))))
    return
  }
  // Own files (hashed, so they never change) and Google Fonts: cache first.
  if (url.origin === location.origin || FONTS.test(req.url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    })))
  }
  // Everything else (ads, stats, the feedback form) goes straight to the network.
})
