const CACHE_NAME = 'domaaf-v3'; // Bumped version to clear stale script.js cache
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

/**
 * Install Event - Cache initial assets
 */
self.addEventListener('install', event => {
    self.skipWaiting(); // Force the waiting service worker to become the active service worker
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

/**
 * Activate Event - Purge old caches
 */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
});

/**
 * Fetch Event - Stale-While-Revalidate Strategy
 */
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Only handle local assets (CSS, JS, manifest, etc.)
    if (url.origin !== self.location.origin) return;

    // For HTML files, we might prefer a Network-First strategy to ensure
    // users see the latest content, but for this optimization, we'll go with
    // Stale-While-Revalidate for ALL local assets to maximize speed.
    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(cachedResponse => {
                const fetchedResponse = fetch(event.request).then(networkResponse => {
                    // Update cache for next time
                    if (networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // If network fails, we've already returned the cachedResponse (if any)
                });

                // Return cached version immediately if it exists, otherwise wait for network
                return cachedResponse || fetchedResponse;
            });
        })
    );
});
