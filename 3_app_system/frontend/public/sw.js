/* Service Worker for Web Push - MY Parliament */
self.addEventListener('push', (event) => {
  let data = { title: 'MY Parliament', body: '', url: '/' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  const options = {
    body: data.body || 'New notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: data.url || '/' },
    tag: data.url || 'myparliament-notification',
    renotify: true
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'MY Parliament', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
