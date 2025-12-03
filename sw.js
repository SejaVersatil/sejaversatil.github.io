const CACHE_NAME = 'seja-versatil-v1.0.3'; // Atualizei a versão para forçar atualização

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
