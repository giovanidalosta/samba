// Naumteria Studio - Service Worker
// <generated>
const CACHE_NAME = 'naumteria-studio-b9fd19f452';
const AUDIO_ASSETS = [
  'assets/audio/ag_2e.mp3',
  'assets/audio/ag_61.mp3',
  'assets/audio/ag_6f.mp3',
  'assets/audio/ag_72.mp3',
  'assets/audio/hs_30.mp3',
  'assets/audio/hs_58.mp3',
  'assets/audio/hs_68.mp3',
  'assets/audio/hs_72.mp3',
  'assets/audio/hs_73.mp3',
  'assets/audio/hs_74.mp3',
  'assets/audio/ls_30.mp3',
  'assets/audio/ls_58.mp3',
  'assets/audio/ls_68.mp3',
  'assets/audio/ls_72.mp3',
  'assets/audio/ls_73.mp3',
  'assets/audio/ls_74.mp3',
  'assets/audio/ms_30.mp3',
  'assets/audio/ms_58.mp3',
  'assets/audio/ms_68.mp3',
  'assets/audio/ms_72.mp3',
  'assets/audio/ms_73.mp3',
  'assets/audio/ms_74.mp3',
  'assets/audio/ot_23.mp3',
  'assets/audio/ot_24.mp3',
  'assets/audio/ot_25.mp3',
  'assets/audio/ot_26.mp3',
  'assets/audio/ot_27.mp3',
  'assets/audio/ot_28.mp3',
  'assets/audio/ot_29.mp3',
  'assets/audio/ot_31.mp3',
  'assets/audio/ot_32.mp3',
  'assets/audio/ot_33.mp3',
  'assets/audio/ot_34.mp3',
  'assets/audio/ot_35.mp3',
  'assets/audio/ot_36.mp3',
  'assets/audio/ot_37.mp3',
  'assets/audio/ot_38.mp3',
  'assets/audio/ot_39.mp3',
  'assets/audio/ot_41.mp3',
  'assets/audio/ot_42.mp3',
  'assets/audio/ot_43.mp3',
  'assets/audio/ot_44.mp3',
  'assets/audio/ot_45.mp3',
  'assets/audio/ot_46.mp3',
  'assets/audio/ot_47.mp3',
  'assets/audio/ot_48.mp3',
  'assets/audio/ot_49.mp3',
  'assets/audio/ot_4a.mp3',
  'assets/audio/ot_4b.mp3',
  'assets/audio/ot_4c.mp3',
  'assets/audio/ot_4d.mp3',
  'assets/audio/ot_4e.mp3',
  'assets/audio/ot_4f.mp3',
  'assets/audio/ot_50.mp3',
  'assets/audio/ot_51.mp3',
  'assets/audio/ot_52.mp3',
  'assets/audio/ot_53.mp3',
  'assets/audio/ot_54.mp3',
  'assets/audio/ot_55.mp3',
  'assets/audio/ot_56.mp3',
  'assets/audio/ot_57.mp3',
  'assets/audio/ot_59.mp3',
  'assets/audio/ot_5a.mp3',
  'assets/audio/ot_5b.mp3',
  'assets/audio/ot_5c.mp3',
  'assets/audio/ot_5e.mp3',
  'assets/audio/ot_5f.mp3',
  'assets/audio/ot_60.mp3',
  'assets/audio/ot_62.mp3',
  'assets/audio/ot_63.mp3',
  'assets/audio/ot_64.mp3',
  'assets/audio/ot_65.mp3',
  'assets/audio/ot_67.mp3',
  'assets/audio/ot_69.mp3',
  'assets/audio/ot_6a.mp3',
  'assets/audio/ot_6b.mp3',
  'assets/audio/ot_6c.mp3',
  'assets/audio/ot_6d.mp3',
  'assets/audio/ot_6e.mp3',
  'assets/audio/ot_70.mp3',
  'assets/audio/ot_71.mp3',
  'assets/audio/ot_75.mp3',
  'assets/audio/ot_76.mp3',
  'assets/audio/ot_77.mp3',
  'assets/audio/ot_78.mp3',
  'assets/audio/ot_79.mp3',
  'assets/audio/ot_7b.mp3',
  'assets/audio/ot_7c.mp3',
  'assets/audio/ot_7d.mp3',
  'assets/audio/ot_7e.mp3',
  'assets/audio/ot_c0.mp3',
  'assets/audio/ot_c1.mp3',
  'assets/audio/ot_c2.mp3',
  'assets/audio/ot_c3.mp3',
  'assets/audio/ot_c4.mp3',
  'assets/audio/ot_c5.mp3',
  'assets/audio/ot_c6.mp3',
  'assets/audio/ot_c7.mp3',
  'assets/audio/ot_c8.mp3',
  'assets/audio/ot_c9.mp3',
  'assets/audio/ot_ca.mp3',
  'assets/audio/ot_cb.mp3',
  'assets/audio/ot_cc.mp3',
  'assets/audio/ot_cd.mp3',
  'assets/audio/ot_ce.mp3',
  'assets/audio/ot_cf.mp3',
  'assets/audio/ot_d0.mp3',
  'assets/audio/ot_d1.mp3',
  'assets/audio/ot_d2.mp3',
  'assets/audio/ot_d3.mp3',
  'assets/audio/ot_d4.mp3',
  'assets/audio/re_2e.mp3',
  'assets/audio/re_58.mp3',
  'assets/audio/re_66.mp3',
  'assets/audio/re_68.mp3',
  'assets/audio/re_72.mp3',
  'assets/audio/re_73.mp3',
  'assets/audio/re_7a.mp3',
  'assets/audio/sh_2e.mp3',
  'assets/audio/sh_58.mp3',
  'assets/audio/sn_2e.mp3',
  'assets/audio/sn_58.mp3',
  'assets/audio/sn_66.mp3',
  'assets/audio/sn_72.mp3',
  'assets/audio/ta_58.mp3',
  'assets/audio/ta_66.mp3',
  'assets/audio/ta_72.mp3',
];
// </generated>
const CORE_ASSETS = [
  './',
  'index.html',
  'beatbox_studio.css',
  'beatbox_studio.js',
  'js/ui-dialogs.js',
  'js/instruments.js',
  'js/audio-engine.js',
  'js/pad-state.js',
  'js/pad-grid.js',
  'js/pad-playback.js',
  'js/io-share.js',
  'js/app-init.js',
  'assets/soundbank.js',
  'manifest.json',
  'assets/icon.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/logo-naumteria.png',
  'assets/fonts/Diamante-ExtraBold.ttf',
  'assets/fonts/Arboria-Book.otf',
  'assets/fonts/MyriadPro-Bold.otf',
  'assets/fonts/MyriadVariableConcept-Roman.otf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...CORE_ASSETS, ...AUDIO_ASSETS]).catch((err) => {
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
