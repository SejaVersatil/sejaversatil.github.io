// ==================== SCRIPT2.JS - SEJA VERSÁTIL ====================
// Sistema Principal de E-commerce - Organizado e Limpo
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

    get cart() {
        return this._cart;
    },
    set cart(val) {
        this._cart = val;
        this.save();
    },

    get appliedCoupon() {
        return this._appliedCoupon;
    },
    set appliedCoupon(val) {
        this._appliedCoupon = val;
        this.save();
    },

    get couponDiscount() {
        return this._couponDiscount;
    },
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

// ==================== FUNÇÕES UTILITÁRIAS DE IMAGEM ====================
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

// ==================== CARROSSEL HERO ====================
let currentHeroSlide = 0;
let heroCarouselInterval;
const heroSlides = [{
        image: 'https://i.imgur.com/ZVqxl8B.jpeg',
        title: '',
        subtitle: '',
        cta: 'EXPLORAR AGORA'
    },
    {
        image: 'https://i.imgur.com/iapKUtF.jpeg',
        title: 'LANÇAMENTO',
        subtitle: 'Tecnologia para máxima performance',
        cta: 'VER COLEÇÃO'
    },
    {
        image: 'https://i.imgur.com/2SHv3pc.jpeg',
        title: 'FITNESS & LIFESTYLE',
        subtitle: 'Do treino ao dia a dia com versatilidade',
        cta: 'DESCOBRIR'
    }
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
        productsSection.scrollIntoView({
            behavior: 'smooth'
        });
    }
}

// ==================== VIDEO GRID LOADER ====================
let videoGridData = [];

async function loadVideoGrid() {
    const container = document.getElementById('videoGridContainer');
    if (!container) {
        console.warn('Container de vídeos não encontrado');
        return;
    }

    try {
        const configDoc = await db.collection('site_config').doc('video_grid').get();
        if (configDoc.exists && configDoc.data().videos && configDoc.data().videos.length > 0) {
            videoGridData = configDoc.data().videos.sort((a, b) => a.order - b.order);
            videoGridData = videoGridData.filter(video => {
                if (!video.url || !video.url.startsWith('http')) {
                    console.warn('URL de vídeo inválida:', video);
                    return false;
                }
                return true;
            });
            if (videoGridData.length === 0) {
                throw new Error('Nenhum vídeo válido encontrado');
            }
        } else {
            console.log('Usando vídeos padrão');
            videoGridData = getDefaultVideos();
        }

        await renderVideoGrid();
    } catch (error) {
        console.error('Erro ao carregar vídeos:', error);
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; background: #f8f8f8;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🎬</div>
                <h3 style="font-size: 1.3rem; margin-bottom: 1rem; color: #666;">
                    Vídeos em breve
                </h3>
                <p style="color: #999;">Estamos preparando conteúdos incríveis para você</p>
            </div>
        `;
    }
}

function getDefaultVideos() {
    return [{
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
    if (!container || !videoGridData || videoGridData.length === 0) {
        console.warn('Sem dados para renderizar vídeos');
        return;
    }

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
            >
                <p style="color: white; padding: 2rem; text-align: center;">
                    Seu navegador não suporta reprodução de vídeos
                </p>
            </video>
            
            <div class="video-overlay">
                <div class="video-title">${video.title}</div>
                <div class="video-subtitle">${video.subtitle}</div>
            </div>
            
            <div class="video-play-indicator">
                <svg viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                </svg>
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
        video.load();

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    video.play().catch(err => {
                        console.warn('⚠️ Autoplay bloqueado:', err);
                        if (playIndicator) playIndicator.style.opacity = '1';
                    });
                } else {
                    video.pause();
                }
            });
        }, {
            threshold: 0.5
        });

        observer.observe(card);

        card.addEventListener('click', () => {
            if (video.paused) {
                video.play();
                if (playIndicator) {
                    playIndicator.innerHTML = `
                        <svg viewBox="0 0 24 24" style="fill: #000;">
                            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                    `;
                }
            } else {
                video.pause();
                if (playIndicator) {
                    playIndicator.innerHTML = `
                        <svg viewBox="0 0 24 24" style="fill: #000;">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    `;
                }
            }
        });
        card.addEventListener('mouseenter', () => {
            if (video.paused) {
                video.play().catch(() => {});
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
// ==================== NAVEGAÇÃO POR CATEGORIA ====================
function navigateToCategory(category) {
    Object.keys(carouselIntervals).forEach(key => {
        clearInterval(carouselIntervals[key]);
    });
    carouselIntervals = {};
    carouselEventsRegistered.clear();

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
            productsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }

    trackEvent('Promo Cards', 'Navigate to Category', category);

    isInternalNavigation = true;
    showToast(`Visualizando: ${getCategoryName(category)}`, 'info');
}

function clearCategoryFilter() {
    currentFilter = 'all';
    currentPage = 1;

    const badge = document.getElementById('activeCategoryBadge');
    if (badge) {
        badge.style.display = 'none';
    }

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

const productCache = new CacheManager();
const firestoreRateLimiter = new RateLimiter(10, 60000);

// ==================== FUNÇÕES UTILITÁRIAS ====================
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

function trackEvent(category, action, label) {
    console.log(`📊 Event: ${category} - ${action} - ${label}`);
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            event_category: category,
            event_label: label
        });
    }
}

// ==================== PRODUTOS PADRÃO ====================
const DEFAULT_PRODUCTS = [{
        name: 'Blusa Fitness Sem Costura',
        category: 'blusas',
        price: 89.90,
        oldPrice: null,
        badge: 'Novo',
        images: ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)']
    },
    {
        name: 'Blusa Regata Essential',
        category: 'blusas',
        price: 69.90,
        oldPrice: 89.90,
        badge: '-22%',
        images: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']
    },
    {
        name: 'Blusa Cropped Strappy',
        category: 'blusas',
        price: 79.90,
        oldPrice: null,
        badge: null,
        images: ['linear-gradient(135deg, #30cfd0 0%, #330867 100%)']
    },
    {
        name: 'Conjunto Calça High Waist',
        category: 'conjunto calca',
        price: 209.90,
        oldPrice: 299.90,
        badge: '-30%',
        images: ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)']
    },
    {
        name: 'Conjunto Calça Seamless Pro',
        category: 'conjunto calca',
        price: 229.90,
        oldPrice: 279.90,
        badge: '-20%',
        images: ['linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)']
    },
    {
        name: 'Conjunto Calça Premium',
        category: 'conjunto calca',
        price: 249.90,
        oldPrice: null,
        badge: 'Lançamento',
        images: ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)']
    },
    {
        name: 'Peça Única Fitness Premium',
        category: 'peca unica',
        price: 149.90,
        oldPrice: 189.90,
        badge: 'Novo',
        images: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)']
    },
    {
        name: 'Peça Única Metallic Rose',
        category: 'peca unica',
        price: 159.90,
        oldPrice: null,
        badge: 'Novo',
        images: ['linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)']
    },
    {
        name: 'Peça Única Alta Compressão',
        category: 'peca unica',
        price: 139.90,
        oldPrice: null,
        badge: null,
        images: ['linear-gradient(135deg, #434343 0%, #000000 100%)']
    },
    {
        name: 'Peça Única Tie Dye',
        category: 'peca unica',
        price: 159.90,
        oldPrice: 199.90,
        badge: '-20%',
        images: ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)']
    },
    {
        name: 'Conjunto Short Saia Premium',
        category: 'conjunto short saia',
        price: 169.90,
        oldPrice: null,
        badge: 'Novo',
        images: ['linear-gradient(135deg, #fa709a 0%, #fee140 100%)']
    },
    {
        name: 'Conjunto Short Saia Ribbed',
        category: 'conjunto short saia',
        price: 149.90,
        oldPrice: 199.90,
        badge: '-25%',
        images: ['linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)']
    },
    {
        name: 'Conjunto Short Seamless',
        category: 'conjunto short',
        price: 79.90,
        oldPrice: null,
        badge: null,
        images: ['linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)']
    },
    {
        name: 'Conjunto Short Fitness',
        category: 'conjunto short',
        price: 189.90,
        oldPrice: null,
        badge: null,
        images: ['linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)']
    },
    {
        name: 'Conjunto Short Push Up',
        category: 'conjunto short',
        price: 99.90,
        oldPrice: null,
        badge: null,
        images: ['linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)']
    }
];

async function inicializarProdutosPadrao() {
    if (productsData.length === 0) {
        console.log('📦 Nenhum produto no Firestore, adicionando produtos padrão...');
        for (const produto of DEFAULT_PRODUCTS) {
            try {
                const docRef = await db.collection("produtos").add({
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
// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }

    const isCheckoutPage = window.location.pathname.includes('checkout.html');

    if (!isCheckoutPage) {
        window.cartSidebar = document.getElementById('cartSidebar');
        window.cartOverlay = document.getElementById('sidebarOverlay');

        if (!window.cartSidebar) {
            console.error('❌ CRITICAL: Cart sidebar not found in HTML!');
        }
        if (!window.cartOverlay) {
            console.warn('⚠️ Overlay not found - cart may not close properly');
        }
    } else {
        console.log('ℹ️ Checkout page detected - skipping cart sidebar cache');
    }

    try {
        console.log('🚀 Iniciando carregamento do site...');

        loadSettings();
        setupPaymentListeners();

        await loadProducts();
        loadCart();

        if (!isCheckoutPage) {
            renderProducts();
            renderBestSellers();
            initHeroCarousel();
            await loadVideoGrid();
        }

        updateCartUI();
        updateFavoritesCount();
        setupConnectionMonitor();
        setupCartAbandonmentTracking();
        setupPushNotifications();

        console.log('✅ Site carregado com sucesso!');

    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao inicializar:', error);
        console.error('Stack trace:', error.stack);
        showToast('Erro ao carregar o site. Recarregue a página.', 'error');

        const grid = document.getElementById('productsGrid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                    <h2 style="color: #e74c3c; margin-bottom: 1rem;">❌ Erro ao Carregar</h2>
                    <p style="color: #666; margin-bottom: 2rem;">${error.message}</p>
                    <button onclick="location.reload()" style="background: var(--primary); color: white; border: none; padding: 1rem 2rem; cursor: pointer; border-radius: 8px;">
                        🔄 Recarregar Página
                    </button>
                </div>
            `;
        }

    } finally {
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }
});

