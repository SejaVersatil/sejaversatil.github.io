// ==================== SCRIPT DE LOJA - VERSÃO FINAL ORGANIZADA ====================
// Estrutura unificada e limpa para performance e manutenção.

'use strict';

// ==================== 1. VARIÁVEIS GLOBAIS E ESTADO ====================
let cart = [];
let appliedCoupon = null;
let couponDiscount = 0;
let productsData = [];
let currentFilter = 'all';
let currentSort = '';
let currentPage = 1;
const itemsPerPage = window.innerWidth <= 768 ? 8 : 12;
let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
let carouselIntervals = {};
const carouselEventsRegistered = new Set();
let carouselsPaused = false;
let isInternalNavigation = false;
let selectedSize = 'M';
let selectedColor = null;
let selectedQuantity = 1;
let currentProductDetails = null;
let productVariants = {};
let editingProductId = null;
let tempProductImages = [];
let productColors = [];
let currentUser = null;
let isAdminLoggedIn = false;

// ==================== 2. UTILITÁRIOS E HELPERS ====================
const $ = (id) => document.getElementById(id);

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

function sanitizeForWhatsApp(str) {
    return String(str || '')
        .replace(/[*_~`]/g, '')
        .replace(/[<>]/g, '')
        .slice(0, 500);
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

// ==================== 3. CACHE E RATE LIMITING ====================
class CacheManager {
    constructor(ttl = 1800000) {
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
const firestoreRateLimiter = new RateLimiter(10, 60000);

// ==================== 4. GESTÃO DO CARRINHO ====================
const saveCart = (() => {
    let timeout;
    return () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            try {
                const cartData = {
                    items: cart || [],
                    appliedCoupon: appliedCoupon || null,
                    couponDiscount: couponDiscount || 0
                };
                localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
                
                // Sincroniza globais se existirem
                if (typeof window.cart !== 'undefined') {
                    window.cart = cart;
                    window.appliedCoupon = appliedCoupon;
                    window.couponDiscount = couponDiscount;
                }
                console.log('💾 Carrinho salvo (Debounced)');
            } catch (err) {
                console.warn('❌ Erro ao salvar carrinho:', err);
            }
        }, 300);
    };
})();

function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if (!saved) {
        resetCartGlobals();
        return;
    }
    try {
        const parsed = JSON.parse(saved);
        if (parsed.items && Array.isArray(parsed.items)) {
            cart = parsed.items.map(item => ({ ...item, quantity: item.quantity || 1, price: item.price || 0 }));
            appliedCoupon = parsed.appliedCoupon || null;
            couponDiscount = parsed.couponDiscount || 0;
        } else if (Array.isArray(parsed)) {
            cart = parsed.map(item => ({ ...item, quantity: item.quantity || 1, price: item.price || 0 }));
            appliedCoupon = null;
            couponDiscount = 0;
        } else {
            resetCartGlobals();
        }
        syncCartGlobals();
    } catch (error) {
        console.error('❌ Erro ao carregar carrinho:', error);
        resetCartGlobals();
    }
}

function resetCartGlobals() {
    cart = [];
    appliedCoupon = null;
    couponDiscount = 0;
    syncCartGlobals();
}

function syncCartGlobals() {
    window.cart = cart;
    window.appliedCoupon = appliedCoupon;
    window.couponDiscount = couponDiscount;
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    
    if (!cartCount || !cartItems || !cartFooter) return;
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Lógica Frete Grátis
    const FREE_SHIPPING_THRESHOLD = 299.00;
    const cartSubtotalCalc = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const progressPercent = Math.min((cartSubtotalCalc / FREE_SHIPPING_THRESHOLD) * 100, 100);
    const remainingForFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - cartSubtotalCalc, 0);
    
    const progressFill = document.getElementById('shippingProgressFill');
    const progressText = document.getElementById('shippingProgressText');
    const progressAmount = document.getElementById('shippingProgressAmount');

    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressText && progressAmount) {
        if (remainingForFreeShipping > 0) {
            progressText.textContent = `Pra ganhar FRETE GRÁTIS`;
            progressAmount.textContent = `R$ ${remainingForFreeShipping.toFixed(2)}`;
            progressAmount.style.color = '#000';
            if (progressText.parentElement) {
                progressText.parentElement.style.background = '';
                progressText.parentElement.style.borderLeft = '';
            }
        } else {
            progressText.textContent = `✓ Você ganhou frete grátis!`;
            progressAmount.textContent = '';
            progressText.style.color = '#27ae60';
            progressText.style.fontWeight = '700';
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
                        <button class="remove-item" onclick="removeFromCart('${item.cartItemId || item.id}')" aria-label="Remover item"></button>
                    </div>
                `;
                fragment.appendChild(itemDiv);
            });
            cartItems.innerHTML = '';
            cartItems.appendChild(fragment);
            
            // Cálculos Finais
            const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
            const discount = Math.min(typeof couponDiscount === 'number' && !isNaN(couponDiscount) ? couponDiscount : 0, subtotal);
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
    const item = cart.find(i => (i.cartItemId || i.id) === cartItemId);
    if (!item) return;
    
    item.quantity = (item.quantity || 1) + change;
    if (item.quantity <= 0) {
        removeFromCart(cartItemId);
    } else {
        recalculateTotals();
        saveCart();
        updateCartUI();
    }
}

function removeFromCart(identifier) {
    const lengthBefore = cart.length;
    cart = cart.filter(item => (item.cartItemId || item.id) !== identifier);
    
    if (lengthBefore === cart.length) {
        showToast('Item não encontrado', 'error');
        return;
    }
    
    if (cart.length === 0) {
        if (appliedCoupon) removeCoupon();
    } else {
        recalculateTotals();
    }
    
    saveCart();
    updateCartUI();
    showToast('Item removido do carrinho', 'info');
}

function recalculateTotals() {
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
            couponDiscount = Math.min(newDiscount, newSubtotal);
            showAppliedCouponBadge(appliedCoupon, couponDiscount);
        }
    }
}

function addToCart(productId) {
    window.location.href = `produto.html?id=${productId}`;
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('sidebarOverlay'); // Corrigido para sidebarOverlay padrão
    if(sidebar) sidebar.classList.toggle('active');
    if(overlay) overlay.classList.toggle('active');
}

function closeCartAndExplore() {
    toggleCart();
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
}

function checkout() {
    if (!cart || cart.length === 0) {
        showToast('Carrinho vazio', 'error');
        return;
    }
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (total < 10) {
        showToast('Valor mínimo: R$ 10,00', 'error');
        return;
    }
    window.location.href = 'checkout.html';
}

// ==================== 5. FIREBASE E PRODUTOS ====================
async function carregarProdutosDoFirestore() {
    try {
        const cached = productCache.get('products');
        if (cached) {
            productsData = cached;
            return productsData;
        }
        if (!firestoreRateLimiter.canMakeRequest()) {
            showToast('Muitas requisições. Aguarde.', 'error');
            return productsData;
        }
        const snapshot = await db.collection("produtos").get();
        productsData = [];
        snapshot.forEach((doc) => {
            productsData.push({ id: doc.id, ...doc.data() });
        });
        productCache.set('products', productsData);
        return productsData;
    } catch (error) {
        console.error("❌ Erro ao carregar produtos:", error);
        return productsData;
    }
}

async function loadProducts() {
    await carregarProdutosDoFirestore();
    if (productsData.length === 0) {
        await inicializarProdutosPadrao(); // Função definida mais abaixo se necessário
    }
}
// ==================== 6. HERO CAROUSEL ====================
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
    stopHeroCarousel(); // Garante que não haja duplicidade
    heroCarouselInterval = setInterval(() => {
        nextHeroSlide();
    }, 8000);
}

function stopHeroCarousel() {
    clearInterval(heroCarouselInterval);
}

function nextHeroSlide() {
    currentHeroSlide = (currentHeroSlide + 1) % heroSlides.length;
    updateHeroCarousel();
}

