/* Service Worker — שמו״ת
   • דפי HTML: רשת קודם (עדכונים מגיעים מיד), ובלי רשת — העותק האחרון מהמטמון
   • /assets/*: קבצים עם hash בשם — לא משתנים לעולם, אז מטמון קודם
   • טקסט מספריא וגופנים: מהמטמון מיד, ומתעדכן ברקע (stale-while-revalidate)
   • כל השאר (Firebase, התחברות) — לא נוגעים */
const VERSION = 'v23';
const SHELL = `shmot-shell-${VERSION}`;
const RUNTIME = 'shmot-runtime';        // נכסים/גופנים/ספריא — לא נמחק בכל גרסה
const STATIC = ['/', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png'];
const MAX_RUNTIME = 300;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_RUNTIME; i++) await cache.delete(keys[i]);
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put('/', res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    const cache = await caches.open(RUNTIME);
    await cache.put(req, res.clone());
    trim(cache);
  }
  return res;
}

async function staleWhileRevalidate(e) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(e.request);
  const net = fetch(e.request).then(res => {
    if (res.ok || res.type === 'opaque') { cache.put(e.request, res.clone()); trim(cache); }
    return res;
  });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.startsWith('/__/')) return;  // Firebase (auth handler וכו׳)

  if (req.mode === 'navigate') {
    // דפים סטטיים נוספים (מדיניות פרטיות וכו׳) — רגיל; האפליקציה עצמה — עם גיבוי מהמטמון
    if (url.origin === self.location.origin && url.pathname.endsWith('.html') && url.pathname !== '/index.html') return;
    e.respondWith(networkFirst(req));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/assets/')) { e.respondWith(cacheFirst(req)); return; }
    if (STATIC.includes(url.pathname)) { e.respondWith(caches.match(req).then(r => r || fetch(req))); return; }
    return;
  }
  if (url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'www.sefaria.org') {
    e.respondWith(staleWhileRevalidate(e));
    return;
  }
});