// ==================== LISTENER PARA BUSCA NO HEADER ====================
document.addEventListener('DOMContentLoaded', () => {
    const headerSearchInput = document.getElementById('headerSearchInput');
    const headerDropdown = document.getElementById('headerDropdown');

    if (!headerSearchInput) {
        console.warn('⚠️ Input de busca não encontrado no header');
        return;
    }

    // Enter key para busca
    headerSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performHeaderSearch();
        }
    });

    // Live search dropdown
    if (headerDropdown) {
        let timeout = null;

        headerSearchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase().trim();

            clearTimeout(timeout);

            if (query.length < 2) {
                headerDropdown.classList.remove('active');
                headerDropdown.innerHTML = '';
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

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', function(e) {
            if (!headerSearchInput.contains(e.target) && !headerDropdown.contains(e.target)) {
                headerDropdown.classList.remove('active');
            }
        });
    }

    console.log('✅ Listener de busca no header ativado');
});

// ==================== SISTEMA DE USUÁRIOS ====================
function openUserPanel() {
    const panel = document.getElementById('userPanel');
    panel.classList.add('active');
    checkUserSession();
}

function closeUserPanel() {
    document.getElementById('userPanel').classList.remove('active');
}

function switchUserTab(tab) {
    document.querySelectorAll('.user-panel-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.user-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tab === 'login') {
        document.querySelectorAll('.user-panel-tab')[0].classList.add('active');
        document.getElementById('loginTab').classList.add('active');
    } else if (tab === 'register') {
        document.querySelectorAll('.user-panel-tab')[1].classList.add('active');
        document.getElementById('registerTab').classList.add('active');
    }
}

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

// ==================== LOGIN COM GOOGLE ====================
async function loginWithGoogle() {
    const isCheckoutPage = window.location.pathname.includes('checkout.html');
    const loadingOverlay = document.getElementById('loadingOverlay') ||
        document.getElementById('checkoutLoadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

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
                phone: '',
                cpf: '',
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false,
                provider: 'google'
            }, {
                merge: true
            });

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
        } else {
            console.error('❌ showLoggedInView não encontrada! Verifique se auth.js foi carregado.');
        }

    } catch (error) {
        console.error('❌ Erro no login Google:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
            showToast('Erro ao entrar com Google', 'error');
        }
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// ==================== FIRESTORE ====================
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
// ==================== PAINEL ADMIN ====================
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
    isAdminLoggedIn = false;
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
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

    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalRevenue').textContent = `R$ ${totalValue.toFixed(2)}`;
    document.getElementById('totalOrders').textContent = Math.floor(Math.random() * 50) + 10;
    document.getElementById('activeProducts').textContent = activeProducts;
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
                <div class="admin-product-image" style="${isRealImage ?
                `background-image: url(${firstImage}); background-size: cover; background-position: center;` : `background: ${firstImage}`}"></div>
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

// ==================== MODAL DE PRODUTO (UI) ====================
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

    event.target.classList.add('active');
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

