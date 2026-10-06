/* Sobat service worker: exists so the pinned web app can show notifications.
   iOS only displays web notifications through a service worker registration;
   the app calls registration.showNotification(). No caching, no push server. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
