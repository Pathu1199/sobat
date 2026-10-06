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
      const open = list.find((c) => 'focus' in c);
      if (open) return open.focus();
      return self.clients.openWindow('/');
    }),
  );
});
