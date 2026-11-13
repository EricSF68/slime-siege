// Offline cache for the Whodini edition. Bump VERSION when you change files.
const VERSION = 'whodini-rvc-v5';
const FILES = ['./', 'index.html', 'whodini.css', 'theme-data.js', 'theme-art.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/whodini-logo.svg',
  '../style.css', '../js/data.js', '../js/audio.js', '../js/art.js', '../js/game.js', '../js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('whodini-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // revalidate with the server every time (GitHub Pages sets a 10-minute browser cache)
  const same = new URL(e.request.url).origin === location.origin;
  const req = same && e.request.mode !== 'navigate' ? fetch(e.request.url, { cache: 'no-cache' }) : fetch(e.request);
  e.respondWith(req.then(r => {
    if (r.ok && new URL(e.request.url).origin === location.origin) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
