const CACHE_NAME = 'mai-reads-v25-offline';
const ASSETS = [
  './',
  './index.html',
  './docs.html',
  './notebook.html',
  './assets/css/styles.css',
  './assets/css/docs.css',
  './assets/css/notebook.css',
  './assets/js/reader.js',
  './assets/js/notebook.js',
  './manifest.json',
  './favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './e88a3b5c4f2e46c7b960b779412f98d7.txt',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-first for same-origin local assets so updates apply immediately
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Clean URL route fallback when offline
        if (url.pathname === '/notebook' || url.pathname === '/notebook/') {
          return caches.match('./notebook.html');
        }
        if (url.pathname === '/docs' || url.pathname === '/docs/') {
          return caches.match('./docs.html');
        }
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
    );
    return;
  }

  // Cache-first for external CDN assets
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          if (event.request.url.startsWith('https://fonts.gstatic.com')) {
            cache.put(event.request, fetchRes.clone());
          }
          return fetchRes;
        });
      });
    }).catch(() => {
      if (event.request && event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});


