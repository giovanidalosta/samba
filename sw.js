// Naumteria Studio - Service Worker
const CACHE_NAME = 'naumteria-studio-v6';
const CORE_ASSETS = [
  './',
  'index.html',
  'beatbox_studio.css',
  'beatbox_studio.js',
  'manifest.json',
  'assets/logo-naumteria.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/fonts/Diamante-ExtraBold.ttf',
  'assets/fonts/Arboria-Book.otf',
  'assets/fonts/MyriadPro-Bold.otf',
  'assets/fonts/MyriadVariableConcept-Roman.otf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('Falha parcial ao pré-armazenar assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignora requisições não-GET ou extensões do navegador
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const isCodeOrHtml = request.mode === 'navigate' ||
    request.url.endsWith('.html') ||
    request.url.endsWith('.js') ||
    request.url.endsWith('.css');

  if (isCodeOrHtml) {
    // Network-first para HTML/CSS/JS garante atualização imediata
    event.respondWith(
      fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => caches.match(request).then((res) => res || caches.match('index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Se não estiver em cache, busca na rede e guarda em cache (ex: áudios mp3 e fontes)
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
