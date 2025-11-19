// ==================== CONFIGURAÇÃO GLOBAL E FIREBASE ====================
// Resgata as variáveis globais definidas no index.html
const db = window.db;
const auth = window.auth;
const storage = window.storage;

// Estado da aplicação
const state = {
    products: [],
    cart: [],
    currentFilter: 'all',
    currentUser: null,
    countdownInterval: null
};

// Cache e Rate Limit
class CacheManager {
    constructor(ttl = 300000) { // 5 minutos
        this.cache = new Map();
        this.ttl = ttl;
    }
    set(key, value) {
        this.cache.set(key, { value, timestamp: Date.now() });
    }
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }
    clear() { this.cache.clear(); }
}
const productCache = new CacheManager();

// ==================== INICIALIZAÇÃO OTIMIZADA ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Home Inicializando...');

    // 1. CARGA VISUAL IMEDIATA (LCP)
    // Carrega configurações e UI estática antes de qualquer dado pesado
    if (typeof loadSettings === 'function') loadSettings();
    if (typeof initHeroCarousel === 'function') initHeroCarousel();
    if (typeof initBlackFridayCountdown === 'function') initBlackFridayCountdown();
    
    // Recupera carrinho do localStorage (instantâneo)
    loadCart();
    updateCartUI();
    updateFavoritesCount();

    // 2. REMOVE TELA DE CARREGAMENTO (Para o usuário ver o site logo)
    const loader = document.getElementById('loadingOverlay');
    if(loader) loader.classList.remove('active');

    // 3. CARREGA DADOS PESADOS EM SEGUNDO PLANO
    // Usa setTimeout para liberar a thread principal
    setTimeout(async () => {
        // Monitora Login
        if (auth) {
            auth.onAuthStateChanged(user => {
                state.currentUser = user;
                console.log('Auth:', user ? 'Logado' : 'Visitante');
                if (typeof updateAdminStats === 'function' && user) updateAdminStats();
            });
        }

        // Baixa Produtos do Firestore
        await loadProducts();

        // Scripts Secundários (Não bloqueantes)
        if (typeof setupConnectionMonitor === 'function') setupConnectionMonitor();
        if (typeof setupCartAbandonmentTracking === 'function') setupCartAbandonmentTracking();
        
        // Verifica se veio busca de outra página
        const urlParams = new URLSearchParams(window.location.search);
        const searchTerm = urlParams.get('search');
        if (searchTerm) {
            const headerInput = document.getElementById('headerSearchInput');
            if(headerInput) {
                headerInput.value = searchTerm;
                setTimeout(() => {
                    performHeaderSearch();
                    const prodSection = document.getElementById('produtos');
                    if(prodSection) prodSection.scrollIntoView({behavior: 'smooth'});
                }, 500);
            }
        }

        // Verifica Ações via Hash (Login/Favoritos vindos do Produto)
        const hash = window.location.hash;
        if (hash === '#login') setTimeout(openUserPanel, 500);
        else if (hash === '#favorites') setTimeout(showFavorites, 800);
        else if (hash === '#cart') setTimeout(toggleCart, 500);

    }, 0);
});

// ==================== PRODUTOS (FIRESTORE) ====================
async function loadProducts() {
    try {
        // Tenta pegar do cache primeiro
        const cached = productCache.get('products');
        if (cached) {
            state.products = cached;
            renderProducts();
            renderBestSellers();
            return;
        }

        // Se não tem cache, busca no Firestore (Limitado a 50 para performance)
        if (!db) { console.error('Firestore não inicializado'); return; }
        
        const snapshot = await db.collection("produtos")
            .limit(50)
            .get();
            
        state.products = [];
        snapshot.forEach(doc => state.products.push({ id: doc.id, ...doc.data() }));
        
        // Salva em cache
        productCache.set('products', state.products);

        renderProducts();
        renderBestSellers();
        
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        showToast("Erro ao conectar com o servidor", "error");
    }
}

