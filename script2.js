// ====================================================================================
// ARQUIVO: main.js
// DESCRIÇÃO: Script principal para a página inicial (index.html) e funcionalidades globais.
// ====================================================================================

// ==================== VARIÁVEIS GLOBAIS ====================
let productsData = []; // Armazena todos os produtos carregados
let cart = []; // Carrinho de compras
let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]'); // Favoritos
let currentFilter = 'all'; // Filtro de categoria ativo
let currentPage = 1; // Página atual da paginação
const itemsPerPage = 12; // Itens por página
let carouselIntervals = {}; // Controle de carrosséis de produtos
let carouselEventsRegistered = new Set(); // Previne múltiplos listeners
let carouselsPaused = false; // Estado de pausa do carrossel
let isInternalNavigation = false; // Flag para navegação interna (previne alerta de abandono)

// Variáveis de Cupom
let appliedCoupon = null;
let couponDiscount =// Variáveis de Usuário/Admin
// Variáveis movidas para o topo do arquivo para melhor organização.
// Configurações (simuladas)
const WHATSAPP_NUMBER = '5511999999999'; // Número de WhatsApp para pedidos

// ==================== FIREBASE (SIMULAÇÃO) - REMOVIDO PARA REINTRODUÇÃO REAL ====================
// **NOTA:** As funções Firebase (db, auth, storage) serão reintroduzidas no HTML.
// e permitir que o código seja executado em um ambiente com Firebase configurado.
// Em um ambiente real, o SDK do Firebase deve ser inicializado no HTML.
// Variáveis globais do Firebase (serão inicializadas no HTML)
let db;
let auth;
let storage;

// Variáveis de Estado de Autenticação
let currentUser = JSON.parse(localStorage.getItem('sejaVersatilCurrentUser') || 'null');
let isAdminLoggedIn = currentUser && currentUser.isAdmin;

// ==================== FIREBASE (SIMULAÇÃO) - REMOVIDO PARA REINTRODUÇÃO REAL ====================
    firestore: {
        FieldValue: {
            serverTimestamp: () => ({ type: 'serverTimestamp' }),
            increment: (value) => ({ type: 'increment', value })
        },
        Timestamp: {
            fromDate: (date) => ({ type: 'timestamp', date })
        }
    },
    auth: {
        currentUser: { uid: 'simulated-uid', email: 'admin@example.com', displayName: 'Admin' },
        signOut: async () => { console.log('Simulated signOut'); },
        signInWithEmailAndPassword: async (email, password) => {
            if (email === 'admin@example.com' && password === 'admin123') {
                return { user: { uid: 'simulated-uid', email: 'admin@example.com', emailVerified: true } };
            }
            throw new Error('auth/user-not-found');
        },
        createUserWithEmailAndPassword: async () => { throw new Error('auth/email-already-in-use'); },
        sendEmailVerification: async () => { console.log('Simulated sendEmailVerification'); },
        updateProfile: async () => { console.log('Simulated updateProfile'); },
        sendPasswordResetEmail: async () => { console.log('Simulated sendPasswordResetEmail'); },
        GoogleAuthProvider: function() {
            this.setCustomParameters = () => {};
        },
        signInWithPopup: async () => { throw new Error('auth/popup-blocked'); },
        signInWithRedirect: async () => { console.log('Simulated signInWithRedirect'); }
    },
    // Simulação de Firestore
    db: {
        collection: (name) => ({
            doc: (id) => ({
                get: async () => ({ exists: id === 'simulated-uid', data: () => ({ role: 'admin', permissions: ['all'] }) }),
                set: async () => { console.log(`Simulated set on ${name}/${id}`); },
                update: async () => { console.log(`Simulated update on ${name}/${id}`); },
                delete: async () => { console.log(`Simulated delete on ${name}/${id}`); },
                collection: (subName) => ({
                    get: async () => ({ docs: [] }),
                    doc: () => ({ set: async () => {} })
                })
            }),
            get: async () => ({ empty: true, docs: [] }),
            add: async () => ({ id: 'new-id' })
        }),
        runTransaction: async (callback) => { await callback({ get: async () => ({ exists: true, data: () => ({ usedCount: 0 }) }), update: async () => {}, set: async () => {} }); }
    },
    storage: {
        ref: () => ({ child: () => ({ put: async () => {}, getDownloadURL: async () => 'simulated-url' }), refFromURL: () => ({ delete: async () => {} }) }
    }
};
// Variáveis de Estado de Autenticação
// let currentUser = JSON.parse(localStorage.getItem('sejaVersatilCurrentUser') || 'null');
// let isAdminLoggedIn = currentUser && currentUser.isAdmin;

// As variáveis db, auth e storage serão definidas no HTML.
// ==================== FIM FIREBASE SIMULAÇÃO ====================

// ==================== CLASSES DE OTIMIZAÇÃO ====================

// Cache Manager (para produtos)
class CacheManager {
    constructor(ttl = 300000) { // 5 minutos de TTL
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
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
    
    clear() {
        this.cache.clear();
    }
}

const productCache = new CacheManager();

// ==================== FUNÇÕES UTILITÁRIAS ====================

// Sanitização de Input (XSS)
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = input;
    
    return div.innerHTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Validação de Email
function validateEmail(email) {
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-9])?)*$/;
    
    if (!re.test(email.trim().toLowerCase())) {
        return false;
    }
    
    // Validar domínios suspeitos (temporários)
    const suspiciousDomains = ['tempmail', 'throwaway', '10minutemail', 'guerrillamail'];
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (suspiciousDomains.some(sus => domain?.includes(sus))) {
        showToast('⚠️ Use um email permanente', 'error');
        return false;
    }
    
    return true;
}

// Validação de Dados do Produto (Admin)
function validateProductData(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length < 3) {
        errors.push('Nome deve ter pelo menos 3 caracteres');
    }
    if (data.name && data.name.length > 100) {
        errors.push('Nome deve ter no máximo 100 caracteres');
    }
    
    if (!data.price || data.price <= 0) {
        errors.push('Preço deve ser maior que zero');
    }
    
    if (data.oldPrice && data.oldPrice <= data.price) {
        errors.push('Preço antigo deve ser maior que o preço atual');
    }
    
    if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
        errors.push('Produto deve ter pelo menos 1 imagem');
    }
    
    const validCategories = ['blusas', 'conjunto calca', 'peca unica', 'conjunto short saia', 'conjunto short'];
    if (!data.category || !validCategories.includes(data.category)) {
        errors.push('Categoria inválida');
    }
    
    return errors;
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Event Tracking (Google Analytics Simulado)
function trackEvent(category, action, label) {
    console.log(`📊 Event: ${category} - ${action} - ${label}`);
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            event_category: category,
            event_label: label
        });
    }
}

// ==================== PRODUTOS E DADOS ====================

