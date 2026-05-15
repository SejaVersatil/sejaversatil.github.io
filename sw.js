const CACHE_NAME = 'seja-versatil-v1.0.56';

const urlsToCache = [
    '/',
    '/index.html',
    '/css2.css',
    '/script2.js',
    '/favicon.ico',
    '/assets/icons/favicon-32.png',
    '/assets/icons/icon-192.png',
    '/assets/home/hero-clube-versatil.webp',
    '/assets/home/hero-clube-versatil-mobile.webp',
    '/assets/home/guia-medidas-versatil.jpeg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            ))
            .then(() => self.clients.claim())
    );
});

function shouldCacheFirst(request) {
    return ['image', 'style', 'script', 'font'].includes(request.destination);
}

function fetchAndCache(request) {
    return fetch(request).then((response) => {
        if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
            });
        }
        return response;
    });
}

self.addEventListener('fetch', (event) => {
    if (!event.request.url.startsWith('http')) return;
    if (event.request.method !== 'GET') return;

    if (shouldCacheFirst(event.request)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || fetchAndCache(event.request);
            })
        );
        return;
    }

    event.respondWith(
        fetchAndCache(event.request).catch(() => {
            return caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || new Response('Voce esta offline e este recurso nao foi cacheado.', {
                    status: 404,
                    statusText: 'Offline'
                });
            });
        })
    );
});