// ==================== GERENCIAMENTO DE IMAGENS ====================
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
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
            border: ${isCover ? '2px solid #3498db' : '1px solid #eee'};
        `;

        const imgArea = document.createElement('div');
        imgArea.style.cssText = `
            height: 140px;
            width: 100%;
            position: relative;
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
                position: absolute;
                top: 0; left: 0; right: 0;
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
                position: absolute;
                bottom: 5px; right: 5px;
                width: 24px; height: 24px; border-radius: 50%;
                background: ${linkedColor.hex};
                border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                z-index: 5;
            `;
            imgArea.appendChild(colorBadge);
        }

        const btnRemove = document.createElement('button');
        btnRemove.innerHTML = '✕';
        btnRemove.type = 'button';
        btnRemove.style.cssText = `
            position: absolute;
            top: 5px; right: 5px;
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(231, 76, 60, 0.9); color: white;
            border: none;
            cursor: pointer; font-weight: bold;
            display: flex; align-items: center; justify-content: center;
            z-index: 10;
        `;
        btnRemove.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeProductImage(index);
        };
        imgArea.appendChild(btnRemove);

        const actionsBar = document.createElement('div');
        actionsBar.style.cssText = `
            padding: 8px;
            background: #f8f9fa;
            border-top: 1px solid #eee;
            display: flex;
            gap: 5px;
            flex-direction: column;
        `;
        if (!isCover) {
            const btnSetCover = document.createElement('button');
            btnSetCover.type = 'button';
            btnSetCover.innerText = '🏠 Virar Capa';
            btnSetCover.style.cssText = `
                background: white;
                border: 1px solid #3498db; color: #3498db;
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
                background: ${bg};
                border: 1px solid #9b59b6; color: ${fg};
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
        } else {
            const urlField = document.getElementById('imageUrlField');
            if (urlField) urlField.value = '';
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
        } else {
            const gradientField = document.getElementById('gradientField');
            if (gradientField) gradientField.value = '';
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
        showToast('Formato inválido! Exemplo: linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'error');
        return;
    }

    tempProductImages.push(gradient);
    renderProductImages();
    gradientField.value = '';
    toggleGradientInput();
    showToast('Gradiente adicionado com sucesso!', 'success');
}

function removeProductImage(index) {
    if (tempProductImages.length === 0) {
        showToast('Não há imagens para remover!', 'error');
        return;
    }

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
// ==================== CRUD DE PRODUTOS (ADMIN) ====================
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
        document.getElementById('loadingOverlay').classList.remove('active');
    }
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
        console.error('Elementos faltando:', {
            nameEl,
            priceEl,
            categoryEl
        });
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
        images: tempProductImages.filter(url => url.startsWith('http') || url.includes('gradient')),
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
        batch.set(productRef, productData, {
            merge: true
        });

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
                }, {
                    merge: true
                });
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

// ==================== GERENCIAMENTO DE CORES ====================
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
                📸 ${color.images.length} ${color.images.length === 1 ? 'imagem' : 'imagens'} vinculada(s)
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
    if (!productColors[idx].images) {
        productColors[idx].images = [];
    }

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
        showToast(`Cor "${color.name}" removida`, 'info');
    }
}

// ==================== CONFIGURAÇÕES DO SITE ====================
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

        const bannerTitleInput = document.getElementById('settingBannerTitle');
        if (bannerTitleInput) bannerTitleInput.value = settings.bannerTitle;

        const bannerSubtitleInput = document.getElementById('settingBannerSubtitle');
        if (bannerSubtitleInput) bannerSubtitleInput.value = settings.bannerSubtitle;

        const topBannerInput = document.getElementById('settingTopBanner');
        if (topBannerInput) topBannerInput.value = settings.topBanner;
    }
}

// ==================== UI COMPONENTS (SIDEBAR & CHAT) ====================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('hamburgerBtn');

    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
    if (btn) btn.classList.toggle('active');
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

    if (message === '') return;
    addChatMessage(message, 'user');
    input.value = '';

    setTimeout(() => {
        const responses = [
            'Obrigado pela sua mensagem! Como posso ajudar com seus produtos fitness?',
            'Estou aqui para ajudar! Temos ótimas promoções hoje. O que você procura?',
            'Que legal! Temos leggings, tops e conjuntos incríveis. Quer que eu mostre?',
            'Posso te ajudar a encontrar o tamanho ideal! Qual peça te interessou?',
            'Nossa equipe está disponível para atendimento personalizado. Em que posso ajudar?'
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        addChatMessage(response, 'bot');
    }, 1000);
}

