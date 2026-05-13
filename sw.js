const CACHE_NAME = 'seja-versatil-v1.0.35'; // Atualizei a versão para forçar atualização

const urlsToCache = [
    '/',
    '/index.html',
    '/css2.css',
    '/script2.js',
    '/favicon.ico',
    '/assets/home/hero-spin.webp',
    '/assets/home/hero-performance.webp',
    '/assets/home/hero-v1-collection.webp',
    '/assets/home/promo-short-saia-v1.jpeg',
    '/assets/home/promo-conjunto-calca-v1.jpeg',
    '/assets/home/promo-conjunto-short-v1.jpeg',
    '/assets/home/promo-blusas-v1.jpeg',
    '/assets/home/promo-peca-unica-v1.jpeg'
];

// INSTALAÇÃO
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Força o SW a ativar imediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 Cache aberto');
            return cache.addAll(urlsToCache);
        })
    );
});

// ATIVAÇÃO (Limpeza de caches antigos)
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
        }).then(() => self.clients.claim()) // Controla as abas abertas imediatamente
    );
});

// FETCH — Network First com fallback para Cache (Blindado)
self.addEventListener('fetch', (event) => {
    // Ignorar requisições internas do Chrome ou não-http
    if (!event.request.url.startsWith('http')) return;

    // Ignorar métodos não-GET (POST, DELETE, etc não devem ser cacheados)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Se a resposta for válida, clona e atualiza o cache
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // 🔴 AQUI ESTAVA O ERRO: O navegador caia aqui sem internet
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse; // Retorna o que tem no cache
                        }
                        
                        // 🔥 CORREÇÃO: Se não tiver no cache, retorna uma resposta de erro válida
                        // Isso evita o erro "Failed to convert value to 'Response'"
                        return new Response("Você está offline e este recurso não foi cacheado.", { 
                            status: 404, 
                            statusText: "Offline" 
                        });
                    });
            })
    );
});
