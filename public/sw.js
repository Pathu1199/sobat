/* Sobat service worker: shows notifications for the pinned web app (iOS only
   displays them through a registration) and keeps the app's own files cached,
   so the pinned app opens at once and works on a weak connection.
   Bundles, fonts and images are served from the cache and refreshed behind;
   the page itself and anything not ours (Firebase, Ollama) always go to the
   network. */
const CACHE = 'sobat-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())),
);

function cacheable(url) {
  if (url.origin !== self.location.origin) return false;
  return /\/_expo\/static\/|\/assets\/|\/fonts\/|\.(?:js|css|woff2?|png|webp|svg|ico)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!cacheable(url)) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
    ),
  );
});

// Tapping a notification brings the app forward (or opens it).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const url = (event.notification.data && event.notification.data.url) || '/';
      const open = list.find((c) => 'focus' in c);
      if (open) return open.focus().then(() => ('navigate' in open ? open.navigate(url) : undefined));
      return self.clients.openWindow(url);
    }),
  );
});

// A push from the relay: {title, body, tag?, url?}. Shown as-is; the relay only ever sends reminder text.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Sobat', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Sobat';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || `sobat-${Date.now()}`,
      data: { url: data.url || '/' },
    }),
  );
});