function addChatMessage(text, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;

    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
// ==================== FILTROS E ORDENAÇÃO ====================
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

// ==================== RENDERIZAÇÃO DE PRODUTOS ====================
function renderProductsSkeleton() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = Array(12).fill(0).map(() => `
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
        if (currentFilter === 'favorites') {
            label = '❤️ Meus Favoritos';
        } else if (currentFilter === 'sale') {
            label = '🔥 Promoções';
        } else {
            label = typeof getCategoryName === 'function' ? getCategoryName(currentFilter) : currentFilter;
        }

        if (categoryName) categoryName.textContent = label;
        if (badge) badge.style.display = 'flex';
    } else {
        if (badge && categoryName && (!categoryName.textContent.includes('resultados'))) {
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
                <h3 style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #666;">
                    Nenhum produto encontrado
                </h3>
                <p style="color: #999; margin-bottom: 2rem;">
                    Não encontramos produtos para esta seleção.
                </p>
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
        const discountPercent = product.oldPrice ?
            Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;

        return `
            <div class="product-card" data-product-id="${product.id}" onclick="isInternalNavigation = true; openProductDetails('${product.id}')">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')" 
                            aria-label="Adicionar aos favoritos">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                    
                    ${product.isBlackFriday && discountPercent > 0 ? `
                        <div class="bf-product-badge">
                            <div class="bf-badge-content">
                                <div class="bf-badge-text">
                                     <span style="font-size: 2.6rem; font-weight: 900; letter-spacing: 2px; color: #FFFFFF;">BLACK</span>
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                         <span style="font-size: 1.17rem; font-weight: 700; letter-spacing: 1px; color: #FFFFFF;">Versátil</span>
                                        <span style="font-size: 1.17rem; font-weight: 900; letter-spacing: 1px; color: #FF6B35;">-${discountPercent}%</span>
                                     </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    ${product.badge && !product.isBlackFriday && discountPercent === 0 ? `<div class="product-badge">${sanitizeInput(product.badge)}</div>` : ''}
                    ${discountPercent > 0 && !product.isBlackFriday ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
                    
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
                    
                    ${hasMultipleImages ? `
                        <div class="product-carousel-arrows">
                            <button class="product-carousel-arrow" onclick="event.stopPropagation(); prevProductImage('${product.id}', event)" aria-label="Imagem anterior">‹</button>
                            <button class="product-carousel-arrow" onclick="event.stopPropagation(); nextProductImage('${product.id}', event)" aria-label="Próxima imagem">›</button>
                        </div>
                        <div class="product-carousel-dots">
                            ${images.map((_, index) => `
                                <div class="product-carousel-dot ${index === 0 ? 'active' : ''}" onclick="event.stopPropagation(); goToProductImage('${product.id}', ${index}, event)"></div>
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

// ==================== PAGINAÇÃO ====================
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

    carouselsPaused = true;
    Object.keys(carouselIntervals).forEach(key => {
        clearInterval(carouselIntervals[key]);
    });
    carouselIntervals = {};
    carouselEventsRegistered.clear();

    currentPage = page;
    renderProducts();

    setTimeout(() => {
        carouselsPaused = false;
        setupAutoCarousel();
    }, 300);
}

// ==================== FAVORITOS ====================
function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('💔 Removido dos favoritos', 'info');

        // Se estiver vendo a categoria de favoritos e remover o último, atualiza a tela
        if (currentFilter === 'favorites') {
            if (favorites.length === 0) {
                clearCategoryFilter();
                showToast('Você não tem mais favoritos', 'info');
            } else {
                renderProducts();
            }
        }
    } else {
        favorites.push(productId);
        showToast('❤️ Adicionado aos favoritos', 'success');
    }

    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    updateFavoritesCount();

    // Atualiza ícones visuais se não estivermos no filtro de favoritos
    if (currentFilter !== 'favorites') {
        renderProducts();
    }
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
    const savedFavs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    if (savedFavs.length === 0) {
        showToast('Você ainda não tem favoritos ❤️', 'info');
        return;
    }
    currentFilter = 'favorites';
    currentPage = 1;
    renderProducts();
    scrollToProducts();
}

// ==================== CARROSSEL INTERATIVO (CARDS) ====================
function clearCarouselIntervals() {
    if (Object.keys(carouselIntervals).length === 0) return;
    Object.values(carouselIntervals).forEach(clearInterval);
    carouselIntervals = {};
    carouselEventsRegistered.clear();
}

function setupAutoCarousel() {
    if (carouselsPaused) return;
    const productCards = document.querySelectorAll('.product-card');

    productCards.forEach(card => {
        const productId = card.getAttribute('data-product-id');
        if (carouselIntervals[productId]) {
            clearInterval(carouselIntervals[productId]);
            delete carouselIntervals[productId];
        }

        const slides = card.querySelectorAll('.product-image-slide');
        if (slides.length <= 1) {
            const arrows = card.querySelector('.product-carousel-arrows');
            const dots = card.querySelector('.product-carousel-dots');
            if (arrows) arrows.style.display = 'none';
            if (dots) dots.style.display = 'none';
            return;
        }

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
            if (carouselIntervals[productId]) clearInterval(carouselIntervals[productId]);
            currentSlideIndex = 0;
            updateCarouselSlides(card, 0);
        };

        card.addEventListener('mouseenter', handleMouseEnter);
        card.addEventListener('mouseleave', handleMouseLeave);
    });
}

function updateCarouselSlides(card, activeIndex) {
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === activeIndex);
    });
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === activeIndex);
    });
}

function nextProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    clearInterval(carouselIntervals[productId]);

    const slides = card.querySelectorAll('.product-image-slide');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    currentIndex = (currentIndex + 1) % slides.length;

    updateCarouselSlides(card, currentIndex);
    setTimeout(() => setupAutoCarousel(), 3000);
}

function prevProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    clearInterval(carouselIntervals[productId]);

    const slides = card.querySelectorAll('.product-image-slide');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;

    updateCarouselSlides(card, currentIndex);
    setTimeout(() => setupAutoCarousel(), 3000);
}

function goToProductImage(productId, index, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    clearInterval(carouselIntervals[productId]);
    updateCarouselSlides(card, index);
    setTimeout(() => setupAutoCarousel(), 3000);
}

function renderBestSellers() {
    const bestSellersGrid = document.getElementById('bestSellersGrid');
    if (!bestSellersGrid) return;

    const bestSellers = productsData.filter(p => p.oldPrice).slice(0, 6);

    if (bestSellers.length === 0) {
        bestSellersGrid.innerHTML = '<p class="empty-section-message">Nenhum produto em destaque no momento</p>';
        return;
    }

    // Reutiliza uma lógica similar para renderizar destaque
    // (Simplificado para usar o HTML direto aqui para evitar duplicidade complexa)
    bestSellersGrid.innerHTML = bestSellers.map(product => {
        const image = product.images && product.images.length > 0 ? product.images[0] : (product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
        const isRealImage = image.startsWith('data:image') || image.startsWith('http');
        
        return `
            <div class="product-card" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <div class="product-image-slide active" 
                         style="${isRealImage ? `background-image: url('${image}')` : `background: ${image}`}">
                    </div>
                     ${product.oldPrice ? `<div class="discount-badge">Promo</div>` : ''}
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <div class="product-price">R$ ${product.price.toFixed(2)}</div>
                </div>
            </div>
        `;
    }).join('');
}
// ==================== INTEGRAÇÃO DE ESTOQUE (VARIANTS) ====================
async function loadProductVariants(productId) {
    if (productVariants[productId]) {
        return productVariants[productId];
    }

    try {
        const variantsSnapshot = await db.collection('produtos')
            .doc(productId)
            .collection('variants')
            .get();

        const variants = [];
        variantsSnapshot.forEach(doc => {
            variants.push({
                id: doc.id,
                ...doc.data()
            });
        });

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

    if (!variant) return false;
    return variant.available && variant.stock > 0;
}

function getVariantStock(productId, size, color) {
    const variants = productVariants[productId] || [];
    const variant = variants.find(v => v.size === size && v.color === color);
    return variant ? variant.stock : 0;
}

// ==================== DETALHES DO PRODUTO (UI) ====================
function openProductDetails(productId) {
    // Salva o ID para ser recuperado na página de produto
    localStorage.setItem('selectedProductId', productId);
    window.location.href = `produto.html?id=${productId}`;
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

// ==================== SELEÇÃO DE CORES E TAMANHOS ====================
async function renderAvailableColors(productId) {
    const product = productsData.find(p => p.id === productId);
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

    const colorOptionWrapper = colorSelector.closest('.product-option');
    if (colorOptionWrapper) colorOptionWrapper.style.display = 'block';

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

    // Reattach listeners to remove old ones
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(colorBtn => {
        const newColorBtn = colorBtn.cloneNode(true);
        colorBtn.replaceWith(newColorBtn);
    });

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
        'Rosa': '#FFB6C1',
        'Preto': '#000000',
        'Azul': '#4169E1',
        'Verde': '#32CD32',
        'Branco': '#FFFFFF',
        'Vermelho': '#DC143C',
        'Amarelo': '#FFD700',
        'Cinza': '#808080',
        'Lilás': '#9370DB',
        'Coral': '#FF7F50',
        'Nude': '#E8BEAC',
        'Bege': '#F5F5DC'
    };
    return colorMap[colorName] || '#999999';
}

function selectColor(colorName) {
    if (!currentProductDetails || !currentProductDetails.colors) return;

    const selectedColorData = currentProductDetails.colors.find(c => c.name === colorName);
    if (!selectedColorData || !selectedColorData.images || selectedColorData.images.length === 0) {
        showToast('Imagens desta cor indisponíveis', 'error');
        return;
    }

    selectedColor = colorName;

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.color === colorName);
        if (opt.dataset.color === colorName) {
            opt.style.transform = "scale(1.15)";
            setTimeout(() => opt.style.transform = "scale(1)", 200);
        }
    });

    updateGalleryDisplay(selectedColorData.images);
    renderAvailableSizes(currentProductDetails.id);

    console.log(`🎨 Cor alterada para: ${colorName}`);
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

    const firstAvailable = sizes.find(size =>
        variants.some(v => v.size === size && v.color === selectedColor && v.stock > 0)
    );

    if (firstAvailable) {
        selectedSize = firstAvailable;
        // Atualiza visualmente o botão selecionado
        document.querySelectorAll('.size-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === selectedSize);
        });
    }
}

// Helper function para seleção de tamanho (chamada via onclick no HTML gerado)
function selectSize(size) {
    selectedSize = size;
    document.querySelectorAll('.size-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.size === size);
    });
}

// ==================== GALERIA DE IMAGENS (DETALHES) ====================
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
            img2.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
            img2.style.display = 'none'; // Oculta se não houver segunda imagem
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
        img1.scrollIntoView({
            behavior: 'smooth'
        });
        img1.style.opacity = '0.5';
        setTimeout(() => {
            img1.src = newSrc;
            img1.style.opacity = '1';
        }, 200);
    }
}

// ==================== AÇÕES DE COMPRA (DETALHES) ====================
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
        // Simulação de função de animação (se existir, senão ignora)
        if (typeof animateProductToCart === 'function') {
            animateProductToCart(addButton, product);
        }
    }

    setTimeout(() => {
        showToast(`${selectedQuantity}x ${product.name} (${selectedSize}, ${selectedColor}) adicionado ao carrinho!`, 'success');
    }, 300);
}

function buyNow() {
    if (!currentProductDetails) return;
    addToCartFromDetails();
    // Se existir função para fechar modal, chama
    if (typeof closeProductDetails === 'function') closeProductDetails();
    
    setTimeout(() => {
        toggleCart();
    }, 500);
    setTimeout(() => {
        checkout();
    }, 1000);
}

// ==================== PRODUTOS RELACIONADOS ====================
function renderRelatedProducts(category, currentId) {
    const related = productsData
        .filter(p => p.category === category && p.id !== currentId)
        .slice(0, 4);

    const grid = document.getElementById('relatedProductsGrid');
    if (!grid) return;

    grid.innerHTML = related.map(product => {
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
            <div class="product-card" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <div class="product-image-slide active" 
                         style="${isRealImage ? `background-image: url('${firstImage}'); background-size: cover; background-position: center;` : `background: ${firstImage}`}">
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
// ==================== SISTEMA DE BUSCA ====================
function openSearch() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.classList.add('active');
        const input = document.getElementById('searchInput');
        if (input) input.focus();
    }
}

function closeSearch() {
    const modal = document.getElementById('searchModal');
    if (modal) {
        modal.classList.remove('active');
        const input = document.getElementById('searchInput');
        if (input) input.value = '';
        const results = document.getElementById('searchResults');
        if (results) results.innerHTML = '';
    }
}

// Listener para fechar modal ao clicar fora
const searchModal = document.getElementById('searchModal');
if (searchModal) {
    searchModal.addEventListener('click', (e) => {
        if (e.target.id === 'searchModal') {
            closeSearch();
        }
    });
}

// Busca Debounced (otimizada)
const debouncedSearch = debounce(function() {
    const input = document.getElementById('searchInput');
    const results = document.getElementById('searchResults');
    if (!input || !results) return;

    const query = input.value.toLowerCase();

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
                <div class="search-result-img" style="${isRealImage ?
                `background-image: url(${productImage}); background-size: cover; background-position: center;` : `background: ${productImage}`}"></div>
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
    // Redireciona para o produto ao invés de adicionar direto (padrão UX melhor)
    window.location.href = `produto.html?id=${productId}`;
    closeSearch();
}

function performHeaderSearch() {
    const input = document.getElementById('headerSearchInput');
    if (!input) return;

    const query = input.value.toLowerCase().trim();

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

    // Renderiza os resultados no grid principal
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    // Atualiza a UI para mostrar modo de busca
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');

    if (badge && categoryName) {
        categoryName.textContent = `🔍 "${query}" (${filtered.length} resultados)`;
        badge.style.display = 'flex';
    }

    // Renderiza grid manualmente com os resultados filtrados
    grid.innerHTML = filtered.map(product => {
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
                </div>
                
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <div class="product-price">
                        ${product.oldPrice ? `<span class="price-old">De R$ ${product.oldPrice.toFixed(2)}</span>` : ''}
                        <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const pagination = document.getElementById('pagination');
    if (pagination) pagination.innerHTML = '';

    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => {
            productsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }

    showToast(`🔍 ${filtered.length} produtos encontrados`, 'success');
    trackEvent('Search', 'Header Search', query);
}

function renderDropdownResults(products) {
    const dropdown = document.getElementById('headerDropdown');
    if (!dropdown) return;

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
        const imgStyle = isRealImg ?
            `background-image: url('${imageUrl}'); background-size: cover; background-position: center;` :
            `background: ${imageUrl};`;

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
            <div class="search-dropdown-item" style="justify-content: center; color: #667eea; font-weight: bold;"
                 onclick="performHeaderSearch()">
                Ver todos os ${products.length} resultados
            </div>
        `;
    }

    dropdown.classList.add('active');
}

// ==================== LÓGICA DO CARRINHO ====================
function addToCart(productId) {
    // Redireciona para página de produto para selecionar variações
    window.location.href = `produto.html?id=${productId}`;
    saveCart();
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('sidebarOverlay'); // Usa o mesmo overlay do menu mobile ou específico

    // Fallback se sidebarOverlay não existir (usando cartOverlay se definido anteriormente)
    const targetOverlay = overlay || document.getElementById('cartOverlay');

    if (sidebar) sidebar.classList.toggle('active');
    if (targetOverlay) targetOverlay.classList.toggle('active');
}

function closeCartAndExplore() {
    toggleCart();
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => {
            productsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 300);
    }
    trackEvent('Cart', 'Explore More Products', 'View More Button');
}

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

                // Atualiza globais para garantir sincronia
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
        cart = [];
        appliedCoupon = null;
        couponDiscount = 0;
        return;
    }

    try {
        const parsed = JSON.parse(saved);
        if (parsed.items && Array.isArray(parsed.items)) {
            cart = parsed.items.map(item => ({
                ...item,
                quantity: item.quantity || 1,
                price: item.price || 0
            }));
            appliedCoupon = parsed.appliedCoupon || null;
            couponDiscount = parsed.couponDiscount || 0;
        } else if (Array.isArray(parsed)) {
            // Suporte legado
            cart = parsed.map(item => ({
                ...item,
                quantity: item.quantity || 1,
                price: item.price || 0
            }));
            appliedCoupon = null;
            couponDiscount = 0;
        } else {
            cart = [];
            appliedCoupon = null;
            couponDiscount = 0;
        }

        console.log('✅ Carrinho carregado:', cart.length, 'itens');
    } catch (error) {
        console.error('❌ Erro ao carregar carrinho:', error);
        cart = [];
        appliedCoupon = null;
        couponDiscount = 0;
    }
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    
    // Se não houver elementos de carrinho na página (ex: checkout), sai
    if (!cartCount || !cartItems || !cartFooter) return;

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Lógica da Barra de Frete Grátis
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

    // Renderização dos Itens
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
            const discount = Math.min(
                typeof couponDiscount === 'number' && !isNaN(couponDiscount) ? couponDiscount : 0,
                subtotal
            );
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

            // Renderiza o cupom se aplicado
            if (appliedCoupon && couponDiscount > 0) {
                 // Verifica se já existe badge renderizado para evitar duplicidade ou renderiza se não existir
                 // Nota: A função showAppliedCouponBadge cuida disso geralmente, mas aqui garantimos a estrutura
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
        // Recalcula desconto de cupom se necessário
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
                
                if (newDiscount > newSubtotal) newDiscount = newSubtotal;
                couponDiscount = newDiscount;
                
                // Atualiza visual do badge
                showAppliedCouponBadge(appliedCoupon, newDiscount);
            }
        }
        
        saveCart();
        updateCartUI();
    }
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
        console.warn('Item não encontrado para remover:', identifier);
        showToast('Item não encontrado', 'error');
        return;
    }

    console.log('✅ Item removido. Carrinho agora:', cart.length, 'itens');

    if (cart.length === 0) {
        if (appliedCoupon) removeCoupon();
        saveCart();
        updateCartUI();
        showToast('Carrinho vazio', 'info');
        return;
    }

    // Recalcula cupom após remoção
    if (appliedCoupon && couponDiscount > 0) {
        const newSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
            if (newDiscount > newSubtotal) newDiscount = newSubtotal;
            couponDiscount = newDiscount;
            showAppliedCouponBadge(appliedCoupon, newDiscount);
        }
    }

    saveCart();
    updateCartUI();
    showToast('Item removido do carrinho', 'info');
}
// ==================== SISTEMA DE CUPONS (ADMIN) ====================
function openCouponModal(couponId = null) {
    const modal = document.getElementById('couponModal');
    const form = document.getElementById('couponForm');

    if (couponId) {
        loadCouponData(couponId);
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
            const coupon = {
                id: doc.id,
                ...doc.data()
            };

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

// ==================== APLICAÇÃO DE CUPONS (CLIENTE) ====================
async function applyCoupon() {
    const input = document.getElementById('couponInput');
    const btn = document.getElementById('applyCouponBtn');
    
    if (!input || !btn) return;

    const code = input.value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 20);

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

        const coupon = {
            id: couponDoc.id,
            ...couponDoc.data()
        };

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

        if (discount > cartValue) {
            discount = cartValue;
        }

        appliedCoupon = coupon;
        couponDiscount = discount;
        saveCart();

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
        if (typeof btn !== 'undefined' && btn && !appliedCoupon) {
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
            if (!couponDoc.exists) {
                throw new Error('Cupom não existe');
            }

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
        console.log('✅ Uso registrado');
    } catch (error) {
        console.error('❌ Transação falhou:', error);
        throw error;
    }
}
// ==================== GERENCIADOR DE VÍDEOS (ADMIN) ====================
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
                           placeholder="Título (Ex: NOVIDADE)"
                           style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 4px; font-weight: 600;">
                    
                    <input type="text" value="${video.subtitle}" 
                           onchange="updateVideoSubtitle(${index}, this.value)"
                           placeholder="Subtítulo (Ex: Confira agora)"
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

            if (file.size > 2 * 1024 * 1024) { // 2MB limit
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

                await db.collection('site_config').doc('video_grid').set({
                    videos
                });

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

        await db.collection('site_config').doc('video_grid').update({
            videos
        });
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

        await db.collection('site_config').doc('video_grid').update({
            videos
        });
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

        await db.collection('site_config').doc('video_grid').update({
            videos
        });

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

        await db.collection('site_config').doc('video_grid').update({
            videos
        });

        await loadVideoGrid();
        renderVideoManager();
        showToast('🗑️ Vídeo removido', 'info');
    } catch (error) {
        console.error('Erro:', error);
        showToast('❌ Erro ao remover vídeo', 'error');
    }
}

