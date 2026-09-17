// 弓道部的中ノート オフライン対応 Service Worker
const CACHE_NAME = 'kyudo-hp-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  '/404.html',
  '/style.css',
  '/script.js',
  '/site.webmanifest',
  '/ogp.jpg',
  '/optimized/hero_bg.webp'
];

// インストール時にコアアセットを事前キャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを整理
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ネットワーク優先 (Network-First)、圏外・オフライン時はキャッシュから返す
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Google Fonts や外部アナリティクスは通常取得
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 成功したレスポンスをキャッシュに更新保存
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // オフライン・圏外時はキャッシュから返す
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // HTMLリクエストでキャッシュもない場合は 404.html を返す
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/404.html');
          }
          return new Response('オフラインです', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
