// ==================== SCRIPT2.JS - SEJA VERSÁTIL ====================
// Sistema Principal de E-commerce - Organizado e Limpo
// ====================================================================

// ==================== SELETORES E UTILITÁRIOS GLOBAIS ====================
const $ = (id) => document.getElementById(id);

// Helper para animações suaves com requestAnimationFrame
function smoothAnimate(element, className, action = 'add') {
    if (!element) return;
    
    requestAnimationFrame(() => {
        if (action === 'add') {
            element.classList.add(className);
        } else if (action === 'remove') {
            element.classList.remove(className);
        } else if (action === 'toggle') {
            element.classList.toggle(className);
        }
    });
}

// ==================== CLASSE: SECURE STORAGE ====================
class SecureStorage {
    constructor(key) {
        this.key = key;
    }
    
    // Criptografia simples (suficiente para dados não críticos)
    encrypt(data) {
        return btoa(encodeURIComponent(JSON.stringify(data)));
    }
    
    decrypt(data) {
        try {
            return JSON.parse(decodeURIComponent(atob(data)));
        } catch {
            return null;
        }
    }
    
    set(key, value) {
        localStorage.setItem(key, this.encrypt(value));
    }
    
    get(key) {
        const data = localStorage.getItem(key);
        return data ? this.decrypt(data) : null;
    }
    
    remove(key) {
        localStorage.removeItem(key);
    }
}

const secureStorage = new SecureStorage('sejaVersatil_v1');

// ==================== GERENCIADOR DE CARRINHO ====================
const CartManager = {
    _cart: [],
    _appliedCoupon: null,
    _couponDiscount: 0,
    
    get cart() { return this._cart; },
    set cart(val) { 
        this._cart = val; 
        this.save();
    },
    
    get appliedCoupon() { return this._appliedCoupon; },
    set appliedCoupon(val) { 
        this._appliedCoupon = val; 
        this.save();
    },
    
    get couponDiscount() { return this._couponDiscount; },
    set couponDiscount(val) { 
        this._couponDiscount = val; 
        this.save();
    },
    
    getSubtotal() {
        return this._cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    },
    
    save() {
        try {
            localStorage.setItem('sejaVersatilCart', JSON.stringify({
                items: this._cart,
                appliedCoupon: this._appliedCoupon,
                couponDiscount: this._couponDiscount
            }));
        } catch (err) {
            console.error('❌ Save failed:', err);
        }
    },
    
    load() {
        try {
            const raw = localStorage.getItem('sejaVersatilCart');
            if (!raw) return;
            
            const parsed = JSON.parse(raw);
            this._cart = parsed.items || [];
            this._appliedCoupon = parsed.appliedCoupon || null;
            this._couponDiscount = parsed.couponDiscount || 0;
        } catch (err) {
            console.error('❌ Load failed:', err);
        }
    }
};

// ==================== CLASSES UTILITÁRIAS ====================
class CacheManager {
    constructor(ttl = 1800000) {
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

// ==================== VARIÁVEIS GLOBAIS ====================
let productsData = [];
let cart = [];
let currentFilter = 'all';
let currentSort = '';
let currentPage = 1;
const itemsPerPage = window.innerWidth <= 768 ? 8 : 12;
let tempProductImages = [];
let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
let viewHistory = JSON.parse(localStorage.getItem('viewHistory') || '[]');
let carouselIntervals = {};
const carouselEventsRegistered = new Set();
let carouselsPaused = false;
let isInternalNavigation = false;
let selectedSize = 'M';
let selectedColor = null;
let selectedQuantity = 1;
let currentProductDetails = null;
let appliedCoupon = null;
let couponDiscount = 0;
let productColors = [];
let editingProductId = null;
let productVariants = {};
const productCache = new CacheManager();
const firestoreRateLimiter = new RateLimiter(10, 60000);
const WHATSAPP_NUMBER = '5571991427103';

// ==================== FUNÇÕES DE AJUDA (HELPERS) ====================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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

function trackEvent(category, action, label) {
    console.log(`📊 Event: ${category} - ${action} - ${label}`);
    
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            event_category: category,
            event_label: label
        });
    }
}

function getProductImage(product) {
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images[0];
    }
    if (product.image) {
        return product.image;
    }
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}

function getProductImages(product) {
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images;
    }
    if (product.image) {
        return [product.image];
    }
    return ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
}

function isRealImage(imageSrc) {
    return imageSrc && (imageSrc.startsWith('data:image') || imageSrc.startsWith('http'));
}

function isNewProduct(product) {
    if (!product.createdAt) return false;
    
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    let createdTime;
    if (product.createdAt.toMillis) {
        createdTime = product.createdAt.toMillis();
    } else if (typeof product.createdAt === 'number') {
        createdTime = product.createdAt;
    } else {
        return false;
    }
    
    return createdTime > sevenDaysAgo;
}