// ==================== VALIDAÇÕES DE SEGURANÇA (UI) ====================
document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    const strengthDiv = document.getElementById('passwordStrength');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');
    const matchFeedback = document.getElementById('passwordMatchFeedback');

    // Setup força de senha
    if (passwordInput && strengthDiv && strengthBar && strengthText) {
        passwordInput.addEventListener('input', (e) => {
            const password = e.target.value.trim();

            if (!password) {
                strengthDiv.style.display = 'none';
                strengthBar.style.width = '0%';
                strengthText.textContent = '';
                return;
            }

            strengthDiv.style.display = 'block';

            const rules = [
                password.length >= 6,
                password.length >= 8,
                /[a-z]/.test(password) && /[A-Z]/.test(password),
                /\d/.test(password),
                /[^A-Za-z0-9]/.test(password)
            ];

            const score = rules.filter(Boolean).length;
            const levels = [{
                    text: '🔴 Senha muito fraca',
                    color: '#e74c3c',
                    width: '20%'
                },
                {
                    text: '🟠 Senha fraca',
                    color: '#e67e22',
                    width: '40%'
                },
                {
                    text: '🟡 Senha razoável',
                    color: '#f39c12',
                    width: '60%'
                },
                {
                    text: '🟢 Senha boa',
                    color: '#27ae60',
                    width: '80%'
                },
                {
                    text: '🟢 Senha forte',
                    color: '#27ae60',
                    width: '100%'
                }
            ];
            const level = levels[Math.min(score, levels.length - 1)];

            strengthBar.style.width = level.width;
            strengthBar.style.backgroundColor = level.color;
            strengthText.textContent = level.text;
            strengthText.style.color = level.color;
        });
    }

    // Setup confirmação de senha
    if (passwordInput && confirmPasswordInput && matchFeedback) {
        const checkMatch = () => {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (!confirmPassword) {
                matchFeedback.style.display = 'none';
                return;
            }

            matchFeedback.style.display = 'block';
            if (password === confirmPassword) {
                matchFeedback.textContent = '✅ As senhas coincidem';
                matchFeedback.style.color = '#27ae60';
            } else {
                matchFeedback.textContent = '❌ As senhas não coincidem';
                matchFeedback.style.color = '#e74c3c';
            }
        };

        passwordInput.addEventListener('input', checkMatch);
        confirmPasswordInput.addEventListener('input', checkMatch);
    }
});
// ==================== CHECKOUT E WHATSAPP ====================
const WHATSAPP_NUMBER = '5571991427103';

