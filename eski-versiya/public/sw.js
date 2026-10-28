// Avval tarmoq, internet bo'lmasa kesh: yangilanishlar darhol ko'rinadi, oflaynda ilova ochiladi.
const CACHE = 'smena-v3';
const SHELL = ['/', '/qanday-ishlaydi.html', '/qoidalar.html', '/bizneslar.html', '/savollar.html', '/app.html', '/app.js', '/landing.js', '/smooth.js', '/vendor/lenis.min.js', '/style.css', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // API har doim jonli: eski smena yoki ariza holatini keshdan ko'rsatmaymiz
  if (request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
