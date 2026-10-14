// 서비스 워커: 오프라인에서도 열리게. 온라인이면 항상 새 파일(네트워크 먼저), 안 되면 마지막으로 받은 파일.
// 캐시할 파일 목록은 따로 두지 않는다: 페이지가 처음 불러온 파일들을 알려 주고, 그 뒤로는 받는 대로 담는다.
const CACHE = 'hamburger-factory-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const sameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;

async function put(req, res) {
  if (!res.ok || res.type !== 'basic') return;
  const cache = await caches.open(CACHE);
  await cache.put(req, res);
}

// 페이지가 보낸 목록 (이미 불러온 파일들)을 담아 둔다
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache' || !Array.isArray(e.data.urls)) return;
  const urls = e.data.urls.filter((u) => typeof u === 'string' && sameOrigin(u)).slice(0, 300);
  e.waitUntil(Promise.all(urls.map(async (u) => {
    try {
      const req = new Request(u, { cache: 'no-cache' });
      await put(req, await fetch(req));
    } catch {
      /* 오프라인이면 다음에 */
    }
  })));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !sameOrigin(req.url)) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      e.waitUntil(put(req, res.clone()));
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      // 첫 화면: 주소가 달라도(index.html, ./) 같은 페이지
      if (req.mode === 'navigate') {
        const page = (await caches.match('./', { ignoreSearch: true })) ?? (await caches.match('index.html', { ignoreSearch: true }));
        if (page) return page;
      }
      throw err;
    }
  })());
});
