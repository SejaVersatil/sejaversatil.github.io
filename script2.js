/**
 * script2.js - Versão Final "Mosaico Live!"
 * Integração verificada com index.html e css2.css
 */

// ==================== 1. UTILITÁRIOS & CONFIGURAÇÃO ====================

class SecureStorage {
    constructor(key) { this.key = key; }
    encrypt(data) { return btoa(encodeURIComponent(JSON.stringify(data))); }
    decrypt(data) {
        try { return JSON.parse(decodeURIComponent(atob(data))); } 
        catch { return null; }
    }
    set(key, value) { localStorage.setItem(key, this.encrypt(value)); }
    get(key) {
        const data = localStorage.getItem(key);
        return data ? this.decrypt(data) : null;
    }
    remove(key) { localStorage.removeItem(key); }
}

const secureStorage = new SecureStorage('sejaVersatil_v1');

// Verificação de Segurança: Garante que o Firebase do HTML foi carregado
if (typeof firebase === 'undefined' || !firebase.apps.length) {
    console.error("CRÍTICO: Firebase SDK não foi carregado no HTML.");
}
// Nota: Não redeclaramos const db/auth/storage aqui pois elas já são globais do HTML.

// Cache Manager
class CacheManager {
    constructor(ttl = 1800000) { this.cache = new Map(); this.ttl = ttl; }
    set(key, value) { this.cache.set(key, { value, timestamp: Date.now() }); }
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() - item.timestamp > this.ttl) { this.cache.delete(key); return null; }
        return item.value;
    }
    clear() { this.cache.clear(); }
}

// Rate Limiter (Proteção contra excesso de leituras no banco)
class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }
    canMakeRequest() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        if (this.requests.length < this.maxRequests) {
            this.requests.push(now);
            return true;
        }
        return false;
    }
}

const productCache = new CacheManager();
const firestoreRateLimiter = new RateLimiter(20, 60000);

// --- Variáveis Globais de Estado ---
let productsData = [];
let cart = [];
let currentFilter = 'all';
let currentSort = '';
let currentPage = 1;
const itemsPerPage = 12;

// Estado Admin e UI
let tempProductImages = [];
let productColors = [];
let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
let carouselIntervals = {};
const carouselEventsRegistered = new Set();
let carouselsPaused = false;
let currentProductDetails = null;
let selectedColor = null;
let selectedSize = null;
let selectedQuantity = 1;
let isAdminLoggedIn = false;
let currentUser = null;
let editingProductId = null;

// ==================== 2. HELPERS VISUAIS E VALIDAÇÃO ====================

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
    // Força reflow para animação funcionar
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML.replace(/['"]/g, '');
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim().toLowerCase());
}

function getProductImage(product) {
    if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
    return product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}

function isRealImage(imageSrc) {
    return typeof imageSrc === 'string' && (imageSrc.startsWith('data:image') || imageSrc.startsWith('http'));
}

function validateProductData(data) {
    const errors = [];
    if (!data.name || data.name.trim().length < 3) errors.push('Nome muito curto');
    if (!data.price || data.price <= 0) errors.push('Preço inválido');
    if (!data.images || !Array.isArray(data.images) || data.images.length === 0) errors.push('Adicione pelo menos 1 imagem');
    return errors;
}

function trackEvent(category, action, label) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, { event_category: category, event_label: label });
    }
}

// ==================== 3. NÚCLEO DE PRODUTOS (VITRINE) ====================

async function loadProducts() {
    try {
        // Tenta Cache Local
        const cached = productCache.get('products');
        if (cached) {
            productsData = cached;
        } else {
            // Tenta Firebase
            if (!firestoreRateLimiter.canMakeRequest()) {
                showToast('Muitas requisições. Aguarde...', 'error');
                return;
            }
            const snapshot = await db.collection("produtos").orderBy('createdAt', 'desc').get();
            productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            productCache.set('products', productsData);
        }
        renderProducts();
        renderBestSellers();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        showToast('Erro ao carregar catálogo', 'error');
    }
}