// Produtos Padrão (Fallback)
const DEFAULT_PRODUCTS = [
    { id: 'p1', name: 'Blusa Fitness Sem Costura', category: 'blusas', price: 89.90, oldPrice: null, badge: 'Novo', images: ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'] },
    { id: 'p2', name: 'Blusa Regata Essential', category: 'blusas', price: 69.90, oldPrice: 89.90, badge: '-22%', images: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'] },
    { id: 'p3', name: 'Conjunto Calça High Waist', category: 'conjunto calca', price: 209.90, oldPrice: 299.90, badge: '-30%', images: ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'] },
    { id: 'p4', name: 'Peça Única Fitness Premium', category: 'peca unica', price: 149.90, oldPrice: 189.90, badge: 'Novo', images: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'] },
];

// Carregar produtos do Firestore (Simulado)
async function carregarProdutosDoFirestore() {
        // Implementação real com Firestore
    try {
        const snapshot = await db.collection('produtos').get();
        productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ ${productsData.length} produtos carregados do Firestore.`);
        
        // Carregar variantes para simulação de estoque
        for (const product of productsData) {
            const variantSnapshot = await db.collection('produtos').doc(product.id).collection('variants').get();
            productVariants[product.id] = variantSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
        if (productsData.length === 0) {
            console.warn('Nenhum produto no Firestore. Usando produtos padrão.');
            productsData = DEFAULT_PRODUCTS;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar produtos do Firestore:', error);
        showToast('Erro ao carregar produtos. Usando dados de demonstração.', 'error');
        productsData = DEFAULT_PRODUCTS;
    }
}

// ==================== CARRINHO E FAVORITOS ====================

function saveCart() {
    try {
        const cartData = {
            items: cart || [],
            appliedCoupon: appliedCoupon || null,
            couponDiscount: couponDiscount || 0
        };
        localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
        console.log(' Carrinho salvo:', cart.length, 'itens');
    } catch (err) {
        console.warn(' Erro ao salvar carrinho:', err);
    }
}

function loadCart() {
    try {
        const cartData = JSON.parse(localStorage.getItem('sejaVersatilCart') || '{"items":[]}');
        cart = cartData.items || [];
        appliedCoupon = cartData.appliedCoupon || null;
        couponDiscount = cartData.couponDiscount || 0;
        console.log(' Carrinho carregado:', cart.length, 'itens');
    } catch (err) {
        console.warn(' Erro ao carregar carrinho:', err);
        cart = [];
        appliedCoupon = null;
        couponDiscount = 0;
    }
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    requestAnimationFrame(() => {
        if (cartCount) {
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }
        
        if (!cartItems || !cartFooter) return;

        if (cart.length === 0) {
            cartItems.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
            cartFooter.style.display = 'none';
        } else {
            const fragment = document.createDocumentFragment();
    
            cart.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'cart-item';
                
                const itemImage = item.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                const isRealImage = itemImage.startsWith('data:image') || itemImage.startsWith('http');
                
                itemDiv.innerHTML = `
                    <div class="cart-item-img" style="${isRealImage ? `background-image: url(${itemImage}); background-size: cover; background-position: center;` : `background: ${itemImage}`}"></div>
                    <div class="cart-item-info">
                        <div class="cart-item-title">${sanitizeInput(item.name)}</div>
                        
                        ${item.selectedSize || item.selectedColor ? `
                            <div style="font-size: 0.75rem; color: #666; margin-top: 0.3rem;">
                                ${item.selectedSize ? `Tamanho: <strong>${sanitizeInput(item.selectedSize)}</strong>` : ''}
                                ${item.selectedSize && item.selectedColor ? ' | ' : ''}
                                ${item.selectedColor ? `Cor: <strong>${sanitizeInput(item.selectedColor)}</strong>` : ''}
                            </div>
                        ` : ''}
                        
                        <div class="cart-item-price">R$ ${item.price.toFixed(2)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="updateQuantity('${item.cartItemId || item.id}', -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="updateQuantity('${item.cartItemId || item.id}', 1)">+</button>
                        </div>
                        <div class="remove-item" onclick="removeFromCart('${item.cartItemId || item.id}')">Remover</div>
                    </div>
                `;
                
                fragment.appendChild(itemDiv);
            });
            
            cartItems.innerHTML = '';
            cartItems.appendChild(fragment);

            const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
            const discount = Math.min(couponDiscount || 0, subtotal);
            const total = Math.max(0, subtotal - discount);
            
            const cartSubtotalEl = document.getElementById('cartSubtotal');
            const discountBreakdownEl = document.getElementById('discountBreakdown');
            const discountValueEl = document.getElementById('discountValue');
            const cartTotalEl = document.getElementById('cartTotal');
            
            if (cartSubtotalEl) cartSubtotalEl.textContent = `R$ ${subtotal.toFixed(2)}`;
            if (cartTotalEl) cartTotalEl.textContent = `R$ ${total.toFixed(2)}`;
            
            if (discount > 0 && discountBreakdownEl && discountValueEl) {
                discountBreakdownEl.style.display = 'flex';
                discountValueEl.textContent = `- R$ ${discount.toFixed(2)}`;
            } else if (discountBreakdownEl) {
                discountBreakdownEl.style.display = 'none';
            }
            
            cartFooter.style.display = 'block';
        }
    });
}

function updateQuantity(cartItemId, change) {
    const item = cart.find(i => {
        const itemId = i.cartItemId || i.id;
        return itemId === cartItemId;
    });
    
    if (!item) return;
    item.quantity = (item.quantity || 1) + change;
    
    if (item.quantity <= 0) {
        removeFromCart(cartItemId);
    } else {
        // Lógica de recalcular cupom (simplificada)
        if (appliedCoupon && couponDiscount > 0) {
            const newSubtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            
            if (appliedCoupon.minValue && newSubtotal < appliedCoupon.minValue) {
                removeCoupon();
                showToast(`❌ Cupom removido: valor mínimo R$ ${appliedCoupon.minValue.toFixed(2)}`, 'error');
            } else {
                let newDiscount = 0;
                if (appliedCoupon.type === 'percentage') {
                    newDiscount = (newSubtotal * appliedCoupon.value) / 100;
                    if (appliedCoupon.maxDiscount && newDiscount > appliedCoupon.maxDiscount) {
                        newDiscount = appliedCoupon.maxDiscount;
                    }
                } else if (appliedCoupon.type === 'fixed') {
                    newDiscount = appliedCoupon.value;
                }
                if (newDiscount > newSubtotal) {
                    newDiscount = newSubtotal;
                }
                couponDiscount = newDiscount;
            }
        }
        
        saveCart();
        updateCartUI();
    }
}

function removeFromCart(identifier) {
    const lengthBefore = cart.length;
    
    cart = cart.filter(item => {
        const itemId = item.cartItemId || item.id;
        return itemId !== identifier;
    });
    
    if (lengthBefore === cart.length) {
        showToast('Item não encontrado para remover', 'error');
        return;
    }
    
    if (cart.length === 0 && appliedCoupon) {
        removeCoupon();
    }
    
    saveCart();
    updateCartUI();
    showToast('Item removido do carrinho', 'info');
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('💔 Removido dos favoritos', 'info');
    } else {
        favorites.push(productId);
        showToast('❤️ Adicionado aos favoritos', 'success');
    }
    
   localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
   updateFavoritesCount();
   renderProducts(); // Atualiza o visual do botão
   trackEvent('Favorites', index > -1 ? 'Remove' : 'Add', productId);
}

function isFavorite(productId) {
    return favorites.includes(productId);
}

function updateFavoritesCount() {
    const favCount = document.getElementById('favoritesCount');
    const totalFavorites = favorites.length;
    
    if (favCount) {
        favCount.textContent = totalFavorites;
        favCount.style.display = totalFavorites > 0 ? 'flex' : 'none';
    }
}

// ==================== RENDERIZAÇÃO DE PRODUTOS ====================

function getFilteredProducts() {
    let filtered = productsData;
    
    if (currentFilter === 'favorites') {
        filtered = productsData.filter(p => favorites.includes(p.id));
    } else if (currentFilter !== 'all') {
        filtered = productsData.filter(p => p.category === currentFilter);
    }
    
    // Simulação de busca
    const searchInput = document.getElementById('headerSearchInput');
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    if (searchQuery) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchQuery) || 
            p.category.toLowerCase().includes(searchQuery)
        );
    }
    
    return filtered;
}

function getCategoryName(filter) {
    if (filter === 'favorites') return 'Meus Favoritos';
    if (filter === 'sale') return 'Promoções';
    return filter.charAt(0).toUpperCase() + filter.slice(1).replace(/-/g, ' ');
}

function renderProducts() {
    // Funções de carrossel (simplificadas para evitar dependências complexas)
    clearCarouselIntervals(); 
    
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');

    if (currentFilter !== 'all') {
        let label = getCategoryName(currentFilter);
        if (categoryName) categoryName.textContent = label;
        if (badge) badge.style.display = 'flex';
    } else {
        if (badge && categoryName && !categoryName.textContent.includes('resultados')) {
            badge.style.display = 'none';
        }
    }
    
    const filtered = getFilteredProducts();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedProducts = filtered.slice(start, end);
    
    const grid = document.getElementById('productsGrid');
    
    if (!grid) {
        console.error('Elemento #productsGrid não encontrado');
        return;
    }
    
    if (paginatedProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #666;">
                    Nenhum produto encontrado
                </h3>
                <p style="color: #999; margin-bottom: 2rem;">
                    Não encontramos produtos para: <strong>${getCategoryName(currentFilter)}</strong>
                </p>
                <button onclick="clearCategoryFilter()" style="background: var(--primary); color: white; border: none; padding: 1rem 2rem; font-weight: 600; cursor: pointer; border-radius: 50px;">
                    Ver Todos os Produtos
                </button>
            </div>
        `;
        renderPagination(0);
        return;
    }
    
    grid.innerHTML = paginatedProducts.map(product => {
        let images = product.images && Array.isArray(product.images) && product.images.length > 0
            ? product.images
            : (product.image ? [product.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);
        
        const hasMultipleImages = images.length > 1;
        const isFav = isFavorite(product.id);
        const discountPercent = product.oldPrice ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;
        
        return `
            <div class="product-card" data-product-id="${product.id}" onclick="isInternalNavigation = true; openProductDetails('${product.id}')">
                <div class="product-image">
                    <!-- Favorite Button -->
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')" 
                            aria-label="Adicionar aos favoritos">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                    
                    <!-- Badges -->
                    ${product.isBlackFriday && discountPercent > 0 ? `<div class="bf-product-badge">...</div>` : ''}
                    ${product.badge && !product.isBlackFriday && discountPercent === 0 ? `<div class="product-badge">${sanitizeInput(product.badge)}</div>` : ''}
                    ${discountPercent > 0 && !product.isBlackFriday ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
                    
                    <!-- Image Carousel -->
                    <div class="product-image-carousel">
                        ${images.map((img, index) => {
                            const isRealImage = img.startsWith('data:image') || img.startsWith('http');
                            return `
                                <div class="product-image-slide ${index === 0 ? 'active' : ''}" 
                                     style="${isRealImage ? `background-image: url('${img}')` : `background: ${img}`}">
                                    ${isRealImage ? `<img src="${img}" alt="${sanitizeInput(product.name)}" loading="lazy" decoding="async">` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <!-- Navigation Arrows (only if multiple images) -->
                    ${hasMultipleImages ? `
                        <div class="product-carousel-arrows">
                            <button class="product-carousel-arrow" 
                                    onclick="event.stopPropagation(); prevProductImage('${product.id}', event)" 
                                    aria-label="Imagem anterior">‹</button>
                            <button class="product-carousel-arrow" 
                                    onclick="event.stopPropagation(); nextProductImage('${product.id}', event)" 
                                    aria-label="Próxima imagem">›</button>
                        </div>
                        
                        <!-- Carousel Dots -->
                        <div class="product-carousel-dots">
                            ${images.map((_, index) => `
                                <div class="product-carousel-dot ${index === 0 ? 'active' : ''}" 
                                     onclick="event.stopPropagation(); goToProductImage('${product.id}', ${index}, event)"></div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Product Info -->
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <div class="product-price">
                        ${product.oldPrice ? `<span class="price-old">De R$ ${product.oldPrice.toFixed(2)}</span>` : ''}
                        <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    setupAutoCarousel();
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Botão Anterior
    paginationHTML += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>`;
    
    // Números de página (simplificado)
    for (let i = 1; i <= totalPages; i++) {
        paginationHTML += `<button onclick="changePage(${i})" class="${i === currentPage ? 'active' : ''}">${i}</button>`;
    }
    
    // Botão Próximo
    paginationHTML += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Próximo</button>`;
    
    paginationContainer.innerHTML = paginationHTML;
}

function changePage(newPage) {
    const filtered = getFilteredProducts();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderProducts();
        scrollToProducts();
    }
}

function scrollToProducts() {
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function setCategoryFilter(category) {
    currentFilter = category;
    currentPage = 1;
    renderProducts();
    scrollToProducts();
}

function clearCategoryFilter() {
    currentFilter = 'all';
    currentPage = 1;
    document.getElementById('headerSearchInput').value = '';
    renderProducts();
    scrollToProducts();
}

function showFavorites() {
    if (favorites.length === 0) {
        showToast('Você ainda não tem favoritos', 'info');
        return;
    }
    setCategoryFilter('favorites');
}

// ==================== CARROSSEL DE PRODUTOS (SIMPLIFICADO) ====================

function clearCarouselIntervals() {
    Object.values(carouselIntervals).forEach(clearInterval);
    carouselIntervals = {};
    carouselEventsRegistered.clear();
}

function updateCarouselSlides(card, newIndex) {
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    
    slides.forEach((slide, i) => slide.classList.toggle('active', i === newIndex));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === newIndex));
}

function setupAutoCarousel() {
    if (carouselsPaused) return;
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const productId = card.getAttribute('data-product-id');
        const slides = card.querySelectorAll('.product-image-slide');
        
        if (slides.length <= 1) return;
        
        if (carouselEventsRegistered.has(productId)) return;
        carouselEventsRegistered.add(productId);
        
        let currentSlideIndex = 0;
        
        const handleMouseEnter = () => {
            if (carouselsPaused) return;
            if (carouselIntervals[productId]) clearInterval(carouselIntervals[productId]);
            
            carouselIntervals[productId] = setInterval(() => {
                const cardSlides = card.querySelectorAll('.product-image-slide');
                currentSlideIndex = (currentSlideIndex + 1) % cardSlides.length;
                updateCarouselSlides(card, currentSlideIndex);
            }, 1500);
        };
        
        const handleMouseLeave = () => {
            clearInterval(carouselIntervals[productId]);
            delete carouselIntervals[productId];
            // Volta para a primeira imagem ao sair
            updateCarouselSlides(card, 0);
            currentSlideIndex = 0;
        };
        
        card.addEventListener('mouseenter', handleMouseEnter);
        card.addEventListener('mouseleave', handleMouseLeave);
    });
}

function nextProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    const slides = card.querySelectorAll('.product-image-slide');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    
    let newIndex = (currentIndex + 1) % slides.length;
    updateCarouselSlides(card, newIndex);
}

function prevProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    const slides = card.querySelectorAll('.product-image-slide');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    
    let newIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarouselSlides(card, newIndex);
}

function goToProductImage(productId, index, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    updateCarouselSlides(card, index);
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
    
    try {
        console.log('🚀 Iniciando carregamento do site...');
        
        await carregarProdutosDoFirestore();
        loadCart();
        
        // Verifica URL para favoritos
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ver_favoritos') === 'true') {
            setTimeout(() => {
                showFavorites();
                window.history.replaceState({}, document.title, "index.html");
            }, 500);
        }
        
        // Renderiza tudo
        renderProducts();
        updateCartUI();
        updateFavoritesCount();
        
        // Inicializa listeners de busca
        setupSearchListeners();
        
        // Inicializa monitoramento de conexão e abandono de carrinho
        setupConnectionMonitor();
        setupCartAbandonmentTracking();
        
        console.log('✅ Site carregado com sucesso!');
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao inicializar:', error);
        showToast('Erro ao carregar o site. Recarregue a página.', 'error');
        
    } finally {
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }
});

// ==================== BUSCA INTELIGENTE (LIVE SEARCH) ====================

function setupSearchListeners() {
    const searchInput = document.getElementById('headerSearchInput');
    const dropdown = document.getElementById('headerDropdown');

    if (!searchInput || !dropdown) return;

    let timeout = null;

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        
        clearTimeout(timeout);

        if (query.length < 2) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }

        timeout = setTimeout(() => {
            const filteredProducts = productsData.filter(product => 
                product.name.toLowerCase().includes(query) || 
                product.category.toLowerCase().includes(query)
            );

            renderDropdownResults(filteredProducts);
        }, 300);
    });

    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function renderDropdownResults(products) {
    const dropdown = document.getElementById('headerDropdown');
    
    if (products.length === 0) {
        dropdown.innerHTML = `
            <div style="padding: 1rem; text-align: center; color: #999; font-size: 0.9rem;">
                Nenhum produto encontrado 😕
            </div>`;
        dropdown.classList.add('active');
        return;
    }

    const topProducts = products.slice(0, 6);

    dropdown.innerHTML = topProducts.map(product => {
        let imageUrl = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        if (Array.isArray(product.images) && product.images.length > 0) {
            imageUrl = product.images[0];
        } else if (product.image) {
            imageUrl = product.image;
        }

        const isRealImg = imageUrl.startsWith('http') || imageUrl.startsWith('data:image');
        const imgStyle = isRealImg 
            ? `background-image: url('${imageUrl}'); background-size: cover; background-position: center;` 
            : `background: ${imageUrl};`;

        return `
            <div class="search-dropdown-item" onclick="openProductDetails('${product.id}'); document.getElementById('headerDropdown').classList.remove('active');">
                <div class="search-dropdown-thumb" style="${imgStyle}"></div>
                <div class="search-dropdown-info">
                    <div class="search-dropdown-title">${product.name}</div>
                    <div class="search-dropdown-price">R$ ${product.price.toFixed(2)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    if (products.length > 6) {
        dropdown.innerHTML += `
            <div class="search-dropdown-item" style="justify-content: center; color: var(--primary); font-weight: bold;" onclick="performHeaderSearch()">
                Ver todos os ${products.length} resultados
            </div>
        `;
    }

    dropdown.classList.add('active');
}

function performHeaderSearch() {
    const searchInput = document.getElementById('headerSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    if (query) {
        currentFilter = 'all'; // Mantém o filtro 'all' mas aplica a busca
        currentPage = 1;
        renderProducts();
        scrollToProducts();
        
        const categoryName = document.getElementById('categoryNameDisplay');
        const badge = document.getElementById('activeCategoryBadge');
        if (categoryName) categoryName.textContent = `Resultados para "${query}"`;
        if (badge) badge.style.display = 'flex';
    }
    document.getElementById('headerDropdown').classList.remove('active');
}

// ==================== CHECKOUT E WHATSAPP ====================

function checkout() {
    if (cart.length === 0) {
        showToast('Seu carrinho está vazio!', 'error');
        return;
    }
    // Simulação de abertura de modal de pagamento
    openPaymentModal();
}

function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.add('active');
        // Simulação de renderização de opções de pagamento
        const installmentsBox = document.getElementById('installmentsBox');
        if (installmentsBox) installmentsBox.style.display = 'none';
        
        document.querySelectorAll('input[name="paymentMethod"]').forEach(input => {
            input.addEventListener('change', function() {
                if (this.value === 'credito-parcelado') {
                    installmentsBox.style.display = 'block';
                } else {
                    installmentsBox.style.display = 'none';
                }
            });
        });
    }
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function sendToWhatsApp() {
    if (!cart.length) {
        showToast('Carrinho vazio!', 'error');
        return;
    }

    // 1. COLETA DE DADOS DO CLIENTE (Simplificado para o escopo)
    let customerData = { name: 'Cliente Visitante', email: 'nao-informado@email.com', phone: 'Não informado', cpf: 'Não informado' };
    
    // 2. PREPARAÇÃO DOS DADOS DO PEDIDO
    const paymentInput = document.querySelector('input[name="paymentMethod"]:checked');
    if (!paymentInput) {
        showToast('Selecione uma forma de pagamento', 'error');
        return;
    }
    
    const paymentMethod = paymentInput.value;
    const installmentsEl = document.getElementById('installments');
    const installments = installmentsEl ? installmentsEl.value : '1';
    
    const paymentMethodsMap = {
        'pix': 'PIX',
        'boleto': 'Boleto Bancário',
        'credito-avista': 'Cartão de Crédito à Vista',
        'credito-parcelado': `Cartão de Crédito Parcelado em ${installments}x sem juros`
    };
    
    const paymentText = paymentMethodsMap[paymentMethod] || paymentMethod;
    const subtotal = cart.reduce((s, it) => s + ((it.price || 0) * (it.quantity || 0)), 0);
    const total = Math.max(0, subtotal - (couponDiscount || 0));

    // 3. MONTAGEM DA MENSAGEM
    let msg = `*🛍️ NOVO PEDIDO - SEJA VERSÁTIL*\n`;
    msg += `*Cliente:* ${customerData.name}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `* PRODUTOS:*\n`;
    
    cart.forEach((item, index) => {
        msg += `${index+1}. *${item.name}*\n`;
        if (item.selectedSize || item.selectedColor) {
            msg += `   📏 Tam: ${item.selectedSize || '-'} | 🎨 Cor: ${item.selectedColor || '-'}\n`;
        }
        msg += `   QTD: ${item.quantity} x R$ ${item.price.toFixed(2)}\n`;
        msg += `   Subtotal: R$ ${(item.price * item.quantity).toFixed(2)}\n\n`;
    });

    if (appliedCoupon && couponDiscount > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `🎟️ *CUPOM:* ${appliedCoupon.code}\n`;
        msg += `💰 *Desconto:* -R$ ${couponDiscount.toFixed(2)}\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (couponDiscount > 0) {
        msg += `*Subtotal: R$ ${subtotal.toFixed(2)}*\n`;
    }
    msg += `*💰 TOTAL: R$ ${total.toFixed(2)}*\n\n`;
    msg += `*💳 PAGAMENTO:* ${paymentText}\n`;
    
    if (paymentMethod === 'credito-parcelado') {
        const installmentValue = (total / parseInt(installments)).toFixed(2);
        msg += `📊 ${installments}x de R$ ${installmentValue}\n`;
    }

    msg += `\n_Pedido salvo no sistema_`;

    // 4. ENVIO E LIMPEZA
    const encodedMessage = encodeURIComponent(msg);
    const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    window.open(whatsappURL, '_blank');
    
    closePaymentModal();
    showToast('Pedido realizado com sucesso!', 'success');
    
    setTimeout(() => {
        if (confirm('Pedido enviado! Deseja limpar o carrinho?')) {
            cart = [];
            appliedCoupon = null;
            couponDiscount = 0;
            saveCart();
            updateCartUI();
            toggleCart();
        }
    }, 2000);
    
    trackEvent('E-commerce', 'Checkout WhatsApp', paymentText);
}

// ==================== FUNÇÕES DE CUPOM (REINTRODUZIDAS E OTIMIZADAS) ====================

async function applyCoupon() {
    const couponInput = document.getElementById('couponInput');
    const couponMessage = document.getElementById('couponMessage');
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    
    if (!couponInput || !couponMessage || !applyCouponBtn) return;

    const code = couponInput.value.trim().toUpperCase();
    
    if (!code) {
        showToast('Digite o código do cupom', 'info');
        return;
    }

    applyCouponBtn.disabled = true;
    couponMessage.textContent = 'Validando...';
    couponMessage.className = 'coupon-message active info';

    try {
        const couponDoc = await db.collection('coupons').doc(code).get();

        if (!couponDoc.exists) {
            throw new Error('Cupom não encontrado ou expirado.');
        }

        const coupon = { id: couponDoc.id, ...couponDoc.data() };
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // 1. Validação de Atividade
        if (!coupon.active) {
            throw new Error('Cupom inativo.');
        }

        // 2. Validação de Data
        const now = new Date();
        if (coupon.validFrom && coupon.validFrom.toDate() > now) {
            throw new Error('Este cupom ainda não está válido.');
        }
        if (coupon.validUntil && coupon.validUntil.toDate() < now) {
            throw new Error('Cupom expirado.');
        }

        // 3. Validação de Valor Mínimo
        if (coupon.minValue && subtotal < coupon.minValue) {
            throw new Error(`Valor mínimo de R$ ${coupon.minValue.toFixed(2)} não atingido.`);
        }

        // 4. Validação de Uso (Simulada, pois o uso real requer autenticação)
        // if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        //     throw new Error('Limite de usos atingido.');
        // }

        // 5. Cálculo do Desconto
        let discount = 0;
        if (coupon.type === 'percentage') {
            discount = (subtotal * coupon.value) / 100;
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount;
            }
        } else if (coupon.type === 'fixed') {
            discount = coupon.value;
        }
        
        // 6. Aplicação
        appliedCoupon = coupon;
        couponDiscount = discount;
        
        // Atualizar UI do badge
        const badge = document.getElementById('appliedCouponBadge');
        const codeEl = document.getElementById('appliedCouponCode');
        const discountEl = document.getElementById('appliedCouponDiscount');
        
        if (badge && codeEl && discountEl) {
            codeEl.textContent = coupon.id;
            discountEl.textContent = `-${couponDiscount.toFixed(2)}`;
            badge.style.display = 'flex';
        }

        showCouponMessage(`✅ Cupom ${coupon.id} aplicado! Desconto de R$ ${couponDiscount.toFixed(2)}`, 'success');
        showToast('Cupom aplicado!', 'success');

    } catch (error) {
        appliedCoupon = null;
        couponDiscount = 0;
        showCouponMessage(`❌ ${error.message}`, 'error');
        showToast('Erro ao aplicar cupom', 'error');
    } finally {
        applyCouponBtn.disabled = false;
        applyCouponBtn.textContent = 'APLICAR';
        saveCart();
        updateCartUI();
    }
}

function removeCoupon() {
    appliedCoupon = null;
    couponDiscount = 0;
    saveCart();
    updateCartUI();
    showToast('Cupom removido', 'info');
    
    const badge = document.getElementById('appliedCouponBadge');
    const message = document.getElementById('couponMessage');
    if (badge) badge.style.display = 'none';
    if (message) message.classList.remove('active');
}

function showCouponMessage(message, type) {
    const couponMessage = document.getElementById('couponMessage');
    if (couponMessage) {
        couponMessage.textContent = message;
        couponMessage.className = `coupon-message active ${type}`;
    }
}

// ==================== INTEGRAÇÃO DE ESTOQUE (SIMPLIFICADA) ====================
let productVariants = {};

function isVariantAvailable(productId, size, color) {
    const variants = productVariants[productId] || [];
    const variant = variants.find(v => v.size === size && v.color === color);
    return variant ? (variant.available && variant.stock > 0) : true; // Assume true se não houver variantes
}

// ==================== FUNÇÕES DE AUTENTICAÇÃO (REINTRODUZIDAS E OTIMIZADAS) ====================

// Variáveis de Estado de Autenticação
// let currentUser = JSON.parse(localStorage.getItem('sejaVersatilCurrentUser') || 'null');
// let isAdminLoggedIn = currentUser && currentUser.isAdmin;

function openUserPanel() {
    const panel = document.getElementById('userPanel');
    if (panel) panel.classList.add('active');
    updateUserPanelUI();
}

function closeUserPanel() {
    const panel = document.getElementById('userPanel');
    if (panel) panel.classList.remove('active');
}

function switchUserTab(tabName) {
    document.querySelectorAll('.user-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.user-tab-content').forEach(content => content.classList.remove('active'));
    
    document.getElementById(`${tabName}Tab`).classList.add('active');
    document.querySelector(`.user-tab-btn[onclick="switchUserTab('${tabName}')"]`).classList.add('active');
}

function updateUserPanelUI() {
    const loggedInTab = document.getElementById('userLoggedTab');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const adminAccessBtn = document.getElementById('adminAccessBtn');
    
    if (!loggedInTab || !loginTab || !registerTab || !adminAccessBtn) return;

    if (auth.currentUser) {
        // Usuário logado
        loggedInTab.style.display = 'block';
        loginTab.style.display = 'none';
        registerTab.style.display = 'none';
        
        document.getElementById('userName').textContent = auth.currentUser.displayName || auth.currentUser.email;
        document.getElementById('userEmail').textContent = auth.currentUser.email;
        document.getElementById('userStatus').textContent = isAdminLoggedIn ? 'Administrador' : 'Cliente';
        
        // Mostrar botão de Admin se for admin
        adminAccessBtn.style.display = isAdminLoggedIn ? 'block' : 'none';
        
        switchUserTab('userLogged');
        
    } else {
        // Usuário deslogado
        loggedInTab.style.display = 'none';
        loginTab.style.display = 'block';
        registerTab.style.display = 'block';
        
        switchUserTab('login');
    }
}

async function userLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.toLowerCase().trim();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');
    
    errorMsg.classList.remove('active');
    
    if (!email || !password) {
        errorMsg.textContent = 'Preencha todos os campos';
        errorMsg.classList.add('active');
        return;
    }
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
            await auth.signOut();
            errorMsg.textContent = '⚠️ Verifique seu email antes de fazer login';
            errorMsg.classList.add('active');
            
            const resend = confirm('Deseja reenviar o email de verificação?');
            if (resend) {
                await user.sendEmailVerification();
                showToast('Email de verificação reenviado!', 'info');
            }
            return;
        }
        
        // Verificar se é admin
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        
        if (adminDoc.exists && adminDoc.data().role === 'admin') {
            const adminData = adminDoc.data();
            
            currentUser = {
                name: adminData.name || user.displayName || 'Administrador',
                email: user.email,
                isAdmin: true,
                uid: user.uid,
                permissions: adminData.permissions || []
            };
            isAdminLoggedIn = true;
            
        } else {
            // Usuário comum
            currentUser = {
                name: user.displayName || 'Cliente',
                email: user.email,
                isAdmin: false,
                uid: user.uid
            };
            isAdminLoggedIn = false;
        }
        
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        updateUserPanelUI();
        closeUserPanel();
        showToast('Login realizado com sucesso!', 'success');
        
    } catch (firebaseError) {
        console.error('❌ Erro Firebase:', firebaseError.code);
        
        let errorMessage = 'Email ou senha incorretos';
        if (firebaseError.code === 'auth/user-not-found') {
            errorMessage = 'Usuário não encontrado';
        } else if (firebaseError.code === 'auth/wrong-password') {
            errorMessage = 'Senha incorreta';
        } else if (firebaseError.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido';
        } else if (firebaseError.code === 'auth/too-many-requests') {
            errorMessage = 'Muitas tentativas. Aguarde alguns minutos.';
        }
        
        errorMsg.textContent = errorMessage;
        errorMsg.classList.add('active');
        
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

async function userRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.toLowerCase().trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorMsg = document.getElementById('registerError');
    const successMsg = document.getElementById('registerSuccess');
    
    errorMsg.classList.remove('active');
    successMsg.classList.remove('active');
    
    if (!name || !email || !password || !confirmPassword) {
        errorMsg.textContent = 'Preencha todos os campos';
        errorMsg.classList.add('active');
        return;
    }
    
    if (!validateEmail(email)) {
        errorMsg.textContent = 'E-mail inválido';
        errorMsg.classList.add('active');
        return;
    }
    
    if (password.length < 6) {
        errorMsg.textContent = 'Senha deve ter no mínimo 6 caracteres';
        errorMsg.classList.add('active');
        return;
    }

    if (password !== confirmPassword) {
        errorMsg.textContent = 'As senhas não coincidem';
        errorMsg.classList.add('active');
        return;
    }
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await user.updateProfile({
            displayName: name
        });
        
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: false,
            newsletter: false
        });
        
        await user.sendEmailVerification({
            url: window.location.href,
            handleCodeInApp: true
        });
        
        successMsg.textContent = '✅ Conta criada! Verifique seu email.';
        successMsg.classList.add('active');
        showToast('Conta criada com sucesso!', 'success');
        
        // Limpar formulário
        document.getElementById('registerName').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerConfirmPassword').value = '';
        
        setTimeout(() => {
            switchUserTab('login');
            successMsg.classList.remove('active');
        }, 3000);
        
    } catch (error) {
        console.error('❌ Erro ao criar conta:', error);
        
        let errorMessage = 'Erro ao criar conta';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este email já está cadastrado';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Email inválido';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Senha muito fraca';
        }
        
        errorMsg.textContent = errorMessage;
        errorMsg.classList.add('active');
        
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

async function userLogout() {
    if (confirm('Deseja realmente sair da sua conta?')) {
        try {
            await auth.signOut();
            localStorage.removeItem('sejaVersatilCurrentUser');
            currentUser = null;
            isAdminLoggedIn = false;
            updateUserPanelUI();
            showToast('Logout realizado com sucesso', 'info');
        } catch (error) {
            console.error('❌ Erro ao fazer logout:', error);
            showToast('Erro ao fazer logout', 'error');
        }
    }
}

async function resetPassword() {
    const email = prompt("Digite seu e-mail para redefinir a senha:");
    if (email && validateEmail(email)) {
        try {
            await auth.sendPasswordResetEmail(email);
            showToast("E-mail de redefinição enviado!", 'success');
        } catch (error) {
            showToast("Erro ao enviar e-mail: " + error.message, 'error');
        }
    } else if (email) {
        showToast("E-mail inválido.", 'error');
    }
}

// Listener de estado de autenticação (Garante que o estado do usuário seja atualizado em tempo real)
auth.onAuthStateChanged(user => {
    if (user) {
        // Usuário logado (o login já foi tratado em userLogin, mas este é um fallback)
        if (!currentUser || currentUser.uid !== user.uid) {
            // Se o estado mudou e o currentUser não está definido, carrega os dados
            db.collection('admins').doc(user.uid).get().then(adminDoc => {
                if (adminDoc.exists && adminDoc.data().role === 'admin') {
                    const adminData = adminDoc.data();
                    currentUser = {
                        name: adminData.name || user.displayName || 'Administrador',
                        email: user.email,
                        isAdmin: true,
                        uid: user.uid,
                        permissions: adminData.permissions || []
                    };
                    isAdminLoggedIn = true;
                } else {
                    currentUser = {
                        name: user.displayName || 'Cliente',
                        email: user.email,
                        isAdmin: false,
                        uid: user.uid
                    };
                    isAdminLoggedIn = false;
                }
                localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
                updateUserPanelUI();
            });
        } else {
            updateUserPanelUI();
        }
    } else {
        // Usuário deslogado
        localStorage.removeItem('sejaVersatilCurrentUser');
        currentUser = null;
        isAdminLoggedIn = false;
        updateUserPanelUI();
    }
});

// ==================== FUNÇÕES DE ADMIN (REINTRODUZIDAS E OTIMIZADAS) ====================

function openAdminPanel() {
    if (!isAdminLoggedIn) {
        showToast('Acesso negado. Apenas administradores.', 'error');
        return;
    }
    const panel = document.getElementById('adminPanel');
    if (panel) panel.classList.add('active');
    updateAdminStats();
    renderAdminProducts();
    renderAdminCoupons();
}

function closeAdminPanel() {
    const panel = document.getElementById('adminPanel');
    if (panel) panel.classList.remove('active');
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
    
    document.getElementById(`${tabName}Tab`).classList.add('active');
    document.querySelector(`.admin-tab[onclick="switchAdminTab('${tabName}')"]`).classList.add('active');
}

async function updateAdminStats() {
    if (!isAdminLoggedIn) return;
    
    try {
        const productsSnapshot = await db.collection('produtos').get();
        const totalProducts = productsSnapshot.size;
        let totalRevenue = 0;
        let activeProducts = 0;
        
        productsSnapshot.forEach(doc => {
            const data = doc.data();
            // Simulação de cálculo de valor em estoque (apenas preço do produto)
            totalRevenue += data.price || 0; 
            // Simulação de produto ativo (se tiver preço)
            if (data.price > 0) activeProducts++;
        });
        
        document.getElementById('totalProducts').textContent = totalProducts;
        document.getElementById('totalRevenue').textContent = `R$ ${totalRevenue.toFixed(2)}`;
        document.getElementById('activeProducts').textContent = activeProducts;
        document.getElementById('totalOrders').textContent = 'Simulado'; // Manter simulação de pedidos
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas do Admin:', error);
    }
}

// ==================== CRUD PRODUTOS ====================

let tempProductImages = []; // Imagens temporárias para o modal de produto

function openProductModal(productId = null) {
    if (!isAdminLoggedIn) return;
    
    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const title = document.getElementById('modalTitle');
    
    if (!modal || !form || !title) return;
    
    form.reset();
    tempProductImages = [];
    document.getElementById('productImagesList').innerHTML = '';
    document.getElementById('productColorsManager').innerHTML = '<p style="color: #999; font-size: 0.85rem; text-align: center;">Nenhuma cor adicionada ainda</p>';
    
    if (productId) {
        title.textContent = 'Editar Produto';
        // Carregar dados do produto (simplificado, em um ambiente real buscaríamos no Firestore)
        const product = productsData.find(p => p.id === productId);
        if (product) {
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name || '';
            document.getElementById('productCategory').value = product.category || 'blusas';
            document.getElementById('productPrice').value = product.price || 0;
            document.getElementById('productOldPrice').value = product.oldPrice || '';
            document.getElementById('productBadge').value = product.badge || '';
            document.getElementById('productBlackFriday').checked = product.isBlackFriday || false;
            
            // Carregar imagens e cores
            tempProductImages = product.images || [];
            renderProductImages();
            
            if (product.colors && product.colors.length > 0) {
                productColors = product.colors;
                renderProductColors();
            }
        }
    } else {
        title.textContent = 'Adicionar Produto';
        document.getElementById('productId').value = '';
        productColors = [];
    }
    
    modal.classList.add('active');
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) modal.classList.remove('active');
}

function renderProductImages() {
    const list = document.getElementById('productImagesList');
    if (!list) return;
    
    list.innerHTML = tempProductImages.map((img, index) => {
        const isRealImage = img.startsWith('http') || img.startsWith('data:image');
        const style = isRealImage ? `background-image: url('${img}'); background-size: cover; background-position: center;` : `background: ${img};`;
        
        return `
            <div class="image-item" style="${style}">
                <button type="button" onclick="removeProductImage(${index})" title="Remover Imagem">✕</button>
            </div>
        `;
    }).join('');
}

function removeProductImage(index) {
    tempProductImages.splice(index, 1);
    renderProductImages();
}

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        for (const file of files) {
            // Simulação de upload para o Firebase Storage
            const storageRef = storage.ref().child(`produtos/${Date.now()}_${file.name}`);
            await storageRef.put(file);
            const url = await storageRef.getDownloadURL();
            tempProductImages.push(url);
        }
        renderProductImages();
        showToast('Imagens carregadas!', 'success');
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        showToast('Erro ao fazer upload de imagem', 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

function toggleUrlInput() {
    const box = document.getElementById('imageUrlInputBox');
    if (box) box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

function addImageFromUrl() {
    const urlInput = document.getElementById('imageUrlField');
    if (!urlInput) return;
    const url = urlInput.value.trim();
    if (url) {
        tempProductImages.push(url);
        renderProductImages();
        urlInput.value = '';
        toggleUrlInput();
    }
}

function toggleGradientInput() {
    const box = document.getElementById('imageGradientInputBox');
    if (box) box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
}

function addGradientImage() {
    const gradientInput = document.getElementById('gradientField');
    if (!gradientInput) return;
    const gradient = gradientInput.value.trim();
    if (gradient) {
        tempProductImages.push(gradient);
        renderProductImages();
        gradientInput.value = '';
        toggleGradientInput();
    }
}

let productColors = [];

function addColorToProduct() {
    const colorName = prompt('Nome da Cor (Ex: Vermelho, Preto):');
    if (!colorName) return;
    
    const colorHex = prompt('Código Hexadecimal (Ex: #FF0000, #000000):');
    if (!colorHex) return;
    
    // Otimização: As imagens atuais no tempProductImages são associadas à nova cor
    productColors.push({
        name: colorName,
        hex: colorHex,
        images: [...tempProductImages] // Copia as imagens atuais
    });
    
    // Limpa as imagens temporárias para a próxima cor
    tempProductImages = [];
    renderProductImages();
    renderProductColors();
    showToast(`Cor ${colorName} adicionada. Adicione as imagens para a próxima cor.`, 'info');
}

function removeProductColor(index) {
    if (confirm('Tem certeza que deseja remover esta cor e suas imagens?')) {
        productColors.splice(index, 1);
        renderProductColors();
    }
}

function renderProductColors() {
    const manager = document.getElementById('productColorsManager');
    if (!manager) return;
    
    if (productColors.length === 0) {
        manager.innerHTML = '<p style="color: #999; font-size: 0.85rem; text-align: center;">Nenhuma cor adicionada ainda</p>';
        return;
    }
    
    manager.innerHTML = productColors.map((color, index) => `
        <div class="color-item-admin">
            <div class="color-preview" style="background-color: ${color.hex};"></div>
            <div class="color-info">
                <strong>${color.name}</strong>
                <small>(${color.images.length} imagens)</small>
            </div>
            <button type="button" onclick="removeProductColor(${index})" title="Remover Cor">✕</button>
        </div>
    `).join('');
}

async function saveProduct(event) {
    event.preventDefault();
    if (!isAdminLoggedIn) return;
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    const productId = document.getElementById('productId').value;
    const name = sanitizeInput(document.getElementById('productName').value);
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const oldPrice = parseFloat(document.getElementById('productOldPrice').value) || null;
    const badge = sanitizeInput(document.getElementById('productBadge').value);
    
    // Otimização: Se houver cores definidas, a lista de imagens principal deve ser a da primeira cor
    const finalImages = productColors.length > 0 ? productColors[0].images : tempProductImages;
    
    const productData = {
        name,
        category,
        price,
        oldPrice,
        badge,
        isBlackFriday: document.getElementById('productBlackFriday').checked,
        images: finalImages,
        colors: productColors.length > 0 ? productColors : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // ===== VALIDAÇÃO =====
    const errors = validateProductData(productData);
    if (errors.length > 0) {
        showToast(errors[0], 'error');
        document.getElementById('loadingOverlay').classList.remove('active');
        return;
    }

    try {
        if (productId) {
            // ===================== EDITAR PRODUTO ========================
            await db.collection("produtos").doc(productId).update(productData);
            showToast('Produto atualizado com sucesso!', 'success');
        } else {
            // ===================== NOVO PRODUTO =========================
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection("produtos").add(productData);
            showToast('Produto adicionado com sucesso!', 'success');
        }

        // ===== ATUALIZAÇÕES GERAIS =====
        productCache.clear();
        await carregarProdutosDoFirestore(); // Recarrega a lista de produtos
        closeProductModal();
        renderAdminProducts();
        renderProducts();
        updateAdminStats();

    } catch (error) {
        console.error("Erro ao salvar produto:", error);
        showToast('Erro ao salvar produto: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

async function deleteProduct(productId) {
    if (!isAdminLoggedIn || !confirm('Tem certeza que deseja deletar este produto?')) return;
    
    try {
        // Deletar variantes (opcional, mas recomendado)
        const variantsSnapshot = await db.collection('produtos').doc(productId).collection('variants').get();
        const batch = db.batch();
        variantsSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        // Deletar produto
        await db.collection('produtos').doc(productId).delete();
        
        productCache.clear();
        await carregarProdutosDoFirestore();
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        showToast('Produto deletado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao deletar produto:', error);
        showToast('Erro ao deletar produto: ' + error.message, 'error');
    }
}

function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if (!grid) return;
    
    if (productsData.length === 0) {
        grid.innerHTML = '<p style="text-align: center; padding: 2rem;">Nenhum produto cadastrado.</p>';
        return;
    }
    
    grid.innerHTML = productsData.map(p => `
        <div class="admin-product-card">
            <div class="admin-product-info">
                <strong>${sanitizeInput(p.name)}</strong>
                <small>ID: ${p.id}</small>
                <small>Preço: R$ ${p.price.toFixed(2)}</small>
            </div>
            <div class="admin-product-actions">
                <button class="admin-btn-edit" onclick="openProductModal('${p.id}')">Editar</button>
                <button class="admin-btn-delete" onclick="deleteProduct('${p.id}')">Deletar</button>
            </div>
        </div>
    `).join('');
}

async function limparTodosProdutos() {
    const confirmacao = confirm(
        '⚠️ ATENÇÃO! Esta ação irá DELETAR TODOS os produtos do Firestore.\n\n' +
        'Esta ação NÃO pode ser desfeita!\n\n' +
        'Tem CERTEZA ABSOLUTA que deseja continuar?'
    );
    
    if (!confirmacao) return;
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const productsSnapshot = await db.collection('produtos').get();
        const batch = db.batch();
        
        productsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        productCache.clear();
        productsData = [];
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        showToast('✅ Todos os produtos foram deletados!', 'success');
        
    } catch (error) {
        console.error('Erro ao limpar produtos:', error);
        showToast('❌ Erro ao limpar produtos: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

// ==================== CRUD CUPONS ====================

async function renderAdminCoupons() {
    if (!isAdminLoggedIn) return;
    
    const activeList = document.getElementById('activeCouponsList');
    const inactiveList = document.getElementById('inactiveCouponsList');
    
    if (!activeList || !inactiveList) return;
    
    try {
        const snapshot = await db.collection('coupons').get();
        const coupons = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const now = new Date();
        const activeCoupons = [];
        const inactiveCoupons = [];
        
        coupons.forEach(c => {
            const validUntil = c.validUntil ? c.validUntil.toDate() : null;
            const isValid = c.active && (!validUntil || validUntil > now);
            
            if (isValid) {
                activeCoupons.push(c);
            } else {
                inactiveCoupons.push(c);
            }
        });
        
        activeList.innerHTML = renderCouponList(activeCoupons);
        inactiveList.innerHTML = renderCouponList(inactiveCoupons);
        
    } catch (error) {
        console.error('Erro ao carregar cupons:', error);
    }
}

function renderCouponList(coupons) {
    if (coupons.length === 0) {
        return '<p style="color: #999;">Nenhum cupom nesta lista.</p>';
    }
    
    return coupons.map(c => {
        const type = c.type === 'percentage' ? `${c.value}%` : `R$ ${c.value.toFixed(2)}`;
        const maxDiscount = c.maxDiscount ? ` (Máx: R$ ${c.maxDiscount.toFixed(2)})` : '';
        const minValue = c.minValue ? ` | Mín: R$ ${c.minValue.toFixed(2)}` : '';
        const usage = c.usageLimit ? ` | Usos: ${c.usedCount || 0}/${c.usageLimit}` : '';
        
        return `
            <div class="admin-coupon-card">
                <div class="admin-coupon-info">
                    <strong>${c.id}</strong>
                    <small>${type}${maxDiscount}${minValue}${usage}</small>
                </div>
                <div class="admin-coupon-actions">
                    <button class="admin-btn-edit" onclick="openCouponModal('${c.id}')">Editar</button>
                    <button class="admin-btn-delete" onclick="deleteCoupon('${c.id}')">Deletar</button>
                </div>
            </div>
        `;
    }).join('');
}

function openCouponModal(couponId = null) {
    if (!isAdminLoggedIn) return;
    
    const modal = document.getElementById('couponModal');
    const form = document.getElementById('couponForm');
    
    if (!modal || !form) return;
    
    form.reset();
    document.getElementById('couponId').value = '';
    
    if (couponId) {
        // Simulação de carregamento de cupom
        db.collection('coupons').doc(couponId).get().then(doc => {
            if (doc.exists) {
                const coupon = { id: doc.id, ...doc.data() };
                document.getElementById('couponId').value = coupon.id;
                document.getElementById('couponCode').value = coupon.id;
                document.getElementById('couponType').value = coupon.type || 'percentage';
                document.getElementById('couponValue').value = coupon.value || 0;
                document.getElementById('couponMaxDiscount').value = coupon.maxDiscount || '';
                document.getElementById('couponMinValue').value = coupon.minValue || '';
                document.getElementById('couponUsageLimit').value = coupon.usageLimit || '';
                document.getElementById('couponUsagePerUser').value = coupon.usagePerUser || '';
                document.getElementById('couponActive').checked = coupon.active !== false;
                
                if (coupon.validFrom) document.getElementById('couponValidFrom').value = coupon.validFrom.toDate().toISOString().slice(0, 16);
                if (coupon.validUntil) document.getElementById('couponValidUntil').value = coupon.validUntil.toDate().toISOString().slice(0, 16);
                
                toggleMaxDiscount();
            }
        });
    }
    
    modal.classList.add('active');
}

function closeCouponModal() {
    const modal = document.getElementById('couponModal');
    if (modal) modal.classList.remove('active');
}

function toggleMaxDiscount() {
    const type = document.getElementById('couponType').value;
    const maxDiscountGroup = document.getElementById('maxDiscountGroup');
    if (maxDiscountGroup) {
        maxDiscountGroup.style.display = type === 'percentage' ? 'block' : 'none';
    }
}

async function saveCoupon(event) {
    event.preventDefault();
    if (!isAdminLoggedIn) return;
    
    const couponId = document.getElementById('couponId').value;
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    const type = document.getElementById('couponType').value;
    const value = parseFloat(document.getElementById('couponValue').value);
    const maxDiscount = parseFloat(document.getElementById('couponMaxDiscount').value) || null;
    const minValue = parseFloat(document.getElementById('couponMinValue').value) || null;
    const usageLimit = parseInt(document.getElementById('couponUsageLimit').value) || null;
    const usagePerUser = parseInt(document.getElementById('couponUsagePerUser').value) || null;
    const active = document.getElementById('couponActive').checked;
    const validFrom = document.getElementById('couponValidFrom').value ? new Date(document.getElementById('couponValidFrom').value) : null;
    const validUntil = document.getElementById('couponValidUntil').value ? new Date(document.getElementById('couponValidUntil').value) : null;
    
    if (!code || !value || value <= 0) {
        showToast('Preencha o código e o valor do cupom corretamente.', 'error');
        return;
    }
    
    const couponData = {
        type,
        value,
        maxDiscount,
        minValue,
        usageLimit,
        usagePerUser,
        active,
        validFrom: validFrom ? firebase.firestore.Timestamp.fromDate(validFrom) : null,
        validUntil: validUntil ? firebase.firestore.Timestamp.fromDate(validUntil) : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (couponId) {
            // Editar
            await db.collection('coupons').doc(couponId).update(couponData);
            showToast('Cupom atualizado com sucesso!', 'success');
        } else {
            // Novo
            couponData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('coupons').doc(code).set(couponData);
            showToast('Cupom criado com sucesso!', 'success');
        }
        
        closeCouponModal();
        renderAdminCoupons();
        
    } catch (error) {
        console.error('Erro ao salvar cupom:', error);
        showToast('Erro ao salvar cupom: ' + error.message, 'error');
    }
}

async function deleteCoupon(couponId) {
    if (!isAdminLoggedIn || !confirm('Tem certeza que deseja deletar este cupom?')) return;
    
    try {
        await db.collection('coupons').doc(couponId).delete();
        renderAdminCoupons();
        showToast('Cupom deletado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao deletar cupom:', error);
        showToast('Erro ao deletar cupom: ' + error.message, 'error');
    }
}

// ==================== CRUD VÍDEOS ====================

function openVideoManager() {
    if (!isAdminLoggedIn) return;
    const modal = document.getElementById('videoManagerModal');
    if (modal) modal.classList.add('active');
    renderVideoManagerList();
}

function closeVideoManager() {
    const modal = document.getElementById('videoManagerModal');
    if (modal) modal.classList.remove('active');
}

function renderVideoManagerList() {
    const list = document.getElementById('videoManagerList');
    if (!list) return;
    
    // Simulação de carregamento de vídeos (em um ambiente real, buscaria em site_config/video_grid)
    const videos = [
        { id: 'v1', url: 'simulated-url-1', title: 'Conforto', order: 1 },
        { id: 'v2', url: 'simulated-url-2', title: 'Estilo', order: 2 }
    ];
    
    if (videos.length === 0) {
        list.innerHTML = '<p style="text-align: center; padding: 2rem;">Nenhum vídeo cadastrado.</p>';
        return;
    }
    
    list.innerHTML = videos.map(v => `
        <div class="video-manager-item">
            <div class="video-info">
                <strong>${v.title}</strong>
                <small>Ordem: ${v.order}</small>
            </div>
            <div class="video-actions">
                <button class="admin-btn-delete" onclick="deleteVideo('${v.id}')">Deletar</button>
            </div>
        </div>
    `).join('');
}

function deleteVideo(videoId) {
    if (!isAdminLoggedIn || !confirm('Tem certeza que deseja deletar este vídeo?')) return;
    // Lógica de deleção de vídeo (simulada)
    showToast('Vídeo deletado (simulado)!', 'success');
    renderVideoManagerList();
}

async function handleVideoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const title = prompt('Título do Vídeo:');
    if (!title) return;
    
    const order = parseInt(prompt('Ordem de exibição (1-5):')) || 1;
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        // Simulação de upload para o Firebase Storage
        const storageRef = storage.ref().child(`videos/${Date.now()}_${file.name}`);
        await storageRef.put(file);
        const url = await storageRef.getDownloadURL();
        
        // Simulação de salvamento no Firestore
        // await db.collection('site_config').doc('video_grid').update({
        //     videos: firebase.firestore.FieldValue.arrayUnion({ url, title, order })
        // });
        
        showToast('Vídeo carregado e salvo!', 'success');
        renderVideoManagerList();
        
    } catch (error) {
        console.error('Erro ao fazer upload de vídeo:', error);
        showToast('Erro ao fazer upload de vídeo', 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

// ==================== FUNÇÕES GLOBAIS EXPOSTAS ====================
window.toggleCart = toggleCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;
window.toggleFavorite = toggleFavorite;
window.showFavorites = showFavorites;
window.setCategoryFilter = setCategoryFilter;
window.clearCategoryFilter = clearCategoryFilter;
window.changePage = changePage;
window.openProductDetails = (productId) => {
    localStorage.setItem('selectedProductId', productId);
    window.location.href = `produto.html?id=${productId}`;
};
window.checkout = checkout;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.sendToWhatsApp = sendToWhatsApp;
window.applyCoupon = applyCoupon;
window.removeCoupon = removeCoupon;
window.openUserPanel = openUserPanel;
window.closeUserPanel = closeUserPanel;
window.switchUserTab = switchUserTab;
window.userLogin = userLogin;
window.userRegister = userRegister;
window.userLogout = userLogout;
window.resetPassword = resetPassword;
window.openAdminPanel = openAdminPanel;
window.closeAdminPanel = closeAdminPanel;
window.switchAdminTab = switchAdminTab;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.handleImageUpload = handleImageUpload;
window.toggleUrlInput = toggleUrlInput;
window.addImageFromUrl = addImageFromUrl;
window.toggleGradientInput = toggleGradientInput;
window.addGradientImage = addGradientImage;
window.addColorToProduct = addColorToProduct;
window.removeProductColor = removeProductColor;
window.limparTodosProdutos = limparTodosProdutos;
window.saveSettings = saveSettings;
window.openCouponModal = openCouponModal;
window.closeCouponModal = closeCouponModal;
window.toggleMaxDiscount = toggleMaxDiscount;
window.saveCoupon = saveCoupon;
window.deleteCoupon = deleteCoupon;
window.openVideoManager = openVideoManager;
window.closeVideoManager = closeVideoManager;
window.handleVideoUpload = handleVideoUpload;
window.nextProductImage = nextProductImage;
window.prevProductImage = prevProductImage;
window.goToProductImage = goToProductImage;
window.performHeaderSearch = performHeaderSearch;

// ==================== TRATAMENTO DE ERROS GLOBAIS ====================
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        carouselsPaused = true;
        clearCarouselIntervals();
    } else {
        carouselsPaused = false;
        setupAutoCarousel();
    }
});

function setupConnectionMonitor() {
    window.addEventListener('online', () => { showToast('Conexão restaurada!', 'success'); });
    window.addEventListener('offline', () => { showToast('Você está offline', 'error'); });
}

function setupCartAbandonmentTracking() {
   window.addEventListener('beforeunload', (e) => {
    if (isInternalNavigation) {
        isInternalNavigation = false;
        return undefined;
    }
    if (cart.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});
}

// ==================== FIM main.js ====================

// Chamada inicial para verificar o estado de autenticação
document.addEventListener('DOMContentLoaded', () => {
    // O listener onAuthStateChanged cuidará da atualização inicial
    // Mas se o Firebase não estiver carregado, o updateUserPanelUI deve ser chamado no final do DOMContentLoaded
    if (typeof auth.onAuthStateChanged !== 'function') {
        updateUserPanelUI();
    }
});