function getImageForColor(product, colorName) {
    if (!colorName) {
        if (Array.isArray(product.images) && product.images.length > 0) {
            return product.images[0];
        }
        return product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    if (Array.isArray(product.colors) && product.colors.length > 0) {
        const colorObj = product.colors.find(c => {
            const cName = typeof c === 'object' ? String(c.name).trim() : String(c).trim();
            return cName === String(colorName).trim();
        });
        
        if (colorObj && colorObj.images && Array.isArray(colorObj.images) && colorObj.images.length > 0) {
            return colorObj.images[0];
        }
    }
    
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images[0];
    }
    
    return product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}

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
    if (data.price > 10000) {
        errors.push('Preço não pode exceder R$ 10.000');
    }
    
    if (data.oldPrice && data.oldPrice <= data.price) {
        errors.push('Preço antigo deve ser maior que o preço atual');
    }
    
    if (data.badge && data.badge.length > 20) {
        errors.push('Badge deve ter no máximo 20 caracteres');
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

// ==================== PRODUTOS PADRÃO (FALLBACK) ====================
const DEFAULT_PRODUCTS = [
    { name: 'Blusa Fitness Sem Costura', category: 'blusas', price: 89.90, oldPrice: null, badge: 'Novo', images: ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'] },
    { name: 'Blusa Regata Essential', category: 'blusas', price: 69.90, oldPrice: 89.90, badge: '-22%', images: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'] },
    { name: 'Blusa Cropped Strappy', category: 'blusas', price: 79.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #30cfd0 0%, #330867 100%)'] },
    
    { name: 'Conjunto Calça High Waist', category: 'conjunto calca', price: 209.90, oldPrice: 299.90, badge: '-30%', images: ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)'] },
    { name: 'Conjunto Calça Seamless Pro', category: 'conjunto calca', price: 229.90, oldPrice: 279.90, badge: '-20%', images: ['linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)'] },
    { name: 'Conjunto Calça Premium', category: 'conjunto calca', price: 249.90, oldPrice: null, badge: 'Lançamento', images: ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'] },
    
    { name: 'Peça Única Fitness Premium', category: 'peca unica', price: 149.90, oldPrice: 189.90, badge: 'Novo', images: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'] },
    { name: 'Peça Única Metallic Rose', category: 'peca unica', price: 159.90, oldPrice: null, badge: 'Novo', images: ['linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'] },
    { name: 'Peça Única Alta Compressão', category: 'peca unica', price: 139.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #434343 0%, #000000 100%)'] },
    { name: 'Peça Única Tie Dye', category: 'peca unica', price: 159.90, oldPrice: 199.90, badge: '-20%', images: ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'] },
    
    { name: 'Conjunto Short Saia Premium', category: 'conjunto short saia', price: 169.90, oldPrice: null, badge: 'Novo', images: ['linear-gradient(135deg, #fa709a 0%, #fee140 100%)'] },
    { name: 'Conjunto Short Saia Ribbed', category: 'conjunto short saia', price: 149.90, oldPrice: 199.90, badge: '-25%', images: ['linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'] },
    
    { name: 'Conjunto Short Seamless', category: 'conjunto short', price: 79.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'] },
    { name: 'Conjunto Short Fitness', category: 'conjunto short', price: 189.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)'] },
    { name: 'Conjunto Short Push Up', category: 'conjunto short', price: 99.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'] }
];

async function inicializarProdutosPadrao() {
    if (productsData.length === 0) {
        console.log('📦 Nenhum produto no Firestore, adicionando produtos padrão...');
        
        for (const produto of DEFAULT_PRODUCTS) {
            try {
                await db.collection("produtos").add({
                    ...produto,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error(`❌ Erro ao adicionar "${produto.name}":`, error);
            }
        }
        
        await carregarProdutosDoFirestore();
    }
}

// ==================== LÓGICA DO FIRESTORE ====================
async function carregarProdutosDoFirestore() {
    try {
        const cached = productCache.get('products');
        if (cached) {
            productsData = cached;
            return productsData;
        }

        if (!firestoreRateLimiter.canMakeRequest()) {
            console.warn('⚠️ Rate limit atingido');
            showToast('Muitas requisições. Aguarde um momento.', 'error');
            return productsData;
        }

        const snapshot = await db.collection("produtos").get();
        productsData.length = 0;

        snapshot.forEach((doc) => {
            productsData.push({
                id: doc.id,
                ...doc.data()
            });
        });

        productCache.set('products', productsData);
        return productsData;
        
    } catch (error) {
        console.error("❌ Erro ao carregar produtos do Firestore:", error);

        if (error.code === 'permission-denied') {
            console.error('🔒 Permissão negada. Verifique as regras do Firestore.');
            showToast('Erro de permissão ao carregar produtos', 'error');
        } else if (error.code === 'unavailable') {
            console.error('🌐 Firestore indisponível. Verifique sua conexão.');
            showToast('Sem conexão com o servidor', 'error');
        }

        return productsData;
    }
}

async function loadProducts() {
    try {
        await carregarProdutosDoFirestore();
        await inicializarProdutosPadrao();
    } catch (error) {
        console.error("Erro ao carregar do Firestore:", error);
        showToast('⚠️ Erro ao conectar com o banco de dados', 'error');
    }
}

function saveProducts() {
    localStorage.setItem('sejaVersatilProducts', JSON.stringify(productsData));
}

// ==================== PAINEL ADMIN (BASE) ====================
async function openAdminPanel() {
    if (!auth.currentUser) {
        showToast('❌ Você precisa fazer login como administrador', 'error');
        openUserPanel();
        return;
    }
    
    if (!currentUser || !currentUser.isAdmin) {
        showToast('❌ Você não tem permissões de administrador', 'error');
        return;
    }
    
    try {
        const adminDoc = await db.collection('admins').doc(auth.currentUser.uid).get();
        
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            showToast('❌ Permissões de admin revogadas', 'error');
            await userLogout();
            return;
        }
        
        document.getElementById('adminPanel').classList.add('active');
        renderAdminProducts();
        updateAdminStats();
        loadCoupons();
        
    } catch (error) {
        console.error('❌ Erro ao verificar permissões:', error);
        showToast('❌ Erro ao verificar permissões', 'error');
    }
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('active');
    // Nota: Mantemos isAdminLoggedIn como true para facilitar, 
    // mas em sistemas críticos deveríamos revalidar
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');

    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tab === 'products') {
        document.getElementById('productsTab').classList.add('active');
    } else if (tab === 'settings') {
        document.getElementById('settingsTab').classList.add('active');
    } else if (tab === 'coupons') {
        document.getElementById('couponsTab').classList.add('active');
        loadCoupons();
    }
}

function updateAdminStats() {
    const totalProducts = productsData.length;
    const totalValue = productsData.reduce((sum, p) => sum + p.price, 0);
    const activeProducts = productsData.filter(p => !p.oldPrice).length;

    const elTotal = document.getElementById('totalProducts');
    const elRevenue = document.getElementById('totalRevenue');
    const elOrders = document.getElementById('totalOrders');
    const elActive = document.getElementById('activeProducts');

    if (elTotal) elTotal.textContent = totalProducts;
    if (elRevenue) elRevenue.textContent = `R$ ${totalValue.toFixed(2)}`;
    if (elOrders) elOrders.textContent = Math.floor(Math.random() * 50) + 10;
    if (elActive) elActive.textContent = activeProducts;
}

function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if (!grid) return;
    
    grid.innerHTML = productsData.map(product => {
        let images = [];
        
        if (Array.isArray(product.images) && product.images.length > 0) {
            images = product.images;
        } else if (product.image) {
            images = [product.image];
        } else {
            images = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
        }
        
        const firstImage = images[0];
        const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
        
        return `
            <div class="admin-product-card">
                <div class="admin-product-image" style="${isRealImage ? `background-image: url(${firstImage}); background-size: cover; background-position: center;` : `background: ${firstImage}`}"></div>
                <div class="admin-product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <p><strong>Categoria:</strong> ${product.category}</p>
                    <p><strong>Preço:</strong> R$ ${product.price.toFixed(2)}</p>
                    ${product.oldPrice ? `<p><strong>De:</strong> R$ ${product.oldPrice.toFixed(2)}</p>` : ''}
                    ${product.badge ? `<p><strong>Badge:</strong> ${sanitizeInput(product.badge)}</p>` : ''}
                    <p><strong>Imagens:</strong> ${images.length}</p>
                </div>
                <div class="admin-actions">
                    <button class="admin-btn admin-btn-edit" onclick="editProduct('${product.id}')">Editar</button>
                    <button class="admin-btn admin-btn-delete" onclick="deleteProduct('${product.id}')">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== ADMIN: MODAL DE PRODUTOS ====================
function openProductModal(productId = null) {
    editingProductId = productId;
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');
    const modalContent = modal.querySelector('.admin-modal-content');
    
    if (modalContent) modalContent.scrollTop = 0;
    modal.scrollTop = 0;

    if (productId) {
        const product = productsData.find(p => p.id === productId);
        title.textContent = 'Editar Produto';
        document.getElementById('productId').value = productId;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productOldPrice').value = product.oldPrice || '';
        document.getElementById('productBadge').value = product.badge || '';
        document.getElementById('productBlackFriday').checked = product.isBlackFriday || false;
        
        // Carregar imagens e cores
        tempProductImages = [...(product.images || (product.image ? [product.image] : []))];
        productColors = product.colors ? JSON.parse(JSON.stringify(product.colors)) : [];
        
        setTimeout(() => renderProductColorsManager(), 100);
    } else {
        title.textContent = 'Adicionar Novo Produto';
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        tempProductImages = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
        productColors = [];
        setTimeout(() => renderProductColorsManager(), 100);
    }

    renderProductImages();
    modal.classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    editingProductId = null;
    productColors = [];
}

function editProduct(productId) {
    openProductModal(productId);
}

function switchDescTab(tab) {
    document.querySelectorAll('.desc-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.description-tab-content').forEach(c => c.classList.remove('active'));
    
    if (event && event.target) event.target.classList.add('active');
    
    if (tab === 'details') {
        document.getElementById('detailsTabContent').classList.add('active');
    } else if (tab === 'tech') {
        document.getElementById('techTabContent').classList.add('active');
    } else if (tab === 'care') {
        document.getElementById('careTabContent').classList.add('active');
    } else if (tab === 'sustain') {
        document.getElementById('sustainTabContent').classList.add('active');
    }
}

// ==================== ADMIN: GERENCIAMENTO DE IMAGENS ====================
function renderProductImages() {
    const container = document.getElementById('productImagesList');
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
    container.style.gap = '15px';

    const hasColors = Array.isArray(productColors) && productColors.length > 0;

    tempProductImages.forEach((img, index) => {
        const isCover = index === 0;
        const isImage = img.startsWith('data:image') || img.startsWith('http');

        let linkedColor = null;
        if (hasColors) {
            linkedColor = productColors.find(color => 
                color.images && color.images.includes(img)
            );
        }

        const card = document.createElement('div');
        card.className = 'admin-image-card';
        card.style.cssText = `
            background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden; display: flex; flex-direction: column; position: relative;
            border: ${isCover ? '2px solid #3498db' : '1px solid #eee'};
        `;

        const imgArea = document.createElement('div');
        imgArea.style.cssText = `
            height: 140px; width: 100%; position: relative;
            background: ${isImage ? '#f0f0f0' : img};
        `;

        if (isImage) {
            const imageEl = document.createElement('img');
            imageEl.src = img;
            imageEl.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            imgArea.appendChild(imageEl);
        }

        if (isCover) {
            const badge = document.createElement('div');
            badge.innerText = '★ CAPA PRINCIPAL';
            badge.style.cssText = `
                position: absolute; top: 0; left: 0; right: 0;
                background: rgba(52, 152, 219, 0.9); color: white;
                font-size: 0.7rem; font-weight: bold; text-align: center;
                padding: 4px; z-index: 5;
            `;
            imgArea.appendChild(badge);
        }

        if (linkedColor) {
            const colorBadge = document.createElement('div');
            colorBadge.title = `Vinculada a: ${linkedColor.name}`;
            colorBadge.style.cssText = `
                position: absolute; bottom: 5px; right: 5px;
                width: 24px; height: 24px; border-radius: 50%;
                background: ${linkedColor.hex}; border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 5;
            `;
            imgArea.appendChild(colorBadge);
        }

        const btnRemove = document.createElement('button');
        btnRemove.innerHTML = '✕';
        btnRemove.type = 'button';
        btnRemove.style.cssText = `
            position: absolute; top: 5px; right: 5px;
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(231, 76, 60, 0.9); color: white;
            border: none; cursor: pointer; font-weight: bold;
            display: flex; align-items: center; justify-content: center; z-index: 10;
        `;
        btnRemove.onclick = (e) => {
            e.preventDefault(); 
            e.stopPropagation();
            removeProductImage(index);
        };
        imgArea.appendChild(btnRemove);

        const actionsBar = document.createElement('div');
        actionsBar.style.cssText = `
            padding: 8px; background: #f8f9fa; border-top: 1px solid #eee;
            display: flex; gap: 5px; flex-direction: column;
        `;

        if (!isCover) {
            const btnSetCover = document.createElement('button');
            btnSetCover.type = 'button';
            btnSetCover.innerText = '🏠 Virar Capa';
            btnSetCover.style.cssText = `
                background: white; border: 1px solid #3498db; color: #3498db;
                padding: 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;
                cursor: pointer; width: 100%;
            `;
            btnSetCover.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                setProductCover(index);
            };
            actionsBar.appendChild(btnSetCover);
        }

        if (hasColors) {
            const btnLinkColor = document.createElement('button');
            btnLinkColor.type = 'button';
            btnLinkColor.innerText = linkedColor ? `🎨 ${linkedColor.name}` : '🎨 Vincular Cor';
            
            const bg = linkedColor ? '#9b59b6' : 'white';
            const fg = linkedColor ? 'white' : '#9b59b6';
            
            btnLinkColor.style.cssText = `
                background: ${bg}; border: 1px solid #9b59b6; color: ${fg};
                padding: 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;
                cursor: pointer; width: 100%;
            `;
            
            btnLinkColor.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                linkImageToColor(index);
            };
            actionsBar.appendChild(btnLinkColor);
        } else {
            const noColorMsg = document.createElement('div');
            noColorMsg.innerText = 'Adicione cores para vincular';
            noColorMsg.style.cssText = 'font-size: 0.65rem; color: #999; text-align: center; padding: 4px;';
            actionsBar.appendChild(noColorMsg);
        }

        card.appendChild(imgArea);
        card.appendChild(actionsBar);
        container.appendChild(card);
    });
}

function setProductCover(index) {
    if (index <= 0 || index >= tempProductImages.length) return;
    const imageToMove = tempProductImages.splice(index, 1)[0];
    tempProductImages.unshift(imageToMove);
    renderProductImages();
    showToast('Capa atualizada com sucesso!', 'success');
}

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files.length) return;
    
    if (!storage) {
        showToast('Firebase Storage não está configurado', 'error');
        event.target.value = '';
        return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    for (const file of files) {
        if (file.size > MAX_SIZE) {
            showToast(`Arquivo "${file.name}" é muito grande! Máximo: 5MB`, 'error');
            event.target.value = '';
            return;
        }
    }
    
    const loadingMsg = document.createElement('div');
    loadingMsg.style.cssText = 'padding: 1rem; background: #f0f0f0; margin-bottom: 1rem; border-radius: 4px;';
    loadingMsg.textContent = '⏳ Fazendo upload das imagens...';
    document.getElementById('productImagesList').parentElement.insertBefore(loadingMsg, document.getElementById('productImagesList'));

    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            showToast('Por favor, selecione apenas arquivos de imagem!', 'error');
            continue;
        }

        try {
            const storageRef = storage.ref();
            const imageRef = storageRef.child(`produtos/${Date.now()}_${file.name}`);
            await imageRef.put(file);
            const imageUrl = await imageRef.getDownloadURL();
            tempProductImages.push(imageUrl);
            renderProductImages();
        } catch (error) {
            console.error('Erro ao fazer upload:', error);
            showToast('Erro ao fazer upload da imagem: ' + error.message, 'error');
        }
    }

    loadingMsg.remove();
    event.target.value = '';
}

function toggleUrlInput() {
    const urlBox = document.getElementById('imageUrlInputBox');
    const gradientBox = document.getElementById('imageGradientInputBox');
    
    if (urlBox) {
        if (gradientBox && gradientBox.classList.contains('active')) {
            gradientBox.classList.remove('active');
        }
        urlBox.classList.toggle('active');
        if (urlBox.classList.contains('active')) {
            const urlField = document.getElementById('imageUrlField');
            if (urlField) urlField.focus();
        }
    }
}

function toggleGradientInput() {
    const gradientBox = document.getElementById('imageGradientInputBox');
    const urlBox = document.getElementById('imageUrlInputBox');
    
    if (gradientBox) {
        if (urlBox && urlBox.classList.contains('active')) {
            urlBox.classList.remove('active');
        }
        gradientBox.classList.toggle('active');
        if (gradientBox.classList.contains('active')) {
            const gradientField = document.getElementById('gradientField');
            if (gradientField) gradientField.focus();
        }
    }
}

function addImageFromUrl() {
    const urlField = document.getElementById('imageUrlField');
    if (!urlField) return;
    
    const imageUrl = urlField.value.trim();
    if (!imageUrl) {
        showToast('Cole o link da imagem!', 'error');
        return;
    }
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        showToast('URL inválida! Deve começar com http:// ou https://', 'error');
        return;
    }

    const img = new Image();
    img.onload = function() {
        tempProductImages.push(imageUrl);
        renderProductImages();
        urlField.value = '';
        toggleUrlInput();
        showToast('Imagem adicionada com sucesso!', 'success');
    };
    img.onerror = function() {
        showToast('Não foi possível carregar a imagem desta URL', 'error');
    };
    img.src = imageUrl;
}

function addGradientImage() {
    const gradientField = document.getElementById('gradientField');
    if (!gradientField) return;
    
    const gradient = gradientField.value.trim();
    if (!gradient) {
        showToast('Digite um gradiente CSS!', 'error');
        return;
    }
    if (!gradient.includes('gradient')) {
        showToast('Formato inválido! Exemplo: linear-gradient(...)', 'error');
        return;
    }

    tempProductImages.push(gradient);
    renderProductImages();
    gradientField.value = '';
    toggleGradientInput();
    showToast('Gradiente adicionado com sucesso!', 'success');
}

function removeProductImage(index) {
    if (tempProductImages.length === 0) return;
    const imageToRemove = tempProductImages[index];
    tempProductImages.splice(index, 1);

    if (productColors && productColors.length > 0) {
        productColors.forEach(color => {
            if (color.images) {
                color.images = color.images.filter(url => url !== imageToRemove);
            }
        });
    }
    if (index === 0 && tempProductImages.length > 0) {
        showToast('Nova capa definida automaticamente', 'info');
    }
    renderProductImages();
    renderProductColorsManager();
    showToast('🗑️ Imagem removida', 'info');
}

async function deleteProduct(productId) {
    if (!isAdminLoggedIn) {
        showToast('❌ Você não tem permissão para excluir produtos', 'error');
        return;
    }
    if (!confirm('Tem certeza que deseja excluir este produto? Esta ação é irreversível.')) {
        return;
    }

    document.getElementById('loadingOverlay').classList.add('active');
    try {
        await db.collection("produtos").doc(productId).delete();
        const index = productsData.findIndex(p => p.id === productId);
        if (index !== -1) productsData.splice(index, 1);
        
        productCache.clear();
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        showToast('Produto excluído com sucesso!', 'success');
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        showToast('Erro ao excluir produto: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

// ==================== ADMIN: SALVAR PRODUTO ====================
async function saveProduct(event) {
    event.preventDefault();

    if (!auth.currentUser || !currentUser.isAdmin) {
        showToast('❌ Apenas admins podem salvar produtos', 'error');
        closeProductModal();
        return;
    }

    const productId = editingProductId || document.getElementById('productId')?.value || db.collection('produtos').doc().id;
    
    const nameEl = document.getElementById('productName');
    const priceEl = document.getElementById('productPrice');
    const oldPriceEl = document.getElementById('productOldPrice');
    const categoryEl = document.getElementById('productCategory');
    const badgeEl = document.getElementById('productBadge');
    const blackFridayEl = document.getElementById('productBlackFriday');
    
    if (!nameEl || !priceEl || !categoryEl) {
        showToast('❌ Campos essenciais não encontrados no formulário', 'error');
        return;
    }
    
    const name = nameEl.value.trim();
    const price = parseFloat(priceEl.value);
    const oldPrice = oldPriceEl?.value ? parseFloat(oldPriceEl.value) : null;
    const category = categoryEl.value.trim();
    const badge = badgeEl?.value.trim() || '';
    const isBlackFriday = blackFridayEl?.checked || false;
    
    if (!name || !price || !category) {
        showToast('Preencha os campos obrigatórios (Nome, Preço, Categoria)', 'error');
        return;
    }

    if (price <= 0) {
        showToast('❌ Preço deve ser maior que zero', 'error');
        return;
    }

    const productData = {
        name,
        price,
        oldPrice,
        category,
        badge,
        isBlackFriday,
        images: tempProductImages.filter(url => url.startsWith('http') || url.startsWith('data:image') || url.includes('gradient')),
        colors: productColors || [],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!editingProductId) {
        productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    document.getElementById('loadingOverlay')?.classList.add('active');
    const batch = db.batch();
    const productRef = db.collection('produtos').doc(productId);

    try {
        batch.set(productRef, productData, { merge: true });

        // Criar variantes baseadas nas cores
        if (productColors && productColors.length > 0) {
            productColors.forEach(color => {
                const variantId = `${productId}_U_${color.name.replace(/\s/g, '')}`;
                const variantRef = productRef.collection('variants').doc(variantId);
                
                batch.set(variantRef, {
                    size: 'U',
                    color: color.name,
                    stock: 999,
                    price: price,
                    available: true
                }, { merge: true });
            });
        }
        
        await batch.commit();

        showToast(`✅ Produto "${name}" salvo com sucesso!`, 'success');
        
        productCache.clear();
        closeProductModal();
        
        await carregarProdutosDoFirestore(); 
        renderAdminProducts();
        renderProducts();
        updateAdminStats();

    } catch (error) {
        console.error("❌ Erro ao salvar produto:", error);
        showToast('Erro ao salvar: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay')?.classList.remove('active');
    }
}

// ==================== ADMIN: GERENCIADOR DE CORES ====================
function addColorToProduct() {
    const colorName = prompt('🎨 Digite o Nome da Cor (Ex: Preto, Rosa Choque):');
    if (!colorName || colorName.trim() === '') return;

    const colorHex = prompt(
        '🎨 Digite o Código Hex (Ex: #000000):\n\n' +
        '💡 Dica: Para duas cores, use vírgula (Ex: #000, #FFF)'
    );
    
    if (!colorHex || !colorHex.includes('#')) {
        alert('❌ Código inválido! O código deve ter o símbolo # (Ex: #FF0000)');
        return;
    }

    if (!Array.isArray(productColors)) {
        productColors = [];
    }

    productColors.push({
        name: colorName.trim(),
        hex: colorHex.trim().toUpperCase(),
        images: [] 
    });

    renderProductColorsManager(); 
    renderProductImages(); 
    
    showToast(`✅ Cor "${colorName}" adicionada! Agora vincule as fotos.`, 'success');
}

function renderProductColorsManager() {
    const container = document.getElementById('productColorsManager');
    if (!container) return;
    
    if (!Array.isArray(productColors)) {
        productColors = [];
    }
    
    if (productColors.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma cor adicionada ainda</p>';
        return;
    }
    
    container.innerHTML = productColors.map((color, index) => `
        <div class="color-card" style="--color: ${color.hex}">
            <div class="color-card-header">
                <div class="color-info">
                    <div class="color-swatch" style="background: ${color.hex}; ${
                        color.hex.toUpperCase() === '#FFFFFF' ? 'border-color: #ddd;' : ''
                    }"></div>
                    <div class="color-details">
                        <span class="color-name">${color.name}</span>
                        <span class="color-hex">${color.hex}</span>
                    </div>
                </div>
                <button type="button" onclick="removeProductColor(${index})" class="btn-remove-color">
                    🗑️ Remover
                </button>
            </div>
            <div class="color-images-count">
                📸 ${color.images ? color.images.length : 0} imagem(ns) vinculada(s)
            </div>
        </div>
    `).join('');
}

function linkImageToColor(imageIndex) {
    if (!Array.isArray(productColors) || productColors.length === 0) {
        showToast('❌ Cadastre pelo menos uma cor antes de vincular!', 'error');
        return;
    }
    
    if (imageIndex < 0 || imageIndex >= tempProductImages.length) {
        showToast('❌ Índice de imagem inválido!', 'error');
        return;
    }

    const imageUrl = tempProductImages[imageIndex];
    const colorNames = productColors.map((c, i) => `${i + 1}: ${c.name}`).join('\n');
    const choice = prompt(`Vincular imagem:\n\n0: Desvincular de todas\n${colorNames}\n\nDigite o número da cor:`);

    if (choice === null || choice.trim() === '') return;
    const choiceNum = parseInt(choice.trim());
    
    performLinkImageToColor(imageIndex, choiceNum);
}

function performLinkImageToColor(imageIndex, choiceNum) {
    const imageUrl = tempProductImages[imageIndex];
    
    if (choiceNum === 0) {
        productColors.forEach(c => {
            if (c.images) c.images = c.images.filter(u => u !== imageUrl);
        });
        renderProductImages();
        renderProductColorsManager();
        showToast('🔓 Foto desvinculada de todas as cores', 'info');
        return;
    }

    const idx = choiceNum - 1;
    if (idx < 0 || idx >= productColors.length || isNaN(idx)) {
        showToast('❌ Número inválido!', 'error');
        return;
    }
    
    productColors.forEach(c => {
        if (c.images) c.images = c.images.filter(u => u !== imageUrl);
    });

    if (!productColors[idx].images) productColors[idx].images = [];
    if (!productColors[idx].images.includes(imageUrl)) {
        productColors[idx].images.push(imageUrl);
    }
    
    renderProductImages();
    renderProductColorsManager();
    showToast(`✅ Foto vinculada a "${productColors[idx].name}"`, 'success');
}

function removeProductColor(index) {
    const color = productColors[index];
    if (confirm(`Remover a cor "${color.name}"?\n\nEsta ação não pode ser desfeita.`)) {
        productColors.splice(index, 1);
        renderProductColorsManager();
        renderProductImages(); // Re-render to remove indicators
        showToast(`Cor "${color.name}" removida`, 'info');
    }
}

// ==================== ADMIN: CONFIGURAÇÕES E MANUTENÇÃO ====================
function saveSettings() {
    const bannerTitle = sanitizeInput(document.getElementById('settingBannerTitle').value.trim());
    const bannerSubtitle = sanitizeInput(document.getElementById('settingBannerSubtitle').value.trim());
    const topBanner = sanitizeInput(document.getElementById('settingTopBanner').value.trim());

    localStorage.setItem('sejaVersatilSettings', JSON.stringify({
        bannerTitle,
        bannerSubtitle,
        topBanner
    }));

    showToast('Configurações salvas com sucesso!', 'success');
}

function loadSettings() {
    const saved = localStorage.getItem('sejaVersatilSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        const topBannerEl = document.querySelector('.top-banner');
        if (topBannerEl) topBannerEl.textContent = settings.topBanner;

        const elTitle = document.getElementById('settingBannerTitle');
        const elSubtitle = document.getElementById('settingBannerSubtitle');
        const elTopBanner = document.getElementById('settingTopBanner');

        if (elTitle) elTitle.value = settings.bannerTitle;
        if (elSubtitle) elSubtitle.value = settings.bannerSubtitle;
        if (elTopBanner) elTopBanner.value = settings.topBanner;
    }
}

async function limparTodosProdutos() {
    const confirmacao = confirm(
        '⚠️ ATENÇÃO! Esta ação irá DELETAR TODOS os produtos do Firestore.\n\n' +
        'Esta ação NÃO pode ser desfeita!\n\n' +
        'Tem CERTEZA ABSOLUTA que deseja continuar?'
    );
    
    if (!confirmacao) return;
    
    const confirmacaoDupla = prompt('Digite "DELETAR TUDO" (sem aspas) para confirmar:');
    
    if (confirmacaoDupla !== 'DELETAR TUDO') {
        showToast('Ação cancelada', 'info');
        return;
    }
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const snapshot = await db.collection("produtos").get();
        
        if (snapshot.empty) {
            showToast('Não há produtos para deletar', 'info');
            return;
        }
        
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        productsData.length = 0;
        productCache.clear();
        
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        
        showToast(`✅ ${snapshot.size} produtos foram deletados!`, 'success');
        
    } catch (error) {
        console.error("Erro ao limpar produtos:", error);
        showToast('Erro ao limpar produtos: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

// ==================== ADMIN: SISTEMA DE CUPONS ====================
function openCouponModal(couponId = null) {
    const modal = document.getElementById('couponModal');
    const form = document.getElementById('couponForm');
    
    if (couponId) {
        // Lógica de carregar dados existente no loadCouponData (se houver) ou implementar aqui se necessário
        // Como o usuário não forneceu loadCouponData explicitamente no código colado, 
        // assumimos que a edição abre o modal limpo ou o usuário implementará o preenchimento.
        // Baseado no código enviado, o form reset é o padrão.
        console.warn('Função de carregar dados do cupom para edição pendente de implementação específica.');
    } else {
        form.reset();
        document.getElementById('couponId').value = '';
        document.getElementById('couponActive').checked = true;
    }
    
    modal.classList.add('active');
}

function closeCouponModal() {
    document.getElementById('couponModal').classList.remove('active');
    document.getElementById('couponForm').reset();
}

function toggleMaxDiscount() {
    const type = document.getElementById('couponType').value;
    const maxDiscountGroup = document.getElementById('maxDiscountGroup');
    
    if (type === 'percentage') {
        maxDiscountGroup.style.display = 'block';
    } else {
        maxDiscountGroup.style.display = 'none';
        document.getElementById('couponMaxDiscount').value = '';
    }
}

async function saveCoupon(event) {
    event.preventDefault();
    
    if (!auth.currentUser || !currentUser.isAdmin) {
        showToast('❌ Apenas admins podem gerenciar cupons', 'error');
        return;
    }
    
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    const type = document.getElementById('couponType').value;
    const value = parseFloat(document.getElementById('couponValue').value);
    const maxDiscount = document.getElementById('couponMaxDiscount').value ? 
        parseFloat(document.getElementById('couponMaxDiscount').value) : null;
    const minValue = document.getElementById('couponMinValue').value ? 
        parseFloat(document.getElementById('couponMinValue').value) : null;
    const usageLimit = document.getElementById('couponUsageLimit').value ? 
        parseInt(document.getElementById('couponUsageLimit').value) : null;
    const usagePerUser = document.getElementById('couponUsagePerUser').value ? 
        parseInt(document.getElementById('couponUsagePerUser').value) : null;
    const active = document.getElementById('couponActive').checked;
    
    const validFromInput = document.getElementById('couponValidFrom').value;
    const validUntilInput = document.getElementById('couponValidUntil').value;
    
    const couponData = {
        code,
        type,
        value,
        maxDiscount,
        minValue,
        usageLimit,
        usagePerUser,
        active,
        usedCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser.uid
    };
    
    if (validFromInput) {
        couponData.validFrom = firebase.firestore.Timestamp.fromDate(new Date(validFromInput));
    }
    if (validUntilInput) {
        couponData.validUntil = firebase.firestore.Timestamp.fromDate(new Date(validUntilInput));
    }
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        await db.collection('coupons').doc(code).set(couponData);
        
        showToast('✅ Cupom criado com sucesso!', 'success');
        closeCouponModal();
        loadCoupons();
        
    } catch (error) {
        console.error('❌ Erro ao salvar cupom:', error);
        showToast('Erro ao salvar cupom: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

async function loadCoupons() {
    try {
        const snapshot = await db.collection('coupons').get();
        
        const activeCoupons = [];
        const inactiveCoupons = [];
        
        snapshot.forEach(doc => {
            const coupon = { id: doc.id, ...doc.data() };
            
            if (coupon.active) {
                activeCoupons.push(coupon);
            } else {
                inactiveCoupons.push(coupon);
            }
        });
        
        renderCouponsList('activeCouponsList', activeCoupons);
        renderCouponsList('inactiveCouponsList', inactiveCoupons);
        
    } catch (error) {
        console.error('❌ Erro ao carregar cupons:', error);
    }
}

function renderCouponsList(containerId, coupons) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (coupons.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">Nenhum cupom encontrado</p>';
        return;
    }
    
    container.innerHTML = coupons.map(coupon => `
        <div class="coupon-admin-card ${!coupon.active ? 'inactive' : ''}">
            <div class="coupon-admin-info">
                <h4>${coupon.code}</h4>
                <div class="coupon-admin-details">
                    <div class="coupon-detail-item">
                        <span class="coupon-detail-label">Tipo</span>
                        <span class="coupon-detail-value">${coupon.type === 'percentage' ? 'Porcentagem' : 'Fixo'}</span>
                    </div>
                    <div class="coupon-detail-item">
                        <span class="coupon-detail-label">Valor</span>
                        <span class="coupon-detail-value">${coupon.type === 'percentage' ? coupon.value + '%' : 'R$ ' + coupon.value.toFixed(2)}</span>
                    </div>
                    ${coupon.minValue ? `
                    <div class="coupon-detail-item">
                        <span class="coupon-detail-label">Valor Mínimo</span>
                        <span class="coupon-detail-value">R$ ${coupon.minValue.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    ${coupon.usageLimit ? `
                    <div class="coupon-detail-item">
                        <span class="coupon-detail-label">Usos</span>
                        <span class="coupon-detail-value">${coupon.usedCount || 0} / ${coupon.usageLimit}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="coupon-admin-actions">
                <button class="coupon-toggle-btn ${coupon.active ? 'deactivate' : 'activate'}" 
                        onclick="toggleCouponStatus('${coupon.id}', ${!coupon.active})">
                    ${coupon.active ? '⏸️ Desativar' : '▶️ Ativar'}
                </button>
                <button class="coupon-delete-btn" onclick="deleteCouponPrompt('${coupon.id}')">
                    🗑️ Deletar
                </button>
            </div>
        </div>
    `).join('');
}

async function toggleCouponStatus(couponId, newStatus) {
    try {
        await db.collection('coupons').doc(couponId).update({
            active: newStatus
        });
        
        showToast(newStatus ? '✅ Cupom ativado' : '⏸️ Cupom desativado', 'success');
        loadCoupons();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        showToast('Erro ao alterar status', 'error');
    }
}

async function deleteCouponPrompt(couponId) {
    if (!confirm(`🗑️ Deletar cupom "${couponId}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        await db.collection('coupons').doc(couponId).delete();
        showToast('🗑️ Cupom deletado', 'info');
        loadCoupons();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        showToast('Erro ao deletar cupom', 'error');
    }
}

// ==================== ADMIN: GERENCIADOR DE VÍDEOS ====================
function openVideoManager() {
    if (!auth.currentUser || !currentUser.isAdmin) {
        showToast('❌ Apenas admins podem gerenciar vídeos', 'error');
        return;
    }
    
    document.getElementById('videoManagerModal').classList.add('active');
    renderVideoManager();
}

function closeVideoManager() {
    document.getElementById('videoManagerModal').classList.remove('active');
}

async function renderVideoManager() {
    const container = document.getElementById('videoManagerList');
    
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; padding: 3rem; gap: 1rem;">
            <div class="loading-spinner">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
            <p style="color: #666;">Carregando vídeos...</p>
        </div>
    `;
    
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        
        let videos = [];
        if (configDoc.exists && configDoc.data().videos) {
            videos = configDoc.data().videos.sort((a, b) => a.order - b.order);
        }
        
        if (videos.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">Nenhum vídeo configurado ainda</p>';
            return;
        }
        
        container.innerHTML = videos.map((video, index) => `
            <div class="video-manager-item" style="display: flex; gap: 1rem; align-items: center; padding: 1rem; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 1rem;">
                <div style="font-weight: 700; font-size: 1.5rem; color: #999; min-width: 30px;">
                    ${index + 1}
                </div>
                
                <div style="width: 120px; height: 160px; background: #000; border-radius: 4px; overflow: hidden;">
                    <video src="${video.url}" style="width: 100%; height: 100%; object-fit: cover;" muted loop></video>
                </div>
                
                <div style="flex: 1;">
                    <input type="text" value="${video.title}" 
                           onchange="updateVideoTitle(${index}, this.value)"
                           style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px; font-weight: 600;">
                    
                    <input type="text" value="${video.subtitle}" 
                           onchange="updateVideoSubtitle(${index}, this.value)"
                           style="width: 100%; padding: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px; font-size: 0.9rem;">
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${index > 0 ? `<button onclick="moveVideo(${index}, ${index - 1})" style="padding: 0.5rem; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">↑</button>` : ''}
                    ${index < videos.length - 1 ? `<button onclick="moveVideo(${index}, ${index + 1})" style="padding: 0.5rem; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">↓</button>` : ''}
                    <button onclick="removeVideo(${index})" style="padding: 0.5rem; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar vídeos:', error);
        container.innerHTML = '<p style="text-align: center; color: #e74c3c; padding: 2rem;">Erro ao carregar vídeos</p>';
    }
}

async function addVideoSlot() {
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        
        let videos = [];
        if (configDoc.exists && configDoc.data().videos) {
            videos = configDoc.data().videos;
        }
        
        if (videos.length >= 5) {
            showToast('❌ Máximo de 5 vídeos permitidos', 'error');
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/mp4';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            
            if (!file) return;
            
            if (file.size > 2 * 1024 * 1024) {
                showToast('❌ Vídeo muito grande! Máximo 2MB', 'error');
                return;
            }
            
            if (!file.type.includes('mp4')) {
                showToast('❌ Apenas arquivos MP4 são permitidos', 'error');
                return;
            }
            
            document.getElementById('loadingOverlay').classList.add('active');
            
            try {
                const timestamp = Date.now();
                const filename = `video_${timestamp}_${Math.random().toString(36).substring(7)}.mp4`;
                const storageRef = storage.ref().child(`videos/${filename}`);
                
                await storageRef.put(file);
                const downloadURL = await storageRef.getDownloadURL();
                
                videos.push({
                    url: downloadURL,
                    title: 'NOVO VÍDEO',
                    subtitle: 'Edite o texto',
                    order: videos.length + 1
                });
                
                await db.collection('site_config').doc('video_grid').set({ videos });
                
                showToast('✅ Vídeo adicionado com sucesso!', 'success');
                
                await loadVideoGrid();
                renderVideoManager();
                
            } catch (error) {
                console.error('Erro ao fazer upload:', error);
                showToast('❌ Erro ao fazer upload: ' + error.message, 'error');
            } finally {
                document.getElementById('loadingOverlay').classList.remove('active');
            }
        };
        
        input.click();
        
    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro ao adicionar vídeo', 'error');
    }
}

async function updateVideoTitle(index, newTitle) {
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        const videos = configDoc.data().videos;
        
        videos[index].title = newTitle;
        
        await db.collection('site_config').doc('video_grid').update({ videos });
        await loadVideoGrid();
        
        showToast('✅ Título atualizado', 'success');
        
    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro ao atualizar título', 'error');
    }
}

async function updateVideoSubtitle(index, newSubtitle) {
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        const videos = configDoc.data().videos;
        
        videos[index].subtitle = newSubtitle;
        
        await db.collection('site_config').doc('video_grid').update({ videos });
        await loadVideoGrid();
        
        showToast('✅ Subtítulo atualizado', 'success');
        
    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro ao atualizar subtítulo', 'error');
    }
}

async function moveVideo(fromIndex, toIndex) {
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        const videos = configDoc.data().videos;
        
        [videos[fromIndex], videos[toIndex]] = [videos[toIndex], videos[fromIndex]];
        
        videos.forEach((v, i) => v.order = i + 1);
        
        await db.collection('site_config').doc('video_grid').update({ videos });
        
        await loadVideoGrid();
        renderVideoManager();
        
        showToast('✅ Ordem alterada', 'success');
        
    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro ao alterar ordem', 'error');
    }
}

async function removeVideo(index) {
    if (!confirm('🗑️ Remover este vídeo?')) return;
    
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        const videos = configDoc.data().videos;
        
        try {
            const videoUrl = videos[index].url;
            const storageRef = storage.refFromURL(videoUrl);
            await storageRef.delete();
        } catch (err) {
            console.warn('Não foi possível deletar do storage:', err);
        }
        
        videos.splice(index, 1);
        videos.forEach((v, i) => v.order = i + 1);
        
        await db.collection('site_config').doc('video_grid').update({ videos });
        
        await loadVideoGrid();
        renderVideoManager();
        
        showToast('🗑️ Vídeo removido', 'info');
        
    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro ao remover vídeo', 'error');
    }
}

async function marcarProdutosBlackFriday() {
    if (!isAdminLoggedIn) {
        alert('Você precisa estar logado como admin!');
        return;
    }

    const confirmacao = confirm(
        'Esta função irá marcar TODOS os produtos com desconto (oldPrice) como Black Friday.\n\n' +
        'Deseja continuar?'
    );
    if (!confirmacao) return;

    document.getElementById('loadingOverlay')?.classList.add('active');

    try {
        let contador = 0;

        for (const product of productsData) {
            if (product.oldPrice) {
                await db.collection("produtos").doc(product.id).update({
                    isBlackFriday: true
                });

                product.isBlackFriday = true;
                contador++;
            }
        }

        productCache.clear();
        await carregarProdutosDoFirestore();
        renderProducts();

        alert(`✅ ${contador} produtos foram marcados como Black Friday!`);

    } catch (error) {
        console.error("Erro:", error);
        alert('Erro ao marcar produtos: ' + error.message);

    } finally {
        document.getElementById('loadingOverlay')?.classList.remove('active');
    }
}

// ==================== BUSCA: MODAL E HEADER ====================
function openSearch() {
    const modal = document.getElementById('searchModal');
    modal.classList.add('active');
    document.getElementById('searchInput').focus();
}

function closeSearch() {
    const modal = document.getElementById('searchModal');
    modal.classList.remove('active');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

// Event Listeners para busca
const searchModal = document.getElementById('searchModal');
if (searchModal) {
    searchModal.addEventListener('click', (e) => {
        if (e.target.id === 'searchModal') {
            closeSearch();
        }
    });
}

const debouncedSearch = debounce(function() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const results = document.getElementById('searchResults');
    
    if (query.length < 2) {
        results.innerHTML = '';
        return;
    }
    
    const filtered = productsData.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.category.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        results.innerHTML = '<div style="padding: 1rem; text-align: center; color: #999;">Nenhum produto encontrado</div>';
        return;
    }
    
    results.innerHTML = filtered.map(product => {
        const productImage = product.images ? product.images[0] : (product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
        const isRealImage = productImage.startsWith('data:image') || productImage.startsWith('http');
        
        return `
            <div class="search-result-item" onclick="selectSearchResult('${product.id}')">
                <div class="search-result-img" style="${isRealImage ? `background-image: url(${productImage}); background-size: cover; background-position: center;` : `background: ${productImage}`}"></div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.3rem;">${sanitizeInput(product.name)}</div>
                    <div style="color: var(--primary); font-weight: 700;">R$ ${product.price.toFixed(2)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    trackEvent('Search', 'Query', query);
}, 300);

function performSearch() {
    debouncedSearch();
}

function selectSearchResult(productId) {
    addToCart(productId);
    closeSearch();
    toggleCart();
}

function performHeaderSearch() {
    const query = document.getElementById('headerSearchInput').value.toLowerCase().trim();
    
    if (query.length < 2) {
        showToast('Digite pelo menos 2 caracteres', 'info');
        return;
    }
    
    const filtered = productsData.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.category.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        showToast(`Nenhum produto encontrado para "${query}"`, 'error');
        return;
    }
    
    // Atualizar grid de produtos com resultados
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    // Renderizar resultados (reaproveitando a lógica de renderização)
    currentFilter = 'all'; // Resetar filtro para não conflitar visualmente
    
    // Injetar HTML diretamente para mostrar resultados (similar ao renderProducts)
    // Nota: Idealmente, chamaríamos renderProducts passando os dados filtrados, 
    // mas aqui seguiremos a lógica original de substituir o grid.
    
    grid.innerHTML = filtered.map(product => {
        let images = getProductImages(product);
        const firstImage = images[0];
        const isRealImage = isRealImage(firstImage);
        const isFav = isFavorite(product.id);
        const discountPercent = product.oldPrice ? 
            Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;
        
        return `
            <div class="product-card" data-product-id="${product.id}" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    <div class="product-image-carousel">
                        <div class="product-image-slide active" 
                             style="${isRealImage ? `background-image: url('${firstImage}')` : `background: ${firstImage}`}">
                            ${isRealImage ? `<img src="${firstImage}" alt="${product.name}" loading="lazy">` : ''}
                        </div>
                    </div>
                    ${product.badge ? `<div class="product-badge">${product.badge}</div>` : ''}
                    ${discountPercent > 0 ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
                        Adicionar ao Carrinho
                    </button>
                </div>
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
    
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');
    
    if (badge && categoryName) {
        categoryName.textContent = `🔍 "${query}" (${filtered.length} resultados)`;
        badge.style.display = 'flex';
    }
    
    document.getElementById('pagination').innerHTML = '';
    
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    showToast(`🔍 ${filtered.length} produtos encontrados`, 'success');
    trackEvent('Search', 'Header Search', query);
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
        let imageUrl = getProductImage(product);
        const isRealImg = isRealImage(imageUrl);
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
            <div class="search-dropdown-item" style="justify-content: center; color: #667eea; font-weight: bold;" onclick="performHeaderSearch()">
                Ver todos os ${products.length} resultados
            </div>
        `;
    }

    dropdown.classList.add('active');
}

// ==================== FAVORITOS ====================
function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('💔 Removido dos favoritos', 'info');
        
        // Se estiver na tela de favoritos e remover o último, atualizar view
        const badge = document.getElementById('activeCategoryBadge');
        if (badge && badge.style.display === 'flex' && 
            document.getElementById('categoryNameDisplay').textContent.includes('Favoritos')) {
            
            if (favorites.length === 0) {
                clearCategoryFilter();
                showToast('Você não tem mais favoritos', 'info');
            } else {
                openFavorites();
            }
            return;
        }
    } else {
        favorites.push(productId);
        showToast('❤️ Adicionado aos favoritos', 'success');
    }
    
    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    updateFavoritesCount();
    renderProducts(); // Atualiza ícones no grid
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

function openFavorites() {
    const favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    
    if (favorites.length === 0) {
        showToast('Você ainda não tem favoritos ❤️', 'info');
        return;
    }
    
    const favProducts = productsData.filter(p => favorites.includes(p.id));
    
    if (favProducts.length === 0) {
        showToast('Seus favoritos não estão mais disponíveis', 'error');
        return;
    }

    // Renderizar favoritos manualmente no grid para garantir visualização correta
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = favProducts.map(product => {
        // ... (Lógica de renderização de card idêntica ao renderProducts, simplificada aqui)
        let images = getProductImages(product);
        const firstImage = images[0];
        const isRealImg = isRealImage(firstImage);
        
        return `
            <div class="product-card" data-product-id="${product.id}" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <button class="favorite-btn active" onclick="event.stopPropagation(); toggleFavorite('${product.id}')">❤️</button>
                    <div class="product-image-carousel">
                        <div class="product-image-slide active" style="${isRealImg ? `background-image: url('${firstImage}')` : `background: ${firstImage}`}">
                             ${isRealImg ? `<img src="${firstImage}" loading="lazy">` : ''}
                        </div>
                    </div>
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">Adicionar ao Carrinho</button>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <div class="product-price"><span class="price-new">R$ ${product.price.toFixed(2)}</span></div>
                </div>
            </div>
        `;
    }).join('');
    
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');
    
    if (badge && categoryName) {
        categoryName.textContent = '❤️ Meus Favoritos';
        badge.style.display = 'flex';
    }
    
    document.getElementById('pagination').innerHTML = '';
    
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
    
    showToast(`❤️ ${favProducts.length} favoritos encontrados`, 'success');
}

function showFavorites() {
    // Alias para openFavorites
    openFavorites();
}

// ==================== CARRINHO: LÓGICA PRINCIPAL ====================
function addToCart(productId) {
    // Redireciona para detalhes para escolher tamanho/cor se necessário
    window.location.href = `produto.html?id=${productId}`;
    saveCart();
    return;
}

function addToCartFromDetails() {
    if (!currentProductDetails) return;
    
    const product = currentProductDetails;
    const addButton = document.querySelector('.btn-add-cart-large');
    
    const cartItemId = `${product.id}_${selectedSize}_${selectedColor}`;
    const existingItem = cart.find(item => item.cartItemId === cartItemId);
    
    if (existingItem) {
        existingItem.quantity += selectedQuantity;
        existingItem.image = getImageForColor(product, selectedColor);
    } else {
        cart.push({
            ...product,
            cartItemId: cartItemId,
            quantity: selectedQuantity,
            selectedSize: selectedSize,
            selectedColor: selectedColor,
            image: getImageForColor(product, selectedColor)
        });
    }
    
    saveCart();
    updateCartUI();
    
    if (addButton) {
        // Animação visual opcional
        if (typeof animateProductToCart === 'function') animateProductToCart(addButton, product);
    }
    
    setTimeout(() => {
        showToast(`${selectedQuantity}x ${product.name} (${selectedSize}, ${selectedColor}) adicionado ao carrinho!`, 'success');
        toggleCart(); // Abre o carrinho automaticamente
    }, 300);
}

function addLookToCart() {
    const relatedProducts = document.querySelectorAll('.related-products-grid .product-card');
    let addedCount = 1; // Conta o produto principal
    
    addToCartFromDetails(); // Adiciona o principal
    
    relatedProducts.forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            const productId = card.dataset.productId;
            // Para produtos relacionados, adicionamos direto (poderia melhorar pedindo tamanho)
            // Aqui simplificamos chamando addToCart que redireciona, mas o ideal seria adicionar direto.
            // Assumindo lógica simplificada:
             const product = productsData.find(p => p.id === productId);
             if (product) {
                 cart.push({
                     ...product,
                     cartItemId: `${product.id}_U_Default`,
                     quantity: 1,
                     selectedSize: 'U',
                     selectedColor: 'Padrão',
                     image: getProductImage(product)
                 });
                 addedCount++;
             }
        }
    });
    
    saveCart();
    updateCartUI();
    showToast(`✅ ${addedCount} produtos adicionados ao carrinho!`, 'success');
}

function buyNow() {
    if (!currentProductDetails) return;
    
    addToCartFromDetails(); // Adiciona
    
    setTimeout(() => {
        // Fecha detalhes se estiver em modal (se aplicável)
        // Redireciona para checkout
        window.location.href = 'checkout.html';
    }, 500);
}

function removeFromCart(identifier) {
    console.log('🗑️ Removendo item:', identifier);
    
    const lengthBefore = cart.length;
    
    cart = cart.filter(item => {
        const itemId = item.cartItemId || item.id;
        return itemId !== identifier;
    });
    
    const lengthAfter = cart.length;
    
    if (lengthBefore === lengthAfter) {
        showToast('Item não encontrado', 'error');
        return;
    }
    
    // Recalcular cupom se necessário
    if (cart.length === 0) {
        if (appliedCoupon) removeCoupon();
    } else if (appliedCoupon) {
        validateCouponRules(); // Helper function para revalidar regras
    }
    
    saveCart();
    updateCartUI();
    showToast('Item removido do carrinho', 'info');
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
        if (appliedCoupon) validateCouponRules();
        saveCart();
        updateCartUI();
    }
}

function validateCouponRules() {
    if (!appliedCoupon) return;
    
    const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    if (appliedCoupon.minValue && subtotal < appliedCoupon.minValue) {
        removeCoupon();
        showToast(`❌ Cupom removido: valor mínimo R$ ${appliedCoupon.minValue.toFixed(2)}`, 'error');
        return;
    }
    
    let newDiscount = 0;
    if (appliedCoupon.type === 'percentage') {
        newDiscount = (subtotal * appliedCoupon.value) / 100;
        if (appliedCoupon.maxDiscount && newDiscount > appliedCoupon.maxDiscount) {
            newDiscount = appliedCoupon.maxDiscount;
        }
    } else if (appliedCoupon.type === 'fixed') {
        newDiscount = appliedCoupon.value;
    }
    
    if (newDiscount > subtotal) newDiscount = subtotal;
    
    couponDiscount = newDiscount;
    showAppliedCouponBadge(appliedCoupon, newDiscount);
}

// ==================== CARRINHO: UI ====================
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('sidebarOverlay'); // Corrigido ID para padrão
    
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    
    if (!cartCount || !cartItems || !cartFooter) return;
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Frete Grátis Progress Bar
    const FREE_SHIPPING_THRESHOLD = 299.00;
    const progressPercent = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
    const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);

    const progressFill = document.getElementById('shippingProgressFill');
    const progressText = document.getElementById('shippingProgressText');
    const progressAmount = document.getElementById('shippingProgressAmount');

    if (progressFill) progressFill.style.width = `${progressPercent}%`;

    if (progressText && progressAmount) {
        if (remainingForFreeShipping > 0) {
            progressText.textContent = `Pra ganhar FRETE GRÁTIS`;
            progressAmount.textContent = `R$ ${remainingForFreeShipping.toFixed(2)}`;
            if (progressText.parentElement) progressText.parentElement.style.background = '';
        } else {
            progressText.textContent = `✓ Você ganhou frete grátis!`;
            progressAmount.textContent = '';
            if (progressText.parentElement) {
                progressText.parentElement.style.background = 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)';
                progressText.parentElement.style.borderLeft = '4px solid #27ae60';
            }
        }
    }
    
    requestAnimationFrame(() => {
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        
        if (cart.length === 0) {
            cartItems.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
            cartFooter.style.display = 'none';
        } else {
            const fragment = document.createDocumentFragment();
            
            cart.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'cart-item';
                const itemImage = item.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                const isRealImg = isRealImage(itemImage);
                
                itemDiv.innerHTML = `
                    <div class="cart-item-img" style="${isRealImg ? `background-image: url(${itemImage}); background-size: cover; background-position: center;` : `background: ${itemImage}`}"></div>
                    <div class="cart-item-info">
                        <div class="cart-item-title">${sanitizeInput(item.name)}</div>
                        ${item.selectedSize || item.selectedColor ? `
                            <div style="font-size: 0.75rem; color: #666; margin-top: 0.3rem;">
                                ${item.selectedSize ? `Tam: <strong>${sanitizeInput(item.selectedSize)}</strong>` : ''}
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
                        <button class="remove-item" onclick="removeFromCart('${item.cartItemId || item.id}')" aria-label="Remover item"></button>
                    </div>
                `;
                fragment.appendChild(itemDiv);
            });
            
            cartItems.innerHTML = '';
            cartItems.appendChild(fragment);

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

function closeCartAndExplore() {
    toggleCart();
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
}

// ==================== CHECKOUT E PAGAMENTO ====================
function checkout() {
    const rawCart = localStorage.getItem('sejaVersatilCart');
    
    if (!rawCart) {
        showToast('Carrinho vazio', 'error');
        return;
    }
    
    try {
        const parsed = JSON.parse(rawCart);
        const items = parsed.items || [];
        
        if (items.length === 0) {
            showToast('Carrinho vazio', 'error');
            return;
        }
        
        const invalidItems = items.filter(item => 
            !item.name || !item.price || !item.quantity
        );
        
        if (invalidItems.length > 0) {
            console.error('❌ Invalid cart items:', invalidItems);
            showToast('Erro no carrinho. Recarregue a página.', 'error');
            return;
        }
        
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (total < 10) {
            showToast('Valor mínimo: R$ 10,00', 'error');
            return;
        }
        
        window.location.href = 'checkout.html';
        
    } catch (error) {
        console.error('❌ Checkout validation error:', error);
        showToast('Erro ao validar carrinho', 'error');
    }
}

// ==================== MODAL DE PAGAMENTO (CHECKOUT RÁPIDO) ====================
function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const cartItemsContainer = document.getElementById('paymentCartItems');
    const totalContainer = document.getElementById('paymentTotal');
    
    if (!modal) {
        console.error('❌ CRÍTICO: Elemento principal do modal ausente!');
        return;
    }
    
    if (!cartItemsContainer || !totalContainer) {
        console.error('❌ Containers do modal ausentes!');
        return;
    }

    // Revalidar cupom antes de abrir
    if (appliedCoupon) {
        const subtotalCheck = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        if (appliedCoupon.minValue && subtotalCheck < appliedCoupon.minValue) {
            console.warn('⚠️ Valor mínimo do cupom não atingido');
            removeCoupon();
        } else {
            let recalcDiscount = 0;
            if (appliedCoupon.type === 'percentage') {
                recalcDiscount = (subtotalCheck * appliedCoupon.value) / 100;
                if (appliedCoupon.maxDiscount && recalcDiscount > appliedCoupon.maxDiscount) {
                    recalcDiscount = appliedCoupon.maxDiscount;
                }
            } else {
                recalcDiscount = appliedCoupon.value;
            }
            couponDiscount = Math.min(recalcDiscount, subtotalCheck);
        }
    }
    
    cartItemsContainer.innerHTML = cart.map(item => {
        const itemImage = item.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        const isRealImg = isRealImage(itemImage);
        
        return `
            <div class="payment-cart-item">
                <div>
                    <div class="payment-cart-item-name">${sanitizeInput(item.name)}</div>
                    <div class="payment-cart-item-details">Qtd: ${item.quantity} × R$ ${item.price.toFixed(2)}</div>
                    ${item.selectedSize || item.selectedColor ? `
                        <div style="font-size: 0.75rem; color: #666; margin-top: 0.3rem;">
                            ${item.selectedSize ? `Tam: <strong>${sanitizeInput(item.selectedSize)}</strong>` : ''}
                            ${item.selectedSize && item.selectedColor ? ' | ' : ''}
                            ${item.selectedColor ? `Cor: <strong>${sanitizeInput(item.selectedColor)}</strong>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div style="font-weight: 700;">
                    R$ ${(item.price * item.quantity).toFixed(2)}
                </div>
            </div>
        `;
    }).join('');
    
    if (appliedCoupon && couponDiscount > 0) {
        cartItemsContainer.innerHTML += `
            <div style="padding: 0.8rem; margin-top: 0.5rem; background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); border-left: 4px solid #28a745; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #155724; font-size: 0.9rem;">🎟️ ${appliedCoupon.code}</strong>
                        <div style="font-size: 0.75rem; color: #155724; margin-top: 0.2rem;">
                            ${appliedCoupon.type === 'percentage' ? appliedCoupon.value + '%' : 'R$ ' + appliedCoupon.value.toFixed(2)} de desconto
                        </div>
                    </div>
                    <strong style="color: #155724;">-R$ ${couponDiscount.toFixed(2)}</strong>
                </div>
            </div>
        `;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = Math.min(couponDiscount || 0, subtotal);
    const total = Math.max(0, subtotal - discount);
    
    totalContainer.textContent = `R$ ${total.toFixed(2)}`;
    
    modal.classList.add('active');
    setupPaymentListeners();
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function setupPaymentListeners() {
    const opts = document.querySelectorAll('input[name="paymentMethod"]');
    const box = document.getElementById('installmentsBox');
    
    if (!opts.length || !box) return;
    
    opts.forEach(opt => {
        opt.addEventListener('change', function() {
            box.style.display = this.value === 'credito-parcelado' ? 'block' : 'none';
        });
    });
}

// ==================== INTEGRAÇÃO WHATSAPP ====================
async function sendToWhatsApp() {
    if (window.authReady) await window.authReady;
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        if (!cart || cart.length === 0) {
            showToast('Carrinho vazio!', 'error');
            return;
        }

        const checked = document.querySelector('input[name="paymentMethod"]:checked');
        if (!checked) {
            showToast('Selecione a forma de pagamento.', 'error');
            return;
        }
        const paymentMethod = checked.value;

        let installments = null;
        if (paymentMethod === 'credito-parcelado') {
            const installmentsSelect = document.getElementById('installmentsSelect');
            if (!installmentsSelect || !installmentsSelect.value) {
                showToast('Selecione o número de parcelas.', 'error');
                return;
            }
            installments = installmentsSelect.value;
        }

        let customerData = {};
        
        if (typeof currentUser !== 'undefined' && currentUser) {
            const phone = await getUserPhone();
            const cpf = await getUserCPF();
            
            if (!phone || !cpf) {
                showToast('Dados incompletos. Preencha telefone e CPF.', 'error');
                return;
            }

            customerData = {
                name: currentUser.name || 'Cliente',
                email: currentUser.email,
                phone: phone,
                cpf: cpf,
                uid: currentUser.uid
            };
        } else {
            const guestData = await collectGuestCustomerData();
            if (!guestData) return;
            
            customerData = {
                ...guestData,
                uid: null
            };
        }

        const subtotal = cart.reduce((s, it) => s + (it.price * it.quantity), 0);
        const discount = couponDiscount || 0;
        const total = Math.max(0, subtotal - discount);

        let orderId = 'PENDENTE';
        try {
            const orderData = {
                userId: customerData.uid || 'guest',
                customer: customerData,
                items: cart.map(item => ({
                    id: item.productId || item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    size: item.selectedSize || null,
                    color: item.selectedColor || null,
                    image: item.image
                })),
                totals: { subtotal, discount, total },
                paymentMethod,
                installments: installments,
                status: 'Pendente WhatsApp',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                appliedCoupon: appliedCoupon ? { code: appliedCoupon.code, value: appliedCoupon.value } : null
            };

            const docRef = await db.collection('orders').add(orderData);
            orderId = docRef.id;

            if (appliedCoupon) {
                await registerCouponUsage(appliedCoupon.id, total, discount);
            }

        } catch (error) {
            console.error('Erro ao salvar pedido:', error);
            showToast('Erro ao processar, mas vamos tentar enviar o WhatsApp.', 'error');
        }

        const msg = generateWhatsAppMessage(orderId, customerData, cart, { subtotal, discount, total }, paymentMethod, installments);

        const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
        window.open(whatsappURL, '_blank');

        closePaymentModal();
        if (typeof closeCustomerDataModal === 'function') closeCustomerDataModal();
        
        cart = [];
        appliedCoupon = null;
        couponDiscount = 0;
        
        saveCart();
        updateCartUI();
        showToast('Pedido realizado com sucesso!', 'success');

    } catch (error) {
        console.error('❌ ERRO CRÍTICO NO CHECKOUT:', error);
        showToast('Ocorreu um erro ao processar. Por favor, tente novamente.', 'error');
        openPaymentModal(); 

    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

function sanitizeForWhatsApp(str) {
    return String(str || '')
        .replace(/[*_~`]/g, '')
        .replace(/[<>]/g, '')
        .slice(0, 500);
}

function generateWhatsAppMessage(orderId, customer, items, totals, paymentMethod, installments = null) {
    let msg = `*🛍️ PEDIDO #${orderId.toUpperCase().substring(0, 6)} - SEJA VERSÁTIL*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    msg += `*👤 CLIENTE:*\n`;
    msg += `Nome: ${sanitizeForWhatsApp(customer.name)}\n`;
    if(customer.phone) msg += `Tel: ${customer.phone}\n`;
    if(customer.cpf) msg += `CPF: ${customer.cpf}\n`;
    msg += `\n`;

    msg += `*📦 PRODUTOS:*\n`;
    items.forEach((item, index) => {
        msg += `${index + 1}. *${sanitizeForWhatsApp(item.name)}*\n`;
        msg += `   ${item.quantity}x R$ ${item.price.toFixed(2)} | Tam: ${item.selectedSize || '-'} Cor: ${item.selectedColor || '-'}\n`;
    });
    msg += `\n`;

    msg += `*💰 RESUMO:*\n`;
    msg += `Subtotal: R$ ${totals.subtotal.toFixed(2)}\n`;
    if (totals.discount > 0) {
        msg += `Desconto: - R$ ${totals.discount.toFixed(2)}\n`;
    }
    msg += `*TOTAL: R$ ${totals.total.toFixed(2)}*\n`;
    msg += `\n`;
    
    const paymentMap = {
        'pix': 'PIX (Aprovação Imediata)',
        'boleto': 'Boleto Bancário',
        'credito-avista': 'Cartão de Crédito (À Vista)',
        'credito-parcelado': 'Cartão de Crédito (Parcelado)'
    };
    
    msg += `*💳 PAGAMENTO:* ${paymentMap[paymentMethod] || paymentMethod}\n`;
    
    if (installments) {
        msg += `Parcelas: ${installments}x\n`;
    }
    
    return msg;
}

// ==================== DADOS DO CLIENTE (CHECKOUT) ====================
function collectGuestCustomerData() {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('customerDataModal');
        const form = document.getElementById('customerDataForm');
        
        if (!modal || !form) {
            console.error('Modal de dados do cliente não encontrado');
            resolve(null);
            return;
        }
        
        modal.classList.add('active');
        form.reset();
        
        const submitHandler = async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('guestName').value.trim();
            const email = document.getElementById('guestEmail').value.trim().toLowerCase();
            const phone = document.getElementById('guestPhone').value.replace(/\D/g, '');
            const cpf = document.getElementById('guestCPF').value.replace(/\D/g, '');
            
            if (name.length < 3) {
                showToast('Nome deve ter pelo menos 3 caracteres', 'error');
                return;
            }
            
            if (!validateEmail(email)) {
                showToast('Email inválido', 'error');
                return;
            }
            
            if (phone.length < 10 || phone.length > 11) {
                showToast('Telefone inválido', 'error');
                return;
            }
            
            if (cpf.length !== 11 || !isValidCPF(cpf)) {
                showToast('CPF inválido', 'error');
                return;
            }
            
            modal.classList.remove('active');
            form.removeEventListener('submit', submitHandler);
            
            resolve({
                name,
                email,
                phone,
                cpf,
                userId: null
            });
        };
        
        form.addEventListener('submit', submitHandler);
        
        window.closeCustomerDataModal = () => {
            modal.classList.remove('active');
            form.removeEventListener('submit', submitHandler);
            resolve(null);
        };
    });
}

async function getUserPhone() {
    try {
        if (!auth.currentUser) return null;
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        
        if (userDoc.exists && userDoc.data().phone) {
            return userDoc.data().phone;
        }
        
        const phone = prompt('Digite seu WhatsApp com DDD:\n(Ex: 71991234567)');
        if (!phone) return null;
        
        const cleanPhone = phone.replace(/\D/g, '');
        
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
            showToast('Telefone inválido', 'error');
            return await getUserPhone(); 
        }
        
        await db.collection('users').doc(auth.currentUser.uid).update({ phone: cleanPhone });
        return cleanPhone;
        
    } catch (error) {
        console.error('Erro ao obter telefone:', error);
        return null;
    }
}

async function getUserCPF() {
    try {
        if (!auth.currentUser) return null;
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        
        if (userDoc.exists && userDoc.data().cpf) {
            return userDoc.data().cpf;
        }
        
        let cpf = prompt('Digite seu CPF (para rastreamento):\n(Ex: 000.000.000-00)');
        if (!cpf) return null;
        
        cpf = cpf.replace(/\D/g, '');
        
        if (!isValidCPF(cpf)) {
            showToast('CPF inválido', 'error');
            return await getUserCPF();
        }
        
        await db.collection('users').doc(auth.currentUser.uid).update({ cpf: cpf });
        return cpf;
        
    } catch (error) {
        console.error('Erro ao obter CPF:', error);
        return null;
    }
}

// ==================== LÓGICA DE CUPONS (USUÁRIO) ====================
async function applyCoupon() {
    const input = document.getElementById('couponInput');
    const btn = document.getElementById('applyCouponBtn');
    
    if (!input || !btn) return;

    const code = input.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

    if (!code || code.length < 3) {
        showCouponMessage('❌ Código inválido (mínimo 3 caracteres)', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '⏳ Validando...';
    btn.style.opacity = '0.6';

    try {
        const couponDoc = await db.collection('coupons').doc(code).get();

        if (!couponDoc.exists) {
            showCouponMessage('❌ Cupom não encontrado', 'error');
            return;
        }

        const coupon = { id: couponDoc.id, ...couponDoc.data() };

        if (!coupon.active) {
            showCouponMessage('❌ Cupom inativo', 'error');
            return;
        }

        const now = new Date();
        const validFrom = coupon.validFrom ? coupon.validFrom.toDate() : null;
        const validUntil = coupon.validUntil ? coupon.validUntil.toDate() : null;

        if (validFrom && now < validFrom) {
            showCouponMessage('❌ Este cupom ainda não está válido', 'error');
            return;
        }

        if (validUntil && now > validUntil) {
            showCouponMessage('❌ Este cupom expirou', 'error');
            return;
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            showCouponMessage('❌ Este cupom atingiu o limite de usos', 'error');
            return;
        }

        const cartValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (coupon.minValue && cartValue < coupon.minValue) {
            showCouponMessage(`❌ Valor mínimo: R$ ${coupon.minValue.toFixed(2)}`, 'error');
            return;
        }

        if (coupon.usagePerUser) {
            if (!auth.currentUser) {
                showCouponMessage('❌ Faça login para usar este cupom', 'error');
                return;
            }

            const usageQuery = await db.collection('coupon_usage')
                .where('couponId', '==', coupon.id)
                .where('userId', '==', auth.currentUser.uid)
                .get();

            if (usageQuery.size >= coupon.usagePerUser) {
                showCouponMessage('❌ Você já usou este cupom', 'error');
                return;
            }
        }

        let discount = 0;
        if (coupon.type === 'percentage') {
            discount = (cartValue * coupon.value) / 100;
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount;
            }
        } else if (coupon.type === 'fixed') {
            discount = coupon.value;
        }

        if (discount > cartValue) discount = cartValue;

        appliedCoupon = coupon;
        couponDiscount = discount;
        
        input.classList.add('success');
        showAppliedCouponBadge(coupon, discount);
        updateCartUI();
        saveCart();

        showCouponMessage(`✅ Cupom aplicado! Desconto de R$ ${discount.toFixed(2)}`, 'success');

        input.value = '';
        input.disabled = true;
        btn.style.display = 'none';

    } catch (error) {
        console.error('Erro ao aplicar cupom:', error);
        showCouponMessage('❌ Erro ao validar cupom', 'error');
    } finally {
        if (btn && !appliedCoupon) {
            btn.disabled = false;
            btn.textContent = 'APLICAR';
            btn.style.opacity = '1';
        }
    }
}

function removeCoupon() {
    appliedCoupon = null;
    couponDiscount = 0;
    
    const badge = document.getElementById('appliedCouponBadge');
    const input = document.getElementById('couponInput');
    const btn = document.getElementById('applyCouponBtn');
    const message = document.getElementById('couponMessage');
    
    if (badge) badge.style.display = 'none';
    if (input) {
        input.disabled = false;
        input.value = '';
        input.classList.remove('success');
    }
    if (btn) {
        btn.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'APLICAR';
        btn.style.opacity = '1';
    }
    if (message) message.classList.remove('active');
    
    updateCartUI();
    saveCart();
    showToast('Cupom removido', 'info');
}

function showAppliedCouponBadge(coupon, discount) {
    const badge = document.getElementById('appliedCouponBadge');
    const codeEl = document.getElementById('appliedCouponCode');
    const discountEl = document.getElementById('appliedCouponDiscount');
    
    if (!badge || !codeEl || !discountEl) return;
    
    codeEl.textContent = coupon.code;
    
    if (coupon.type === 'percentage') {
        discountEl.textContent = `${coupon.value}% de desconto (R$ ${discount.toFixed(2)})`;
    } else {
        discountEl.textContent = `Desconto de R$ ${discount.toFixed(2)}`;
    }
    
    badge.style.display = 'flex';
}

function showCouponMessage(text, type) {
    const message = document.getElementById('couponMessage');
    if (!message) return;
    
    message.textContent = text;
    message.className = `coupon-message ${type} active`;
    
    setTimeout(() => {
        message.classList.remove('active');
    }, 5000);
}

async function registerCouponUsage(couponId, orderValue, discountApplied) {
    if (!auth.currentUser) return;
    
    const couponRef = db.collection('coupons').doc(couponId);
    
    try {
        await db.runTransaction(async (transaction) => {
            const couponDoc = await transaction.get(couponRef);
            
            if (!couponDoc.exists) throw new Error('Cupom não existe');
            
            const coupon = couponDoc.data();
            const newCount = (coupon.usedCount || 0) + 1;
            
            if (coupon.usageLimit && newCount > coupon.usageLimit) {
                throw new Error('Limite atingido');
            }
            
            transaction.update(couponRef, {
                usedCount: firebase.firestore.FieldValue.increment(1)
            });
            
            transaction.set(db.collection('coupon_usage').doc(), {
                couponId: couponId,
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                usedAt: firebase.firestore.FieldValue.serverTimestamp(),
                orderValue: orderValue,
                discountApplied: discountApplied
            });
        });
        console.log('✅ Uso de cupom registrado');
    } catch (error) {
        console.error('❌ Registro de cupom falhou:', error);
    }
}

// ==================== VALIDAÇÕES (CPF, EMAIL) ====================
function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cpf.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cpf.charAt(10))) return false;
    
    return true;
}

function isValidCPF(cpf) {
    return validateCPF(cpf);
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function applyVisualValidation(inputElement, validationFn) {
    if (!inputElement) return;
    
    inputElement.addEventListener('blur', () => {
        const isValid = validationFn(inputElement.value);
        if (inputElement.value.length > 0) {
            if (isValid) {
                inputElement.style.borderColor = '#27ae60';
                inputElement.style.boxShadow = '0 0 0 2px rgba(39, 174, 96, 0.1)';
            } else {
                inputElement.style.borderColor = '#e74c3c';
                inputElement.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.1)';
            }
        }
    });
    
    inputElement.addEventListener('input', () => {
        inputElement.style.borderColor = '';
        inputElement.style.boxShadow = '';
    });
}

// ==================== DETALHES DO PRODUTO ====================
function openProductDetails(productId) {
    localStorage.setItem('selectedProductId', productId);
    window.location.href = `produto.html?id=${productId}`;
}

// Nota: As funções abaixo são usadas especificamente na página produto.html
// mas mantidas aqui para centralização da lógica se o site for Single Page no futuro.

async function loadProductVariants(productId) {
    if (productVariants[productId]) return productVariants[productId];
    
    try {
        const variantsSnapshot = await db.collection('produtos')
            .doc(productId)
            .collection('variants')
            .get();
        
        const variants = [];
        variantsSnapshot.forEach(doc => {
            variants.push({ id: doc.id, ...doc.data() });
        });
        
        productVariants[productId] = variants;
        return variants;
    } catch (error) {
        console.error('Erro ao carregar variantes:', error);
        return [];
    }
}

async function renderAvailableColors(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;

    const variants = productVariants[productId] || [];
    const colorSelector = document.getElementById('colorSelector');
    
    if (!colorSelector) return;
    
    let availableColors = [];
    
    if (product.colors && Array.isArray(product.colors) && product.colors.length > 0) {
        availableColors = product.colors;
    } else if (variants.length > 0) {
        const uniqueColors = [...new Set(variants.map(v => v.color))];
        availableColors = uniqueColors.map(colorName => ({
            name: colorName,
            hex: getColorHex(colorName),
            images: product.images || []
        }));
    } else {
        const colorOption = colorSelector.closest('.product-option');
        if (colorOption) colorOption.style.display = 'none';
        return;
    }
    
    const colorOption = colorSelector.closest('.product-option');
    if (colorOption) colorOption.style.display = 'block';
    
    colorSelector.innerHTML = availableColors.map((color, index) => {
        const hasStock = variants.length === 0 || variants.some(v => v.color === color.name && v.stock > 0);
        const borderStyle = (color.hex === '#FFFFFF' || color.hex === '#ffffff') ? 'border: 3px solid #ddd;' : '';
        
        return `
            <div class="color-option ${index === 0 ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                 data-color="${sanitizeInput(color.name)}"
                 data-has-stock="${hasStock}"
                 style="background: ${color.hex}; ${borderStyle} ${!hasStock ? 'opacity: 0.3; cursor: not-allowed;' : ''}"
                 title="${sanitizeInput(color.name)}">
                ${!hasStock ? '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5rem; color: red;">✕</span>' : ''}
            </div>
        `;
    }).join('');

    // Reattach listeners
    document.querySelectorAll('.color-option').forEach(colorBtn => {
        const hasStock = colorBtn.dataset.hasStock === 'true';
        colorBtn.addEventListener('click', function() {
            if (!hasStock) {
                showToast('❌ Cor indisponível', 'error');
                return;
            }
            selectColor(this.dataset.color);
        });
    });
}

function getColorHex(colorName) {
    const colorMap = {
        'Rosa': '#FFB6C1', 'Preto': '#000000', 'Azul': '#4169E1', 'Verde': '#32CD32',
        'Branco': '#FFFFFF', 'Vermelho': '#DC143C', 'Amarelo': '#FFD700', 'Cinza': '#808080',
        'Lilás': '#9370DB', 'Coral': '#FF7F50', 'Nude': '#E8BEAC', 'Bege': '#F5F5DC'
    };
    return colorMap[colorName] || '#999999';
}

function selectColor(colorName) {
    if (!currentProductDetails || !currentProductDetails.colors) return;

    const selectedColorData = currentProductDetails.colors.find(c => c.name === colorName);
    
    if (!selectedColorData || !selectedColorData.images || selectedColorData.images.length === 0) {
        // Fallback se não tiver imagens específicas
    } else {
        updateGalleryDisplay(selectedColorData.images);
    }

    selectedColor = colorName;
    
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.color === colorName);
        if (opt.dataset.color === colorName) {
            opt.style.transform = "scale(1.15)";
            setTimeout(() => opt.style.transform = "scale(1)", 200);
        }
    });

    renderAvailableSizes(currentProductDetails.id);
}

async function renderAvailableSizes(productId) {
    const variants = productVariants[productId] || [];
    const sizeSelector = document.getElementById('sizeSelector');
    if (!sizeSelector) return;
    
    const sizes = ['P', 'M', 'G', 'GG'];
    
    sizeSelector.innerHTML = sizes.map((size, index) => {
        const hasStock = variants.some(v => v.size === size && v.color === selectedColor && v.stock > 0);
        const stock = variants.find(v => v.size === size && v.color === selectedColor)?.stock || 0;
        
        return `
            <button class="size-option ${index === 1 ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                    data-size="${size}"
                    ${!hasStock ? 'disabled' : ''}
                    onclick="selectSize('${size}')">
                ${size}
                ${!hasStock ? '<br><small style="font-size: 0.7rem; color: red;">Esgotado</small>' : 
                  stock > 0 && stock <= 3 ? '<br><small style="font-size: 0.7rem; color: #ff9800; font-weight: 600;">Últimas unidades</small>' : 
                  ''}
            </button>
        `;
    }).join('');
    
    // Selecionar o primeiro disponível automaticamente
    const firstAvailable = sizes.find(size => 
        variants.some(v => v.size === size && v.color === selectedColor && v.stock > 0)
    );
    if (firstAvailable) {
        selectedSize = firstAvailable;
        // Atualizar visualmente
        document.querySelectorAll('.size-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === firstAvailable);
        });
    }
}

function selectSize(size) {
    selectedSize = size;
    document.querySelectorAll('.size-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === size);
    });
}

function updateGalleryDisplay(images) {
    const img1 = document.getElementById('mainImg1');
    const img2 = document.getElementById('mainImg2');

    if (img1 && images[0]) {
        img1.style.opacity = '0.5';
        setTimeout(() => {
            img1.src = images[0];
            img1.style.opacity = '1';
        }, 150);
    }

    if (img2) {
        if (images[1]) {
            img2.style.display = 'block';
            img2.style.opacity = '0.5';
            setTimeout(() => {
                img2.src = images[1];
                img2.style.opacity = '1';
            }, 150);
        } else {
            // Placeholder transparente
            img2.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
        }
    }

    const remainingImages = images.slice(2);
    const thumbnailContainer = document.getElementById('thumbnailList');
    
    if (thumbnailContainer) {
        if (remainingImages.length > 0) {
            thumbnailContainer.innerHTML = remainingImages.map((img) => `
                <div class="thumbnail-item" onclick="swapMainImage('${img}')" style="cursor: pointer; overflow: hidden; border-radius: 4px;">
                    <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;">
                </div>
            `).join('');
            thumbnailContainer.style.display = 'grid';
        } else {
            thumbnailContainer.innerHTML = '';
            thumbnailContainer.style.display = 'none'; 
        }
    }
}

function swapMainImage(newSrc) {
    const img1 = document.getElementById('mainImg1');
    if (img1) {
        img1.scrollIntoView({ behavior: 'smooth' });
        img1.style.opacity = '0.5';
        setTimeout(() => {
            img1.src = newSrc;
            img1.style.opacity = '1';
        }, 200);
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (tabName === 'description') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        document.getElementById('descriptionTab').classList.add('active');
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        document.getElementById('specsTab').classList.add('active');
    }
}

function renderRelatedProducts(category, currentId) {
    const related = productsData
        .filter(p => p.category === category && p.id !== currentId)
        .slice(0, 4);
    
    const grid = document.getElementById('relatedProductsGrid');
    if (!grid) return;
    
    grid.innerHTML = related.map(product => {
        let images = getProductImages(product);
        const firstImage = images[0];
        const isRealImg = isRealImage(firstImage);
        
        return `
            <div class="product-card" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <div class="product-image-slide active" 
                         style="${isRealImg ? `background-image: url('${firstImage}'); background-size: cover; background-position: center;` : `background: ${firstImage}`}">
                    </div>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <div class="product-price">
                        <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== FILTROS E PAGINAÇÃO ====================
function filterProducts(category) {
    currentFilter = category;
    currentPage = 1;
    renderProducts();
    trackEvent('Products', 'Filter', category);
}

function sortProducts(sortType) {
    currentSort = sortType;
    renderProducts();
    trackEvent('Products', 'Sort', sortType);
}

function getFilteredProducts() {
    let filtered = productsData;
    
    if (currentFilter !== 'all') {
        if (currentFilter === 'sale') {
            filtered = filtered.filter(p => p.oldPrice !== null);
        } else if (currentFilter === 'favorites') {
            filtered = filtered.filter(p => favorites.includes(p.id));
        } else {
            filtered = filtered.filter(p => p.category === currentFilter);
        }
    }
    
    if (currentSort === 'price-asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return filtered;
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    if (currentPage > 1) {
        html += `<button class="page-btn" onclick="changePage(${currentPage - 1})">‹</button>`;
    }
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="page-btn" style="border: none; cursor: default;">...</span>`;
        }
    }
    
    if (currentPage < totalPages) {
        html += `<button class="page-btn" onclick="changePage(${currentPage + 1})">›</button>`;
    }
    
    pagination.innerHTML = html;
}

function changePage(page) {
    const productsSection = document.getElementById('produtos');
    const sectionTitle = document.querySelector('.section-title');
    const productsGrid = document.getElementById('productsGrid');
    
    if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (sectionTitle) {
        const titlePosition = sectionTitle.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: titlePosition, behavior: 'smooth' });
    } else if (productsGrid) {
        const gridPosition = productsGrid.getBoundingClientRect().top + window.scrollY - 150;
        window.scrollTo({ top: gridPosition, behavior: 'smooth' });
    }
    
    carouselsPaused = true;
    clearCarouselIntervals();
    
    currentPage = page;
    renderProducts();
    
    setTimeout(() => {
        carouselsPaused = false;
        setupAutoCarousel();
    }, 300);
}