function validateDadosStep() {
    const nome = document.getElementById('inputNome').value.trim();
    const email = document.getElementById('inputEmail').value.trim();
    const telefone = document.getElementById('inputTelefone').value.replace(/\D/g, '');
    const cpf = document.getElementById('inputCPF').value.replace(/\D/g, '');

    if (!nome || !email || telefone.length < 10 || cpf.length !== 11) {
        showToast('Preencha todos os campos corretamente', 'error');
        return false;
    }

    document.getElementById('sectionEndereco').style.opacity = '1';
    document.getElementById('sectionEndereco').style.pointerEvents = 'auto';
    showToast('✅ Dados confirmados', 'success');
    return true;
}

function validateEnderecoStep() {
    const cep = document.getElementById('inputCEP').value.replace(/\D/g, '');
    const rua = document.getElementById('inputRua').value.trim();
    const numero = document.getElementById('inputNumero').value.trim();
    const bairro = document.getElementById('inputBairro').value.trim();
    const cidade = document.getElementById('inputCidade').value.trim();
    const uf = document.getElementById('inputUF').value;

    if (cep.length !== 8 || !rua || !numero || !bairro || !cidade || !uf) {
        showToast('Preencha todos os campos de endereço', 'error');
        return false;
    }

    document.getElementById('sectionPagamento').style.opacity = '1';
    document.getElementById('sectionPagamento').style.pointerEvents = 'auto';
    document.getElementById('checkoutFormPagamento').style.display = 'block';
    
    const subtitle = document.querySelector('#sectionPagamento .checkout-section-subtitle');
    if (subtitle) subtitle.style.display = 'none';

    const btnFinalizar = document.getElementById('btnFinalizarCompra');
    if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = 'FINALIZAR COMPRA';
    }

    showToast('✅ Endereço confirmado', 'success');
    return true;
}

