const CACHE_NAME = 'seja-versatil-v1.0.2';
const urlsToCache = [
    '/',
    '/index.html',
    '/css2.css',
    '/script2.js',
    '/favicon.ico',
    'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700;800;900&display=swap'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Cache aberto');
                return cache.addAll(urlsToCache);
            })
    );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('🗑️ Cache antigo removido:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Estratégia: Network First, fallback para Cache
self.addEventListener('fetch', (event) => {
    // ✅ ADICIONAR NO INÍCIO DO EVENTO
    if (event.request.url.startsWith('chrome-extension://') || 
    event.request.url.startsWith('chrome://')) {
    return; // Ignorar requisições de extensões
}

// ← ADICIONAR ESTE FILTRO AQUI
if (event.request.method !== 'GET') {
    return; // Não fazer cache de POST, PUT, DELETE, etc.
}

self.addEventListener('fetch', (event) => {
    // 1️⃣ Ignorar extensões
    if (event.request.url.startsWith('chrome-extension://') || 
        event.request.url.startsWith('chrome://')) {
        return;
    }

    // 2️⃣ Ignorar métodos não-GET (CRÍTICO!)
    if (event.request.method !== 'GET') {
        return;
    }

    // 3️⃣ Processar cache normalmente
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});



