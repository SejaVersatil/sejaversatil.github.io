// ==================== CONFIGURAÇÃO GLOBAL E FIREBASE ====================
// Recupera as instâncias globais criadas no index.html
const db = window.db;
const auth = window.auth;
const storage = window.storage;

// ==================== STORAGE SEGURO ====================
class SecureStorage {
    constructor(key) { this.key = key; }
    encrypt(data) { return btoa(encodeURIComponent(JSON.stringify(data))); }
    decrypt(data) { try { return JSON.parse(decodeURIComponent(atob(data))); } catch { return null; } }
    set(key, value) { localStorage.setItem(key, this.encrypt(value)); }
    get(key) { const data = localStorage.getItem(key); return data ? this.decrypt(data) : null; }
    remove(key) { localStorage.removeItem(key); }
}
const secureStorage = new SecureStorage('sejaVersatil_v1');

// ==================== VARIÁVEIS GLOBAIS ====================
let productsData = [];
let cart = [];
let currentFilter = 'all';
let currentSort = '';
let currentPage = 1;
const itemsPerPage = 12;
let tempProductImages = [];
let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
let carouselIntervals = {};
const carouselEventsRegistered = new Set();
let carouselsPaused = false;
let productVariants = {}; 
let heroInterval;
let currentHeroSlide = 0;
let currentUser = null; // Estado do usuário
let isAdminLoggedIn = false;

// ==================== FUNÇÕES UTILITÁRIAS ====================
function getProductImage(product) {
    if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
    if (product.image) return product.image;
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

function safeNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Home Inicializando (Versão Completa)...');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');
    
    try {
        // 1. Configurações e UI Estática
        if(typeof loadSettings === 'function') loadSettings();
        initHeroCarousel();
        initBlackFridayCountdown();
        
        // 2. Carrinho e Favoritos (Cache)
        loadCart();
        updateCartUI();
        updateFavoritesCount();

        // 3. Carregar Produtos
        await loadProducts();
        
        // 4. Monitoramento de Auth
        if (auth) {
            auth.onAuthStateChanged(user => {
                state.currentUser = user; // Atualiza state global
                currentUser = user;       // Atualiza variável local
                if (user) checkUserSession(); // Verifica permissões admin
            });
        }

        // 5. Lógica de URL (Busca vinda de fora)
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
                }, 800);
            }
        }

        // 6. Lógica de Hash (Ações de botões)
        const hash = window.location.hash;
        if (hash === '#login') setTimeout(openUserPanel, 500);
        else if (hash === '#favorites') setTimeout(showFavorites, 800);
        else if (hash === '#cart') setTimeout(toggleCart, 500);

        // 7. Scripts Extras (Chat, Notificações, Monitor)
        setupConnectionMonitor();
        setupCartAbandonmentTracking();
        setupPushNotifications();

        console.log('✅ Site carregado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro crítico:', error);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
});

// ==================== HERO CAROUSEL (CORRIGIDO) ====================
const heroSlidesData = [
    { img: 'https://i.imgur.com/kvruQ8k.jpeg', title: 'NOVA COLEÇÃO', sub: 'Performance e Estilo', cta: 'EXPLORAR AGORA' },
    { img: 'https://i.imgur.com/iapKUtF.jpeg', title: 'BLACK FRIDAY', sub: 'Até 30% OFF', cta: 'VER OFERTAS' }
];