// ==================== RENDERIZAÇÃO DA GRADE PRINCIPAL ====================
function renderProductsSkeleton() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = Array(itemsPerPage).fill(0).map(() => `
        <div class="product-card skeleton-loading">
            <div class="skeleton-image shimmer"></div>
            <div class="skeleton-info">
                <div class="skeleton-line shimmer"></div>
                <div class="skeleton-line short shimmer"></div>
            </div>
        </div>
    `).join('');
}

function renderProducts() {
    clearCarouselIntervals();
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');

    if (currentFilter !== 'all') {
        let label = currentFilter;
        if (currentFilter === 'favorites') label = '❤️ Meus Favoritos';
        else if (currentFilter === 'sale') label = '🔥 Promoções';
        else label = typeof getCategoryName === 'function' ? getCategoryName(currentFilter) : currentFilter;

        if (categoryName) categoryName.textContent = label;
        if (badge) badge.style.display = 'flex';
    } else {
        if (badge && (!categoryName || !categoryName.textContent.includes('resultados'))) {
            badge.style.display = 'none';
        }
    }

    const filtered = getFilteredProducts();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedProducts = filtered.slice(start, end);
    
    const grid = document.getElementById('productsGrid');
    
    if (!grid) return;
    
    if (paginatedProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #666;">Nenhum produto encontrado</h3>
                <p style="color: #999; margin-bottom: 2rem;">Não encontramos produtos para esta seleção.</p>
                <button onclick="clearCategoryFilter()" style="background: var(--primary); color: white; border: none; padding: 1rem 2rem; font-weight: 600; cursor: pointer; border-radius: 50px;">
                    Ver Todos os Produtos
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = paginatedProducts.map(product => {
        let images = getProductImages(product);
        const hasMultipleImages = images.length > 1;
        const isFav = isFavorite(product.id);
        const discountPercent = product.oldPrice ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;
        
        return `
            <div class="product-card" data-product-id="${product.id}" onclick="isInternalNavigation = true; openProductDetails('${product.id}')">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')" 
                            aria-label="Favoritar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                    
                    ${product.badge && discountPercent === 0 ? `<div class="product-badge">${sanitizeInput(product.badge)}</div>` : ''}
                    ${discountPercent > 0 ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
                    
                    <div class="product-image-carousel">
                        ${images.map((img, index) => {
                            const isRealImg = isRealImage(img);
                            return `
                                <div class="product-image-slide ${index === 0 ? 'active' : ''}" 
                                     style="${isRealImg ? `background-image: url('${img}')` : `background: ${img}`}">
                                    ${isRealImg ? `<img src="${img}" alt="${sanitizeInput(product.name)}" loading="lazy">` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    ${hasMultipleImages ? `
                        <div class="product-carousel-dots">
                            ${images.map((_, index) => `
                                <div class="product-carousel-dot ${index === 0 ? 'active' : ''}" 
                                     onclick="event.stopPropagation(); goToProductImage('${product.id}', ${index}, event)"></div>
                            `).join('')}
                        </div>
                    ` : ''}
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

// ==================== RENDERIZAÇÃO: MAIS VENDIDOS ====================
function renderBestSellers() {
    const bestSellersGrid = document.getElementById('bestSellersGrid');
    if (!bestSellersGrid) return;
    
    // Filtrar produtos com desconto ou marcados como destaque
    const bestSellers = productsData.filter(p => p.oldPrice).slice(0, 6);
    
    if (bestSellers.length === 0) {
        bestSellersGrid.innerHTML = '<p class="empty-section-message">Nenhum produto em destaque no momento</p>';
        return;
    }
    
    bestSellersGrid.innerHTML = bestSellers.map(product => {
        let images = getProductImages(product);
        const firstImage = images[0];
        const isRealImg = isRealImage(firstImage);
        const isFav = isFavorite(product.id);
        const discountPercent = Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
        
        return `
            <div class="product-card" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    <div class="product-image-slide active" 
                         style="${isRealImg ? `background-image: url('${firstImage}');` : `background: ${firstImage}`}">
                         ${isRealImg ? `<img src="${firstImage}" loading="lazy">` : ''}
                    </div>
                    <div class="discount-badge">-${discountPercent}%</div>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <div class="product-price">
                        <span class="price-old">R$ ${product.oldPrice.toFixed(2)}</span>
                        <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== CARROSSEL HERO (BANNER) ====================
let currentHeroSlide = 0;
let heroCarouselInterval;

const heroSlides = [
    { image: 'https://i.imgur.com/ZVqxl8B.jpeg', title: '', subtitle: '', cta: 'EXPLORAR AGORA' },
    { image: 'https://i.imgur.com/iapKUtF.jpeg', title: 'LANÇAMENTO', subtitle: 'Tecnologia para máxima performance', cta: 'VER COLEÇÃO' },
    { image: 'https://i.imgur.com/2SHv3pc.jpeg', title: 'FITNESS & LIFESTYLE', subtitle: 'Do treino ao dia a dia com versatilidade', cta: 'DESCOBRIR' }
];

function initHeroCarousel() {
    const heroContainer = document.querySelector('.hero-carousel');
    if (!heroContainer) return;

    heroContainer.innerHTML = heroSlides.map((slide, index) => `
        <div class="hero-slide ${index === 0 ? 'active' : ''}" 
             style="background-image: url('${slide.image}'); cursor: pointer;"
             onclick="scrollToProducts()">
            <div class="hero-overlay"></div>
        </div>
    `).join('');

    const dotsContainer = document.querySelector('.hero-carousel-dots');
    if (dotsContainer) {
        dotsContainer.innerHTML = heroSlides.map((_, index) => `
            <div class="hero-dot ${index === 0 ? 'active' : ''}" onclick="goToHeroSlide(${index})"></div>
        `).join('');
    }

    startHeroCarousel();
}

function startHeroCarousel() {
    heroCarouselInterval = setInterval(nextHeroSlide, 8000);
}

function stopHeroCarousel() {
    clearInterval(heroCarouselInterval);
}

function nextHeroSlide() {
    currentHeroSlide = (currentHeroSlide + 1) % heroSlides.length;
    updateHeroCarousel();
}

function goToHeroSlide(index) {
    stopHeroCarousel();
    currentHeroSlide = index;
    updateHeroCarousel();
    startHeroCarousel();
}

function updateHeroCarousel() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.hero-dot');
    
    slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentHeroSlide);
    });
    
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentHeroSlide);
    });
}

function scrollToProducts() {
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==================== VÍDEO GRID ====================
let videoGridData = [];

async function loadVideoGrid() {
    const container = document.getElementById('videoGridContainer');
    if (!container) return; // Se não houver container (ex: checkout), sai.
    
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        
        if (configDoc.exists && configDoc.data().videos && configDoc.data().videos.length > 0) {
            videoGridData = configDoc.data().videos.sort((a, b) => a.order - b.order);
        } else {
            videoGridData = [
                { url: 'https://firebasestorage.googleapis.com/v0/b/seja-versatil.firebasestorage.app/o/Grid%201.mp4?alt=media', title: 'CONFORTO', subtitle: 'Alta performance', order: 1 },
                { url: 'https://firebasestorage.googleapis.com/v0/b/seja-versatil.firebasestorage.app/o/Grid%202%20.mp4?alt=media', title: 'ESTILO', subtitle: 'Looks incríveis', order: 2 },
                { url: 'https://firebasestorage.googleapis.com/v0/b/seja-versatil.firebasestorage.app/o/Grid%203.mp4?alt=media', title: 'QUALIDADE', subtitle: 'Tecidos premium', order: 3 },
                { url: 'https://firebasestorage.googleapis.com/v0/b/seja-versatil.firebasestorage.app/o/Grid%204%20.mp4?alt=media', title: 'VOCÊ', subtitle: 'Seja versátil', order: 4 }
            ];
        }
        
        await renderVideoGrid();
    } catch (error) {
        console.error('Erro ao carregar vídeos:', error);
    }
}

async function renderVideoGrid() {
    const container = document.getElementById('videoGridContainer');
    if (!container || !videoGridData.length) return;
    
    container.innerHTML = videoGridData.map((video, index) => `
        <div class="video-card">
            <video src="${video.url}" loop muted playsinline preload="none" loading="lazy"
                   onloadeddata="this.style.opacity='1'" style="opacity: 0; transition: opacity 0.3s;"></video>
            <div class="video-overlay">
                <div class="video-title">${video.title}</div>
                <div class="video-subtitle">${video.subtitle}</div>
            </div>
            <div class="video-play-indicator">▶</div>
        </div>
    `).join('');
    
    setupVideoInteractions();
}

function setupVideoInteractions() {
    const videoCards = document.querySelectorAll('.video-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (video) {
                if (entry.isIntersecting) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            }
        });
    }, { threshold: 0.5 });

    videoCards.forEach(card => observer.observe(card));
}

// ==================== UI & CHAT ====================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        chatBox.classList.toggle('active');
        if (chatBox.classList.contains('active')) {
            document.getElementById('chatInput').focus();
        }
    }
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    addChatMessage(message, 'user');
    input.value = '';
    
    setTimeout(() => {
        addChatMessage('Nossa equipe está disponível para atendimento personalizado no WhatsApp!', 'bot');
    }, 1000);
}

function addChatMessage(text, sender) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-message ${sender}`;
    div.innerHTML = `<div class="message-bubble">${text}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ==================== LISTENERS GLOBAIS E INICIALIZAÇÃO ====================
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        carouselsPaused = true;
        stopHeroCarousel();
        clearCarouselIntervals();
    } else {
        carouselsPaused = false;
        startHeroCarousel();
        setupAutoCarousel();
    }
});

// Inicialização Principal
document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    const isCheckoutPage = window.location.pathname.includes('checkout.html');
    
    try {
        console.log('🚀 Iniciando script2.js organizado...');
        
        // Carregar configurações e carrinho
        loadSettings();
        CartManager.load(); // Carregar do novo gerenciador
        
        // Se usar o método antigo em paralelo para compatibilidade
        if (typeof loadCart === 'function') loadCart(); 

        // Carregar produtos
        await loadProducts();
        
        if (!isCheckoutPage) {
            renderProducts();
            renderBestSellers();
            initHeroCarousel();
            await loadVideoGrid();
        }
        
        updateCartUI();
        updateFavoritesCount();
        setupPaymentListeners();
        
        // Monitorar conexão
        window.addEventListener('online', () => showToast('Conexão restaurada!', 'success'));
        window.addEventListener('offline', () => showToast('Você está offline', 'error'));

        console.log('✅ Inicialização completa.');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showToast('Erro ao carregar o site. Recarregue a página.', 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
});

// Tecla ESC para fechar modais
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = ['.modal.active', '#cartSidebar.active', '#userPanel.active', '#adminPanel.active'];
        modals.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) el.classList.remove('active');
        });
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.classList.remove('active');
    }
});
