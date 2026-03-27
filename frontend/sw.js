const CACHE_NAME = 'domaaf-v2'; // Bumped version
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
 * Fetch Event - Network-First Strategy
 */
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Only handle local assets
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Update cache with the fresh version
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                // Fallback to cache if network fails
                return caches.match(event.request);
            })
    );
});
