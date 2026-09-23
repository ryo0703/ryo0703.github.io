/* 資金管理：オフライン用
   ネットにつながるときは最新版を読み込み、つながらない・遅いときは保存しておいた版で開く */
const CACHE = 'shikin-v2';
const CORE = ['./', './index.html', './icon.JPG'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('shikin-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  e.respondWith(handle(e, req));
});

async function handle(e, req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then((res) => {
    if (res && res.ok && !res.redirected) cache.put(req, res.clone());
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  try {
    const res = await Promise.race([net, new Promise((r) => setTimeout(r, 3500))]);
    if (res) return res;
  } catch (_) { /* オフライン */ }
  const hit = (await cache.match(req, { ignoreSearch: true }))
    || (req.mode === 'navigate' ? (await cache.match('./')) || (await cache.match('./index.html')) : undefined);
  return hit || net;
}
