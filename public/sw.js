// NEET 2027 Study Tracker — Service Worker
// Caches app shell for offline use + powers the persistent study notification.

const CACHE_NAME = 'neet-2027-v10';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
  '/favicon-32.png',
  '/notif/night.png',
  '/notif/dawn.png',
  '/notif/morning.png',
  '/notif/noon.png',
  '/notif/dusk.png',
  '/notif/evening.png',
  '/notif/sleep-scene.png',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // If any single resource fails, continue (don't break install)
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for navigation, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip Next.js HMR and dev resources — NEVER cache these
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;
  if (url.pathname.includes('hot-update')) return;
  if (url.pathname.startsWith('/_next/dev/')) return;
  if (url.pathname.startsWith('/_next/static/chunks/')) return;

  // Network-first for navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Cache-first for static assets — but NOT _next/ dev chunks
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => {
          return new Response('', { status: 504, statusText: 'Offline' });
        })
    })
  );
});

// === Persistent Notification System ===
//
// The web app posts messages here to show / update / close the persistent
// notification. We use self.registration.showNotification() (the only way
// to attach action buttons + persist via requireInteraction).
//
// Notification tag: 'neet-persistent' — same tag updates in place rather
// than creating a stack of notifications.

const NOTIF_TAG = 'neet-persistent';

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SHOW_NOTIFICATION') {
    const payload = data.payload || {};
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      tag: NOTIF_TAG,
      // @ts-ignore — requireInteraction is valid in browsers
      requireInteraction: true,
      silent: true,             // never buzz — this is a calm companion
      renotify: false,          // don't buzz on update
      data: { actions: payload.actions || [], url: payload.url || '/' },
    };
    if (payload.image) options.image = payload.image;
    if (payload.badge) options.badge = payload.badge;
    if (payload.progress != null) {
      options.progress = payload.progress;
      // @ts-ignore — supported on Chrome Android
      options.silent = true;
    }
    if (payload.actions && payload.actions.length > 0) {
      // Notifications API supports up to 2 actions on Android Chrome
      options.actions = payload.actions.slice(0, 2).map(a => ({
        action: a.action,
        title: a.title,
      }));
    }
    self.registration.showNotification(payload.title || 'NEET 2027', options);
    return;
  }

  if (data.type === 'CLOSE_NOTIFICATION') {
    self.registration.getNotifications({ tag: NOTIF_TAG }).then((notifs) => {
      notifs.forEach((n) => n.close());
    });
    return;
  }
});

// Handle notification clicks:
//  - Action button click → send corresponding command to the active client
//  - Body click → focus the app (which will show SleepLockScreen if sleeping,
//    ready for the double-tap → math wake flow)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Focus the first available client, or open a new one
      let client = allClients[0];
      if (client) {
        try { await client.focus(); } catch {}
      } else {
        client = await self.clients.openWindow(data.url || '/');
      }

      // Send the action command to the client for handling
      if (client && action) {
        client.postMessage({
          type: 'NOTIF_ACTION',
          action,
          timestamp: Date.now(),
        });
      }
    })()
  );
});