function prevHeroSlide() {
    currentHeroSlide = (currentHeroSlide - 1 + heroSlides.length) % heroSlides.length;
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

// ==================== 7. VIDEO GRID LOADER ====================
let videoGridData = [];

async function loadVideoGrid() {
    const container = document.getElementById('videoGridContainer');
    
    if (!container) return; // Silent fail se não existir na página
    
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        
        if (configDoc.exists && configDoc.data().videos && configDoc.data().videos.length > 0) {
            videoGridData = configDoc.data().videos.sort((a, b) => a.order - b.order);
            
            videoGridData = videoGridData.filter(video => {
                if (!video.url || !video.url.startsWith('http')) {
                    return false;
                }
                return true;
            });
            
            if (videoGridData.length === 0) {
                videoGridData = getDefaultVideos();
            }
        } else {
            videoGridData = getDefaultVideos();
        }
        
        await renderVideoGrid();
        
    } catch (error) {
        console.error('Erro ao carregar vídeos:', error);
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: #f8f8f8;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🎬</div>
                <h3 style="font-size: 1.3rem; margin-bottom: 1rem; color: #666;">Vídeos em breve</h3>
            </div>
        `;
    }
}

function getDefaultVideos() {
    return [
        {
            url: 'https://firebasestorage.googleapis.com/v0/b/seja-versatil.firebasestorage.app/o/Grid%201.mp4?alt=media&token=f04963d6-8348-49fe-912b-9dc321b42691',
            title: 'CONFORTO',
            subtitle: 'Alta performance',
            order: 1
        },
        {
            url: 'https://firebasestorage.googleapis.com/v0/b/seja-versatil.firebasestorage.app/o/Grid%202%20.mp4?alt=media&token=8f66e794-844d-4696-8123-dd8776194f31',
            title: 'ESTILO',
            subtitle: 'Looks incríveis',
            order: 2
        },
        {
            url: 'https://firebasestorage.googleapis.com/v0/b/seja-versatil.firebasestorage.app/o/Grid%203.mp4?alt=media&token=3f34d22d-79a1-4ded-9677-d1af0ae89bdc',
            title: 'QUALIDADE',
            subtitle: 'Tecidos premium',
            order: 3
        },
        {
            url: 'https://firebasestorage.googleapis.com/v0/b/seja-versatil.firebasestorage.app/o/Grid%204%20.mp4?alt=media&token=cffa1c61-6b35-43c5-ba74-970a1e13bd09',
            title: 'VOCÊ',
            subtitle: 'Seja versátil',
            order: 4
        }
    ];
}

async function renderVideoGrid() {
    const container = document.getElementById('videoGridContainer');
    
    if (!container || !videoGridData || videoGridData.length === 0) return;
    
    container.innerHTML = videoGridData.map((video, index) => `
        <div class="video-card" data-video-index="${index}">
            <video 
                src="${video.url}" 
                loop 
                muted 
                playsinline
                preload="none"
                loading="lazy"
                onloadeddata="this.style.opacity='1'"
                onerror="handleVideoError(this)"
                style="opacity: 0; transition: opacity 0.3s;"
            ></video>
            
            <div class="video-overlay">
                <div class="video-title">${video.title}</div>
                <div class="video-subtitle">${video.subtitle}</div>
            </div>
            
            <div class="video-play-indicator">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
        </div>
    `).join('');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    setupVideoInteractions();
}

function setupVideoInteractions() {
    const videoCards = document.querySelectorAll('.video-card');
    
    videoCards.forEach(card => {
        const video = card.querySelector('video');
        const playIndicator = card.querySelector('.video-play-indicator');
        
        if (!video) return;
        
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    video.play().catch(() => {
                        if (playIndicator) playIndicator.style.opacity = '1';
                    });
                } else {
                    video.pause();
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(card);
        
        card.addEventListener('click', () => {
            if (video.paused) {
                video.play();
                if (playIndicator) playIndicator.innerHTML = `<svg viewBox="0 0 24 24" style="fill: #000;"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>`;
            } else {
                video.pause();
                if (playIndicator) playIndicator.innerHTML = `<svg viewBox="0 0 24 24" style="fill: #000;"><path d="M8 5v14l11-7z"/></svg>`;
            }
        });
    });
}

function handleVideoError(videoElement) {
    console.error('Erro ao carregar vídeo:', videoElement.src);
    const card = videoElement.closest('.video-card');
    if (card) {
        card.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0; color: #666;">
                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🎬</div>
                    <div style="font-size: 0.9rem;">Erro ao carregar vídeo</div>
                </div>
            </div>
        `;
    }
}

// ==================== 8. NAVEGAÇÃO E FILTROS ====================
function navigateToCategory(category) {
    clearCarouselIntervals();
    currentFilter = category;
    currentPage = 1;
    
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');
    
    if (badge && categoryName) {
        categoryName.textContent = getCategoryName(category);
        badge.style.display = 'flex';
    }
    
    renderProducts();
    
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    trackEvent('Promo Cards', 'Navigate to Category', category);
    isInternalNavigation = true;
    showToast(` ${getCategoryName(category)}`, 'info');
}

function clearCategoryFilter() {
    currentFilter = 'all';
    currentPage = 1;
    
    const badge = document.getElementById('activeCategoryBadge');
    if (badge) badge.style.display = 'none';
    
    renderProducts();
    showToast('Mostrando todos os produtos', 'info');
}

function getCategoryName(category) {
    const names = {
        'blusas': 'Blusas',
        'conjunto calca': 'Conjunto Calça',
        'peca unica': 'Peça Única',
        'conjunto short saia': 'Conjunto Short Saia',
        'conjunto short': 'Conjunto Short',
        'all': 'Todos os Produtos'
    };
    return names[category] || category.toUpperCase();
}

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