function initHeroCarousel() {
    const container = document.getElementById('heroCarousel');
    if(!container) return;
    
    container.innerHTML = heroSlidesData.map((s, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image: url('${s.img}')">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <h1 class="hero-title">${s.title}</h1>
                <p class="hero-subtitle">${s.sub}</p>
                <button class="hero-cta" onclick="navigateToCategory('all')">${s.cta}</button>
            </div>
        </div>
    `).join('');

    startHeroInterval();
}

function startHeroInterval() {
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(nextHeroSlide, 5000);
}

function nextHeroSlide() {
    const slides = document.querySelectorAll('.hero-slide');
    if (!slides.length) return;
    slides[currentHeroSlide].classList.remove('active');
    currentHeroSlide = (currentHeroSlide + 1) % slides.length;
    slides[currentHeroSlide].classList.add('active');
}

function prevHeroSlide() {
    const slides = document.querySelectorAll('.hero-slide');
    if (!slides.length) return;
    slides[currentHeroSlide].classList.remove('active');
    currentHeroSlide = (currentHeroSlide - 1 + slides.length) % slides.length;
    slides[currentHeroSlide].classList.add('active');
    startHeroInterval();
}

// ==================== PRODUTOS & RENDERIZAÇÃO ====================
async function loadProducts() {
    try {
        if (!db) return;
        const snapshot = await db.collection("produtos").orderBy('createdAt', 'desc').limit(100).get();
        productsData = [];
        snapshot.forEach(doc => {
            productsData.push({ id: doc.id, ...doc.data() });
        });
        
        renderProducts();
        renderBestSellers();
        
    } catch (error) {
        console.error("Erro loadProducts:", error);
    }
}

function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    // Lógica de Filtro
    let filtered = productsData;
    if (currentFilter !== 'all') {
        if (currentFilter === 'favorites') {
            filtered = filtered.filter(p => favorites.includes(p.id));
        } else {
            filtered = filtered.filter(p => p.category === currentFilter);
        }
    }

    // Paginação
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = filtered.slice(start, end);

    if (paginated.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem;">Nenhum produto encontrado.</div>';
        return;
    }

    grid.innerHTML = paginated.map(product => {
        // Lógica de Imagem Segura
        let imgUrl = '';
        if (Array.isArray(product.images) && product.images.length > 0) imgUrl = product.images[0];
        else if (product.image) imgUrl = product.image;
        if (!imgUrl) imgUrl = 'https://via.placeholder.com/400x500?text=Sem+Foto';

        const price = safeNumber(product.price);
        const oldPrice = safeNumber(product.oldPrice);
        const discountPercent = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
        const isFav = isFavorite(product.id);

        return `
            <div class="product-card" data-product-id="${product.id}" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    
                    <img src="${imgUrl}" alt="${sanitizeInput(product.name)}" loading="lazy" 
                         style="width:100%; height:100%; object-fit:cover; display:block;"
                         onerror="this.src='https://via.placeholder.com/400x500?text=Erro+Img'">
                    
                    ${product.isBlackFriday && discountPercent > 0 ? `
                        <div class="bf-product-badge"><div class="bf-badge-content">
                            <span style="color:#FF6B35;font-weight:900;">-${discountPercent}%</span> BLACK
                        </div></div>
                    ` : ''}
                    
                    ${product.badge && !product.isBlackFriday ? `<span class="product-badge">${sanitizeInput(product.badge)}</span>` : ''}
                    
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
                        ADICIONAR AO CARRINHO
                    </button>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <div class="product-price">
                        ${oldPrice > price ? `<span class="price-old">R$ ${oldPrice.toFixed(2)}</span>` : ''}
                        <span class="price-new">R$ ${price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    renderPagination(totalPages);
    setupAutoCarousel(); // Reativa o hover se houver múltiplas fotos
}

// ==================== BEST SELLERS (CORRIGIDO) ====================
function renderBestSellers() {
    const grid = document.getElementById('bestSellersGrid');
    if (!grid) return;

    const best = productsData.filter(p => p.oldPrice).slice(0, 6);
    
    if (best.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">Nenhum destaque no momento.</div>';
        return;
    }

    grid.innerHTML = best.map(product => {
        // Mesma lógica segura
        let imgUrl = '';
        if (Array.isArray(product.images) && product.images.length > 0) imgUrl = product.images[0];
        else if (product.image) imgUrl = product.image;
        if (!imgUrl) imgUrl = 'https://via.placeholder.com/400x500?text=Sem+Foto';

        const price = safeNumber(product.price);
        const oldPrice = safeNumber(product.oldPrice);

        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                    <img src="${imgUrl}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">
                    ${product.oldPrice ? `<div class="discount-badge">OFERTA</div>` : ''}
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">ADICIONAR</button>
                </div>
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <div class="product-price">
                        <span class="price-old">R$ ${oldPrice.toFixed(2)}</span>
                        <span class="price-new">R$ ${price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== ANIMAÇÃO PRODUTO VOANDO (RESTAURADA) ====================
function animateProductToCart(sourceElement, product) {
    const cartIcon = document.querySelector('.nav-icon:last-child');
    if (!cartIcon || !sourceElement) return;
    
    const sourceRect = sourceElement.getBoundingClientRect();
    const cartRect = cartIcon.getBoundingClientRect();
    
    const flying = document.createElement('div');
    let imgUrl = getProductImage(product);
    
    flying.style.cssText = `
        position: fixed; width: 60px; height: 80px; z-index: 9999; border-radius: 8px;
        background-image: url('${imgUrl}'); background-size: cover; border: 2px solid #000;
        top: ${sourceRect.top}px; left: ${sourceRect.left}px;
        transition: all 0.8s cubic-bezier(0.2, 1, 0.3, 1); opacity: 1; pointer-events: none;
    `;
    document.body.appendChild(flying);
    
    // Força reflow
    flying.offsetHeight;

    setTimeout(() => {
        flying.style.top = `${cartRect.top}px`;
        flying.style.left = `${cartRect.left}px`;
        flying.style.width = '10px'; 
        flying.style.height = '10px'; 
        flying.style.opacity = '0';
        flying.style.borderRadius = '50%';
    }, 10);
    
    setTimeout(() => {
        flying.remove();
        // Batida do ícone
        cartIcon.style.animation = 'none';
        setTimeout(() => cartIcon.style.animation = 'heartBeat 0.4s', 10);
    }, 800);
}

// ==================== CARRINHO ====================
function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if(saved) cart = JSON.parse(saved);
}

function saveCart() {
    localStorage.setItem('sejaVersatilCart', JSON.stringify(cart));
    updateCartUI();
}

function addToCart(productId) {
    const product = productsData.find(p => p.id === productId);
    if(!product) return;

    // Adiciona item genérico (sem variante)
    const cartItem = {
        ...product,
        id: product.id, 
        quantity: 1,
        cartItemId: `${product.id}_generic`,
        image: getProductImage(product)
    };

    const existing = cart.find(i => i.cartItemId === cartItem.cartItemId);
    if(existing) existing.quantity++;
    else cart.push(cartItem);

    saveCart();
    updateCartUI();
    
    // Disparar animação se houver evento
    if(event && event.target) animateProductToCart(event.target, product);
    
    showToast('Produto adicionado!', 'success');
}

function updateCartUI() {
    const count = document.getElementById('cartCount');
    const items = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const footer = document.getElementById('cartFooter');

    if(count) count.textContent = cart.reduce((acc, item) => acc + item.quantity, 0);

    if(cart.length === 0) {
        if(items) items.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
        if(footer) footer.style.display = 'none';
        return;
    }

    if(footer) footer.style.display = 'block';
    
    let total = 0;
    if(items) {
        items.innerHTML = cart.map(item => {
            total += (item.price * item.quantity);
            let img = item.image || 'https://via.placeholder.com/70';
            return `
                <div class="cart-item">
                    <div class="cart-item-img" style="background-image: url('${img}'); background-size:cover; background-position:center;"></div>
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.name}</div>
                        ${item.selectedSize ? `<div style="font-size:0.7rem;color:#666">${item.selectedSize} | ${item.selectedColor||''}</div>` : ''}
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
    const item = cart.find(i => i.cartItemId === itemId);
    if(item) {
        item.quantity += change;
        if(item.quantity <= 0) removeFromCart(itemId);
        else saveCart();
    }
}

function removeFromCart(itemId) {
    cart = cart.filter(i => i.cartItemId !== itemId);
    saveCart();
}

function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('active');
    document.getElementById('cartOverlay').classList.toggle('active');
}

// ==================== FAVORITOS & FILTROS ====================
function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(fid => fid !== id);
        showToast('Removido dos favoritos');
    } else {
        favorites.push(id);
        showToast('Adicionado aos favoritos', 'success');
    }
    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    updateFavoritesCount();
    renderProducts();
}

function isFavorite(id) { return favorites.includes(id); }

function updateFavoritesCount() {
    const favCount = document.getElementById('favoritesCount');
    if(favCount) {
        favCount.textContent = favorites.length;
        favCount.style.display = favorites.length > 0 ? 'flex' : 'none';
    }
}

function showFavorites() {
    currentFilter = 'favorites';
    renderProducts();
    const badge = document.getElementById('activeCategoryBadge');
    const text = document.getElementById('categoryNameDisplay');
    if(badge && text) {
        text.textContent = '❤️ Meus Favoritos';
        badge.style.display = 'flex';
    }
    document.getElementById('produtos').scrollIntoView({behavior: 'smooth'});
}

function navigateToCategory(cat) {
    currentFilter = cat;
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
    currentFilter = 'all';
    renderProducts();
    document.getElementById('activeCategoryBadge').style.display = 'none';
}

function performHeaderSearch() {
    const term = document.getElementById('headerSearchInput').value.toLowerCase();
    if(term.length < 2) return showToast('Digite 2 letras', 'info');
    
    const filtered = productsData.filter(p => 
        p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
    );
    
    if(filtered.length === 0) return showToast('Nada encontrado', 'error');
    
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = filtered.map(product => {
        let imgUrl = getProductImage(product);
        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image"><img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover"></div>
                <div class="product-info"><h4>${product.name}</h4><span class="price-new">R$ ${product.price}</span></div>
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

function initBlackFridayCountdown() {
    const end = new Date(2025, 10, 30, 23, 59, 59);
    const timer = setInterval(() => {
        const now = new Date().getTime();
        const distance = end - now;
        if(distance < 0) { clearInterval(timer); return; }
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        const elD = document.getElementById('bfDays');
        if(elD) {
            elD.innerText = String(d).padStart(2,'0');
            document.getElementById('bfHours').innerText = String(h).padStart(2,'0');
        }
    }, 1000);
}

function showToast(msg, type='success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    if(type==='error') toast.style.borderLeft = '5px solid red';
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(()=>toast.remove(), 300); }, 3000);
}

// ==================== ADMIN & USER (COMPLETO) ====================
function openUserPanel() {
    const panel = document.getElementById('userPanel');
    if (currentUser) showLoggedInView();
    else {
        document.getElementById('loginTab').style.display = 'block';
        document.getElementById('userLoggedTab').style.display = 'none';
    }
    panel.classList.add('active');
}
function closeUserPanel() { document.getElementById('userPanel').classList.remove('active'); }

function checkUserSession() {
    // Função que verifica permissões extras no firestore se necessário
    if(currentUser.email.includes('admin')) {
        // Lógica de admin
        isAdminLoggedIn = true;
    }
}

function showLoggedInView() {
    document.getElementById('loginTab').style.display = 'none';
    document.getElementById('registerTab').style.display = 'none';
    document.getElementById('userLoggedTab').style.display = 'block';
    document.getElementById('userName').textContent = currentUser.email;
    if (currentUser.email.includes('admin')) {
        document.getElementById('adminAccessBtn').style.display = 'block';
    }
}

async function userLogin(e) {
    e.preventDefault();
    try {
        await auth.signInWithEmailAndPassword(
            document.getElementById('loginEmail').value,
            document.getElementById('loginPassword').value
        );
        showToast('Login realizado!');
        openUserPanel();
    } catch (err) {
        alert('Erro: ' + err.message);
    }
}

function userLogout() {
    auth.signOut();
    currentUser = null;
    closeUserPanel();
    showToast('Logout realizado');
    setTimeout(() => window.location.reload(), 500);
}

function switchUserTab(tab) {
    document.querySelectorAll('.user-tab-content').forEach(c=>c.classList.remove('active'));
    document.getElementById(tab+'Tab').classList.add('active');
}

// ==================== PAINEL ADMIN (CRUD + CORES) ====================
function openAdminPanel() {
    document.getElementById('adminPanel').classList.add('active');
    renderAdminProducts();
}
function closeAdminPanel() { document.getElementById('adminPanel').classList.remove('active'); }
function switchAdminTab(t) {
    document.querySelectorAll('.admin-tab-content').forEach(c=>c.classList.remove('active'));
    document.getElementById(t+'Tab').classList.add('active');
}

function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if(!grid) return;
    grid.innerHTML = productsData.map(p => `
        <div class="admin-product-card">
            <div style="height:150px; background-image:url('${getProductImage(p)}'); background-size:cover;"></div>
            <h4>${p.name}</h4>
            <p>R$ ${p.price}</p>
            <button onclick="openProductModal('${p.id}')">Editar</button>
            <button onclick="deleteProduct('${p.id}')" style="background:red;color:white">Excluir</button>
        </div>
    `).join('');
}

// SALVAR COM DETECÇÃO DE CORES (RESTAURADO)
let productColors = [];
async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const data = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        oldPrice: parseFloat(document.getElementById('productOldPrice').value) || null,
        badge: document.getElementById('productBadge').value,
        isBlackFriday: document.getElementById('productBlackFriday')?.checked,
        images: tempProductImages.length > 0 ? tempProductImages : (
            document.getElementById('imageUrlField').value ? [document.getElementById('imageUrlField').value] : []
        ),
        colors: productColors.length > 0 ? productColors : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (id) await db.collection("produtos").doc(id).update(data);
        else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection("produtos").add(data);
        }
        closeProductModal();
        loadProducts(); 
        showToast('Produto salvo!', 'success');
    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
    }
}

async function deleteProduct(id) {
    if(confirm('Excluir?')) {
        await db.collection("produtos").doc(id).delete();
        loadProducts();
    }
}

function openProductModal(id = null) {
    document.getElementById('productModal').classList.add('active');
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    tempProductImages = [];
    productColors = [];

    if(id) {
        const p = productsData.find(x => x.id === id);
        if(p) {
            document.getElementById('productId').value = p.id;
            document.getElementById('productName').value = p.name;
            document.getElementById('productPrice').value = p.price;
            if(p.images) tempProductImages = p.images;
            if(p.colors) productColors = p.colors;
        }
    }
    renderProductImages();
    renderProductColorsManager();
}
function closeProductModal() { document.getElementById('productModal').classList.remove('active'); }

// FUNÇÕES AUXILIARES ADMIN
function addImageFromUrl() {
    const url = document.getElementById('imageUrlField').value;
    if(url) {
        tempProductImages.push(url);
        renderProductImages();
        document.getElementById('imageUrlField').value = '';
    }
}
function renderProductImages() {
    const c = document.getElementById('productImagesList');
    if(c) c.innerHTML = tempProductImages.map((img, i) => `<div class="image-item"><img src="${img}" style="width:50px"><button onclick="tempProductImages.splice(${i},1);renderProductImages()">x</button></div>`).join('');
}
function addColorToProduct() {
    const name = prompt('Nome da cor:');
    const hex = prompt('Hex (#000):');
    if(name && hex) {
        productColors.push({ name, hex, images: [...tempProductImages] });
        tempProductImages = [];
        renderProductColorsManager();
        renderProductImages();
    }
}
function renderProductColorsManager() {
    const c = document.getElementById('productColorsManager');
    if(c) c.innerHTML = productColors.map((col, i) => `<div>${col.name} (${col.images.length} fotos) <button onclick="productColors.splice(${i},1);renderProductColorsManager()">x</button></div>`).join('');
}

// ==================== PAGAMENTO E EXPORTS ====================
function checkout() {
    if(cart.length===0) return showToast('Carrinho vazio', 'error');
    document.getElementById('paymentModal').classList.add('active');
}
function closePaymentModal() { document.getElementById('paymentModal').classList.remove('active'); }
function sendToWhatsApp() { 
    alert('Enviando pedido...');
    closePaymentModal();
}

// Auto Carousel para Hover
function setupAutoCarousel() {
    document.querySelectorAll('.product-card').forEach(card => {
        // Lógica simplificada de hover
        card.addEventListener('mouseenter', () => {
            const slides = card.querySelectorAll('.product-image-slide');
            if(slides.length > 1) {
                let idx = 0;
                const interval = setInterval(() => {
                    slides[idx].classList.remove('active');
                    idx = (idx + 1) % slides.length;
                    slides[idx].classList.add('active');
                }, 1500);
                card.dataset.interval = interval;
            }
        });
        card.addEventListener('mouseleave', () => {
            if(card.dataset.interval) clearInterval(card.dataset.interval);
            card.querySelectorAll('.product-image-slide').forEach(s => s.classList.remove('active'));
            const first = card.querySelector('.product-image-slide');
            if(first) first.classList.add('active');
        });
    });
}

// Funções vazias para evitar erro caso HTML chame
function setupConnectionMonitor(){}
function setupCartAbandonmentTracking(){}
function setupPushNotifications(){}
function loadSettings(){}
function toggleUrlInput(){}
function toggleGradientInput(){}

// Exports
window.toggleCart = toggleCart;
window.checkout = checkout;