function validatePagamentoStep() {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (!paymentMethod) {
        showToast('Selecione a forma de pagamento', 'error');
        return false;
    }

    if (paymentMethod.value === 'credito-parcelado') {
        const installments = document.getElementById('installmentsSelect').value;
        if (!installments) {
            showToast('Selecione o número de parcelas', 'error');
            return false;
        }
    }

    return true;
}

async function processCheckout() {
    if (!validateDadosStep() || !validateEnderecoStep() || !validatePagamentoStep()) {
        return;
    }

    await sendToWhatsApp();
}

async function sendToWhatsApp() {
    if (window.authReady) await window.authReady;

    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        if (!cart || cart.length === 0) {
            showToast('Carrinho vazio!', 'error');
            return;
        }

        // Coleta de dados do formulário de checkout (se estiver na página de checkout)
        const nomeInput = document.getElementById('inputNome');
        const phoneInput = document.getElementById('inputTelefone');
        const cpfInput = document.getElementById('inputCPF');
        const paymentInput = document.querySelector('input[name="paymentMethod"]:checked');
        const installmentsInput = document.getElementById('installmentsSelect');

        // Fallback para modal de dados se não estiver na página de checkout
        let customerData = {};
        if (nomeInput) {
             customerData = {
                name: nomeInput.value.trim(),
                phone: phoneInput.value.replace(/\D/g, ''),
                cpf: cpfInput.value.replace(/\D/g, ''),
                email: document.getElementById('inputEmail')?.value.trim()
            };
        } else if (typeof currentUser !== 'undefined' && currentUser) {
             customerData = {
                name: currentUser.name,
                email: currentUser.email,
                uid: currentUser.uid,
                phone: await getUserPhone(),
                cpf: await getUserCPF()
            };
        } else {
             const guestData = await collectGuestCustomerData();
             if (!guestData) return;
             customerData = guestData;
        }

        if (!paymentInput && !document.querySelector('input[name="paymentMethod"]:checked')) {
             showToast('Selecione a forma de pagamento', 'error');
             return;
        }
        
        const paymentMethod = paymentInput ? paymentInput.value : document.querySelector('input[name="paymentMethod"]:checked').value;
        let installments = null;
        if (paymentMethod === 'credito-parcelado') {
            installments = installmentsInput ? installmentsInput.value : document.getElementById('installmentsSelect')?.value;
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

        if (typeof closePaymentModal === 'function') closePaymentModal();
        if (typeof closeCustomerDataModal === 'function') closeCustomerDataModal();

        cart = [];
        appliedCoupon = null;
        couponDiscount = 0;

        saveCart();
        updateCartUI();
        showToast('Pedido realizado com sucesso!', 'success');
        
        // Redireciona para home após sucesso se estiver no checkout
        if (window.location.pathname.includes('checkout.html')) {
             setTimeout(() => window.location.href = 'index.html', 2000);
        }

    } catch (error) {
        console.error('❌ ERRO CRÍTICO NO CHECKOUT:', error);
        showToast('Ocorreu um erro ao processar. Por favor, tente novamente.', 'error');
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
    if (customer.phone) msg += `Tel: ${customer.phone}\n`;
    if (customer.cpf) msg += `CPF: ${customer.cpf}\n`;
    
    // Adiciona endereço se disponível (elementos do checkout)
    const rua = document.getElementById('inputRua');
    if (rua && rua.value) {
         msg += `\n*📍 ENDEREÇO:*\n`;
         msg += `${rua.value}, ${document.getElementById('inputNumero').value}\n`;
         msg += `${document.getElementById('inputBairro').value} - ${document.getElementById('inputCidade').value}/${document.getElementById('inputUF').value}\n`;
         msg += `CEP: ${document.getElementById('inputCEP').value}\n`;
    }
    
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

// ==================== VALIDAÇÕES (CPF, EMAIL, CEP) ====================
function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');

    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
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

// Listener de CEP
document.addEventListener('DOMContentLoaded', () => {
    const cepInput = document.getElementById('inputCEP');
    if (!cepInput) return;

    cepInput.addEventListener('blur', async function() {
        const cep = this.value.replace(/\D/g, '');
        if (cep.length !== 8) return;

        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) loadingOverlay.classList.add('active');

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                showToast('CEP não encontrado', 'error');
                return;
            }

            document.getElementById('inputRua').value = data.logradouro || '';
            document.getElementById('inputBairro').value = data.bairro || '';
            document.getElementById('inputCidade').value = data.localidade || '';
            document.getElementById('inputUF').value = data.uf || '';

            document.getElementById('inputNumero').focus();
            showToast('✅ Endereço preenchido automaticamente', 'success');
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            showToast('Erro ao buscar CEP. Preencha manualmente.', 'error');
        } finally {
            if (loadingOverlay) loadingOverlay.classList.remove('active');
        }
    });
});

