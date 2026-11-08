// Cleanup worker. The original static app registered a cache-first service worker at this path.
// Devices that still have it installed would keep serving the old cached pages, so this version
// clears every cache it owns and unregisters itself. The old app still lives at /classic.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    })()
  );
});