// ==================== 9. RENDERIZAÇÃO DE PRODUTOS ====================
function renderProducts() {
    clearCarouselIntervals();
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');

    if (currentFilter !== 'all') {
        let label = currentFilter;
        if (currentFilter === 'favorites') label = '❤️ Meus Favoritos';
        else if (currentFilter === 'sale') label = 'Promoções';
        else label = getCategoryName(currentFilter);

        if (categoryName) categoryName.textContent = label;
        if (badge) badge.style.display = 'flex';
    } else {
        if (badge && (!categoryName.textContent.includes('resultados'))) {
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
                <p style="color: #999; margin-bottom: 2rem;">Não encontramos produtos para: <strong>${getCategoryName(currentFilter)}</strong></p>
                <button onclick="clearCategoryFilter()" style="background: var(--primary); color: white; border: none; padding: 1rem 2rem; font-weight: 600; cursor: pointer; border-radius: 50px;">
                    Ver Todos os Produtos
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = paginatedProducts.map(product => {
        let images = [];
        if (Array.isArray(product.images) && product.images.length > 0) {
            images = product.images;
        } else if (product.image) {
            images = [product.image];
        } else {
            images = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
        }
        
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
                            const isRealImage = img.startsWith('data:image') || img.startsWith('http');
                            return `
                                <div class="product-image-slide ${index === 0 ? 'active' : ''}" 
                                     style="${isRealImage ? `background-image: url('${img}')` : `background: ${img}`}">
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    ${hasMultipleImages ? `
                        <div class="product-carousel-arrows">
                            <button class="product-carousel-arrow" onclick="event.stopPropagation(); prevProductImage('${product.id}', event)">‹</button>
                            <button class="product-carousel-arrow" onclick="event.stopPropagation(); nextProductImage('${product.id}', event)">›</button>
                        </div>
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

function renderBestSellers() {
    const bestSellersGrid = document.getElementById('bestSellersGrid');
    if (!bestSellersGrid) return;
    
    const bestSellers = productsData.filter(p => p.oldPrice).slice(0, 6);
    
    if (bestSellers.length === 0) {
        bestSellersGrid.innerHTML = '<p class="empty-section-message">Nenhum produto em destaque</p>';
        return;
    }
    
    bestSellersGrid.innerHTML = bestSellers.map(product => {
        let images = [];
        if (Array.isArray(product.images) && product.images.length > 0) {
            images = product.images;
        } else if (product.image) {
            images = [product.image];
        } else {
            images = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
        }
        
        const isFav = isFavorite(product.id);
        const firstImage = images[0];
        const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
        
        return `
            <div class="product-card" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    
                    ${product.badge ? `<span class="product-badge">${sanitizeInput(product.badge)}</span>` : ''}
                    
                    <div class="product-image-carousel">
                        <div class="product-image-slide active" style="${isRealImage ? `background-image: url(${firstImage}); background-size: cover; background-position: center;` : `background: ${firstImage}`}"></div>
                    </div>
                    
                    <div class="product-quick-actions" style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; opacity: 0; transition: opacity 0.3s;">
                        <button class="add-to-cart-btn" style="flex: 1; border-radius: 0;" onclick="event.stopPropagation(); addToCart('${product.id}')">🛒 Carrinho</button>
                        <button class="add-to-cart-btn" style="flex: 1; background: #27ae60; border-radius: 0;" onclick="event.stopPropagation(); quickBuy('${product.id}')">Comprar</button>
                    </div>
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
    const productsGrid = document.getElementById('productsGrid');
    
    if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (productsGrid) {
        const gridPosition = productsGrid.getBoundingClientRect().top + window.scrollY - 150;
        window.scrollTo({ top: gridPosition, behavior: 'smooth' });
    }
    
    clearCarouselIntervals();
    currentPage = page;
    renderProducts();
}

// ==================== 10. FAVORITOS ====================
function openFavorites() {
    const favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    
    if (favorites.length === 0) {
        showToast('Você ainda não tem favoritos ❤️', 'info');
        return;
    }
    
    currentFilter = 'favorites';
    currentPage = 1;
    
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');
    
    if (badge && categoryName) {
        categoryName.textContent = '❤️ Meus Favoritos';
        badge.style.display = 'flex';
    }
    
    renderProducts();
    showToast(`❤️ ${favorites.length} favoritos encontrados`, 'success');
}

function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('💔 Removido dos favoritos', 'info');
        
        if (currentFilter === 'favorites') {
            renderProducts(); 
            if (favorites.length === 0) {
                clearCategoryFilter();
                showToast('Você não tem mais favoritos', 'info');
            }
        }
    } else {
        favorites.push(productId);
        showToast('❤️ Adicionado aos favoritos', 'success');
    }
    
    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    updateFavoritesCount();
    
    // Atualiza visualmente o botão sem recarregar tudo se não estiver no filtro de favoritos
    if (currentFilter !== 'favorites') {
        const btns = document.querySelectorAll(`.product-card[data-product-id="${productId}"] .favorite-btn`);
        btns.forEach(btn => {
            btn.classList.toggle('active');
            const svg = btn.querySelector('svg');
            if (svg) svg.setAttribute('fill', index > -1 ? 'none' : 'currentColor');
        });
    }
    
    trackEvent('Favorites', index > -1 ? 'Remove' : 'Add', productId);
}

function isFavorite(productId) {
    return favorites.includes(productId);
}

function updateFavoritesCount() {
    const favCount = document.getElementById('favoritesCount');
    if (favCount) {
        favCount.textContent = favorites.length;
        favCount.style.display = favorites.length > 0 ? 'flex' : 'none';
    }
}

// ==================== 11. BUSCA ====================
function openSearch() {
    document.getElementById('searchModal').classList.add('active');
    document.getElementById('searchInput').focus();
}

function closeSearch() {
    document.getElementById('searchModal').classList.remove('active');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

const debouncedSearch = debounce(() => {
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

function performSearch() { debouncedSearch(); }

function selectSearchResult(productId) {
    openProductDetails(productId);
    closeSearch();
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
    
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');
    
    if (badge && categoryName) {
        categoryName.textContent = `🔍 "${query}" (${filtered.length} resultados)`;
        badge.style.display = 'flex';
    }
    
    // Renderização manual simplificada para resultado de busca (reuso da lógica de renderProducts seria ideal, mas mantemos o fluxo)
    // Para manter a consistência, vamos setar o estado e chamar renderProducts
    // Mas como renderProducts depende de currentFilter, e busca não é filtro de categoria...
    // Vamos injetar HTML direto conforme o código original pedia:
    
    grid.innerHTML = filtered.map(product => {
        let images = product.images && product.images.length ? product.images : (product.image ? [product.image] : ['']);
        const firstImage = images[0];
        const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
        const isFav = isFavorite(product.id);
        
        return `
            <div class="product-card" data-product-id="${product.id}" onclick="isInternalNavigation = true; openProductDetails('${product.id}')">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${product.id}')">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    <div class="product-image-carousel">
                        <div class="product-image-slide active" style="${isRealImage ? `background-image: url('${firstImage}')` : `background: ${firstImage}`}"></div>
                    </div>
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">Adicionar ao Carrinho</button>
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
    
    document.getElementById('pagination').innerHTML = '';
    const productsSection = document.getElementById('produtos');
    if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    showToast(`🔍 ${filtered.length} produtos encontrados`, 'success');
}

function renderDropdownResults(products) {
    const dropdown = document.getElementById('headerDropdown');
    
    if (products.length === 0) {
        dropdown.innerHTML = `<div style="padding: 1rem; text-align: center; color: #999;">Nenhum produto encontrado 😕</div>`;
        dropdown.classList.add('active');
        return;
    }

    const topProducts = products.slice(0, 6);
    dropdown.innerHTML = topProducts.map(product => {
        let imageUrl = (product.images && product.images.length) ? product.images[0] : (product.image || '');
        const isRealImg = imageUrl.startsWith('http') || imageUrl.startsWith('data:image');
        const imgStyle = isRealImg ? `background-image: url('${imageUrl}'); background-size: cover;` : `background: ${imageUrl};`;

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
        dropdown.innerHTML += `<div class="search-dropdown-item" style="justify-content: center; color: #667eea; font-weight: bold;" onclick="performHeaderSearch()">Ver todos os ${products.length} resultados</div>`;
    }

    dropdown.classList.add('active');
}

// ==================== 11.5 DETALHES DO PRODUTO E VARIANTES (Bloco Complementar) ====================

function openProductDetails(productId) {
    localStorage.setItem('selectedProductId', productId);
    // Se você usa navegação para outra página:
    window.location.href = `produto.html?id=${productId}`;
    
    // Se você usasse modal na mesma página (legado), a lógica estaria aqui.
    // Como o código original indica redirecionamento, mantemos o redirecionamento.
}

// Funções auxiliares caso a página produto.html use este mesmo script,
// ou caso você decida reativar o modal rápido futuramente:

function closeProductDetails() {
    const modal = document.getElementById('productDetailsModal');
    if (modal) modal.classList.remove('active');
    currentProductDetails = null;
}

function addToCartFromDetails() {
    if (!currentProductDetails) return;
    
    // Validação básica se tamanhos/cores são obrigatórios
    if ((currentProductDetails.colors && currentProductDetails.colors.length > 0 && !selectedColor) || 
        (currentProductDetails.sizes && !selectedSize)) {
        showToast('Selecione cor e tamanho!', 'error');
        return;
    }

    const product = currentProductDetails;
    const addButton = document.querySelector('.btn-add-cart-large');
    const cartItemId = `${product.id}_${selectedSize}_${selectedColor}`;
    const existingItem = cart.find(item => (item.cartItemId || item.id) === cartItemId);
    
    // URL da imagem correta baseada na cor selecionada
    let finalImage = product.image;
    if (selectedColor && product.colors) {
        const colorObj = product.colors.find(c => c.name === selectedColor);
        if (colorObj && colorObj.images && colorObj.images.length > 0) {
            finalImage = colorObj.images[0];
        }
    }

    if (existingItem) {
        existingItem.quantity += selectedQuantity;
        existingItem.image = finalImage;
    } else {
        cart.push({
            ...product,
            cartItemId: cartItemId,
            quantity: selectedQuantity,
            selectedSize: selectedSize,
            selectedColor: selectedColor,
            image: finalImage
        });
    }
    
    saveCart();
    updateCartUI();
    
    if (addButton) animateProductToCart(addButton, product);
    
    setTimeout(() => {
        showToast(`${selectedQuantity}x ${product.name} adicionado!`, 'success');
        toggleCart(); // Abre o carrinho automaticamente
    }, 300);
}

function animateProductToCart(sourceElement, product) {
    if (!sourceElement) return;
    const cartEl = document.getElementById('cartSidebar');
    if (!cartEl) return;
    
    const clone = document.createElement('div');
    const rect = sourceElement.getBoundingClientRect();
    
    // Tenta pegar a imagem atual visível
    let imgSrc = product.image;
    if (selectedColor && product.colors) {
        const c = product.colors.find(x => x.name === selectedColor);
        if(c && c.images) imgSrc = c.images[0];
    }

    clone.style.cssText = `
        position: fixed; width: 50px; height: 50px; 
        background-image: url('${imgSrc}'); background-size: cover; 
        border-radius: 50%; z-index: 9999; pointer-events: none;
        left: ${rect.left}px; top: ${rect.top}px;
        transition: all 0.8s cubic-bezier(0.19, 1, 0.22, 1);
    `;
    
    document.body.appendChild(clone);
    
    requestAnimationFrame(() => {
        const cartRect = document.getElementById('cartCount')?.getBoundingClientRect() || cartEl.getBoundingClientRect();
        clone.style.left = `${cartRect.left}px`;
        clone.style.top = `${cartRect.top}px`;
        clone.style.opacity = '0';
        clone.style.transform = 'scale(0.1)';
    });
    
    setTimeout(() => clone.remove(), 800);
}

function quickBuy(productId) {
    window.location.href = `produto.html?id=${productId}`;
}

function buyNow() {
    if (!currentProductDetails) return;
    addToCartFromDetails();
    setTimeout(() => {
        checkout(); // Redireciona direto para checkout
    }, 500);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const targetBtn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
    const targetContent = document.getElementById(`${tabName}Tab`) || document.getElementById('descriptionTab');
    
    if(targetBtn) targetBtn.classList.add('active');
    if(targetContent) targetContent.classList.add('active');
}

function renderRelatedProducts(category, currentId) {
    const related = productsData
        .filter(p => p.category === category && p.id !== currentId)
        .slice(0, 4);
    
    const grid = document.getElementById('relatedProductsGrid');
    if (!grid) return;
    
    grid.innerHTML = related.map(product => {
        const img = (product.images && product.images.length) ? product.images[0] : (product.image || '');
        const isRealImg = img.startsWith('http');
        
        return `
            <div class="product-card" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <div class="product-image-slide active" 
                         style="${isRealImg ? `background-image: url('${img}');` : `background: ${img}`}"></div>
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

// SISTEMA DE VARIANTES (Cor/Tamanho)
async function loadProductVariants(productId) {
    if (productVariants[productId]) return productVariants[productId];
    
    try {
        const snapshot = await db.collection('produtos').doc(productId).collection('variants').get();
        const variants = [];
        snapshot.forEach(doc => variants.push({ id: doc.id, ...doc.data() }));
        productVariants[productId] = variants;
        return variants;
    } catch (error) {
        console.error('Erro ao carregar variantes:', error);
        return [];
    }
}

function isVariantAvailable(productId, size, color) {
    const variants = productVariants[productId] || [];
    const variant = variants.find(v => v.size === size && v.color === color);
    return variant && variant.available && variant.stock > 0;
}

function getVariantStock(productId, size, color) {
    const variants = productVariants[productId] || [];
    const variant = variants.find(v => v.size === size && v.color === color);
    return variant ? variant.stock : 0;
}

function getColorHex(colorName) {
    const colorMap = {
        'Rosa': '#FFB6C1', 'Preto': '#000000', 'Azul': '#4169E1',
        'Verde': '#32CD32', 'Branco': '#FFFFFF', 'Vermelho': '#DC143C',
        'Amarelo': '#FFD700', 'Cinza': '#808080', 'Lilás': '#9370DB',
        'Coral': '#FF7F50', 'Nude': '#E8BEAC', 'Bege': '#F5F5DC',
        'Laranja': '#FFA500', 'Roxo': '#800080'
    };
    return colorMap[colorName] || '#999999';
}

async function renderAvailableColors(productId) {
    const product = productsData.find(p => p.id === productId);
    const variants = productVariants[productId] || [];
    const colorSelector = document.getElementById('colorSelector');
    
    if (!colorSelector || !product) return;
    
    let availableColors = [];
    if (product.colors && product.colors.length > 0) {
        availableColors = product.colors; // Estrutura {name, hex, images}
    } else if (variants.length > 0) {
        const unique = [...new Set(variants.map(v => v.color))];
        availableColors = unique.map(name => ({ name, hex: getColorHex(name), images: product.images }));
    }
    
    // Se não tem cores, esconde container
    if (availableColors.length === 0) {
        const wrapper = colorSelector.closest('.product-option');
        if(wrapper) wrapper.style.display = 'none';
        return;
    }

    colorSelector.innerHTML = availableColors.map((color, index) => {
        // Verifica estoque global da cor
        const hasStock = variants.length === 0 || variants.some(v => v.color === color.name && v.stock > 0);
        const hex = color.hex || getColorHex(color.name);
        const isWhite = hex.toLowerCase() === '#ffffff' || hex.toLowerCase() === '#fff';
        
        return `
            <div class="color-option ${index === 0 && !selectedColor ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                 data-color="${sanitizeInput(color.name)}"
                 data-has-stock="${hasStock}"
                 style="background: ${hex}; ${isWhite ? 'border: 1px solid #ddd;' : ''} ${!hasStock ? 'opacity: 0.4;' : ''}"
                 title="${color.name}"
                 onclick="selectColor('${color.name}')">
                 ${!hasStock ? '<span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.2rem;color:red;">✕</span>' : ''}
            </div>
        `;
    }).join('');
    
    // Seleciona primeira cor automaticamente se não houver seleção
    if (!selectedColor && availableColors.length > 0) {
        // selectColor(availableColors[0].name); // Opcional: auto-selecionar
    }
}

async function renderAvailableSizes(productId) {
    const variants = productVariants[productId] || [];
    const sizeSelector = document.getElementById('sizeSelector');
    if (!sizeSelector) return;
    
    const sizes = ['P', 'M', 'G', 'GG']; // Ou pegue de product.sizes se existir
    
    sizeSelector.innerHTML = sizes.map(size => {
        const hasStock = variants.some(v => v.size === size && v.color === selectedColor && v.stock > 0);
        const stock = variants.find(v => v.size === size && v.color === selectedColor)?.stock || 0;
        
        return `
            <button class="size-option ${size === selectedSize ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                    data-size="${size}"
                    ${!hasStock ? 'disabled' : ''}
                    onclick="selectSize('${size}')">
                ${size}
                ${!hasStock ? '<br><span style="font-size:0.6rem;color:red">Esgotado</span>' : ''}
                ${stock > 0 && stock <= 3 ? '<br><span style="font-size:0.6rem;color:orange">Últimos</span>' : ''}
            </button>
        `;
    }).join('');
}

function selectColor(colorName) {
    if (!currentProductDetails) return;
    
    selectedColor = colorName;
    
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.color === colorName);
    });
    
    // Atualiza galeria se a cor tiver imagens específicas
    if (currentProductDetails.colors) {
        const colorData = currentProductDetails.colors.find(c => c.name === colorName);
        if (colorData && colorData.images && colorData.images.length > 0) {
            updateGalleryDisplay(colorData.images);
        }
    }
    
    renderAvailableSizes(currentProductDetails.id);
}

function selectSize(size) {
    selectedSize = size;
    document.querySelectorAll('.size-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.size === size);
    });
}

function updateGalleryDisplay(images) {
    const img1 = document.getElementById('mainImg1');
    const img2 = document.getElementById('mainImg2');
    const thumbContainer = document.getElementById('thumbnailList');
    
    if (img1 && images[0]) img1.src = images[0];
    if (img2) {
        if (images[1]) {
            img2.style.display = 'block';
            img2.src = images[1];
        } else {
            img2.style.display = 'none';
        }
    }
    
    if (thumbContainer) {
        const remaining = images.slice(2);
        if (remaining.length > 0) {
            thumbContainer.innerHTML = remaining.map(img => `
                <div class="thumbnail-item" onclick="swapMainImage('${img}')" style="cursor:pointer;">
                    <img src="${img}" style="width:100%;height:100%;object-fit:cover;">
                </div>
            `).join('');
            thumbContainer.style.display = 'grid';
        } else {
            thumbContainer.style.display = 'none';
        }
    }
}

function swapMainImage(src) {
    const img1 = document.getElementById('mainImg1');
    if(img1) {
        img1.style.opacity = '0.5';
        setTimeout(() => {
            img1.src = src;
            img1.style.opacity = '1';
            img1.scrollIntoView({behavior: 'smooth', block: 'center'});
        }, 200);
    }
}

// ==================== 12. SISTEMA DE USUÁRIOS ====================
function openUserPanel() {
    const panel = document.getElementById('userPanel');
    if (panel) panel.classList.add('active');
    if (typeof checkUserSession === 'function') {
        checkUserSession();
    }
}

function closeUserPanel() {
    const panel = document.getElementById('userPanel');
    if (panel) panel.classList.remove('active');
}

function checkUserSession() {
    if (auth.currentUser) {
        console.log('✅ Usuário já logado:', auth.currentUser.email);
    } else {
        console.log('ℹ️ Nenhum usuário logado');
    }
}

function switchUserTab(tab) {
    document.querySelectorAll('.user-panel-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.user-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tab === 'login') {
        const loginTabBtn = document.querySelectorAll('.user-panel-tab')[0];
        const loginTabContent = document.getElementById('loginTab');
        if (loginTabBtn) loginTabBtn.classList.add('active');
        if (loginTabContent) loginTabContent.classList.add('active');
    } else if (tab === 'register') {
        const regTabBtn = document.querySelectorAll('.user-panel-tab')[1];
        const regTabContent = document.getElementById('registerTab');
        if (regTabBtn) regTabBtn.classList.add('active');
        if (regTabContent) regTabContent.classList.add('active');
    }
}

// Handler de Redirect do Firebase
auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log('✅ Retorno do redirect:', result.user.email);
    }
}).catch((error) => {
    if (error.code !== 'auth/popup-closed-by-user') {
        console.error('❌ Erro no redirect:', error);
        showToast('Erro no login: ' + error.message, 'error');
    }
});

async function loginWithGoogle() {
    const loadingOverlay = document.getElementById('loadingOverlay') || document.getElementById('checkoutLoadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        let result;
        try {
            result = await auth.signInWithPopup(provider);
        } catch (popupError) {
            if (popupError.code === 'auth/popup-blocked') {
                await auth.signInWithRedirect(provider);
                return;
            }
            throw popupError;
        }
        
        const user = result.user;
        console.log('✅ Login Google bem-sucedido:', user.email);
        
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
            await db.collection('users').doc(user.uid).set({
                name: user.displayName || 'Usuário',
                email: user.email,
                photoURL: user.photoURL || null,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                provider: 'google'
            }, { merge: true });
            
            currentUser = {
                name: user.displayName || 'Usuário',
                email: user.email,
                isAdmin: false,
                uid: user.uid,
                phone: '',
                cpf: '',
                permissions: []
            };
        }
        
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        showToast('Login realizado com sucesso!', 'success');
        
        if (typeof showLoggedInView === 'function') {
            await showLoggedInView();
        }
        
        // Dispara evento de atualização de estado
        window.dispatchEvent(new CustomEvent('authStateUpdated', { 
            detail: { user: currentUser, isAdmin: isAdminLoggedIn } 
        }));

    } catch (error) {
        console.error('❌ Erro no login Google:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
             showToast('Erro ao entrar com Google', 'error');
        }
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// ==================== 13. ADMIN PANEL: GERAL ====================
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
            if (typeof userLogout === 'function') {
                await userLogout();
            }
            return;
        }
        
        document.getElementById('adminPanel').classList.add('active');
        renderAdminProducts();
        updateAdminStats();
        if (typeof loadCoupons === 'function') loadCoupons();
        
    } catch (error) {
        console.error('❌ Erro ao verificar permissões:', error);
        showToast('❌ Erro ao verificar permissões', 'error');
    }
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('active');
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    // Encontra o botão clicado ou correspondente
    const targetBtn = Array.from(document.querySelectorAll('.admin-tab')).find(b => b.textContent.toLowerCase().includes(tab) || b.getAttribute('onclick')?.includes(tab));
    if (targetBtn) targetBtn.classList.add('active');
    else if (event && event.target) event.target.classList.add('active');

    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tab === 'products') {
        document.getElementById('productsTab').classList.add('active');
    } else if (tab === 'settings') {
        document.getElementById('settingsTab').classList.add('active');
    } else if (tab === 'coupons') {
        document.getElementById('couponsTab').classList.add('active');
        if (typeof loadCoupons === 'function') loadCoupons();
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
    if (elOrders) elOrders.textContent = Math.floor(Math.random() * 50) + 10; // Mock temporário
    if (elActive) elActive.textContent = activeProducts;
}

// ==================== 14. ADMIN PANEL: PRODUTOS ====================
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
        if(document.getElementById('productBlackFriday')) {
            document.getElementById('productBlackFriday').checked = product.isBlackFriday || false;
        }
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

function editProduct(productId) {
    openProductModal(productId);
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    editingProductId = null;
    productColors = [];
}

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
        images: tempProductImages.filter(url => url.startsWith('http')),
        colors: productColors || [],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!editingProductId) {
        productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    if(loadingOverlay) loadingOverlay.classList.add('active');
    
    const batch = db.batch();
    const productRef = db.collection('produtos').doc(productId);

    try {
        batch.set(productRef, productData, { merge: true });

        // Salvar variantes baseadas nas cores (tamanho Único por padrão para simplificar, pode expandir)
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
        if(loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Tem certeza que deseja excluir este produto? Esta ação é irreversível.')) {
        return;
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    if(loadingOverlay) loadingOverlay.classList.add('active');

    try {
        await db.collection("produtos").doc(productId).delete();
        
        const index = productsData.findIndex(p => p.id === productId);
        if (index !== -1) {
            productsData.splice(index, 1);
        }
        
        productCache.clear();
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        showToast('Produto excluído com sucesso!', 'success');
        
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        showToast('Erro ao excluir produto: ' + (error.code === 'permission-denied' ? 'Permissão negada. Verifique se você é admin.' : error.message), 'error');
    } finally {
        if(loadingOverlay) loadingOverlay.classList.remove('active');
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
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    if(loadingOverlay) loadingOverlay.classList.add('active');
    
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
        
        alert(`✅ ${snapshot.size} produtos foram deletados!`);
        
    } catch (error) {
        console.error("Erro ao limpar produtos:", error);
        alert('Erro ao limpar produtos: ' + error.message);
    } finally {
        if(loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// ==================== 15. ADMIN PANEL: GESTÃO DE IMAGENS E CORES ====================
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
        imgArea.style.cssText = `height: 140px; width: 100%; position: relative; background: ${isImage ? '#f0f0f0' : img};`;

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
                position: absolute; top: 0; left: 0; right: 0; background: rgba(52, 152, 219, 0.9);
                color: white; font-size: 0.7rem; font-weight: bold; text-align: center; padding: 4px; z-index: 5;
            `;
            imgArea.appendChild(badge);
        }

        if (linkedColor) {
            const colorBadge = document.createElement('div');
            colorBadge.title = `Vinculada a: ${linkedColor.name}`;
            colorBadge.style.cssText = `
                position: absolute; bottom: 5px; right: 5px; width: 24px; height: 24px;
                border-radius: 50%; background: ${linkedColor.hex}; border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 5;
            `;
            imgArea.appendChild(colorBadge);
        }

        const btnRemove = document.createElement('button');
        btnRemove.innerHTML = '✕';
        btnRemove.type = 'button';
        btnRemove.style.cssText = `
            position: absolute; top: 5px; right: 5px; width: 28px; height: 28px; border-radius: 50%;
            background: rgba(231, 76, 60, 0.9); color: white; border: none; cursor: pointer;
            font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 10;
        `;
        btnRemove.onclick = (e) => { e.preventDefault(); e.stopPropagation(); removeProductImage(index); };
        imgArea.appendChild(btnRemove);

        const actionsBar = document.createElement('div');
        actionsBar.style.cssText = `padding: 8px; background: #f8f9fa; border-top: 1px solid #eee; display: flex; gap: 5px; flex-direction: column;`;

        if (!isCover) {
            const btnSetCover = document.createElement('button');
            btnSetCover.type = 'button';
            btnSetCover.innerText = '🏠 Virar Capa';
            btnSetCover.style.cssText = `background: white; border: 1px solid #3498db; color: #3498db; padding: 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer; width: 100%;`;
            btnSetCover.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setProductCover(index); };
            actionsBar.appendChild(btnSetCover);
        }

        if (hasColors) {
            const btnLinkColor = document.createElement('button');
            btnLinkColor.type = 'button';
            btnLinkColor.innerText = linkedColor ? `🎨 ${linkedColor.name}` : '🎨 Vincular Cor';
            const bg = linkedColor ? '#9b59b6' : 'white';
            const fg = linkedColor ? 'white' : '#9b59b6';
            btnLinkColor.style.cssText = `background: ${bg}; border: 1px solid #9b59b6; color: ${fg}; padding: 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer; width: 100%;`;
            btnLinkColor.onclick = (e) => { e.preventDefault(); e.stopPropagation(); linkImageToColor(index); };
            actionsBar.appendChild(btnLinkColor);
        } else {
            const noColorMsg = document.createElement('div');
            noColorMsg.innerText = 'Adicione cores acima para vincular';
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

// Helpers de Imagem por URL/Gradiente
function toggleUrlInput() {
    const urlBox = document.getElementById('imageUrlInputBox');
    const gradientBox = document.getElementById('imageGradientInputBox');
    if (urlBox) {
        if (gradientBox) gradientBox.classList.remove('active');
        urlBox.classList.toggle('active');
        if (urlBox.classList.contains('active')) document.getElementById('imageUrlField')?.focus();
    }
}

function toggleGradientInput() {
    const gradientBox = document.getElementById('imageGradientInputBox');
    const urlBox = document.getElementById('imageUrlInputBox');
    if (gradientBox) {
        if (urlBox) urlBox.classList.remove('active');
        gradientBox.classList.toggle('active');
        if (gradientBox.classList.contains('active')) document.getElementById('gradientField')?.focus();
    }
}

function addImageFromUrl() {
    const urlField = document.getElementById('imageUrlField');
    if (!urlField) return;
    const imageUrl = urlField.value.trim();
    if (!imageUrl) { showToast('Cole o link da imagem!', 'error'); return; }
    
    tempProductImages.push(imageUrl);
    renderProductImages();
    urlField.value = '';
    toggleUrlInput();
    showToast('Imagem adicionada com sucesso!', 'success');
}

function addGradientImage() {
    const gradientField = document.getElementById('gradientField');
    if (!gradientField) return;
    const gradient = gradientField.value.trim();
    if (!gradient || !gradient.includes('gradient')) { 
        showToast('Gradiente inválido!', 'error'); 
        return; 
    }
    
    tempProductImages.push(gradient);
    renderProductImages();
    gradientField.value = '';
    toggleGradientInput();
    showToast('Gradiente adicionado!', 'success');
}

// Gestão de Cores
function addColorToProduct() {
    const colorName = prompt('🎨 Digite o Nome da Cor (Ex: Preto):');
    if (!colorName || colorName.trim() === '') return;

    const colorHex = prompt('🎨 Digite o Código Hex (Ex: #000000):');
    if (!colorHex || !colorHex.includes('#')) {
        alert('❌ Código inválido! Use #');
        return;
    }

    if (!Array.isArray(productColors)) productColors = [];

    productColors.push({
        name: colorName.trim(),
        hex: colorHex.trim().toUpperCase(),
        images: [] 
    });

    renderProductColorsManager(); 
    renderProductImages(); 
    showToast(`✅ Cor "${colorName}" adicionada!`, 'success');
}

function renderProductColorsManager() {
    const container = document.getElementById('productColorsManager');
    if (!container) return;
    
    if (!Array.isArray(productColors)) productColors = [];
    
    if (productColors.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma cor adicionada ainda</p>';
        return;
    }
    
    container.innerHTML = productColors.map((color, index) => `
        <div class="color-card" style="--color: ${color.hex}">
            <div class="color-card-header">
                <div class="color-info">
                    <div class="color-swatch" style="background: ${color.hex}; ${color.hex.toUpperCase() === '#FFFFFF' ? 'border-color: #ddd;' : ''}"></div>
                    <div class="color-details">
                        <span class="color-name">${color.name}</span>
                        <span class="color-hex">${color.hex}</span>
                    </div>
                </div>
                <button type="button" onclick="removeProductColor(${index})" class="btn-remove-color">🗑️ Remover</button>
            </div>
            <div class="color-images-count">
                📸 ${color.images.length} imagem(ns) vinculada(s)
            </div>
        </div>
    `).join('');
}

function linkImageToColor(imageIndex) {
    if (!Array.isArray(productColors) || productColors.length === 0) {
        showToast('❌ Cadastre uma cor antes de vincular!', 'error');
        return;
    }
    
    const imageUrl = tempProductImages[imageIndex];
    const colorNames = productColors.map((c, i) => `${i + 1}: ${c.name}`).join('\n');
    const choice = prompt(`Vincular imagem:\n\n0: Desvincular de todas\n${colorNames}\n\nDigite o número da cor:`);

    if (choice === null || choice.trim() === '') return;
    const choiceNum = parseInt(choice.trim());
    
    if (choiceNum === 0) {
        productColors.forEach(c => { if (c.images) c.images = c.images.filter(u => u !== imageUrl); });
        renderProductImages();
        renderProductColorsManager();
        showToast('🔓 Foto desvinculada', 'info');
        return;
    }

    const idx = choiceNum - 1;
    if (idx < 0 || idx >= productColors.length) { showToast('❌ Inválido!', 'error'); return; }

    // Remove de outras cores (uma foto só pode ser de uma cor)
    productColors.forEach(c => { if (c.images) c.images = c.images.filter(u => u !== imageUrl); });

    if (!productColors[idx].images) productColors[idx].images = [];
    if (!productColors[idx].images.includes(imageUrl)) productColors[idx].images.push(imageUrl);
    
    renderProductImages();
    renderProductColorsManager();
    showToast(`✅ Vinculada a "${productColors[idx].name}"`, 'success');
}

function removeProductColor(index) {
    if (confirm('Remover esta cor?')) {
        productColors.splice(index, 1);
        renderProductColorsManager();
        renderProductImages(); // Re-renderiza para atualizar botões de vínculo
        showToast('Cor removida', 'info');
    }
}

// ==================== 16. CONFIGURAÇÕES DO ADMIN ====================
function saveSettings() {
    const bannerTitle = sanitizeInput(document.getElementById('settingBannerTitle').value.trim());
    const bannerSubtitle = sanitizeInput(document.getElementById('settingBannerSubtitle').value.trim());
    const topBanner = sanitizeInput(document.getElementById('settingTopBanner').value.trim());

    localStorage.setItem('sejaVersatilSettings', JSON.stringify({ bannerTitle, bannerSubtitle, topBanner }));
    showToast('Configurações salvas!', 'success');
}

function loadSettings() {
    const saved = localStorage.getItem('sejaVersatilSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        if(document.querySelector('.top-banner')) document.querySelector('.top-banner').textContent = settings.topBanner;
        if(document.getElementById('settingBannerTitle')) {
            document.getElementById('settingBannerTitle').value = settings.bannerTitle;
            document.getElementById('settingBannerSubtitle').value = settings.bannerSubtitle;
            document.getElementById('settingTopBanner').value = settings.topBanner;
        }
    }
}

// ==================== 17. ADMIN PANEL: CUPONS ====================
async function loadCoupons() {
    try {
        const snapshot = await db.collection('coupons').get();
        const activeCoupons = [];
        const inactiveCoupons = [];
        
        snapshot.forEach(doc => {
            const coupon = { id: doc.id, ...doc.data() };
            if (coupon.active) activeCoupons.push(coupon);
            else inactiveCoupons.push(coupon);
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
                        <span class="coupon-detail-label">Mínimo</span>
                        <span class="coupon-detail-value">R$ ${coupon.minValue.toFixed(2)}</span>
                    </div>` : ''}
                    ${coupon.usageLimit ? `
                    <div class="coupon-detail-item">
                        <span class="coupon-detail-label">Usos</span>
                        <span class="coupon-detail-value">${coupon.usedCount || 0} / ${coupon.usageLimit}</span>
                    </div>` : ''}
                </div>
            </div>
            <div class="coupon-admin-actions">
                <button class="coupon-toggle-btn ${coupon.active ? 'deactivate' : 'activate'}" 
                        onclick="toggleCouponStatus('${coupon.id}', ${!coupon.active})">
                    ${coupon.active ? '⏸️ Desativar' : '▶️ Ativar'}
                </button>
                <button class="coupon-delete-btn" onclick="deleteCouponPrompt('${coupon.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

function openCouponModal(couponId = null) {
    const modal = document.getElementById('couponModal');
    const form = document.getElementById('couponForm');
    
    // Lógica de edição futura pode ser implementada aqui
    form.reset();
    if(document.getElementById('couponId')) document.getElementById('couponId').value = '';
    if(document.getElementById('couponActive')) document.getElementById('couponActive').checked = true;
    
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
        showToast('❌ Permissão negada', 'error');
        return;
    }
    
    const code = document.getElementById('couponCode').value.trim().toUpperCase();
    const type = document.getElementById('couponType').value;
    const value = parseFloat(document.getElementById('couponValue').value);
    const maxDiscount = document.getElementById('couponMaxDiscount').value ? parseFloat(document.getElementById('couponMaxDiscount').value) : null;
    const minValue = document.getElementById('couponMinValue').value ? parseFloat(document.getElementById('couponMinValue').value) : null;
    const usageLimit = document.getElementById('couponUsageLimit').value ? parseInt(document.getElementById('couponUsageLimit').value) : null;
    const usagePerUser = document.getElementById('couponUsagePerUser').value ? parseInt(document.getElementById('couponUsagePerUser').value) : null;
    const active = document.getElementById('couponActive').checked;
    
    const validFromInput = document.getElementById('couponValidFrom').value;
    const validUntilInput = document.getElementById('couponValidUntil').value;
    
    const couponData = {
        code, type, value, maxDiscount, minValue, usageLimit, usagePerUser, active,
        usedCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser.uid
    };
    
    if (validFromInput) couponData.validFrom = firebase.firestore.Timestamp.fromDate(new Date(validFromInput));
    if (validUntilInput) couponData.validUntil = firebase.firestore.Timestamp.fromDate(new Date(validUntilInput));
    
    document.getElementById('loadingOverlay').classList.add('active');
    try {
        await db.collection('coupons').doc(code).set(couponData);
        showToast('✅ Cupom criado!', 'success');
        closeCouponModal();
        loadCoupons();
    } catch (error) {
        console.error('Erro ao salvar cupom:', error);
        showToast('Erro ao salvar', 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

async function toggleCouponStatus(couponId, newStatus) {
    try {
        await db.collection('coupons').doc(couponId).update({ active: newStatus });
        showToast(newStatus ? '✅ Cupom ativado' : '⏸️ Cupom desativado', 'success');
        loadCoupons();
    } catch (error) {
        showToast('Erro ao alterar status', 'error');
    }
}

async function deleteCouponPrompt(couponId) {
    if (!confirm(`🗑️ Deletar cupom "${couponId}"?`)) return;
    try {
        await db.collection('coupons').doc(couponId).delete();
        showToast('🗑️ Cupom deletado', 'info');
        loadCoupons();
    } catch (error) {
        showToast('Erro ao deletar', 'error');
    }
}

// ==================== 18. ADMIN PANEL: GERENCIADOR DE VÍDEOS ====================
function openVideoManager() {
    if (!auth.currentUser || !currentUser.isAdmin) {
        showToast('❌ Permissão negada', 'error');
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
    container.innerHTML = `<div class="loading-spinner"><div class="loading-dot"></div></div>`;
    
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        let videos = [];
        if (configDoc.exists && configDoc.data().videos) {
            videos = configDoc.data().videos.sort((a, b) => a.order - b.order);
        }
        
        if (videos.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem;">Nenhum vídeo configurado</p>';
            return;
        }
        
        container.innerHTML = videos.map((video, index) => `
            <div class="video-manager-item" style="display: flex; gap: 1rem; align-items: center; padding: 1rem; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 1rem;">
                <div style="font-weight: 700; font-size: 1.5rem; color: #999; min-width: 30px;">${index + 1}</div>
                <div style="width: 120px; height: 160px; background: #000; border-radius: 4px; overflow: hidden;">
                    <video src="${video.url}" style="width: 100%; height: 100%; object-fit: cover;" muted loop></video>
                </div>
                <div style="flex: 1;">
                    <input type="text" value="${video.title}" onchange="updateVideoTitle(${index}, this.value)" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <input type="text" value="${video.subtitle}" onchange="updateVideoSubtitle(${index}, this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${index > 0 ? `<button onclick="moveVideo(${index}, ${index - 1})" style="padding: 0.5rem;">↑</button>` : ''}
                    ${index < videos.length - 1 ? `<button onclick="moveVideo(${index}, ${index + 1})" style="padding: 0.5rem;">↓</button>` : ''}
                    <button onclick="removeVideo(${index})" style="padding: 0.5rem; background: #e74c3c; color: white; border: none; border-radius: 4px;">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar vídeos:', error);
        container.innerHTML = '<p>Erro ao carregar vídeos</p>';
    }
}

async function addVideoSlot() {
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        let videos = configDoc.exists && configDoc.data().videos ? configDoc.data().videos : [];
        
        if (videos.length >= 5) {
            showToast('❌ Máximo de 5 vídeos', 'error');
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/mp4';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { showToast('❌ Vídeo muito grande! Máximo 5MB', 'error'); return; }
            
            document.getElementById('loadingOverlay').classList.add('active');
            try {
                const storageRef = storage.ref().child(`videos/video_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);
                await storageRef.put(file);
                const downloadURL = await storageRef.getDownloadURL();
                
                videos.push({ url: downloadURL, title: 'NOVO', subtitle: 'Edite', order: videos.length + 1 });
                await db.collection('site_config').doc('video_grid').set({ videos });
                
                showToast('✅ Vídeo adicionado!', 'success');
                renderVideoManager();
                await loadVideoGrid();
            } catch (err) {
                showToast('Erro no upload', 'error');
            } finally {
                document.getElementById('loadingOverlay').classList.remove('active');
            }
        };
        input.click();
    } catch (err) {
        console.error(err);
    }
}

// Funções auxiliares de vídeo (update, move, remove)
async function updateVideoTitle(index, val) { updateVideoField(index, 'title', val); }
async function updateVideoSubtitle(index, val) { updateVideoField(index, 'subtitle', val); }

async function updateVideoField(index, field, value) {
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        const videos = configDoc.data().videos;
        videos[index][field] = value;
        await db.collection('site_config').doc('video_grid').update({ videos });
        await loadVideoGrid();
        showToast('✅ Atualizado', 'success');
    } catch (err) { console.error(err); }
}

async function moveVideo(from, to) {
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        const videos = configDoc.data().videos;
        [videos[from], videos[to]] = [videos[to], videos[from]];
        videos.forEach((v, i) => v.order = i + 1);
        await db.collection('site_config').doc('video_grid').update({ videos });
        renderVideoManager();
        await loadVideoGrid();
    } catch (err) { console.error(err); }
}

async function removeVideo(index) {
    if (!confirm('Remover vídeo?')) return;
    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        const videos = configDoc.data().videos;
        videos.splice(index, 1);
        videos.forEach((v, i) => v.order = i + 1);
        await db.collection('site_config').doc('video_grid').update({ videos });
        renderVideoManager();
        await loadVideoGrid();
        showToast('🗑️ Vídeo removido', 'info');
    } catch (err) { console.error(err); }
}

// ==================== 19. UI COMPONENTS (CHAT & SIDEBAR) ====================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if(sidebar) sidebar.classList.toggle('active');
    if(overlay) overlay.classList.toggle('active');
    if(btn) btn.classList.toggle('active');
}

function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    if(chatBox) {
        chatBox.classList.toggle('active');
        if (chatBox.classList.contains('active')) document.getElementById('chatInput')?.focus();
    }
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    addChatMessage(message, 'user');
    input.value = '';
    
    setTimeout(() => {
        const responses = [
            'Como posso ajudar com seus produtos fitness?',
            'Temos ótimas promoções hoje! O que procura?',
            'Posso ajudar a encontrar o tamanho ideal.'
        ];
        addChatMessage(responses[Math.floor(Math.random() * responses.length)], 'bot');
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

// ==================== 20. CHECKOUT & WHATSAPP INTEGRATION ====================
function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const cartItemsContainer = document.getElementById('paymentCartItems');
    const totalContainer = document.getElementById('paymentTotal');
    
    if (!modal || !cartItemsContainer || !totalContainer) {
        console.error('Elementos do modal de pagamento não encontrados!');
        return;
    }
    
    // Cálculo final com cupom aplicado
    let finalDiscount = 0;
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (appliedCoupon) {
        if (appliedCoupon.minValue && subtotal < appliedCoupon.minValue) {
            removeCoupon(); // Remove se não atingir mínimo
        } else {
            if (appliedCoupon.type === 'percentage') {
                let discountVal = (subtotal * appliedCoupon.value) / 100;
                if (appliedCoupon.maxDiscount && discountVal > appliedCoupon.maxDiscount) {
                    discountVal = appliedCoupon.maxDiscount;
                }
                finalDiscount = discountVal;
            } else {
                finalDiscount = appliedCoupon.value;
            }
            // Garante que desconto não exceda o total
            finalDiscount = Math.min(finalDiscount, subtotal);
        }
    }
    
    couponDiscount = finalDiscount; // Atualiza global

    // Renderiza itens
    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="payment-cart-item">
            <div>
                <div class="payment-cart-item-name">${sanitizeInput(item.name)}</div>
                <div class="payment-cart-item-details">Qtd: ${item.quantity} × R$ ${item.price.toFixed(2)}</div>
                ${item.selectedSize ? `<div style="font-size:0.75rem;color:#666">Tam: ${item.selectedSize} ${item.selectedColor ? '| Cor: '+item.selectedColor : ''}</div>` : ''}
            </div>
            <div style="font-weight: 700;">R$ ${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `).join('');
    
    // Renderiza Cupom se existir
    if (appliedCoupon && couponDiscount > 0) {
        cartItemsContainer.innerHTML += `
            <div style="padding: 0.8rem; margin-top: 0.5rem; background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #155724;">🎟️ ${appliedCoupon.code}</strong>
                    </div>
                    <strong style="color: #155724;">-R$ ${couponDiscount.toFixed(2)}</strong>
                </div>
            </div>
        `;
    }
    
    const total = Math.max(0, subtotal - couponDiscount);
    totalContainer.textContent = `R$ ${total.toFixed(2)}`;
    
    modal.classList.add('active');
    setupPaymentListeners();
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) modal.classList.remove('active');
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

// 21. Validações e Dados do Cliente para Checkout
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0, remainder;
    for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i-1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i-1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

function collectGuestCustomerData() {
    return new Promise((resolve) => {
        const modal = document.getElementById('customerDataModal');
        const form = document.getElementById('customerDataForm');
        
        if (!modal || !form) {
            console.error('Modal de dados não encontrado');
            resolve(null);
            return;
        }
        
        modal.classList.add('active');
        form.reset();
        
        // Remove listener antigo para evitar duplicação
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('guestName').value.trim();
            const email = document.getElementById('guestEmail').value.trim();
            const phone = document.getElementById('guestPhone').value.replace(/\D/g, '');
            const cpf = document.getElementById('guestCPF').value.replace(/\D/g, '');
            
            if (name.length < 3 || !validateEmail(email) || phone.length < 10 || !isValidCPF(cpf)) {
                showToast('Preencha os dados corretamente', 'error');
                return;
            }
            
            modal.classList.remove('active');
            resolve({ name, email, phone, cpf, userId: null });
        });
        
        // Botão Fechar/Cancelar
        window.closeCustomerDataModal = () => {
            modal.classList.remove('active');
            resolve(null);
        };
    });
}

async function getUserPhone() {
    if (!auth.currentUser) return null;
    // Lógica simplificada: tenta pegar do DB, se não, pede prompt
    const doc = await db.collection('users').doc(auth.currentUser.uid).get();
    if (doc.exists && doc.data().phone) return doc.data().phone;
    
    const phone = prompt('Digite seu WhatsApp com DDD (apenas números):');
    if (phone && phone.length >= 10) {
        await db.collection('users').doc(auth.currentUser.uid).update({ phone });
        return phone;
    }
    return null;
}

async function getUserCPF() {
    if (!auth.currentUser) return null;
    const doc = await db.collection('users').doc(auth.currentUser.uid).get();
    if (doc.exists && doc.data().cpf) return doc.data().cpf;
    
    const cpf = prompt('Digite seu CPF para a nota fiscal:');
    if (cpf && isValidCPF(cpf)) {
        await db.collection('users').doc(auth.currentUser.uid).update({ cpf });
        return cpf;
    }
    return null;
}

async function sendToWhatsApp() {
    if (window.authReady) await window.authReady;
    
    if (cart.length === 0) {
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
        const sel = document.getElementById('installmentsSelect');
        if (!sel.value) { showToast('Selecione as parcelas.', 'error'); return; }
        installments = sel.value;
    }

    let customerData = {};
    if (auth.currentUser) {
        const phone = await getUserPhone();
        const cpf = await getUserCPF();
        if (!phone || !cpf) { showToast('Dados incompletos.', 'error'); return; }
        customerData = {
            name: currentUser.name || 'Cliente',
            email: currentUser.email,
            phone: phone, cpf: cpf, uid: currentUser.uid
        };
    } else {
        const guestData = await collectGuestCustomerData();
        if (!guestData) return; // Cancelou modal
        customerData = guestData;
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    if(loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
        const discount = couponDiscount || 0;
        const total = Math.max(0, subtotal - discount);
        
        let orderId = 'PENDENTE';
        
        // Salva pedido no Firestore
        const orderData = {
            userId: customerData.uid || 'guest',
            customer: customerData,
            items: cart,
            totals: { subtotal, discount, total },
            paymentMethod, installments,
            status: 'Pendente WhatsApp',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            appliedCoupon: appliedCoupon ? { code: appliedCoupon.code, value: appliedCoupon.value } : null
        };
        
        const docRef = await db.collection('orders').add(orderData);
        orderId = docRef.id;
        
        if (appliedCoupon) {
            await registerCouponUsage(appliedCoupon.id, total, discount);
        }
        
        // Gera link e abre WhatsApp
        const msg = generateWhatsAppMessage(orderId, customerData, cart, { subtotal, discount, total }, paymentMethod, installments);
        const WHATSAPP_NUMBER = '5571991427103';
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        
        // Limpeza
        closePaymentModal();
        if(window.closeCustomerDataModal) window.closeCustomerDataModal();
        cart = []; appliedCoupon = null; couponDiscount = 0;
        saveCart(); updateCartUI();
        showToast('Pedido realizado!', 'success');
        
    } catch (err) {
        console.error(err);
        showToast('Erro ao processar pedido', 'error');
    } finally {
        if(loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

function generateWhatsAppMessage(orderId, customer, items, totals, paymentMethod, installments) {
    let msg = `*🛍️ PEDIDO #${orderId.substring(0,6).toUpperCase()} - SEJA VERSÁTIL*\n\n`;
    msg += `*👤 CLIENTE:*\nNome: ${customer.name}\nTel: ${customer.phone}\nCPF: ${customer.cpf}\n\n`;
    
    msg += `*📦 PRODUTOS:*\n`;
    items.forEach(item => {
        msg += `- ${item.quantity}x ${item.name} | ${item.selectedSize || '-'} ${item.selectedColor || '-'}\n`;
    });
    
    msg += `\n*💰 FINANCEIRO:*\nSubtotal: R$ ${totals.subtotal.toFixed(2)}\n`;
    if (totals.discount > 0) msg += `Desconto: - R$ ${totals.discount.toFixed(2)}\n`;
    msg += `*TOTAL: R$ ${totals.total.toFixed(2)}*\n\n`;
    
    const methodMap = { 'pix': 'PIX', 'boleto': 'Boleto', 'credito-avista': 'Crédito à Vista', 'credito-parcelado': 'Crédito Parcelado' };
    msg += `*💳 PAGAMENTO:* ${methodMap[paymentMethod] || paymentMethod}`;
    if (installments) msg += ` (${installments}x)`;
    
    return msg;
}

// ==================== 22. EVENT LISTENERS GLOBAIS ====================
document.addEventListener('DOMContentLoaded', () => {
    // Escuta teclas para fechar modais
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModals = document.querySelectorAll('.admin-modal.active, .sidebar.active, .search-modal.active');
            activeModals.forEach(m => m.classList.remove('active'));
            if(document.getElementById('sidebarOverlay')) document.getElementById('sidebarOverlay').classList.remove('active');
        }
    });
    
    // Monitoramento de Rede
    window.addEventListener('online', () => showToast('Conexão restaurada!', 'success'));
    window.addEventListener('offline', () => showToast('Você está offline', 'error'));
});

// Listener de Auth atualizada (Disparado pelo auth.js ou login manual)
window.addEventListener('authStateUpdated', (e) => {
    const { user, isAdmin } = e.detail;
    if (typeof currentUser !== 'undefined') currentUser = user;
    if (typeof isAdminLoggedIn !== 'undefined') isAdminLoggedIn = isAdmin;
    if (typeof updateUI === 'function') updateUI(user); // Atualiza Header se existir função
    if (typeof updateFavoriteStatus === 'function') updateFavoriteStatus();
});

console.log('✅ script2_clean.js - PARTE 4 carregada. Código completo.');