// ==================== POPUP PROMOCIONAL ====================
function showPromoPopup() {
    const overlay = document.getElementById('promoPopupOverlay');
    if (!overlay) return;

    const lastClosed = localStorage.getItem('promoPopupLastClosed');
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;

    if (lastClosed && (now - parseInt(lastClosed)) < ONE_DAY) {
        console.log('🚫 Popup já foi fechado nas últimas 24h');
        return;
    }

    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
}

function closePromoPopup() {
    const overlay = document.getElementById('promoPopupOverlay');
    if (!overlay) return;

    overlay.classList.remove('active');
    localStorage.setItem('promoPopupLastClosed', Date.now().toString());
}

// Listeners de Popup
document.addEventListener('click', (e) => {
    const overlay = document.getElementById('promoPopupOverlay');
    if (overlay && e.target === overlay) closePromoPopup();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePromoPopup();
});

window.addEventListener('load', () => {
    setTimeout(() => {
        showPromoPopup();
    }, 2000);
});

// ==================== NOTIFICAÇÕES PUSH ====================
async function setupPushNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    if (Notification.permission === 'granted') return;

    setTimeout(() => {
        if (Notification.permission === 'default') {
            showNotificationPrompt();
        }
    }, 30000);
}

function showNotificationPrompt() {
    const promptHTML = `
        <div id="notificationPrompt" style="position: fixed; bottom: 20px; right: 20px; background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 350px; z-index: 9998; animation: slideInRight 0.5s ease;">
            <div style="display: flex; align-items: flex-start; gap: 1rem;">
                <div style="font-size: 2rem;">🔔</div>
                <div style="flex: 1;">
                    <h4 style="margin-bottom: 0.5rem; font-size: 1rem;">Receber Notificações?</h4>
                    <p style="font-size: 0.85rem; color: #666; margin-bottom: 1rem;">Seja avisado sobre promoções exclusivas e lançamentos!</p>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="requestNotificationPermission()" style="flex: 1; padding: 0.6rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">Permitir</button>
                        <button onclick="closeNotificationPrompt()" style="padding: 0.6rem 1rem; background: #e5e5e5; color: #666; border: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">Agora não</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', promptHTML);
}

async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast('Você receberá notificações sobre promoções!', 'success');
            localStorage.setItem('notificationsEnabled', 'true');
        }
        closeNotificationPrompt();
    } catch (error) {
        console.error('Erro ao solicitar permissão:', error);
    }
}

function closeNotificationPrompt() {
    const prompt = document.getElementById('notificationPrompt');
    if (prompt) {
        prompt.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => prompt.remove(), 500);
    }
}

// ==================== EXPORTAÇÃO GLOBAL E LISTENERS FINAIS ====================

// Atalhos de teclado
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const activeModals = document.querySelectorAll('.modal.active, #cartSidebar.active, #userPanel.active, #adminPanel.active, #searchModal.active');
        activeModals.forEach(modal => modal.classList.remove('active'));
        if (document.getElementById('sidebarOverlay')) document.getElementById('sidebarOverlay').classList.remove('active');
        if (document.getElementById('cartOverlay')) document.getElementById('cartOverlay').classList.remove('active');
    }
});

// Helpers de janela para acesso no HTML
window.openPaymentModal = function() {
    // Redireciona para o fluxo de checkout
    window.location.href = 'checkout.html';
};
window.closePaymentModal = function() {
    const modal = document.getElementById('paymentModal');
    if(modal) modal.classList.remove('active');
};
window.sendToWhatsApp = sendToWhatsApp;
window.collectGuestCustomerData = function() {
    // Lógica simplificada para guest no modal
    return new Promise((resolve) => {
        const modal = document.getElementById('customerDataModal');
        if (!modal) { resolve(null); return; }
        modal.classList.add('active');
        
        // Simulação de preenchimento (na prática precisa do listener de submit do form)
        // Aqui deixamos preparado para ser implementado se o modal existir no HTML
    });
};
window.isValidCPF = isValidCPF;
window.getUserPhone = async function() {
    if (!auth.currentUser) return null;
    const doc = await db.collection('users').doc(auth.currentUser.uid).get();
    if (doc.exists && doc.data().phone) return doc.data().phone;
    const phone = prompt('Digite seu WhatsApp com DDD:');
    if (phone) await db.collection('users').doc(auth.currentUser.uid).update({ phone });
    return phone;
};
window.getUserCPF = async function() {
    if (!auth.currentUser) return null;
    const doc = await db.collection('users').doc(auth.currentUser.uid).get();
    if (doc.exists && doc.data().cpf) return doc.data().cpf;
    const cpf = prompt('Digite seu CPF:');
    if (cpf) await db.collection('users').doc(auth.currentUser.uid).update({ cpf });
    return cpf;
};
window.applyCoupon = applyCoupon;
window.removeCoupon = removeCoupon;
window.checkout = function() {
    if (cart.length === 0) {
        showToast('Carrinho vazio', 'error');
        return;
    }
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (total < 10) {
        showToast('Valor mínimo: R$ 10,00', 'error');
        return;
    }
    window.location.href = 'checkout.html';
};
window.validateDadosStep = validateDadosStep;
window.validateEnderecoStep = validateEnderecoStep;
window.validatePagamentoStep = validatePagamentoStep;
window.processCheckout = processCheckout;
window.closeCartAndExplore = closeCartAndExplore;
window.requestNotificationPermission = requestNotificationPermission;
window.closeNotificationPrompt = closeNotificationPrompt;

// Service Worker (se existir)
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) registration.update();
    });
}

// Monitor de visibilidade (pausar carrosséis)
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

console.log('✅ script2.js carregado completamente - Seja Versátil E-commerce');
