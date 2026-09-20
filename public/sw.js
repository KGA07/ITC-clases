'use strict';

const CACHE = 'itc-clases-v1';
const ASSETS = [
  '/',
  '/inicio',
  '/config.js',
  '/css/styles.css',
  '/js/common.js',
  '/img/logo-itc.svg',
  '/img/logo-udemm.svg',
  '/img/icon.svg',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Las páginas y los interactivos van con red primero (fallback a cache).
  const isPage = url.pathname === '/' || ['/inicio', '/curso', '/clase'].includes(url.pathname) ||
    url.pathname.startsWith('/html/interactivos/');

  if (isPage) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // El resto de estáticos: cache primero.
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
    )
  );
});