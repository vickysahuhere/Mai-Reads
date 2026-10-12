const CACHE_NAME = 'mai-reads-v24-offline';
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
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;

      // Clean URL support for offline PWA navigation
      try {
        const url = new URL(event.request.url);
        if (url.origin === location.origin) {
          if (url.pathname === '/notebook' || url.pathname === '/notebook/') {
            return caches.match('./notebook.html');
          }
          if (url.pathname === '/docs' || url.pathname === '/docs/') {
            return caches.match('./docs.html');
          }
        }
      } catch (_) {}

      return fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          // Cache dynamic fonts or external requests if needed, but return fetchRes
          if (event.request.url.startsWith('https://fonts.gstatic.com')) {
             cache.put(event.request, fetchRes.clone());
          }
          return fetchRes;
        });
      });
    }).catch(() => {
      // Offline fallback for navigation requests
      if (event.request && event.request.mode === 'navigate') {
        try {
          const url = new URL(event.request.url);
          if (url.pathname.includes('notebook')) return caches.match('./notebook.html');
          if (url.pathname.includes('docs')) return caches.match('./docs.html');
          return caches.match('./index.html');
        } catch (_) {
          return caches.match('./index.html');
        }
      }
    })
  );
});


