/* ============================================================
   MandıraPro — Service Worker (PWA offline önbellek)
   ============================================================ */
'use strict';

const CACHE_NAME = 'mandirapro-v20261025';
const OFFLINE_URL = '/';
const STATIC_ASSETS = [
  '/',
  'index.html',
  'manifest.json',
  'assets/style.css?v=20261025m',
  'assets/theme.css?v=20261025m',
  'assets/app.js?v=20261025m',
  'assets/core.js?v=20261025m',
  'assets/data.js?v=20261025m',
  'assets/charts.js?v=20261025m',
  'assets/sw-register.js?v=20261025m',
  'assets/vendor/qrcode.js?v=20261025m',
  'assets/vendor/xlsx.full.min.js?v=20261025m',
  'assets/pages-dashboard.js?v=20261025m',
  'assets/pages-route.js?v=20261025m',
  'assets/pages-producers.js?v=20261025m',
  'assets/pages-producer-detail.js?v=20261025m',
  'assets/pages-records.js?v=20261025m',
  'assets/pages-quality.js?v=20261025m',
  'assets/pages-tank.js?v=20261025m',
  'assets/pages-settlements.js?v=20261025m',
  'assets/pages-invoices.js?v=20261025m',
  'assets/pages-orders.js?v=20261025m',
  'assets/pages-accounts.js?v=20261025m',
  'assets/pages-fleet.js?v=20261025m',
  'assets/pages-reports.js?v=20261025m',
  'assets/pages-system.js?v=20261025m',
  'assets/pages-farm.js?v=20261025m',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
  'icons/icon-72.svg',
  'icons/icon-96.svg',
  'icons/icon-128.svg',
  'icons/icon-144.svg',
  'icons/icon-152.svg',
  'icons/icon-384.svg',
  'icons/icon-maskable-192.svg',
  'icons/icon-maskable-512.svg'
];

// Kurulum: statik varlıkları önbelleğe al
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS.map(function (url) {
        return new Request(url, { cache: 'no-cache' });
      })).catch(function () {
        // Bazı varlıklar yok olabilir; devam et
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Aktivasyon: eski önbellekleri temizle
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
)

// Fetch: ağdan önce önbellek, yoksa ağdan
self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);

  // Sadece same-origin istekleri işle
  if (url.origin !== self.location.origin) return;

  // API / localStorage işlemleri SW'den geçirilmez (localStorage SW'de yok)
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        // Geçerli yanıtları önbelleğe al (HTML, CSS, JS, PNG)
        if (response.status === 200 &&
            (response.headers.get('content-type') || '').match(/text\/html|text\/css|application\/javascript|image\/png/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        // Çevrimdışıysa ve istek HTML ise offline sayfayı göster
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('', { status: 503, statusText: 'Çevrimdışı' });
      });
    })
  );
});