// ==================== RENDERIZAÇÃO (GRID PRINCIPAL) ====================
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    let filtered = state.products;
    
    // Filtros
    if (state.currentFilter !== 'all') {
        if (state.currentFilter === 'favorites') {
            const favs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
            filtered = filtered.filter(p => favs.includes(p.id));
        } else {
            filtered = filtered.filter(p => p.category === state.currentFilter);
        }
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem;">Nenhum produto encontrado.</div>';
        return;
    }

    grid.innerHTML = filtered.map(product => {
        // LÓGICA DE IMAGEM ROBUSTA (Tag IMG)
        let imgUrl = '';
        if (Array.isArray(product.images) && product.images.length > 0) imgUrl = product.images[0];
        else if (product.image) imgUrl = product.image;
        else if (product.img) imgUrl = product.img;

        // Fallback
        if (!imgUrl) imgUrl = 'https://via.placeholder.com/400x500?text=Sem+Foto';

        const price = parseFloat(product.price) || 0;
        const oldPrice = parseFloat(product.oldPrice) || 0;
        const isFav = isFavorite(product.id);

        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                     <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')">
                        ${isFav ? '❤️' : '🤍'}
                    </button>

                    <img src="${imgUrl}" alt="${product.name}" loading="lazy" 
                         style="width:100%; height:100%; object-fit:cover; display:block;"
                         onerror="this.src='https://via.placeholder.com/400x500?text=Erro+Img'">
                    
                    ${product.badge ? `<span class="product-badge" style="position:absolute;top:10px;left:10px;background:black;color:white;padding:5px;">${product.badge}</span>` : ''}
                    
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); quickAddToCart('${product.id}')">
                        ADICIONAR AO CARRINHO
                    </button>
                </div>
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <div class="product-price">
                        ${oldPrice > price ? `<span class="price-old">R$ ${oldPrice.toFixed(2)}</span>` : ''}
                        <span class="price-new">R$ ${price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== RENDER BEST SELLERS ====================
function renderBestSellers() {
    const bestSellersGrid = document.getElementById('bestSellersGrid');
    if (!bestSellersGrid) return;

    const bestSellers = state.products.filter(p => p.oldPrice).slice(0, 6);
    
    if (bestSellers.length === 0) {
        bestSellersGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:#999;">Confira nossas novidades!</div>';
        return;
    }
    
    bestSellersGrid.innerHTML = bestSellers.map(product => {
        let imgUrl = '';
        if (Array.isArray(product.images) && product.images.length > 0) imgUrl = product.images[0];
        else if (product.image) imgUrl = product.image;
        else if (product.img) imgUrl = product.img;

        if (!imgUrl) imgUrl = 'https://via.placeholder.com/400x500?text=Sem+Foto';
        
        const price = parseFloat(product.price) || 0;
        const oldPrice = parseFloat(product.oldPrice) || 0;
        
        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                    <img src="${imgUrl}" alt="${product.name}" loading="lazy" 
                         style="width:100%; height:100%; object-fit:cover; display:block;"
                         onerror="this.src='https://via.placeholder.com/400x500?text=Erro+Img'">
                    
                    ${product.badge ? `<span class="product-badge" style="position:absolute;top:10px;left:10px;background:black;color:white;padding:5px;">${product.badge}</span>` : ''}
                    
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); quickAddToCart('${product.id}')">
                        ADICIONAR AO CARRINHO
                    </button>
                </div>
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <div class="product-price">
                        ${oldPrice > price ? `<span class="price-old">R$ ${oldPrice.toFixed(2)}</span>` : ''}
                        <span class="price-new">R$ ${price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== CARRINHO (INTEGRADO) ====================
function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if (saved) state.cart = JSON.parse(saved);
}

function saveCart() {
    localStorage.setItem('sejaVersatilCart', JSON.stringify(state.cart));
    updateCartUI();
}

function quickAddToCart(id) {
    const product = state.products.find(p => p.id === id);
    if(!product) return;

    // Adiciona item genérico (sem variante selecionada)
    const cartItem = {
        ...product,
        quantity: 1,
        cartItemId: `${product.id}_generic`,
        image: Array.isArray(product.images) ? product.images[0] : product.image
    };

    const existing = state.cart.find(i => i.cartItemId === cartItem.cartItemId);
    if(existing) existing.quantity++;
    else state.cart.push(cartItem);

    saveCart();
    updateCartUI();
    toggleCart(); // Abre o carrinho
    showToast('Produto adicionado!', 'success');
}

function updateCartUI() {
    const count = document.getElementById('cartCount');
    const items = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const footer = document.getElementById('cartFooter');

    if(count) count.textContent = state.cart.reduce((acc, item) => acc + item.quantity, 0);

    if(state.cart.length === 0) {
        if(items) items.innerHTML = '<div class="empty-cart">Carrinho vazio</div>';
        if(footer) footer.style.display = 'none';
        return;
    }

    if(footer) footer.style.display = 'block';
    
    let total = 0;
    if(items) {
        items.innerHTML = state.cart.map(item => {
            total += (item.price * item.quantity);
            return `
                <div class="cart-item">
                    <div class="cart-item-img" style="background-image: url('${item.image || ''}'); background-size:cover; background-position:center;"></div>
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-price">R$ ${item.price.toFixed(2)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="updateQuantity('${item.cartItemId}', -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="updateQuantity('${item.cartItemId}', 1)">+</button>
                        </div>
                    </div>
                    <div class="remove-item" onclick="removeFromCart('${item.cartItemId}')">✕</div>
                </div>
            `;
        }).join('');
    }
    
    if(totalEl) totalEl.textContent = `R$ ${total.toFixed(2)}`;
}

function updateQuantity(itemId, change) {
    const item = state.cart.find(i => i.cartItemId === itemId);
    if(item) {
        item.quantity += change;
        if(item.quantity <= 0) removeFromCart(itemId);
        else saveCart();
    }
}

function removeFromCart(itemId) {
    state.cart = state.cart.filter(i => i.cartItemId !== itemId);
    saveCart();
}

function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('active');
    document.getElementById('cartOverlay').classList.toggle('active');
}

// ==================== FAVORITOS ====================
function isFavorite(id) {
    const favs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    return favs.includes(id);
}

function toggleFavorite(id) {
    let favs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    if (favs.includes(id)) {
        favs = favs.filter(fid => fid !== id);
        showToast('Removido dos favoritos');
    } else {
        favs.push(id);
        showToast('Adicionado aos favoritos', 'success');
    }
    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favs));
    updateFavoritesCount();
    renderProducts(); // Re-renderiza para atualizar os corações
    
    // Se estiver vendo a lista de favoritos, atualiza ela
    if (state.currentFilter === 'favorites') showFavorites();
}

function updateFavoritesCount() {
    const favCount = document.getElementById('favoritesCount');
    const favs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    if(favCount) {
        favCount.textContent = favs.length;
        favCount.style.display = favs.length > 0 ? 'flex' : 'none';
    }
}

function showFavorites() {
    const favs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    if (favs.length === 0) {
        showToast('Você não tem favoritos', 'info');
        return;
    }
    state.currentFilter = 'favorites';
    renderProducts();
    
    // Mostra badge de filtro
    const badge = document.getElementById('activeCategoryBadge');
    const text = document.getElementById('categoryNameDisplay');
    if(badge && text) {
        text.textContent = '❤️ Meus Favoritos';
        badge.style.display = 'flex';
    }
    
    document.getElementById('produtos').scrollIntoView({behavior: 'smooth'});
}

// ==================== NAVEGAÇÃO E UI ====================
function navigateToCategory(cat) {
    state.currentFilter = cat;
    renderProducts();
    document.getElementById('produtos').scrollIntoView({behavior: 'smooth'});
    
    const badge = document.getElementById('activeCategoryBadge');
    const text = document.getElementById('categoryNameDisplay');
    if(badge && text) {
        badge.style.display = 'flex';
        text.textContent = cat === 'all' ? 'Todos' : cat.toUpperCase();
    }
}

function clearCategoryFilter() {
    state.currentFilter = 'all';
    renderProducts();
    document.getElementById('activeCategoryBadge').style.display = 'none';
}

function performHeaderSearch() {
    const term = document.getElementById('headerSearchInput').value.toLowerCase();
    if(term.length < 2) {
        showToast('Digite pelo menos 2 letras', 'info');
        return;
    }
    
    const filtered = state.products.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.category.toLowerCase().includes(term)
    );
    
    if(filtered.length === 0) {
        showToast('Nenhum produto encontrado', 'error');
        return;
    }
    
    // Hack: usa o filtro atual para "mascarar" a busca
    // O ideal seria ter um state.searchTerm, mas isso funciona para visualização
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = filtered.map(product => { /* ...mesmo template do renderProducts... */ 
        // Para simplificar, vamos apenas setar o filtro para 'all' e re-renderizar, 
        // mas aqui seria melhor criar uma função renderList(lista) para reuso.
        // Vou forçar a renderização manual aqui rapidinho usando o template:
        let imgUrl = Array.isArray(product.images) ? product.images[0] : product.image;
        if (!imgUrl) imgUrl = 'https://via.placeholder.com/400x500';
        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                    <img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">
                </div>
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('categoryNameDisplay').textContent = `🔍 "${term}"`;
    document.getElementById('activeCategoryBadge').style.display = 'flex';
    document.getElementById('produtos').scrollIntoView({behavior: 'smooth'});
}

function toggleSidebar() {
    document.getElementById('sidebarMenu').classList.toggle('active');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

// ==================== COMPONENTES VISUAIS ====================
const heroSlides = [
    { img: 'https://i.imgur.com/kvruQ8k.jpeg', title: 'NOVA COLEÇÃO', sub: 'Performance e Estilo' },
    { img: 'https://i.imgur.com/iapKUtF.jpeg', title: 'BLACK FRIDAY', sub: 'Até 30% OFF' }
];

function initHeroCarousel() {
    const container = document.getElementById('heroCarousel');
    if(!container) return;
    container.innerHTML = heroSlides.map((s, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image: url('${s.img}')">
            <div class="hero-content">
                <h1 class="hero-title">${s.title}</h1>
                <p>${s.sub}</p>
                <button class="hero-cta" onclick="navigateToCategory('all')">VER PRODUTOS</button>
            </div>
        </div>
    `).join('');
}

function initBlackFridayCountdown() {
    const d = document.getElementById('bfDays'); if(d) d.innerText = '11';
    const h = document.getElementById('bfHours'); if(h) h.innerText = '04';
}

function showToast(msg, type='success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    if(type === 'error') toast.style.borderLeft = '5px solid red';
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(()=>toast.remove(), 300); }, 3000);
}

// Funções de Admin/User (Mantidas as assinaturas para não quebrar onclicks do HTML)
function openUserPanel() { document.getElementById('userPanel').classList.add('active'); }
function closeUserPanel() { document.getElementById('userPanel').classList.remove('active'); }
function switchUserTab(tab) { /* Lógica de abas simples */ 
    document.querySelectorAll('.user-tab-content').forEach(c=>c.classList.remove('active'));
    document.getElementById(tab+'Tab').classList.add('active');
}
function openAdminPanel() { /* Lógica de admin */ }
function checkout() { 
    if(state.cart.length === 0) return showToast('Carrinho vazio', 'error');
    document.getElementById('paymentModal').classList.add('active');
}
function closePaymentModal() { document.getElementById('paymentModal').classList.remove('active'); }
function sendToWhatsApp() { /* Lógica do zap */ 
    alert('Enviando pedido...');
    closePaymentModal();
}
