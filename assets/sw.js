// 弓道部的中ノート オフライン対応 Service Worker
//
// 控えの名前と事前に控える一覧は、ビルドのあとの台本（scripts/after-build.mjs）が、その回の束（CSS・JS。名前にハッシュが入る）と
// ページから作って dist/sw.js に書き込む（2026-11-04）。前は /style.css・/script.js を決め打ちしていて、本番ではどちらも 404
// （ビルドで名前が変わる）になり、cache.addAll が丸ごと失敗して Service Worker が一度も入らなかった。
// 下の値は手元の vite の開発用（dist では書き換わる）
const CACHE_NAME = 'kyudo-hp-dev';
const PRECACHE_URLS = ['/', '/index.html', '/privacy.html', '/terms.html', '/404.html', '/site.webmanifest'];

// インストール時にコアアセットを事前キャッシュ。1 つずつ入れ、どれかが落ちても入る（全部まとめると 1 つの 404 で全部止まる）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(PRECACHE_URLS.map((道) => cache.add(道).catch(() => {}))))
      .then(() => self.skipWaiting())
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