function renderProducts() {
    clearCarouselIntervals();
    const grid = document.getElementById('productsGrid');
    const badge = document.getElementById('activeCategoryBadge');
    const categoryDisplay = document.getElementById('categoryNameDisplay');
    
    if (!grid) return;

    // 1. Filtragem
    let filtered = [...productsData];
    if (currentFilter !== 'all') {
        if (currentFilter === 'favorites') {
            filtered = filtered.filter(p => favorites.includes(p.id));
            if(categoryDisplay) categoryDisplay.textContent = '❤️ Meus Favoritos';
        } else if (currentFilter === 'sale') {
            filtered = filtered.filter(p => p.oldPrice);
            if(categoryDisplay) categoryDisplay.textContent = '🔥 Promoções';
        } else {
            filtered = filtered.filter(p => p.category === currentFilter);
            if(categoryDisplay) categoryDisplay.textContent = getCategoryName(currentFilter);
        }
        if(badge) badge.style.display = 'flex';
    } else {
        if(badge) badge.style.display = 'none';
    }

    // 2. Ordenação
    if (currentSort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-desc') filtered.sort((a, b) => b.price - a.price);

    // 3. Paginação
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = filtered.slice(start, start + itemsPerPage);

    if (paginated.length === 0) {
        grid.innerHTML = `<div class="empty-section-message" style="grid-column:1/-1; text-align:center; padding:3rem;">Nenhum produto encontrado.</div>`;
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    // 4. Renderização HTML
    grid.innerHTML = paginated.map(product => {
        const images = (Array.isArray(product.images) && product.images.length) ? product.images : [getProductImage(product)];
        const discount = product.oldPrice ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;
        const isFav = favorites.includes(product.id);
        const hasMultipleImages = images.length > 1;

        return `
            <div class="product-card" data-product-id="${product.id}" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${product.id}')">
                        ${isFav ? '❤️' : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`}
                    </button>
                    
                    ${product.isBlackFriday && discount > 0 ? `
                        <div class="bf-product-badge"><div class="bf-badge-content"><div class="bf-badge-text">
                            <span style="font-size: 11px; font-weight: 900; color: #FFF;">VERSÁTIL</span>
                            <div><span style="font-size: 9px; color: #FFF;">Friday</span> <span style="font-size: 9px; color: #FF6B35; font-weight: 700;">-${discount}%</span></div>
                        </div></div></div>` 
                    : (discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : '')}
                    
                    ${product.badge && !product.isBlackFriday && discount === 0 ? `<div class="product-badge">${sanitizeInput(product.badge)}</div>` : ''}

                    <div class="product-image-carousel">
                        ${images.map((img, idx) => `
                            <div class="product-image-slide ${idx === 0 ? 'active' : ''}" style="${isRealImage(img) ? `background-image: url('${img}')` : `background: ${img}`}"></div>
                        `).join('')}
                    </div>
                    
                    ${hasMultipleImages ? `
                    <div class="product-carousel-dots">
                        ${images.map((_, idx) => `<div class="product-carousel-dot ${idx === 0 ? 'active' : ''}"></div>`).join('')}
                    </div>` : ''}

                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">Adicionar</button>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <div class="product-price">
                        ${product.oldPrice ? `<span class="price-old">R$ ${product.oldPrice.toFixed(2)}</span>` : ''}
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
    const container = document.getElementById('pagination');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    if (currentPage > 1) html += `<button class="page-btn" onclick="changePage(${currentPage - 1})">‹</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        }
    }
    
    if (currentPage < totalPages) html += `<button class="page-btn" onclick="changePage(${currentPage + 1})">›</button>`;
    container.innerHTML = html;
}

function changePage(newPage) {
    currentPage = newPage;
    renderProducts();
    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
}

function renderBestSellers() {
    const grid = document.getElementById('bestSellersGrid');
    if(!grid) return;
    const best = productsData.filter(p => p.oldPrice).slice(0, 4);
    
    if(!best.length) {
        grid.innerHTML = '<p class="empty-section-message" style="grid-column:1/-1">Nenhum destaque no momento</p>';
        return;
    }

    grid.innerHTML = best.map(p => {
        const img = getProductImage(p);
        const isReal = isRealImage(img);
        const isFav = favorites.includes(p.id);
        
        return `
            <div class="product-card" onclick="openProductDetails('${p.id}')">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${p.id}')">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    <div class="product-image-slide active" style="${isReal ? `background-image: url('${img}')` : `background: ${img}`}"></div>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(p.name)}</h4>
                    <div class="product-price">
                        <span class="price-new">R$ ${p.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== 4. CARRINHO & CHECKOUT ====================

function addToCart(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            ...product,
            quantity: 1,
            image: getProductImage(product)
        });
    }
    
    saveCart();
    updateCartUI();
    showToast('Adicionado ao carrinho!');
    
    const btn = event.target;
    if(btn && btn.classList.contains('add-to-cart-btn')) {
        const originalText = btn.textContent;
        btn.textContent = '✓';
        btn.style.background = '#27ae60';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 1500);
    }
}

function updateCartUI() {
    const countEl = document.getElementById('cartCount');
    const itemsEl = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const footerEl = document.getElementById('cartFooter');
    
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (countEl) {
        countEl.textContent = totalQty;
        countEl.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    if (itemsEl) {
        if (cart.length === 0) {
            itemsEl.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
            if(footerEl) footerEl.style.display = 'none';
        } else {
            itemsEl.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-img" style="${isRealImage(item.image) ? `background-image: url('${item.image}')` : `background: ${item.image}`}"></div>
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.name}</div>
                        ${item.selectedSize ? `<small>Tam: ${item.selectedSize} ${item.selectedColor ? `| ${item.selectedColor}` : ''}</small>` : ''}
                        <div class="cart-item-price">R$ ${item.price.toFixed(2)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="updateCartItem('${item.cartItemId || item.id}', -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="updateCartItem('${item.cartItemId || item.id}', 1)">+</button>
                        </div>
                    </div>
                    <div class="remove-item" onclick="removeCartItem('${item.cartItemId || item.id}')">✕</div>
                </div>
            `).join('');
            if(totalEl) totalEl.textContent = `R$ ${totalValue.toFixed(2)}`;
            if(footerEl) footerEl.style.display = 'block';
        }
    }
}

function updateCartItem(id, change) {
    const item = cart.find(i => (i.cartItemId || i.id) === id);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) removeCartItem(id);
        else {
            saveCart();
            updateCartUI();
        }
    }
}

function removeCartItem(id) {
    cart = cart.filter(i => (i.cartItemId || i.id) !== id);
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('sejaVersatilCart', JSON.stringify(cart));
}

function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if (saved) {
        try { cart = JSON.parse(saved); } catch { cart = []; }
        updateCartUI();
    }
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// Checkout
function checkout() {
    if (cart.length === 0) return showToast('Carrinho vazio!', 'error');
    document.getElementById('paymentModal').classList.add('active');
    
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    document.getElementById('paymentTotal').textContent = `R$ ${total.toFixed(2)}`;
    document.getElementById('paymentCartItems').innerHTML = cart.map(i => 
        `<div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:5px;">
            <span>${i.quantity}x ${i.name}</span>
            <span>R$ ${(i.price * i.quantity).toFixed(2)}</span>
         </div>`
    ).join('');
    
    setupPaymentListeners();
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function setupPaymentListeners() {
    const opts = document.querySelectorAll('input[name="paymentMethod"]');
    const box = document.getElementById('installmentsBox');
    if(opts && box) {
        opts.forEach(opt => {
            opt.addEventListener('change', function() {
                box.style.display = this.value === 'credito-parcelado' ? 'block' : 'none';
            });
        });
    }
}

function sendToWhatsApp() {
    const methodInput = document.querySelector('input[name="paymentMethod"]:checked');
    if(!methodInput) return alert('Selecione uma forma de pagamento');
    const method = methodInput.value;
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    
    let msg = `*PEDIDO SEJA VERSÁTIL*\n\n`;
    cart.forEach(i => {
        msg += `${i.quantity}x ${i.name} ${i.selectedSize ? `(${i.selectedSize})` : ''}\n`;
    });
    msg += `\n*Total: R$ ${total.toFixed(2)}*`;
    msg += `\nPagamento: ${method.toUpperCase()}`;
    
    const phone = "5571991427103";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    
    cart = [];
    saveCart();
    updateCartUI();
    closePaymentModal();
    toggleCart();
}

// ==================== 5. PAINEL ADMIN (CRUD & GESTÃO DE IMAGENS) ====================

function openAdminPanel() {
    if (!auth.currentUser || !currentUser?.isAdmin) {
        showToast('Acesso negado', 'error');
        return;
    }
    document.getElementById('adminPanel').classList.add('active');
    renderAdminProducts();
    updateAdminStats();
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('active');
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    
    if (event && event.target) event.target.classList.add('active');
    
    if (tab === 'products') document.getElementById('productsTab').classList.add('active');
    if (tab === 'settings') document.getElementById('settingsTab').classList.add('active');
}

function updateAdminStats() {
    document.getElementById('totalProducts').textContent = productsData.length;
    const totalVal = productsData.reduce((sum, p) => sum + p.price, 0);
    document.getElementById('totalRevenue').textContent = `R$ ${totalVal.toFixed(2)}`;
}

function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if (!grid) return;
    
    grid.innerHTML = productsData.map(p => {
        const img = getProductImage(p);
        const isReal = isRealImage(img);
        return `
            <div class="admin-product-card">
                <div class="admin-product-image" style="${isReal ? `background-image: url('${img}')` : `background: ${img}`}"></div>
                <div class="admin-product-info">
                    <h4>${p.name}</h4>
                    <p>${p.category} | R$ ${p.price.toFixed(2)}</p>
                </div>
                <div class="admin-actions">
                    <button class="admin-btn admin-btn-edit" onclick="openProductModal('${p.id}')">Editar</button>
                    <button class="admin-btn admin-btn-delete" onclick="deleteProduct('${p.id}')">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- Modal de Edição de Produto ---

function openProductModal(productId = null) {
    editingProductId = productId;
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('productForm');
    
    form.reset();
    productColors = [];
    tempProductImages = [];

    if (productId) {
        const p = productsData.find(prod => prod.id === productId);
        if (p) {
            title.textContent = 'Editar Produto';
            document.getElementById('productId').value = p.id;
            document.getElementById('productName').value = p.name;
            document.getElementById('productCategory').value = p.category;
            document.getElementById('productPrice').value = p.price;
            document.getElementById('productOldPrice').value = p.oldPrice || '';
            document.getElementById('productBadge').value = p.badge || '';
            document.getElementById('productBlackFriday').checked = !!p.isBlackFriday;
            
            if(p.images) tempProductImages = [...p.images];
            else if(p.image) tempProductImages = [p.image];
            
            if(p.colors) productColors = [...p.colors];
        }
    } else {
        title.textContent = 'Novo Produto';
        document.getElementById('productId').value = '';
        tempProductImages = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
    }
    
    renderProductImages();
    renderProductColorsManager();
    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

// --- Gerenciamento de Imagens (COM ORDENAÇÃO DE CAPA) ---

function renderProductImages() {
    const container = document.getElementById('productImagesList');
    if (!container) return;

    container.innerHTML = tempProductImages.map((img, index) => {
        const isReal = isRealImage(img);
        const isCover = index === 0; // Index 0 é sempre a capa

        return `
            <div class="image-item ${isCover ? 'is-cover' : ''}">
                <div class="image-item-preview" style="${isReal ? `background-image: url('${img}')` : `background: ${img}`}"></div>
                <button type="button" class="image-item-remove" onclick="removeProductImage(${index})">✕</button>
                
                <div class="image-item-actions">
                    ${isCover 
                        ? `<span class="cover-badge">★ CAPA</span>` 
                        : `<button type="button" class="btn-set-cover" onclick="setProductCover(${index})">Virar Capa</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function setProductCover(index) {
    if (index <= 0 || index >= tempProductImages.length) return;
    // Remove a imagem da posição atual
    const imageToMove = tempProductImages.splice(index, 1)[0];
    // Coloca no início (índice 0)
    tempProductImages.unshift(imageToMove);
    // Re-renderiza visualmente
    renderProductImages();
    showToast('Nova capa definida!', 'success');
}

function removeProductImage(index) {
    if (tempProductImages.length <= 1) return showToast('Mínimo 1 imagem', 'error');
    tempProductImages.splice(index, 1);
    renderProductImages();
}

// --- Upload e Inputs ---
async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files.length) return;
    
    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = '⏳ Enviando imagens...';
    document.getElementById('productImagesList').before(loadingMsg);

    for (const file of files) {
        if (file.size > 5 * 1024 * 1024) continue;
        try {
            const ref = storage.ref().child(`produtos/${Date.now()}_${file.name}`);
            await ref.put(file);
            const url = await ref.getDownloadURL();
            tempProductImages.push(url);
        } catch (e) {
            console.error(e);
        }
    }
    loadingMsg.remove();
    renderProductImages();
    event.target.value = '';
}

function toggleUrlInput() { document.getElementById('imageUrlInputBox').classList.toggle('active'); }
function toggleGradientInput() { document.getElementById('imageGradientInputBox').classList.toggle('active'); }

function addImageFromUrl() {
    const url = document.getElementById('imageUrlField').value.trim();
    if (url) { tempProductImages.push(url); renderProductImages(); toggleUrlInput(); }
}
function addGradientImage() {
    const grad = document.getElementById('gradientField').value.trim();
    if (grad) { tempProductImages.push(grad); renderProductImages(); toggleGradientInput(); }
}

// --- Cores ---
function renderProductColorsManager() {
    const container = document.getElementById('productColorsManager');
    if (!container) return;
    
    if (productColors.length === 0) {
        container.innerHTML = '<p style="color:#999;text-align:center">Nenhuma cor adicionada</p>';
        return;
    }

    container.innerHTML = productColors.map((c, idx) => `
        <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; padding:10px; margin-bottom:5px; border-radius:6px; border-left:4px solid ${c.hex}">
            <div><strong>${c.name}</strong> <small>(${c.images.length} fotos)</small></div>
            <button type="button" onclick="removeProductColor(${idx})" style="color:red; border:none; background:none; cursor:pointer">🗑️</button>
        </div>
    `).join('');
}

function addColorToProduct() {
    if (tempProductImages.length === 0) return alert('Adicione fotos antes de criar a cor!');
    const name = prompt('Nome da Cor (ex: Azul):');
    if (!name) return;
    const hex = prompt('Código Hex (ex: #0000FF):');
    if (!hex) return;

    productColors.push({
        name: name.trim(),
        hex: hex.trim(),
        images: [...tempProductImages] // Clona imagens atuais para a cor
    });

    renderProductColorsManager();
    if (confirm('Limpar imagens atuais para adicionar a próxima cor?')) {
        tempProductImages = [];
        renderProductImages();
    }
}

function removeProductColor(index) {
    productColors.splice(index, 1);
    renderProductColorsManager();
}

// --- Salvar no Firebase ---
async function saveProduct(event) {
    event.preventDefault();
    if (!auth.currentUser || !currentUser?.isAdmin) return showToast('Permissão negada', 'error');

    document.getElementById('loadingOverlay').classList.add('active');

    const productData = {
        name: document.getElementById('productName').value.trim(),
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        oldPrice: document.getElementById('productOldPrice').value ? parseFloat(document.getElementById('productOldPrice').value) : null,
        badge: document.getElementById('productBadge').value.trim() || null,
        isBlackFriday: document.getElementById('productBlackFriday').checked,
        images: tempProductImages, // ✅ AQUI SALVA A ORDEM VISUAL (incluindo a capa em [0])
        colors: productColors.length > 0 ? productColors : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editingProductId) {
            await db.collection('produtos').doc(editingProductId).update(productData);
            showToast('Produto atualizado!');
        } else {
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('produtos').add(productData);
            showToast('Produto criado!');
        }
        
        productCache.clear();
        closeProductModal();
        await loadProducts();
        updateAdminStats();
        
    } catch (e) {
        console.error(e);
        showToast('Erro ao salvar: ' + e.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

async function deleteProduct(id) {
    if (!confirm('Excluir este produto?')) return;
    try {
        await db.collection('produtos').doc(id).delete();
        productsData = productsData.filter(p => p.id !== id);
        productCache.clear();
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        showToast('Produto excluído');
    } catch (e) {
        showToast('Erro ao excluir', 'error');
    }
}

// ==================== 6. AUTENTICAÇÃO ====================

function openUserPanel() { document.getElementById('userPanel').classList.add('active'); }
function closeUserPanel() { document.getElementById('userPanel').classList.remove('active'); }

function switchUserTab(tab) {
    document.querySelectorAll('.user-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.user-panel-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tab}Tab`).classList.add('active');
    const idx = tab === 'login' ? 0 : 1;
    document.querySelectorAll('.user-panel-tab')[idx].classList.add('active');
}

async function userLogin(e) {
    e.preventDefault();
    const emailIn = document.getElementById('loginEmail').value.trim().toLowerCase();
    const pass = document.getElementById('loginPassword').value;
    const email = (emailIn === 'admin') ? 'admin@sejaversatil.com.br' : emailIn;

    try {
        const cred = await auth.signInWithEmailAndPassword(email, pass);
        checkUserRole(cred.user);
    } catch (err) {
        document.getElementById('loginError').textContent = 'Email ou senha incorretos';
        document.getElementById('loginError').classList.add('active');
    }
}

async function userRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const pass = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirmPassword').value;
    
    if (pass !== confirm) return showToast('Senhas não conferem', 'error');

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await cred.user.updateProfile({ displayName: name });
        await db.collection('users').doc(cred.user.uid).set({
            name, email, role: 'customer', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Conta criada! Faça login.', 'success');
        switchUserTab('login');
    } catch (err) {
        document.getElementById('registerError').textContent = err.message;
        document.getElementById('registerError').classList.add('active');
    }
}

async function checkUserRole(user) {
    if (!user) return;
    const adminDoc = await db.collection('admins').doc(user.uid).get();
    currentUser = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || 'Usuário',
        isAdmin: adminDoc.exists && adminDoc.data().role === 'admin'
    };
    localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
    updateUserUI();
    closeUserPanel();
    if (currentUser.isAdmin) {
        isAdminLoggedIn = true;
        document.getElementById('adminAccessBtn').style.display = 'block';
    }
}

function updateUserUI() {
    if (!currentUser) return;
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userStatus').innerHTML = currentUser.isAdmin ? 'Administrador <span class="admin-badge">ADMIN</span>' : 'Cliente';
    
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('registerTab').classList.remove('active');
    document.getElementById('userLoggedTab').classList.add('active');
    document.getElementById('userPanelTabs').style.display = 'none';
}

async function userLogout() {
    await auth.signOut();
    currentUser = null;
    isAdminLoggedIn = false;
    localStorage.removeItem('sejaVersatilCurrentUser');
    location.reload();
}

auth.onAuthStateChanged(user => { if (user) checkUserRole(user); });

async function resetPassword() {
    const email = prompt('Digite seu email:');
    if(email) {
        try {
            await auth.sendPasswordResetEmail(email);
            showToast('Email enviado!');
        } catch(e) { showToast('Erro: ' + e.message, 'error'); }
    }
}

// ==================== 7. UI GERAL & SETTINGS ====================

function loadSettings() {
    const saved = localStorage.getItem('sejaVersatilSettings');
    if (saved) {
        try {
            const s = JSON.parse(saved);
            const topBanner = document.querySelector('.top-banner .bf-label');
            if(topBanner && s.topBanner) topBanner.textContent = s.topBanner;
            
            const ti = document.getElementById('settingBannerTitle');
            if(ti) {
                ti.value = s.bannerTitle || '';
                document.getElementById('settingBannerSubtitle').value = s.bannerSubtitle || '';
                document.getElementById('settingTopBanner').value = s.topBanner || '';
            }
        } catch(e) {}
    }
}

function saveSettings() {
    const s = {
        bannerTitle: document.getElementById('settingBannerTitle').value,
        bannerSubtitle: document.getElementById('settingBannerSubtitle').value,
        topBanner: document.getElementById('settingTopBanner').value
    };
    localStorage.setItem('sejaVersatilSettings', JSON.stringify(s));
    showToast('Configurações salvas!');
    loadSettings();
}

function toggleSidebar() {
    document.getElementById('sidebarMenu').classList.toggle('active');
    document.getElementById('sidebarOverlay').classList.toggle('active');
    document.getElementById('hamburgerBtn').classList.toggle('active');
}

function filterProducts(category) {
    currentFilter = category;
    currentPage = 1;
    renderProducts();
    if(document.getElementById('sidebarMenu').classList.contains('active')) toggleSidebar();
}

function navigateToCategory(cat) {
    filterProducts(cat);
    document.getElementById('produtos').scrollIntoView({ behavior: 'smooth' });
}

function clearCategoryFilter() {
    currentFilter = 'all';
    renderProducts();
    document.getElementById('activeCategoryBadge').style.display = 'none';
}

function getCategoryName(cat) {
    const map = { 'blusas':'Blusas', 'conjunto calca':'Conjunto Calça', 'peca unica':'Peça Única', 'conjunto short saia':'Conjunto Short Saia', 'conjunto short':'Conjunto Short', 'all':'Todos' };
    return map[cat] || cat.toUpperCase();
}

function openProductDetails(id) {
    window.location.href = `produto.html?id=${id}`;
}

// ==================== 8. CAROUSEL & FAVORITOS ====================
function clearCarouselIntervals() {
    Object.values(carouselIntervals).forEach(clearInterval);
    carouselIntervals = {};
    carouselEventsRegistered.clear();
}

function setupAutoCarousel() {
    if (carouselsPaused) return;
    document.querySelectorAll('.product-card').forEach(card => {
        const slides = card.querySelectorAll('.product-image-slide');
        const dots = card.querySelectorAll('.product-carousel-dot');
        if(slides.length < 2) return;

        let interval;
        let idx = 0;

        card.addEventListener('mouseenter', () => {
            interval = setInterval(() => {
                slides[idx].classList.remove('active');
                if(dots[idx]) dots[idx].classList.remove('active');
                idx = (idx + 1) % slides.length;
                slides[idx].classList.add('active');
                if(dots[idx]) dots[idx].classList.add('active');
            }, 1200);
        });
        card.addEventListener('mouseleave', () => {
            clearInterval(interval);
            slides.forEach(s => s.classList.remove('active'));
            if(dots.length) dots.forEach(d => d.classList.remove('active'));
            slides[0].classList.add('active');
            if(dots[0]) dots[0].classList.add('active');
            idx = 0;
        });
    });
}

function toggleFavorite(id) {
    const idx = favorites.indexOf(id);
    if(idx > -1) { favorites.splice(idx, 1); showToast('Removido'); }
    else { favorites.push(id); showToast('Adicionado aos favoritos'); }
    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    
    const el = document.getElementById('favoritesCount');
    if(el) { el.textContent = favorites.length; el.style.display = favorites.length ? 'flex' : 'none'; }
    renderProducts();
}

function showFavorites() {
    if(!favorites.length) return showToast('Sem favoritos', 'info');
    currentFilter = 'favorites';
    renderProducts();
    document.getElementById('produtos').scrollIntoView({behavior:'smooth'});
}

// ==================== 9. INIT & EVENTS ====================

function initBlackFridayCountdown() {
    const end = new Date(2025, 10, 30, 23, 59, 59).getTime();
    setInterval(() => {
        const now = new Date().getTime();
        const diff = end - now;
        if (diff < 0) return;
        
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        const elD = document.getElementById('bfDays');
        if(elD) {
            elD.textContent = String(d).padStart(2,'0');
            document.getElementById('bfHours').textContent = String(h).padStart(2,'0');
            document.getElementById('bfMinutes').textContent = String(m).padStart(2,'0');
            document.getElementById('bfSeconds').textContent = String(s).padStart(2,'0');
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    const loading = document.getElementById('loadingOverlay');
    if(loading) loading.classList.add('active');
    
    Promise.all([loadProducts(), loadCart()]).then(() => {
        loadSettings();
        if(typeof initHeroCarousel === 'function') initHeroCarousel();
        initBlackFridayCountdown();
        if(loading) loading.classList.remove('active');
        
        const elFav = document.getElementById('favoritesCount');
        if(elFav) {
             elFav.textContent = favorites.length;
             elFav.style.display = favorites.length ? 'flex' : 'none';
        }
    });

    // Busca Live
    const searchInput = document.getElementById('headerSearchInput');
    if(searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const q = e.target.value.toLowerCase();
            const dropdown = document.getElementById('headerDropdown');
            if(q.length < 2) { dropdown.classList.remove('active'); return; }
            
            const matches = productsData.filter(p => p.name.toLowerCase().includes(q)).slice(0, 5);
            dropdown.innerHTML = matches.length === 0 
                ? '<div class="search-dropdown-item" style="justify-content:center">Nenhum resultado</div>'
                : matches.map(p => `
                    <div class="search-dropdown-item" onclick="openProductDetails('${p.id}')">
                        <div class="search-dropdown-thumb" style="background: url('${getProductImage(p)}') center/cover"></div>
                        <div class="search-dropdown-info">
                            <div class="search-dropdown-title">${p.name}</div>
                            <div class="search-dropdown-price">R$ ${p.price.toFixed(2)}</div>
                        </div>
                    </div>`).join('');
            dropdown.classList.add('active');
        }, 300));
        
        // Enter na busca
        searchInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                const q = e.target.value.toLowerCase();
                if(q.length < 2) return;
                document.getElementById('headerDropdown').classList.remove('active');
                currentFilter = 'all'; // Reseta filtro
                // Filtro simples na visualização atual
                const grid = document.getElementById('productsGrid');
                const filtered = productsData.filter(p => p.name.toLowerCase().includes(q));
                if(filtered.length === 0) return showToast('Nenhum produto encontrado', 'info');
                
                // Renderiza manual para a busca
                grid.innerHTML = filtered.map(p => {
                    const img = getProductImage(p);
                    return `<div class="product-card" onclick="openProductDetails('${p.id}')">
                        <div class="product-image" style="background:url('${img}') center/cover"></div>
                        <div class="product-info"><h4>${p.name}</h4><p>R$ ${p.price.toFixed(2)}</p></div>
                    </div>`;
                }).join('');
                document.getElementById('produtos').scrollIntoView({behavior:'smooth'});
            }
        });
    }

    document.addEventListener('click', e => {
        const dd = document.getElementById('headerDropdown');
        if(dd && !searchInput.contains(e.target) && !dd.contains(e.target)) dd.classList.remove('active');
    });

    // Ver Favoritos via URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ver_favoritos') === 'true') setTimeout(showFavorites, 500);
});

// ESC para fechar
document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') {
        closeAdminPanel(); closeUserPanel(); closeProductModal();
        closePaymentModal(); toggleCart(); toggleSidebar();
        document.getElementById('headerDropdown')?.classList.remove('active');
    }
});

