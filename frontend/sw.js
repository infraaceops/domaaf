const CACHE_NAME = 'domaaf-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', event => {
    // Only intercept requests for our own origin (local assets)
    // External APIs, Fonts, and Images should bypass the Service Worker
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(err => {
                console.warn('Local fetch failed:', err);
            });
        })
    );
});
