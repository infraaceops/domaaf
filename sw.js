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
    // Explicitly do not intercept Google Apps Script calls to prevent NS_ERROR_INTERCEPTION_FAILED
    if (event.request.url.includes('script.google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(err => {
                // Return an error or a fallback if necessary
                console.warn('Fetch failed:', err);
            });
        })
    );
});
