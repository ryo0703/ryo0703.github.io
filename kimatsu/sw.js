/* 期末試験 勉強計画：オフライン用
   このフォルダ（/kimatsu/）の中だけを扱う。資金管理アプリのキャッシュには触れない。
   ネットにつながるときは最新版を読み込み、つながらない・遅いときは保存しておいた版で開く */
const CACHE = 'kimatsu-v2';
const FONT_CACHE = 'kimatsu-fonts-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('kimatsu-') && k !== CACHE && k !== FONT_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (!url.href.startsWith(self.registration.scope)) return;
    e.respondWith(fromNetworkFirst(e, req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(fromCacheFirst(req));
  }
});

async function fromNetworkFirst(e, req) {
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

async function fromCacheFirst(req) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}
