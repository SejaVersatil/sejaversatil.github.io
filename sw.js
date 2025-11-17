const CACHE_NAME = 'seja-versatil-v1.0.2';

const urlsToCache = [
    '/',
    '/index.html',
    '/css2.css',
    '/script2.js',
    '/favicon.ico',
    'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700;800;900&display=swap'
];

// INSTALAÇÃO
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 Cache aberto');
            return cache.addAll(urlsToCache);
        })
    );
});

// ATIVAÇÃO
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('🗑️ Cache antigo removido:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// FETCH — Network First com fallback para cache
self.addEventListener('fetch', (event) => {

    // Ignorar requisições internas do Chrome
    if (
        event.request.url.startsWith('chrome-extension://') ||
        event.request.url.startsWith('chrome://')
    ) {
        return;
    }

    // Ignorar métodos não-GET
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Apenas cachear respostas válidas
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback
                return caches.match(event.request);
            })
    );
});
