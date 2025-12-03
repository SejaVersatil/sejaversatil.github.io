const $ = (id) => document.getElementById(id);

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
// ==================== FUNÇÕES UTILITÁRIAS DE IMAGEM ====================
function getProductImage(product) {


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
// ADICIONAR APÓS isRealImage()
function isNewProduct(product) {
    if (!product.createdAt) return false;
    
    // Verificar se foi criado nos últimos 7 dias
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    let createdTime;
    if (product.createdAt.toMillis) {
        // Timestamp do Firestore
        createdTime = product.createdAt.toMillis();
    } else if (typeof product.createdAt === 'number') {
        // Timestamp normal
        createdTime = product.createdAt;
    } else {
        return false;
    }
    
    return createdTime > sevenDaysAgo;
}

// ==================== CARROSSEL HERO ====================
let currentHeroSlide = 0;
let heroCarouselInterval;

const heroSlides = [
    {
        image: 'https://i.imgur.com/kOzFAAv.jpeg',
        title: '', // titulo da coleção//
        subtitle: '', //descrição do titulo//
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

    const dotsContainer = document.querySelector('.hero-carousel-dots'); // Corrigido seletor se necessário
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
        productsSection.scrollIntoView({ behavior: 'smooth' });
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
    // Tentar carregar configuração do Firestore
    const configDoc = await db.collection('site_config').doc('video_grid').get();
    
    if (configDoc.exists && configDoc.data().videos && configDoc.data().videos.length > 0) {
      videoGridData = configDoc.data().videos.sort((a, b) => a.order - b.order);
      
      // Validar URLs dos vídeos
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
      // Usar vídeos padrão se não houver configuração
      console.log('Usando vídeos padrão');
      videoGridData = getDefaultVideos();
    }
    
    // ✅ AGUARDAR RENDERIZAÇÃO COMPLETA
    await renderVideoGrid();
    
  } catch (error) {
    console.error('Erro ao carregar vídeos:', error);
    
    // Mostrar mensagem amigável
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

// ✅ TORNAR RENDERIZAÇÃO ASSÍNCRONA
async function renderVideoGrid() {
  const container = document.getElementById('videoGridContainer');
  
  if (!container || !videoGridData || videoGridData.length === 0) {
    console.warn('Sem dados para renderizar vídeos');
    console.log('Container:', container); // ← DEBUG
    console.log('videoGridData:', videoGridData); // ← DEBUG
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
  
  // ✅ AGUARDAR DOM ATUALIZAR
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Adicionar event listeners
  setupVideoInteractions();
}

function setupVideoInteractions() {
  const videoCards = document.querySelectorAll('.video-card');
  
  videoCards.forEach(card => {
    const video = card.querySelector('video');
    const playIndicator = card.querySelector('.video-play-indicator');
    
    if (!video) return;
    
    // ✅ CONFIGURAÇÕES CRÍTICAS PARA AUTOPLAY
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.load(); // ← FORÇA CARREGAMENTO
    
    // Intersection Observer (autoplay quando visível)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          video.play().catch(err => {
            console.warn('⚠️ Autoplay bloqueado:', err);
            // Fallback: mostrar botão play
            if (playIndicator) playIndicator.style.opacity = '1';
          });
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.5 });
    
    observer.observe(card);
    
    // Click manual
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
    
    // Hover (desktop)
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
    // Limpar carrosséis ativos
    Object.keys(carouselIntervals).forEach(key => {
        clearInterval(carouselIntervals[key]);
    });
    carouselIntervals = {};
    carouselEventsRegistered.clear();
    
    // Definir o filtro
    currentFilter = category;
    currentPage = 1;
    
    // Atualizar badge de categoria ativa
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');
    
    if (badge && categoryName) {
        categoryName.textContent = getCategoryName(category);
        badge.style.display = 'flex';
    }
    
    // Renderizar produtos filtrados
    renderProducts();
    
    // Scroll suave até a seção de produtos
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        // Adicionar pequeno delay para melhor UX
        setTimeout(() => {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    // Tracking
    trackEvent('Promo Cards', 'Navigate to Category', category);
    
    // Feedback visual
    isInternalNavigation = true;
    showToast(` ${getCategoryName(category)}`, 'info');
}

// Função para limpar filtro
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

// Função auxiliar para nomes amigáveis
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

// Cache Manager
class CacheManager {
    constructor(ttl = 1800000) { // 5 minutos
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

// Rate Limiter
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

// Debounce
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

// Validação de Email
function validateEmail(email) {
    // ✅ Regex profissional que valida domínios reais
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!re.test(email.trim().toLowerCase())) {
        return false;
    }
    
    // ✅ Validar domínios suspeitos
    const suspiciousDomains = ['tempmail', 'throwaway', '10minutemail', 'guerrillamail'];
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (suspiciousDomains.some(sus => domain?.includes(sus))) {
        showToast('⚠️ Use um email permanente', 'error');
        return false;
    }
    
    return true;
}

// Sanitização de Input
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = input;
    
    // Remover caracteres perigosos adicionais
    return div.innerHTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Validação de Dados do Produto
function validateProductData(data) {
    const errors = [];
    
    // Validar nome
    if (!data.name || data.name.trim().length < 3) {
        errors.push('Nome deve ter pelo menos 3 caracteres');
    }
    if (data.name && data.name.length > 100) {
        errors.push('Nome deve ter no máximo 100 caracteres');
    }
    
    // Validar preço
    if (!data.price || data.price <= 0) {
        errors.push('Preço deve ser maior que zero');
    }
    if (data.price > 10000) {
        errors.push('Preço não pode exceder R$ 10.000');
    }
    
    // Validar oldPrice
    if (data.oldPrice && data.oldPrice <= data.price) {
        errors.push('Preço antigo deve ser maior que o preço atual');
    }
    
    // Validar badge
    if (data.badge && data.badge.length > 20) {
        errors.push('Badge deve ter no máximo 20 caracteres');
    }
    
    // Validar imagens
    if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
        errors.push('Produto deve ter pelo menos 1 imagem');
    }
    
    // Validar categoria
    const validCategories = ['blusas', 'conjunto calca', 'peca unica', 'conjunto short saia', 'conjunto short'];
    if (!data.category || !validCategories.includes(data.category)) {
        errors.push('Categoria inválida');
    }
    
    return errors;
}

// Event Tracking
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
        console.log(' Nenhum produto no Firestore, adicionando produtos padrão...');
        
        for (const produto of DEFAULT_PRODUCTS) {
            try {
                const docRef = await db.collection("produtos").add({
                    ...produto,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                //console.log(`✅ Produto "${produto.name}" adicionado com ID: ${docRef.id}`);
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

    window.cartSidebar = document.getElementById('cartSidebar');
    window.cartOverlay = document.getElementById('sidebarOverlay');
    
    if (!window.cartSidebar) {
        console.error('❌ CRITICAL: Cart sidebar not found in HTML!');
    }
    if (!window.cartOverlay) {
        console.warn('⚠️ Overlay not found - cart may not close properly');
    }
    
    try {
        console.log('🚀 Iniciando carregamento do site...');
        
        // ✅ CORREÇÃO 1: Carrega settings ANTES
        loadSettings();

        setupPaymentListeners();
        
        await loadProducts();
        
        // ✅ CORREÇÃO 2: Carrega produtos ANTES do carrinho
        await loadProducts();
        loadCart();
        
        // ✅ CORREÇÃO 3: SÓ AGORA carrega o carrinho (productsData já existe)
        loadCart();
        
        // ✅ Verifica URL para favoritos
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ver_favoritos') === 'true') {
            setTimeout(() => {
                showFavorites();
                window.history.replaceState({}, document.title, "index.html");
            }, 500);
        }
        
        // ✅ Renderiza tudo
        renderProducts();
        renderBestSellers();
        updateCartUI();
        updateFavoritesCount();
        initHeroCarousel();
        await loadVideoGrid();
        initBlackFridayCountdown();
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

// Aguardar 100ms para garantir que o DOM está pronto
setTimeout(() => {
    const headerSearchInput = document.getElementById('headerSearchInput');
    if (headerSearchInput) {
        headerSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performHeaderSearch();
            }
        });
        // console.log('✅ Listener de busca no header ativado');
    } else {
        console.warn('⚠️ Input de busca não encontrado no header');
    }
}, 100);

// ==================== SISTEMA DE ADMIN ====================
let editingProductId = null;

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

// Tratar retorno do redirect (caso popup seja bloqueado)
auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log('✅ Retorno do redirect:', result.user.email);
        // O listener onAuthStateChanged vai cuidar do resto
    }
}).catch((error) => {
    if (error.code !== 'auth/popup-closed-by-user') {
        console.error('❌ Erro no redirect:', error);
        showToast('Erro no login: ' + error.message, 'error');
    }
});

function showLoggedInView() {
    document.getElementById('userPanelTabs').style.display = 'none';
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('registerTab').classList.remove('active');
    document.getElementById('userLoggedTab').classList.add('active');
    
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    
    if (currentUser.isAdmin) {
        document.getElementById('userStatus').innerHTML = 'Administrador <span class="admin-badge">ADMIN</span>';
        document.getElementById('adminAccessBtn').style.display = 'block';
        isAdminLoggedIn = true;
    } else {
        document.getElementById('userStatus').textContent = 'Cliente';
        document.getElementById('adminAccessBtn').style.display = 'none';
    }
}

function hideLoggedInView() {
    document.getElementById('userPanelTabs').style.display = 'flex';
    document.getElementById('userLoggedTab').classList.remove('active');
    switchUserTab('login');
}

/**
 * Verifica a força da senha com base em critérios de segurança.
 * Retorna uma pontuação de 0 a 4.
 */
function checkPasswordStrength(password) {
    let score = 0;
    // Mínimo de 8 caracteres (melhoria de segurança em relação aos 6 anteriores)
    if (password.length < 8) return 0; 
    score++; 

    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++; // Maiúsculas e minúsculas
    if (/\d/.test(password)) score++; // Números
    if (/[^a-zA-Z0-9\s]/.test(password)) score++; // Símbolos

    return score;
}

// ==================== LOGIN COM GOOGLE ====================
async function loginWithGoogle() {
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        // ✅ CORREÇÃO 1: Detectar bloqueio de popup
        let result;
        try {
            result = await auth.signInWithPopup(provider);
        } catch (popupError) {
            if (popupError.code === 'auth/popup-blocked') {
                // Tentar com redirect como fallback
                await auth.signInWithRedirect(provider);
                return; // Sai aqui, o redirect vai recarregar a página
            }
            throw popupError; // Repassa outros erros
        }
        
        const user = result.user;
        
        console.log('✅ Login Google bem-sucedido:', user.email);
        
        // ✅ CORREÇÃO 2: Verificar se é admin ANTES de criar documento
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
            // ✅ CORREÇÃO 3: Usar merge para não sobrescrever dados existentes
            await db.collection('users').doc(user.uid).set({
                name: user.displayName || 'Usuário',
                email: user.email,
                photoURL: user.photoURL || null,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false,
                provider: 'google' // ← Adiciona identificador
            }, { merge: true }); // ← IMPORTANTE: merge true
            
            currentUser = {
                name: user.displayName || 'Usuário',
                email: user.email,
                isAdmin: false,
                uid: user.uid,
                permissions: []
            };
        }
        
        // Salvar sessão
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        
        // Atualizar UI
        showLoggedInView();
        showToast('Login realizado com sucesso!', 'success');
        
        // Fechar painel após 1 segundo
        setTimeout(() => {
            closeUserPanel();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erro no login Google:', error);
        
        let errorMessage = 'Erro ao fazer login com Google';
        
        // ✅ CORREÇÃO 4: Mensagens de erro mais específicas
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Você fechou a janela de login';
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = 'Login cancelado';
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'Este email já está cadastrado com outro método de login';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Erro de conexão. Verifique sua internet';
        } else if (error.code === 'auth/internal-error') {
            errorMessage = 'Erro interno. Tente novamente em alguns segundos';
        } else if (error.message) {
            // Mostrar mensagem técnica se for outro erro
            errorMessage = error.message;
        }
        
        showToast(errorMessage, 'error');
        
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}
// ==================== FIRESTORE ====================

async function carregarProdutosDoFirestore() {
    try {
        //console.log('📄 Carregando produtos do Firestore...');
        
        // Verificar cache primeiro
        const cached = productCache.get('products');
        if (cached) {
            //console.log('✅ Produtos carregados do cache');
            productsData = cached;
            return productsData;
        }

        // Rate limiting
        if (!firestoreRateLimiter.canMakeRequest()) {
            console.warn('⚠️ Rate limit atingido');
            showToast('Muitas requisições. Aguarde um momento.', 'error');
            return productsData;
        }

        // Buscar do Firestore
        const snapshot = await db.collection("produtos").get();
        productsData.length = 0; // Limpar array

        snapshot.forEach((doc) => {
            productsData.push({
                id: doc.id,
                ...doc.data()
            });
        });

        productCache.set('products', productsData);
        //console.log(`✅ ${productsData.length} produtos carregados do Firestore`);
        return productsData;
        
    } catch (error) {
        console.error("❌ Erro ao carregar produtos do Firestore:", error);

        // Tratamento de erros específicos
        if (error.code === 'permission-denied') {
            console.error('🔒 Permissão negada. Verifique as regras do Firestore.');
            showToast('Erro de permissão ao carregar produtos', 'error');
        } else if (error.code === 'unavailable') {
            console.error('🌐 Firestore indisponível. Verifique sua conexão.');
            showToast('Sem conexão com o servidor', 'error');
        }

        // Se falhar, retornar array vazio (será preenchido por inicializarProdutosPadrao)
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
    // 🔒 VERIFICAÇÃO RIGOROSA
    if (!auth.currentUser) {
        showToast('❌ Você precisa fazer login como administrador', 'error');
        openUserPanel();
        return;
    }
    
    if (!currentUser || !currentUser.isAdmin) {
        showToast('❌ Você não tem permissões de administrador', 'error');
        return;
    }
    
    // Verificar documento admin no Firestore em tempo real
    try {
        const adminDoc = await db.collection('admins').doc(auth.currentUser.uid).get();
        
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            showToast('❌ Permissões de admin revogadas', 'error');
            await userLogout();
            return;
        }
        
        // Tudo OK - abrir painel
       document.getElementById('adminPanel').classList.add('active');
renderAdminProducts();
updateAdminStats();
loadCoupons();
        //console.log('✅ Painel admin aberto com sucesso');
        
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
    } else if (tab === 'coupons') {  // ← ADICIONAR ESTA CONDIÇÃO
        document.getElementById('couponsTab').classList.add('active');
        loadCoupons(); // Carrega cupons ao abrir a aba
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
        // CORREÇÃO: Garantir que images sempre seja um array válido
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
        document.getElementById('productBlackFriday').checked = product.isBlackFriday || false;
        tempProductImages = [...(product.images || (product.image ? [product.image] : []))];
        productColors = product.colors ? JSON.parse(JSON.stringify(product.colors)) : [];
console.log('📋 Cores carregadas para edição:', productColors.length);
if (productColors.length > 0) {
    console.log('🎨 Detalhes das cores:', productColors);
}
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

function switchDescTab(tab) {
    // Remover active de todas as abas
    document.querySelectorAll('.desc-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.description-tab-content').forEach(c => c.classList.remove('active'));
    
    // Ativar aba clicada
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

// Renderiza as imagens no Modal de Admin com correção de cliques
function renderProductImages() {
    const container = document.getElementById('productImagesList');
    if (!container) return;

    // Limpa o conteúdo atual
    container.innerHTML = '';
    
    // Aplica estilo de GRID no container para organizar as fotos lado a lado
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
    container.style.gap = '15px';

    // Verifica se existem cores cadastradas para mostrar as opções corretamente
    const hasColors = Array.isArray(productColors) && productColors.length > 0;

    tempProductImages.forEach((img, index) => {
        const isCover = index === 0;
        const isImage = img.startsWith('data:image') || img.startsWith('http');

        // Verifica se essa imagem está vinculada a alguma cor
        let linkedColor = null;
        if (hasColors) {
            linkedColor = productColors.find(color => 
                color.images && color.images.includes(img)
            );
        }

        // 1. Cria o Card Principal
        const card = document.createElement('div');
        card.className = 'admin-image-card';
        // Estilos inline críticos para garantir funcionamento visual
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

        // 2. Cria a Área da Imagem (Visualização)
        const imgArea = document.createElement('div');
        imgArea.style.cssText = `
            height: 140px;
            width: 100%;
            position: relative;
            background: ${isImage ? '#f0f0f0' : img}; /* Se for gradiente, usa ele como bg */
        `;

        if (isImage) {
            const imageEl = document.createElement('img');
            imageEl.src = img;
            imageEl.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            imgArea.appendChild(imageEl);
        }

        // Badge de CAPA (Visual)
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

        // Badge de COR VINCULADA (Visual)
        if (linkedColor) {
            const colorBadge = document.createElement('div');
            colorBadge.title = `Vinculada a: ${linkedColor.name}`;
            colorBadge.style.cssText = `
                position: absolute; bottom: 5px; right: 5px;
                width: 24px; height: 24px; border-radius: 50%;
                background: ${linkedColor.hex};
                border: 2px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                z-index: 5;
            `;
            imgArea.appendChild(colorBadge);
        }

        // Botão REMOVER (X) - Fica sobre a imagem
        const btnRemove = document.createElement('button');
        btnRemove.innerHTML = '✕';
        btnRemove.type = 'button'; // Importante para não submeter form
        btnRemove.style.cssText = `
            position: absolute; top: 5px; right: 5px;
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(231, 76, 60, 0.9); color: white;
            border: none; cursor: pointer; font-weight: bold;
            display: flex; align-items: center; justify-content: center;
            z-index: 10;
        `;
        btnRemove.onclick = (e) => {
            e.preventDefault(); 
            e.stopPropagation();
            removeProductImage(index);
        };
        imgArea.appendChild(btnRemove);

        // 3. Cria a Barra de Ações (Botões embaixo da foto)
        const actionsBar = document.createElement('div');
        actionsBar.style.cssText = `
            padding: 8px;
            background: #f8f9fa;
            border-top: 1px solid #eee;
            display: flex;
            gap: 5px;
            flex-direction: column;
        `;

        // Botão DEFINIR CAPA (Só aparece se não for a capa)
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

        // Botão VINCULAR COR (Só aparece se tiver cores cadastradas)
        if (hasColors) {
            const btnLinkColor = document.createElement('button');
            btnLinkColor.type = 'button';
            // Muda o texto se já estiver vinculada
            btnLinkColor.innerText = linkedColor ? `🎨 ${linkedColor.name}` : '🎨 Vincular Cor';
            
            // Muda o estilo se já estiver vinculada
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
            // Se não tem cores, mostra aviso discreto
            const noColorMsg = document.createElement('div');
            noColorMsg.innerText = 'Adicione cores acima para vincular';
            noColorMsg.style.cssText = 'font-size: 0.65rem; color: #999; text-align: center; padding: 4px;';
            actionsBar.appendChild(noColorMsg);
        }

        // Montagem final do Card
        card.appendChild(imgArea);
        card.appendChild(actionsBar);
        container.appendChild(card);
    });
}

// NOVA FUNÇÃO: Move a imagem clicada para a posição 0 (Capa)
function setProductCover(index) {
    if (index <= 0 || index >= tempProductImages.length) return;
    
    // Remove a imagem da posição atual
    const imageToMove = tempProductImages.splice(index, 1)[0];
    
    // Adiciona ela no início do array (Index 0)
    tempProductImages.unshift(imageToMove);
    
    // Re-renderiza a lista
    renderProductImages();
    
    // Feedback visual
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

    // 1. Remove da lista principal
    tempProductImages.splice(index, 1);

    // 2. Remove de TODAS as cores vinculadas
    if (productColors && productColors.length > 0) {
        productColors.forEach(color => {
            if (color.images) {
                color.images = color.images.filter(url => url !== imageToRemove);
            }
        });
    }

    // 3. Se removeu a capa e ainda existem imagens
    if (index === 0 && tempProductImages.length > 0) {
        showToast('Nova capa definida automaticamente', 'info');
    }

    // 4. Atualiza interface
    renderProductImages();
    renderProductColorsManager();
    
    showToast('🗑️ Imagem removida', 'info');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    editingProductId = null;
    productColors = [];
}

function editProduct(productId) {
    openProductModal(productId);
}

// script2.js (SUBSTITUIR)
async function deleteProduct(productId) {
    // A verificação de permissão é feita no Firestore Security Rules.
    // A verificação de isAdminLoggedIn aqui é apenas para UX.
    if (!isAdminLoggedIn) {
        showToast('❌ Você não tem permissão para excluir produtos', 'error');
        return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este produto? Esta ação é irreversível.')) {
        return;
    }

    document.getElementById('loadingOverlay').classList.add('active');

    try {
        // 1. Deleta o documento principal
        await db.collection("produtos").doc(productId).delete();
        
        // 2. Deleta a subcoleção de variantes (ATENÇÃO: Firestore não deleta subcoleções automaticamente.
        // Você precisará de uma Cloud Function para deletar a subcoleção de forma segura em produção.
        // Por enquanto, o código abaixo apenas deleta o principal.)
        
        // 3. Atualiza o estado local
        const index = productsData.findIndex(p => p.id === productId);
        if (index !== -1) {
            productsData.splice(index, 1);
        }
        
        productCache.clear();
        // Não precisa chamar saveProducts() se você está usando o Firestore como fonte de verdade
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        showToast('Produto excluído com sucesso!', 'success');
        
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        // O erro mais comum será de permissão negada se as Security Rules estiverem corretas.
        showToast('Erro ao excluir produto: ' + (error.code === 'permission-denied' ? 'Permissão negada. Verifique se você é admin.' : error.message), 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

// script2.js (SUBSTITUIR)
async function saveProduct(event) {
    event.preventDefault();

    // 1. VERIFICAÇÕES DE PERMISSÃO (Frontend - O Backend garante a segurança)
    if (!auth.currentUser || !currentUser.isAdmin) {
        showToast('❌ Apenas admins podem salvar produtos', 'error');
        closeProductModal();
        return;
    }

    // 2. Coleta de Dados
    const productId = editingProductId || document.getElementById('productId').value || db.collection('produtos').doc().id;
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const oldPrice = document.getElementById('productOldPrice').value ? parseFloat(document.getElementById('productOldPrice').value) : null;
    const category = document.getElementById('productCategory').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const specs = document.getElementById('productSpecs').value.trim();
    const badge = document.getElementById('productBadge').value.trim();
    const active = document.getElementById('productActive').checked;
    
    // Validação básica
    if (!name || !price || !category || !description) {
        showToast('Preencha os campos obrigatórios (Nome, Preço, Categoria, Descrição)', 'error');
        return;
    }

    // 3. Preparação dos Dados
    const productData = {
        name,
        price,
        oldPrice,
        category,
        description,
        specs,
        badge,
        active,
        images: tempProductImages.filter(url => url.startsWith('http' )), // Apenas URLs reais
        colors: productColors, // Array de cores (nome, hex, etc.)
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!editingProductId) {
        productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    // 4. PREPARAÇÃO DO BATCH WRITE (Transação Atômica)
    document.getElementById('loadingOverlay').classList.add('active');
    const batch = db.batch();
    const productRef = db.collection('produtos').doc(productId);

    try {
        // A. Salva o documento principal do produto
        batch.set(productRef, productData, { merge: true });

        // B. Salva as variantes (Exemplo: Cria uma variante padrão se não houver)
        // ATENÇÃO: Você precisará adaptar esta lógica para como você gera suas variantes.
        // Este é um exemplo de como salvar variantes junto com o produto principal.
        if (productColors.length > 0) {
            // Exemplo: Criar uma variante de estoque para cada cor (tamanho 'U' - Único)
            productColors.forEach(color => {
                const variantId = `${productId}_U_${color.name.replace(/\s/g, '')}`;
                const variantRef = productRef.collection('variants').doc(variantId);
                
                batch.set(variantRef, {
                    size: 'U',
                    color: color.name,
                    stock: 999, // Exemplo de estoque
                    price: price,
                    available: true
                }, { merge: true });
            });
        }
        
        // 5. EXECUTA O BATCH
        await batch.commit();

        // 6. ATUALIZAÇÕES GERAIS (Frontend)
        showToast(`✅ Produto "${name}" salvo com sucesso!`, 'success');
        
        // Limpeza e Re-renderização
        productCache.clear();
        closeProductModal();
        
        // Recarrega os dados do Firestore para garantir consistência
        await carregarProdutosDoFirestore(); 
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

function addColorToProduct() {
    // 1. Validação básica via Prompt
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

    // 2. Garante que o array existe
    if (!Array.isArray(productColors)) {
        productColors = [];
    }

    // 3. Cria a nova cor
    productColors.push({
        name: colorName.trim(),
        hex: colorHex.trim().toUpperCase(),
        images: [] 
    });

    // 4. Atualiza a interface
    renderProductColorsManager(); 
    renderProductImages(); 
    
    showToast(`✅ Cor "${colorName}" adicionada! Agora vincule as fotos.`, 'success');
}

// ==================== GERENCIAR CORES NO ADMIN ====================
let productColors = [];

function renderProductColorsManager() {
    const container = document.getElementById('productColorsManager');
    if (!container) return;
    
    // Garantir que productColors existe
    if (!Array.isArray(productColors)) {
        productColors = [];
    }
    
    if (productColors.length === 0) {
        container.innerHTML = '<p style="color: #999; font-size: 0.85rem; text-align: center;">Nenhuma cor adicionada ainda</p>';
        return;
    }
    
    container.innerHTML = productColors.map((color, index) => `
        <div style="background: white; padding: 1rem; margin-bottom: 0.8rem; border-radius: 8px; border-left: 5px solid ${color.hex}; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <div style="width: 45px; height: 45px; border-radius: 50%; background: ${color.hex}; border: 3px solid ${color.hex === '#FFFFFF' || color.hex === '#ffffff' ? '#ddd' : '#e5e5e5'}; box-shadow: 0 2px 6px rgba(0,0,0,0.1);"></div>
                    <div>
                        <strong style="display: block; font-size: 1rem; color: #333;">${color.name}</strong>
                        <small style="color: #999; font-size: 0.75rem;">${color.hex}</small>
                    </div>
                </div>
                <button type="button" onclick="removeProductColor(${index})" 
                        style="background: #e74c3c; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.8rem; transition: all 0.3s;">
                    🗑️ Remover
                </button>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #f8f8f8; border-radius: 6px;">
                <span style="color: #666; font-size: 0.85rem;">📸 <strong>${color.images.length}</strong> ${color.images.length === 1 ? 'imagem' : 'imagens'} vinculada(s)</span>
            </div>
        </div>
    `).join('');
}

// script2.js (SUBSTITUIR)
function linkImageToColor(imageIndex) {
    // Validação CRÍTICA
    if (!Array.isArray(productColors) || productColors.length === 0) {
        showToast('❌ Cadastre pelo menos uma cor antes de vincular!', 'error');
        return;
    }
    
    if (imageIndex < 0 || imageIndex >= tempProductImages.length) {
        showToast('❌ Índice de imagem inválido!', 'error');
        return;
    }

    const imageUrl = tempProductImages[imageIndex];
    
    // 1. CONSTRUIR O MODAL DE SELEÇÃO
    const colorOptions = productColors.map((color, index) => `
        <button class="color-select-btn" 
                onclick="performLinkImageToColor(${imageIndex}, ${index + 1}); closeColorSelectModal();"
                style="background-color: ${color.hex}; border: 2px solid ${color.hex === '#FFFFFF' ? '#ccc' : 'transparent'};">
            ${color.name}
        </button>
    `).join('');

    const modalContent = `
        <div class="color-select-modal-content">
            <h3>Vincular Imagem à Cor</h3>
            <p>Selecione a cor à qual esta imagem pertence:</p>
            <div class="color-options-grid">
                ${colorOptions}
            </div>
            <button class="color-select-btn unlink-btn" onclick="performLinkImageToColor(${imageIndex}, 0); closeColorSelectModal();">
                Desvincular de Todas
            </button>
        </div>
    `;
    
    // 2. Exibir o modal (Você precisará de um modal genérico no seu HTML)
    // Se você não tem um modal genérico, use um alert/confirm mais elaborado ou crie um div temporário.
    // Para simplificar, vamos usar um prompt aprimorado (mas o ideal é um modal HTML/CSS)
    
    const colorNames = productColors.map((c, i) => `${i + 1}: ${c.name}`).join('\n');
    const choice = prompt(`Vincular imagem:\n\n0: Desvincular de todas\n${colorNames}\n\nDigite o número da cor:`);

    if (choice === null || choice.trim() === '') return;

    const choiceNum = parseInt(choice.trim());
    
    performLinkImageToColor(imageIndex, choiceNum);
}

// NOVA FUNÇÃO: Lógica de vinculação separada
function performLinkImageToColor(imageIndex, choiceNum) {
    const imageUrl = tempProductImages[imageIndex];
    
    // 0. Desvincular de todas
    if (choiceNum === 0) {
        productColors.forEach(c => {
            if (c.images) c.images = c.images.filter(u => u !== imageUrl);
        });
        renderProductImages();
        renderProductColorsManager();
        showToast('🔓 Foto desvinculada de todas as cores', 'info');
        return;
    }

    // 1. Vincular a cor específica
    const idx = choiceNum - 1;
    
    if (idx < 0 || idx >= productColors.length || isNaN(idx)) {
        showToast('❌ Número inválido!', 'error');
        return;
    }
    
    // 2. Desvincular de outras cores (opcional, mas recomendado para evitar fotos duplicadas)
    productColors.forEach(c => {
        if (c.images) c.images = c.images.filter(u => u !== imageUrl);
    });

    // 3. Vincular à cor escolhida
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
    if (confirm(` Remover a cor "${color.name}"?\n\nEsta ação não pode ser desfeita.`)) {
        productColors.splice(index, 1);
        renderProductColorsManager();
        showToast(` Cor "${color.name}" removida`, 'info');
    }
}

function loadSettings() {
    const saved = localStorage.getItem('sejaVersatilSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        document.querySelector('.top-banner').textContent = settings.topBanner;

        document.getElementById('settingBannerTitle').value = settings.bannerTitle;
        document.getElementById('settingBannerSubtitle').value = settings.bannerSubtitle;
        document.getElementById('settingTopBanner').value = settings.topBanner;
    }
}

// ==================== UI COMPONENTS ====================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('hamburgerBtn');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    btn.classList.toggle('active');
}

// ==================== CHAT WIDGET ====================

function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.classList.toggle('active');
    
    if (chatBox.classList.contains('active')) {
        document.getElementById('chatInput').focus();
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

// ==================== PRODUTOS ====================

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
    
   // console.log(' Filtro atual:', currentFilter);
    // console.log(' Total de produtos:', productsData.length);
    
    if (currentFilter !== 'all') {
        if (currentFilter === 'sale') {
            filtered = filtered.filter(p => p.oldPrice !== null);
        } else if (currentFilter === 'favorites') { // ← ADICIONE ESTA CONDIÇÃO
            filtered = filtered.filter(p => favorites.includes(p.id));
            console.log('❤️ Produtos favoritados:', filtered.length);
        } else {
            // Filtrar por categoria exata
            filtered = filtered.filter(p => {
                const match = p.category === currentFilter;
                console.log(`Produto: "${p.name}" | Categoria: "${p.category}" | Match: ${match}`); // ← CORRIGI O TEMPLATE STRING
                return match;
            });
        }
    }
    
    // console.log('✅ Produtos filtrados:', filtered.length);
    
    // Se não encontrar produtos, mostrar aviso
    if (filtered.length === 0 && currentFilter !== 'all') {
        console.warn(' Nenhum produto encontrado para a categoria:', currentFilter);
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

function renderProductsSkeleton() {
    const grid = document.getElementById('productsGrid');
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

// ==================== RENDER PRODUCTS - VERSÃO MODERNIZADA ====================

function renderProducts() {
    clearCarouselIntervals();
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');

    if (currentFilter !== 'all') {
        let label = currentFilter;
        
        // Nomes amigáveis para filtros especiais
        if (currentFilter === 'favorites') {
            label = '❤️ Meus Favoritos';
        } else if (currentFilter === 'sale') {
            label = ' Promoções';
        } else {
            // Tenta pegar o nome bonito da categoria, ou usa o próprio ID formatado
            label = typeof getCategoryName === 'function' ? getCategoryName(currentFilter) : currentFilter;
        }

        if (categoryName) categoryName.textContent = label;
        if (badge) badge.style.display = 'flex'; // Mostra a barra com botão X
    } else {
        // Se não tiver filtro (e não for uma busca ativa do header), esconde
        // Verificamos se o texto não contém "resultados" para não esconder a barra da busca
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
    
    if (!grid) {
        console.error('Elemento #productsGrid não encontrado');
        return;
    }
    
    if (paginatedProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;"></div>
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
        return;
    }
    
    grid.innerHTML = paginatedProducts.map(product => {
    // CORREÇÃO: Garantir que images sempre seja um array válido
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
    
    // Calcular desconto percentual
    const discountPercent = product.oldPrice ? 
        Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;

        const variants = productVariants[product.id] || [];
const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
const lowStockWarning = totalStock > 0 && totalStock <= 10;
    
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
                
                <!-- Black Friday Badge -->
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

// Adicionar hover automático no carrossel
setupAutoCarousel();
renderPagination(totalPages);
}

// ==================== AUTO CAROUSEL NO HOVER ====================

// Controle de eventos já registrados
function clearCarouselIntervals() {
    // ✅ Verificar se há intervalos antes de iterar
    if (Object.keys(carouselIntervals).length === 0) {
        return;
    }
    
    //console.log('🧹 Limpando carousels ativos:', Object.keys(carouselIntervals).length);
    
    // Limpar todos os intervalos
    Object.values(carouselIntervals).forEach(clearInterval);
    
    // Resetar objetos
    carouselIntervals = {};
    carouselEventsRegistered.clear();
    
    //console.log('✅ Carousels limpos');
}

function setupAutoCarousel() {
    if (carouselsPaused) {
        return;
    }
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const productId = card.getAttribute('data-product-id');
        
        // ✅ CLEAR existing interval before creating new one
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
        
        // ✅ CHECK if listeners already exist
        if (carouselEventsRegistered.has(productId)) {
            return;
        }
        
        carouselEventsRegistered.add(productId);
        
        let currentSlideIndex = 0;
        
        // ✅ STORE references to remove listeners later if needed
        const handleMouseEnter = () => {
            if (carouselsPaused) return;
            
            if (carouselIntervals[productId]) {
                clearInterval(carouselIntervals[productId]);
            }
            
            carouselIntervals[productId] = setInterval(() => {
                const cardSlides = card.querySelectorAll('.product-image-slide');
                currentSlideIndex = (currentSlideIndex + 1) % cardSlides.length;
                updateCarouselSlides(card, currentSlideIndex);
            }, 1500);
        };
        
        const handleMouseLeave = () => {
            if (carouselIntervals[productId]) {
                clearInterval(carouselIntervals[productId]);
            }
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

// ==================== MANUAL CAROUSEL NAVIGATION ====================

function nextProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    
    // Parar auto-carousel
    clearInterval(carouselIntervals[productId]);
    
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    
    slides[currentIndex].classList.remove('active');
    dots[currentIndex].classList.remove('active');
    
    currentIndex = (currentIndex + 1) % slides.length;
    
    slides[currentIndex].classList.add('active');
    dots[currentIndex].classList.add('active');
    
    // Reiniciar auto-carousel após 3 segundos
    setTimeout(() => {
        setupAutoCarousel();
    }, 3000);
}

function prevProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    
    // Parar auto-carousel
    clearInterval(carouselIntervals[productId]);
    
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    
    slides[currentIndex].classList.remove('active');
    dots[currentIndex].classList.remove('active');
    
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    
    slides[currentIndex].classList.add('active');
    dots[currentIndex].classList.add('active');
    
    // Reiniciar auto-carousel após 3 segundos
    setTimeout(() => {
        setupAutoCarousel();
    }, 3000);
}

function goToProductImage(productId, index, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    
    // Parar auto-carousel
    clearInterval(carouselIntervals[productId]);
    
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    slides[index].classList.add('active');
    dots[index].classList.add('active');
    
    // Reiniciar auto-carousel após 3 segundos
    setTimeout(() => {
        setupAutoCarousel();
    }, 3000);
}

// ==================== RENDER BEST SELLERS ====================

function renderBestSellers() {
    const bestSellersGrid = document.getElementById('bestSellersGrid');
    if (!bestSellersGrid) return;
    
    const bestSellers = productsData.filter(p => p.oldPrice).slice(0, 6);
    
    if (bestSellers.length === 0) {
        bestSellersGrid.innerHTML = '<p class="empty-section-message">Nenhum produto em destaque no momento</p>';
        return;
    }
    
    bestSellersGrid.innerHTML = bestSellers.map(product => {
        // Garantir que images sempre seja um array válido
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
                <!-- ↑ ADICIONAR onclick AQUI -->
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')" 
                            aria-label="Adicionar aos favoritos">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    
                    <div class="product-image-carousel">
                        <div class="product-image-slide active" style="${isRealImage ? `background-image: url(${firstImage}); background-size: cover; background-position: center;` : `background: ${firstImage}`}"></div>
                    </div>
                    
                    ${product.badge ? `<span class="product-badge">${sanitizeInput(product.badge)}</span>` : ''}
                    
                    <div class="product-quick-actions" style="position: absolute; bottom: 0; left: 0; right: 0; display: flex; opacity: 0; transition: opacity 0.3s;">
    <button class="add-to-cart-btn" style="flex: 1; border-radius: 0;" onclick="event.stopPropagation(); addToCart('${product.id}')">
        🛒 Carrinho
    </button>
    <button class="add-to-cart-btn" style="flex: 1; background: #27ae60; border-radius: 0;" onclick="event.stopPropagation(); quickBuy('${product.id}')">
         Comprar
    </button>
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

// ==================== PAGINAÇÃO ====================

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    
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
    // Tentar múltiplas formas de scroll (garantia máxima)
    const productsSection = document.getElementById('produtos');
    const sectionTitle = document.querySelector('.section-title');
    const productsGrid = document.getElementById('productsGrid');
    
    // Scroll para o elemento que existir
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


// ==================== HELPER: PEGAR IMAGEM DA COR SELECIONADA ====================
function getImageForColor(product, colorName) {
    // Se não tem cor selecionada, retorna a primeira imagem geral
    if (!colorName) {
        if (Array.isArray(product.images) && product.images.length > 0) {
            return product.images[0];
        }
        return product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
    
    // Busca a cor específica no array de cores do produto
    if (Array.isArray(product.colors) && product.colors.length > 0) {
        const colorObj = product.colors.find(c => {
            const cName = typeof c === 'object' ? String(c.name).trim() : String(c).trim();
            return cName === String(colorName).trim();
        });
        
        // Se encontrou a cor E ela tem imagens
        if (colorObj && colorObj.images && Array.isArray(colorObj.images) && colorObj.images.length > 0) {
            return colorObj.images[0]; // ← Primeira imagem DA COR
        }
    }
    
    // Fallback: se não encontrou imagens da cor, usa a primeira geral
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images[0];
    }
    
    return product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}

// ==================== CARRINHO ====================

function addToCart(productId) {
    // ✅ REDIRECIONA PARA A PÁGINA DO PRODUTO
    window.location.href = `produto.html?id=${productId}`;
    saveCart();
    return;
}

function addLookToCart() {
    // Adicionar produto atual + produtos relacionados selecionados
    const relatedProducts = document.querySelectorAll('.related-products-grid .product-card');
    let addedCount = 1; // Produto principal
    
    // Adicionar produto principal
    addToCartFromDetails();
    
    // Adicionar produtos relacionados (se houver seleção)
    relatedProducts.forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            const productId = card.dataset.productId;
            addToCart(productId);
            addedCount++;
        }
    });
    
    showToast(`✅ ${addedCount} produtos adicionados ao carrinho!`, 'success');
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    const cartTotal = document.getElementById('cartTotal');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // ✅ Batch de atualizações DOM usando requestAnimationFrame
    requestAnimationFrame(() => {
        // Atualizar contador
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        
        if (cart.length === 0) {
            cartItems.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
            cartFooter.style.display = 'none';
        } else {
            // ✅ Usar DocumentFragment (mais rápido)
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
            ${item.selectedColor ? `Cor: <strong>${sanitizeInput(item.selectedColor)}</strong>` : ''} <!-- ✅ ADICIONE sanitizeInput -->
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
            
            // ✅ Atualizar DOM de uma vez
            cartItems.innerHTML = '';
            cartItems.appendChild(fragment);

            
const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
const discount = Math.min(
    typeof couponDiscount === 'number' && !isNaN(couponDiscount) ? couponDiscount : 0,
    subtotal
);
const total = Math.max(0, subtotal - discount);

// Atualizar UI de valores
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

window.addEventListener('storage', (e) => {
    if (e.key === 'sejaVersatilCart' && e.newValue !== e.oldValue) {
        console.log('🔄 Carrinho atualizado em outra aba');
        loadCart();
        updateCartUI();
    }
});

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
        // ✅ RECALCULAR CUPOM APÓS MUDANÇA DE QUANTIDADE
        if (appliedCoupon && couponDiscount > 0) {
            const newSubtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            
            // Se tem valor mínimo e não atinge mais, remove o cupom
            if (appliedCoupon.minValue && newSubtotal < appliedCoupon.minValue) {
                removeCoupon();
                showToast(`❌ Cupom removido: valor mínimo R$ ${appliedCoupon.minValue.toFixed(2)}`, 'error');
            }
            // Recalcula o desconto com o novo subtotal
            else {
                let newDiscount = 0;
                
                if (appliedCoupon.type === 'percentage') {
                    newDiscount = (newSubtotal * appliedCoupon.value) / 100;
                    if (appliedCoupon.maxDiscount && newDiscount > appliedCoupon.maxDiscount) {
                        newDiscount = appliedCoupon.maxDiscount;
                    }
                } else if (appliedCoupon.type === 'fixed') {
                    newDiscount = appliedCoupon.value;
                }
                
                // Desconto não pode ser maior que o subtotal
                if (newDiscount > newSubtotal) {
                    newDiscount = newSubtotal;
                }
                
                couponDiscount = newDiscount;
                showAppliedCouponBadge(appliedCoupon, newDiscount);
            }
        }

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
    
    // Filtra o item removido
    cart = cart.filter(item => {
        const itemId = item.cartItemId || item.id;
        return itemId !== identifier;
    });
    
    const lengthAfter = cart.length;
    
    // ✅ VERIFICAÇÃO: Realmente removeu?
    if (lengthBefore === lengthAfter) {
        console.warn(' Item não encontrado para remover:', identifier);
        showToast('Item não encontrado', 'error');
        return;
    }
    
    console.log('✅ Item removido. Carrinho agora:', cart.length, 'itens');
    
    // 1. Se o carrinho ficou vazio
    if (cart.length === 0) {
        if (appliedCoupon) {
            removeCoupon();
        }
        // ✅ SALVA EXPLICITAMENTE O CARRINHO VAZIO
        saveCart();
        updateCartUI();
        showToast('Carrinho vazio', 'info');
        return; // Sai da função aqui
    }
    
    // 2. Se ainda tem itens, recalcula o cupom (se houver)
    if (appliedCoupon && couponDiscount > 0) {
        const newSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Verifica se ainda atinge o valor mínimo
        if (appliedCoupon.minValue && newSubtotal < appliedCoupon.minValue) {
            removeCoupon();
            showToast(`❌ Cupom removido: valor mínimo R$ ${appliedCoupon.minValue.toFixed(2)}`, 'error');
        } else {
            // Recalcula o valor do desconto
            let newDiscount = 0;
            
            if (appliedCoupon.type === 'percentage') {
                newDiscount = (newSubtotal * appliedCoupon.value) / 100;
                if (appliedCoupon.maxDiscount && newDiscount > appliedCoupon.maxDiscount) {
                    newDiscount = appliedCoupon.maxDiscount;
                }
            } else if (appliedCoupon.type === 'fixed') {
                newDiscount = appliedCoupon.value;
            }
            
            // Garante que o desconto não é maior que o total
            if (newDiscount > newSubtotal) {
                newDiscount = newSubtotal;
            }
            
            couponDiscount = newDiscount;
            showAppliedCouponBadge(appliedCoupon, newDiscount);
        }
    }
    
    // ✅ SALVA OBRIGATORIAMENTE O ESTADO FINAL
    saveCart();
    updateCartUI();
    showToast('Item removido do carrinho', 'info');
}
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function saveCart() {
    try {
        const cartData = {
            items: cart || [],
            appliedCoupon: appliedCoupon || null,
            couponDiscount: couponDiscount || 0
        };
        localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
        console.log('💾 Carrinho salvo:', cart.length, 'itens');
    } catch (err) {
        console.warn('⚠️ Erro ao salvar carrinho:', err);
    }
}


// ==================== INICIALIZAÇÃO ====================
// Garante que os elementos são carregados ao iniciar a página
document.addEventListener('DOMContentLoaded', () => {
    // Cache dos elementos do carrinho
    window.cartSidebar = document.getElementById('cartSidebar');
    window.cartOverlay = document.getElementById('sidebarOverlay');
    
    // Validação na inicialização
    if (!window.cartSidebar) {
        console.error('❌ CRÍTICO: #cartSidebar não encontrado ao carregar página!');
    }
    if (!window.cartOverlay) {
        console.warn('⚠️ #sidebarOverlay não encontrado - overlay pode não funcionar');
    }
    
    // Setup de eventos
    if (window.cartOverlay) {
        window.cartOverlay.addEventListener('click', toggleCart);
    }
    
    // Fechar carrinho com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.cartSidebar?.classList.contains('active')) {
            toggleCart();
        }
    });
    
    console.log('✅ Sistema de carrinho inicializado');
});

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

// Aplicar cupom
async function applyCoupon() {
    const input = document.getElementById('couponInput');
    const btn = document.getElementById('applyCouponBtn');
    const message = document.getElementById('couponMessage');

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

    // Desabilita botão durante verificação
    btn.disabled = true;
    btn.innerHTML = '⏳ Validando...';
    btn.style.opacity = '0.6';

    try { // ✅ ABERTURA DO BLOCO TRY
        // 1. Buscar cupom no Firestore
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

        // 2. Validar data de validade
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

        // 3. Verificar limite total de usos
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            showCouponMessage('❌ Este cupom atingiu o limite de usos', 'error');
            return;
        }

        // ✅ CORREÇÃO: Definir cartValue antes de usar
        const cartValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // 4. Verificar valor mínimo do carrinho (usando cartValue definido)
        if (coupon.minValue && cartValue < coupon.minValue) {
            showCouponMessage(`❌ Valor mínimo: R$ ${coupon.minValue.toFixed(2)}`, 'error');
            return;
        }

        // 5. Verificar uso por usuário (se logado)
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

        // 6. Calcular desconto
        let discount = 0;

        if (coupon.type === 'percentage') {
            discount = (cartValue * coupon.value) / 100;
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount;
            }
        } else if (coupon.type === 'fixed') {
            discount = coupon.value;
        }

        // Desconto não pode ser maior que o valor do carrinho
        if (discount > cartValue) {
            discount = cartValue;
        }

        // 7. Aplicar cupom
        appliedCoupon = coupon;
        couponDiscount = discount;
        saveCart();

        // 8. Atualizar UI
        input.classList.add('success');
        showAppliedCouponBadge(coupon, discount);
        updateCartUI();
        saveCart(); // ✅ Salvar cupom

        showCouponMessage(`✅ Cupom aplicado! Desconto de R$ ${discount.toFixed(2)}`, 'success');

        // Limpar input
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
// Remover cupom
function removeCoupon() {
    appliedCoupon = null;
    couponDiscount = 0;
    
    // Resetar UI
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
        btn.disabled = false; // ← ADICIONE ESTA LINHA
        btn.textContent = 'APLICAR'; // ← ADICIONE ESTA LINHA
        btn.style.opacity = '1'; // ← ADICIONE ESTA LINHA
    }
    if (message) message.classList.remove('active');
    
    updateCartUI();
    saveCart();
    showToast('Cupom removido', 'info');
}

// Mostrar badge de cupom aplicado
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

// Mostrar mensagem de cupom
function showCouponMessage(text, type) {
    const message = document.getElementById('couponMessage');
    if (!message) return;
    
    message.textContent = text;
    message.className = `coupon-message ${type} active`;
    
    setTimeout(() => {
        message.classList.remove('active');
    }, 5000);
}

// Registrar uso do cupom (chamar após pagamento confirmado)
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
            
            // ✅ Validação atômica
            if (coupon.usageLimit && newCount > coupon.usageLimit) {
                throw new Error('Limite atingido');
            }
            
            // ✅ Incremento seguro
            transaction.update(couponRef, {
                usedCount: firebase.firestore.FieldValue.increment(1)
            });
            
            // ✅ Registro de uso
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


// ==================== GERENCIADOR DE VÍDEOS ====================

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
    <p style="color: #666;">Carregando seus pedidos...</p>
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
    
    // Input de arquivo
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      
      if (!file) return;
      
      // Validar tamanho
      if (file.size > 2 * 1024 * 1024) {
        showToast('❌ Vídeo muito grande! Máximo 2MB', 'error');
        return;
      }
      
      // Validar formato
      if (!file.type.includes('mp4')) {
        showToast('❌ Apenas arquivos MP4 são permitidos', 'error');
        return;
      }
      
      document.getElementById('loadingOverlay').classList.add('active');
      
      try {
        // Upload para Firebase Storage
        const timestamp = Date.now();
        const filename = `video_${timestamp}_${Math.random().toString(36).substring(7)}.mp4`;
        const storageRef = storage.ref().child(`videos/${filename}`);
        
        await storageRef.put(file);
        const downloadURL = await storageRef.getDownloadURL();
        
        // Adicionar ao array
        videos.push({
          url: downloadURL,
          title: 'NOVO VÍDEO',
          subtitle: 'Edite o texto',
          order: videos.length + 1
        });
        
        // Salvar no Firestore
        await db.collection('site_config').doc('video_grid').set({ videos });
        
        showToast('✅ Vídeo adicionado com sucesso!', 'success');
        
        // Recarregar grid
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
    
    // Trocar posições
    [videos[fromIndex], videos[toIndex]] = [videos[toIndex], videos[fromIndex]];
    
    // Atualizar order
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
    
    // Tentar deletar do Storage
    try {
      const videoUrl = videos[index].url;
      const storageRef = storage.refFromURL(videoUrl);
      await storageRef.delete();
    } catch (err) {
      console.warn('Não foi possível deletar do storage:', err);
    }
    
    // Remover do array
    videos.splice(index, 1);
    
    // Atualizar order
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
// ==================== BUSCA ====================

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

document.getElementById('searchModal').addEventListener('click', (e) => {
    if (e.target.id === 'searchModal') {
        closeSearch();
    }
});

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
    
    // Mostrar resultados
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    // Renderizar produtos filtrados
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
                    
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
                        Adicionar ao Carrinho
                    </button>
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
    
    // Mostrar badge
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');
    
    if (badge && categoryName) {
        categoryName.textContent = `🔍 "${query}" (${filtered.length} resultados)`;
        badge.style.display = 'flex';
    }
    
    // Esconder paginação
    document.getElementById('pagination').innerHTML = '';
    
    // Scroll
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    showToast(`🔍 ${filtered.length} produtos encontrados`, 'success');
    trackEvent('Search', 'Header Search', query);
}

// ==================== FAVORITOS ====================

function openFavorites() {
    // Carregar favoritos do localStorage
    const favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    
    if (favorites.length === 0) {
        showToast('Você ainda não tem favoritos ❤️', 'info');
        return;
    }
    
    // Filtrar produtos favoritados
    const favProducts = productsData.filter(p => favorites.includes(p.id));
    
    if (favProducts.length === 0) {
        showToast('Seus favoritos não estão mais disponíveis', 'error');
        return;
    }
    
    // Limpar produtos do grid atual
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    // Renderizar APENAS favoritos
    grid.innerHTML = favProducts.map(product => {
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
        const discountPercent = product.oldPrice ? 
            Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;
        
        return `
            <div class="product-card" data-product-id="${product.id}" onclick="openProductDetails('${product.id}')">
                <div class="product-image">
                    <!-- Favorite Button (já favoritado) -->
                    <button class="favorite-btn active" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')" 
                            aria-label="Remover dos favoritos">
                        ❤️
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
                    
                    ${product.badge && !product.isBlackFriday && discountPercent === 0 ? `<div class="product-badge">${product.badge}</div>` : ''}
                    ${discountPercent > 0 && !product.isBlackFriday ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
                    
                    <!-- Image -->
                    <div class="product-image-carousel">
                        <div class="product-image-slide active" 
                             style="${isRealImage ? `background-image: url('${firstImage}')` : `background: ${firstImage}`}">
                            ${isRealImage ? `<img src="${firstImage}" alt="${product.name}" loading="lazy">` : ''}
                        </div>
                    </div>
                    
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
                        Adicionar ao Carrinho
                    </button>
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
    
    // Mostrar badge de filtro ativo
    const badge = document.getElementById('activeCategoryBadge');
    const categoryName = document.getElementById('categoryNameDisplay');
    
    if (badge && categoryName) {
        categoryName.textContent = '❤️ Meus Favoritos';
        badge.style.display = 'flex';
    }
    
    // Esconder paginação
    document.getElementById('pagination').innerHTML = '';
    
    // Scroll para produtos
    const productsSection = document.getElementById('produtos');
    if (productsSection) {
        setTimeout(() => {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    showToast(`❤️ ${favProducts.length} favoritos encontrados`, 'success');
    trackEvent('Favorites', 'View', `${favProducts.length} items`);
}

function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('💔 Removido dos favoritos', 'info');
        
        // Se estiver na tela de favoritos, recarregar
        const badge = document.getElementById('activeCategoryBadge');
        if (badge && badge.style.display === 'flex' && 
            document.getElementById('categoryNameDisplay').textContent.includes('Favoritos')) {
            
            // Se removeu o último favorito
            if (favorites.length === 0) {
                clearCategoryFilter();
                showToast('Você não tem mais favoritos', 'info');
            } else {
                // Recarregar tela de favoritos
                openFavorites();
            }
            return;
        }
    } else {
        favorites.push(productId);
        showToast('❤️ Adicionado aos favoritos', 'success');
    }
    
   localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
   updateFavoritesCount(); // ← ADICIONE ESTA LINHA
    
    // Atualizar visual do produto
    renderProducts();
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

function showFavorites() {
    if (favorites.length === 0) {
        showToast('Você ainda não tem favoritos', 'info');
        return;
    }
    
    // Filtrar apenas produtos favoritados
    currentFilter = 'favorites';
    currentPage = 1;
    
    // Modificar a função getFilteredProducts para incluir filtro de favoritos
    renderProducts();
    
    // Scroll para produtos
    scrollToProducts();
    
    showToast(`Mostrando ${favorites.length} favoritos`, 'info');
}

// ==================== CONEXÃO E OFFLINE ====================

function setupConnectionMonitor() {
    window.addEventListener('online', () => {
        showToast('Conexão restaurada!', 'success');
    });
    
    window.addEventListener('offline', () => {
        showToast('Você está offline', 'error');
    });
}

function setupCartAbandonmentTracking() {
    let cartTimer;
    
    const startCartTimer = () => {
        clearTimeout(cartTimer);
        if (cart.length > 0) {
            cartTimer = setTimeout(() => {
                showToast('Não esqueça de finalizar sua compra! 🛍️', 'info');
            }, 300000);
        }
    };
    
    // ✅ MODIFICADO: Só avisa se for realmente sair (fechar aba/janela)
   window.addEventListener('beforeunload', (e) => {
    // ✅ Se for navegação interna marcada, não avisa
    if (isInternalNavigation) {
        isInternalNavigation = false; // Reset
        return undefined;
    }
    
    // ✅ Se tem carrinho, avisa apenas ao FECHAR/SAIR
    if (cart.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});
    
    setInterval(startCartTimer, 60000);
}

// Sistema de Notificações Push
async function setupPushNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        console.log('❌ Push notifications não suportadas');
        return;
    }
    
    // Verificar se já tem permissão
    if (Notification.permission === 'granted') {
        console.log('✅ Notificações já autorizadas');
        return;
    }
    
    // Perguntar permissão após 30 segundos (não ser invasivo)
    setTimeout(() => {
        if (Notification.permission === 'default') {
            showNotificationPrompt();
        }
    }, 30000);
}

function showNotificationPrompt() {
    const promptHTML = `
        <div id="notificationPrompt" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 350px;
            z-index: 9998;
            animation: slideInRight 0.5s ease;
        ">
            <div style="display: flex; align-items: flex-start; gap: 1rem;">
                <div style="font-size: 2rem;">🔔</div>
                <div style="flex: 1;">
                    <h4 style="margin-bottom: 0.5rem; font-size: 1rem;">Receber Notificações?</h4>
                    <p style="font-size: 0.85rem; color: #666; margin-bottom: 1rem;">
                        Seja avisado sobre promoções exclusivas e lançamentos!
                    </p>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="requestNotificationPermission()" style="
                            flex: 1;
                            padding: 0.6rem;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-weight: 600;
                            font-size: 0.85rem;
                        ">
                            Permitir
                        </button>
                        <button onclick="closeNotificationPrompt()" style="
                            padding: 0.6rem 1rem;
                            background: #e5e5e5;
                            color: #666;
                            border: none;
                            border-radius: 6px;
                            font-weight: 600;
                            font-size: 0.85rem;
                        ">
                            Agora não
                        </button>
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
            console.log('✅ Permissão de notificação concedida');
            showToast('Você receberá notificações sobre promoções!', 'success');
            
            // Enviar notificação de boas-vindas
            new Notification('Bem-vindo ao Seja Versátil! 👋', {
                body: 'Agora você receberá ofertas exclusivas!',
                icon: '/favicon.ico',
                badge: '/favicon.ico'
            });
            
            // Salvar no localStorage
            localStorage.setItem('notificationsEnabled', 'true');
        } else {
            console.log('❌ Permissão de notificação negada');
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

// ==================== ATALHOS DE TECLADO ====================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Fechar search
        const searchModal = document.getElementById('searchModal');
        if (searchModal && searchModal.classList.contains('active')) {
            closeSearch();
            return;
        }
        
        // Fechar carrinho
        const cartSidebar = document.getElementById('cartSidebar');
        if (cartSidebar && cartSidebar.classList.contains('active')) {
            toggleCart();
            return;
        }
        
        // Fechar user panel
        const userPanel = document.getElementById('userPanel');
        if (userPanel && userPanel.classList.contains('active')) {
            closeUserPanel();
            return;
        }
        
        // Fechar product modal (admin)
        const productModal = document.getElementById('productModal');
        if (productModal && productModal.classList.contains('active')) {
            closeProductModal();
            return;
        }
        
        // Fechar payment modal
        const paymentModal = document.getElementById('paymentModal');
        if (paymentModal && paymentModal.classList.contains('active')) {
            closePaymentModal();
            return;
        }
        
        // Fechar product details modal
        const detailsModal = document.getElementById('productDetailsModal');
        if (detailsModal && detailsModal.classList.contains('active')) {
            closeProductDetails();
            return;
        }
        
        // Fechar admin panel
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.classList.contains('active')) {
            closeAdminPanel();
            return;
        }
    }
});

function checkout() {
    // ✅ FORÇA SALVAMENTO IMEDIATO
    saveCart();
    
    const rawCart = localStorage.getItem('sejaVersatilCart');
    if (!rawCart) {
        showToast('Carrinho vazio', 'Adicione produtos antes de finalizar', 'error');
        return;
    }
    
    let cartData;
    try {
        cartData = JSON.parse(rawCart);
    } catch (error) {
        console.error('❌ Erro ao parsear carrinho:', error);
        showToast('Erro no carrinho', 'Tente recarregar a página', 'error');
        return;
    }
    
    // ✅ VALIDA ESTRUTURA NOVA (objeto com .items)
    const items = cartData.items || [];
    if (items.length === 0) {
        showToast('Carrinho vazio', 'Adicione produtos antes de finalizar', 'error');
        return;
    }
    
    window.location.href = 'checkout.html';
}

// ==================== CHECKOUT VIA WHATSAPP ====================

const WHATSAPP_NUMBER = '5571991427103'; // SEU NÚMERO COM DDI + DDD + NÚMERO

function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const cartItemsContainer = document.getElementById('paymentCartItems');
    const totalContainer = document.getElementById('paymentTotal');
    
    console.log('🔍 Debug openPaymentModal:', {
        modal: !!modal,
        cartItemsContainer: !!cartItemsContainer,
        totalContainer: !!totalContainer,
        cartLength: cart.length
    });
    
    if (!modal) {
        console.error('❌ CRÍTICO: Elemento principal do modal ausente!');
        alert('Erro ao abrir modal de pagamento. Verifique o console.');
        return;
    }
    
    console.log('✅ Abrindo modal de pagamento com', cart.length, 'itens');
    
    if (!cartItemsContainer || !totalContainer) {
        console.error('❌ Containers do modal ausentes!');
        return;
    }
    
    // ✅ CORREÇÃO 1: Revalidar cupom ANTES de abrir modal
    if (appliedCoupon) {
        const subtotalCheck = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Se valor mínimo não for atingido, remove cupom
        if (appliedCoupon.minValue && subtotalCheck < appliedCoupon.minValue) {
            console.warn('⚠️ Valor mínimo do cupom não atingido');
            removeCoupon();
        } else {
            // Recalcula desconto com valor atualizado
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
    
    console.log('📦 Dados atualizados:', {
        appliedCoupon,
        couponDiscount,
        cartLength: cart.length
    });

    // ✅ CORREÇÃO 2: Renderizar itens
    cartItemsContainer.innerHTML = cart.map(item => {
        const itemImage = item.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        const isRealImage = itemImage.startsWith('data:image') || itemImage.startsWith('http');
        
        return `
            <div class="payment-cart-item">
                <div>
                    <div class="payment-cart-item-name">${sanitizeInput(item.name)}</div>
                    <div class="payment-cart-item-details">Qtd: ${item.quantity} × R$ ${item.price.toFixed(2)}</div>
                    ${item.selectedSize || item.selectedColor ? `
                        <div style="font-size: 0.75rem; color: #666; margin-top: 0.3rem;">
                            ${item.selectedSize ? `Tamanho: <strong>${sanitizeInput(item.selectedSize)}</strong>` : ''}
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
    
    // ✅ CORREÇÃO 3: Mostrar cupom aplicado
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
    
    // ✅ CORREÇÃO 4: Calcular total com desconto
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = Math.min(couponDiscount || 0, subtotal);
    const total = Math.max(0, subtotal - discount);
    
    totalContainer.textContent = `R$ ${total.toFixed(2)}`;
    
    // Mostrar modal
    modal.classList.add('active');
    
    // Configurar listeners para opções de pagamento
    const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
    const installmentsBox = document.getElementById('installmentsBox');
    
    if (paymentOptions.length > 0 && installmentsBox) {
        paymentOptions.forEach(option => {
            option.addEventListener('change', function() {
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
} // --- ADICIONADA CHAVE QUE FALTAVA AQUI ---

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

// ==================== 2. SISTEMA DE CHECKOUT APRIMORADO ====================

async function sendToWhatsApp() {
    // ✅ WAIT FOR AUTH STATE
    await new Promise(resolve => {
        if (auth.currentUser !== undefined) {
            resolve();
        } else {
            const unsubscribe = auth.onAuthStateChanged(() => {
                unsubscribe();
                resolve();
            });
        }
    });
    
    if (!cart || cart.length === 0) {
        showToast('Carrinho vazio!', 'error');
        return;
    }

    // 1. Coleta de Dados do Cliente
    let customerData = {};
    
    if (auth.currentUser) {
        // Usuário Logado
        customerData = {
            name: currentUser?.name || auth.currentUser.displayName,
            email: auth.currentUser.email,
            phone: (typeof getUserPhone === 'function') ? await getUserPhone() : '',
            cpf: (typeof getUserCPF === 'function') ? await getUserCPF() : '',
            uid: auth.currentUser.uid
        };
        
        if (!customerData.phone) {
             const phone = prompt("Precisamos do seu WhatsApp para confirmar o pedido:");
             if(!phone) return;
             customerData.phone = phone;
        }
    } else {
        // Usuário Visitante: DEVE coletar dados antes de prosseguir
        if (typeof collectGuestCustomerData === 'function') {
            // Fecha o modal de pagamento para abrir o de dados
            closePaymentModal(); 
            
            // collectGuestCustomerData é assíncrona e retorna os dados ou null se cancelado
            const guestData = await collectGuestCustomerData(); 
            
            if (!guestData) {
                // Se cancelou, reabre o modal de pagamento e interrompe
                openPaymentModal(); 
                return; 
            }
            customerData = guestData;
        } else {
            // Fallback caso a função não exista
            customerData = { name: 'Visitante', email: 'Não informado', phone: 'Não informado' };
        }
    }

    // 2. Dados do Pagamento
    const paymentInput = document.querySelector('input[name="paymentMethod"]:checked');
    if (!paymentInput) {
        showToast('Selecione uma forma de pagamento', 'error');
        return;
    }
    const paymentMethod = paymentInput.value;

if (paymentMethod === 'credito-parcelado') {
        const installmentsSelect = document.getElementById('installmentsSelect');
        if (!installmentsSelect || !installmentsSelect.value) {
            showToast('Selecione o número de parcelas.', 'error');
            // Reabre o modal de pagamento se estiver fechado (caso tenha vindo do fluxo de visitante)
            openPaymentModal(); 
            return;
        }
    }
    
    // 3. Cálculos
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = couponDiscount || 0;
    const total = Math.max(0, subtotal - discount);

    // 4. Salvar no Firestore (Lógica melhorada do arquivo enviado)
    let orderId = 'PENDENTE';
    
    try {
        const orderData = {
            userId: auth.currentUser ? auth.currentUser.uid : 'guest',
            customer: customerData,
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                size: item.selectedSize || null,
                color: item.selectedColor || null
            })),
            totals: {
                subtotal: subtotal,
                discount: discount,
                total: total
            },
            paymentMethod: paymentMethod,
            status: 'Pendente WhatsApp',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            appliedCoupon: appliedCoupon ? { code: appliedCoupon.code, value: appliedCoupon.value } : null
        };

        const docRef = await db.collection('orders').add(orderData);
        orderId = docRef.id;

        // Registrar uso do cupom se houver
        if (appliedCoupon) {
            // Chama sua função existente ou usa a lógica direta
            if(typeof registerCouponUsage === 'function') {
                await registerCouponUsage(appliedCoupon.id, total, discount);
            }
        }

    } catch (error) {
        console.error('Erro ao salvar pedido:', error);
        showToast('Erro ao processar pedido, mas vamos tentar enviar o WhatsApp.', 'error');
    }

    // 5. Gerar Mensagem WhatsApp (Layout Profissional)
    const msg = generateWhatsAppMessage(orderId, customerData, cart, { subtotal, discount, total }, paymentMethod);

    // 6. Enviar
    const WHATSAPP_NUMBER = '5571991427103'; // Confirme se este é o número correto
    const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappURL, '_blank');

    // 7. Limpeza
    closePaymentModal();
    if(typeof closeCustomerDataModal === 'function') closeCustomerDataModal();
    
    // Limpar carrinho
    cart = [];
    appliedCoupon = null;
    couponDiscount = 0;
    saveCart(); // Sua função de salvar no localStorage
    updateCartUI(); // Sua função de atualizar UI
    
    showToast('Pedido enviado para o WhatsApp!', 'success');
}

// Função Auxiliar para formatar a mensagem (Baseada no arquivo enviado)
function generateWhatsAppMessage(orderId, customer, items, totals, paymentMethod, installments = null) {
    let msg = `*🛍️ PEDIDO #${orderId.toUpperCase().substring(0, 6)} - SEJA VERSÁTIL*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    msg += `*👤 CLIENTE:*\n`;
    msg += `Nome: ${customer.name}\n`;
    if(customer.phone) msg += `Tel: ${customer.phone}\n`;
    if(customer.cpf) msg += `CPF: ${customer.cpf}\n`;
    msg += `\n`;

    msg += `*📦 PRODUTOS:*\n`;
    items.forEach((item, index) => {
        msg += `${index + 1}. *${item.name}*\n`;
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

// ==================== FUNÇÕES AUXILIARES (TRAZIDAS DO SEU CÓDIGO) ====================

function collectGuestCustomerData() {
  return new Promise((resolve, reject) => {
    const modal = document.getElementById('customerDataModal');
    const form = document.getElementById('customerDataForm');
    
    if (!modal || !form) {
        console.error('Modal de dados do cliente não encontrado');
        resolve(null);
        return;
    }
    
    // Abrir modal
    modal.classList.add('active');
    
    // Limpar campos
    form.reset();
    
    // Handler do formulário
    const submitHandler = async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('guestName').value.trim();
      const email = document.getElementById('guestEmail').value.trim().toLowerCase();
      const phone = document.getElementById('guestPhone').value.replace(/\D/g, '');
      const cpf = document.getElementById('guestCPF').value.replace(/\D/g, '');
      
      // Validações
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
      
      if (cpf.length !== 11) {
        showToast('CPF inválido', 'error');
        return;
      }
      
      // Validar CPF (algoritmo simplificado)
      if (!isValidCPF(cpf)) {
        showToast('CPF inválido', 'error');
        return;
      }
      
      // Fechar modal
      modal.classList.remove('active');
      
      // Remover listener
      form.removeEventListener('submit', submitHandler);
      
      // Resolver promise com dados
      resolve({
        name,
        email,
        phone,
        cpf,
        userId: null
      });
    };
    
    // Adicionar listener
    form.addEventListener('submit', submitHandler);
    
    // Cancelar
    window.closeCustomerDataModal = () => {
      modal.classList.remove('active');
      form.removeEventListener('submit', submitHandler);
      resolve(null); // Retorna null se cancelar
    };
  });
}

function isValidCPF(cpf) {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/\D/g, '');
  
  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) return false;
  
  let soma = 0;
  let resto;
  
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
}

function closeCustomerDataModal() {
  const modal = document.getElementById('customerDataModal');
  if (modal) modal.classList.remove('active');
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

// ==================== FIM DA ANIMAÇÃO ====================

function addToCartFromDetails() {
    if (!currentProductDetails) return;
    
    const product = currentProductDetails;
    
    // Pegar o botão que foi clicado para animar
    const addButton = document.querySelector('.btn-add-cart-large');
    
    // Criar identificador único para produto + tamanho + cor
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
            image: getImageForColor(product, selectedColor) // ← USA A NOVA FUNÇÃO
        });
    }
    
    saveCart();
    updateCartUI();
    
    // 🎬 CHAMAR ANIMAÇÃO ANTES DO TOAST
    if (addButton) {
        animateProductToCart(addButton, product);
    }
    
    // Toast aparece após pequeno delay para não competir visualmente
    setTimeout(() => {
        showToast(`${selectedQuantity}x ${product.name} (${selectedSize}, ${selectedColor}) adicionado ao carrinho!`, 'success');
    }, 300);
}

function buyNow() {
    if (!currentProductDetails) return;
    
    // Adicionar ao carrinho primeiro
    addToCartFromDetails();
    
    // Fechar modal de detalhes
    closeProductDetails();
    
    // Abrir carrinho
    setTimeout(() => {
        toggleCart();
    }, 500);
    
    // Abrir modal de pagamento após 1 segundo
    setTimeout(() => {
        checkout();
    }, 1000);
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
        // CORREÇÃO: Garantir que images seja array válido
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

// ==================== TRATAMENTO DE ERROS GLOBAIS ====================

// Capturar erros de Promise não tratadas
window.addEventListener('unhandledrejection', function(event) {
    console.warn('⚠️ Promise não tratada:', event.reason);
    event.preventDefault();
});

// Limpar carousels quando usuário sai da aba/janela
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        carouselsPaused = true;
        stopHeroCarousel();
        clearCarouselIntervals();
        //console.log('🛑 Carousels pausados (aba inativa)');
    } else {
        carouselsPaused = false;
        startHeroCarousel();
        setupAutoCarousel();
        //console.log('▶️ Carousels reativados (aba ativa)');
    }
});

// ==================== INTEGRAÇÃO DE ESTOQUE ====================
let productVariants = {};

// Carregar variantes de um produto
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
            variants.push({ id: doc.id, ...doc.data() });
        });
        
        productVariants[productId] = variants;
        return variants;
    } catch (error) {
        console.error('Erro ao carregar variantes:', error);
        return [];
    }
}

// Verificar disponibilidade de tamanho/cor específicos
function isVariantAvailable(productId, size, color) {
    const variants = productVariants[productId] || [];
    const variant = variants.find(v => v.size === size && v.color === color);
    
    if (!variant) return false;
    return variant.available && variant.stock > 0;
}

// Obter estoque de uma variante
function getVariantStock(productId, size, color) {
    const variants = productVariants[productId] || [];
    const variant = variants.find(v => v.size === size && v.color === color);
    return variant ? variant.stock : 0;
}

function openProductDetails(productId) {
    // Salvar ID do produto no localStorage
    localStorage.setItem('selectedProductId', productId);
    
    // Redirecionar para página de produto
    window.location.href = `produto.html?id=${productId}`;
}

// Renderizar cores disponíveis COM IMAGENS do Firebase
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

// Função auxiliar para converter nome em hex (fallback)
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

// Renderizar tamanhos disponíveis
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
    
    // Selecionar primeiro tamanho disponível
    const firstAvailable = sizes.find(size => 
        variants.some(v => v.size === size && v.color === selectedColor && v.stock > 0)
    );
    if (firstAvailable) {
        selectedSize = firstAvailable;
    }
}

// Selecionar cor e TROCAR IMAGENS automaticamente
// ==================== ATUALIZAÇÃO DINÂMICA DE GALERIA ====================

function selectColor(colorName) {
    // 1. Validação Básica
    if (!currentProductDetails || !currentProductDetails.colors) return;

    // 2. Encontrar os dados da cor selecionada
    const selectedColorData = currentProductDetails.colors.find(c => c.name === colorName);
    
    if (!selectedColorData || !selectedColorData.images || selectedColorData.images.length === 0) {
        showToast('Imagens desta cor indisponíveis', 'error');
        return;
    }

    // 3. Atualizar Variáveis Globais
    selectedColor = colorName;
    
    // 4. Atualizar Visual dos Botões de Cor (Feedback visual)
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.color === colorName);
        
        // Pequena animação de escala para confirmar o clique
        if (opt.dataset.color === colorName) {
            opt.style.transform = "scale(1.15)";
            setTimeout(() => opt.style.transform = "scale(1)", 200);
        }
    });

    // ==========================================================
    // 🔥 O CORAÇÃO DA MUDANÇA: TROCAR AS FOTOS PRINCIPAIS 🔥
    // ==========================================================
    updateGalleryDisplay(selectedColorData.images);

    // 5. Atualizar Tamanhos Disponíveis para essa cor (se houver lógica de estoque)
    renderAvailableSizes(currentProductDetails.id);
    
    console.log(`🎨 Cor alterada para: ${colorName}`);
}

// Função auxiliar que manipula o DOM das imagens
function updateGalleryDisplay(images) {
    // --- PARTE 1: ATUALIZAR AS DUAS FOTOS GIGANTES (HERO) ---
    
    const img1 = document.getElementById('mainImg1');
    const img2 = document.getElementById('mainImg2');

    // Atualiza Foto Principal 1
    if (img1 && images[0]) {
        // Efeito suave de fade
        img1.style.opacity = '0.5';
        setTimeout(() => {
            img1.src = images[0];
            img1.style.opacity = '1';
        }, 150);
    }

    // Atualiza Foto Principal 2
    if (img2) {
        if (images[1]) {
            img2.style.display = 'block'; // Garante que aparece
            img2.style.opacity = '0.5';
            setTimeout(() => {
                img2.src = images[1];
                img2.style.opacity = '1';
            }, 150);
        } else {
            // Se a cor só tiver 1 foto, esconde o segundo espaço ou repete a primeira
            // Opção A: Esconder
            // img2.style.display = 'none'; 
            
            // Opção B: Deixar branco ou placeholder (recomendado para manter layout)
            img2.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Pixel transparente
        }
    }

    // --- PARTE 2: ATUALIZAR MINIATURAS / GRID INFERIOR ---
    
    // Pega as imagens restantes (a partir da terceira, índice 2)
    // Se só tiver 2 fotos, esse array ficará vazio, o que é correto.
    const remainingImages = images.slice(2);
    
    const thumbnailContainer = document.getElementById('thumbnailList'); // Ou o ID da sua grid inferior
    
    if (thumbnailContainer) {
        if (remainingImages.length > 0) {
            thumbnailContainer.innerHTML = remainingImages.map((img, index) => `
                <div class="thumbnail-item" onclick="swapMainImage('${img}')" style="cursor: pointer; overflow: hidden; border-radius: 4px;">
                    <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;">
                </div>
            `).join('');
            thumbnailContainer.style.display = 'grid'; // Garante que aparece
        } else {
            // Se não sobrar fotos, esconde a grid de baixo ou limpa
            thumbnailContainer.innerHTML = '';
            thumbnailContainer.style.display = 'none'; 
        }
    }
}

// Função extra para clicar na miniatura de baixo e ela subir para a principal
function swapMainImage(newSrc) {
    const img1 = document.getElementById('mainImg1');
    if (img1) {
        img1.scrollIntoView({ behavior: 'smooth' }); // Rola para o topo suavemente
        img1.style.opacity = '0.5';
        setTimeout(() => {
            img1.src = newSrc;
            img1.style.opacity = '1';
        }, 200);
    }
}

// SUBSTITUIR addToCartFromDetails() por esta versão:
function addToCartFromDetails() {
    if (!currentProductDetails) return;
    
    const product = currentProductDetails;
    
    // Verificar disponibilidade
    if (!isVariantAvailable(product.id, selectedSize, selectedColor)) {
        showToast('❌ Esta combinação está indisponível', 'error');
        return;
    }
    
    // Verificar estoque
    const stock = getVariantStock(product.id, selectedSize, selectedColor);
    if (stock < selectedQuantity) {
        showToast(`❌ Apenas ${stock} unidades disponíveis`, 'error');
        return;
    }
    
    const addButton = document.querySelector('.btn-add-cart-large');
    
    // Criar identificador único para produto + tamanho + cor
    const cartItemId = `${product.id}_${selectedSize}_${selectedColor}`;
    
    const existingItem = cart.find(item => item.cartItemId === cartItemId);
    
    if (existingItem) {
        // Verificar se não excede estoque
        if (existingItem.quantity + selectedQuantity > stock) {
            showToast(`❌ Estoque insuficiente. Máximo: ${stock}`, 'error');
            return;
        }
        existingItem.quantity += selectedQuantity;
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
        animateProductToCart(addButton, product);
    }
    
    setTimeout(() => {
        showToast(`✅ ${selectedQuantity}x ${product.name} (${selectedSize}, ${selectedColor}) adicionado!`, 'success');
    }, 300);
}

// Adicionar CSS para itens indisponíveis
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    .size-option.unavailable,
    .color-option.unavailable {
        opacity: 0.3;
        cursor: not-allowed !important;
        position: relative;
    }
    
    .size-option.unavailable::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 2px;
        background: #dc3545;
        transform: translateY(-50%) rotate(-45deg);
    }
`;
document.head.appendChild(styleSheet);

console.log('✅ Sistema de estoque integrado ao site');

// ==================== BLACK FRIDAY COUNTDOWN ====================

function initBlackFridayCountdown() {
    const blackFridayEnd = new Date(2025, 10, 30, 23, 59, 59);
    let countdownInterval; // ✅ DECLARE FIRST
    
    function updateCountdown() {
        const now = new Date().getTime();
        const distance = blackFridayEnd - now;
        
        if (distance < 0) {
            document.querySelector('.top-banner').innerHTML = `...`;
            clearInterval(countdownInterval); // ✅ Now accessible
            return;
        }
        
        // Calcular tempo restante
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        // Atualizar elementos (com zero à esquerda)
        const daysEl = document.getElementById('bfDays');
        const hoursEl = document.getElementById('bfHours');
        const minutesEl = document.getElementById('bfMinutes');
        const secondsEl = document.getElementById('bfSeconds');
        
        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    }
    
    // Atualizar imediatamente
    updateCountdown();
    
    // Atualizar a cada segundo
    countdownInterval = setInterval(updateCountdown, 1000); // CORRIGIDO: Removido 'const' para usar a variável let declarada acima
}
// ==================== FIM BLACK FRIDAY COUNTDOWN ====================
// MARCAR PRODUTOS COMO BLACK FRIDAY
// ================================================================
async function marcarProdutosBlackFriday() {
    // Verifica se admin está logado
    if (!isAdminLoggedIn) {
        alert('Você precisa estar logado como admin!');
        return;
    }

    // Confirmação do usuário
    const confirmacao = confirm(
        'Esta função irá marcar TODOS os produtos com desconto (oldPrice) como Black Friday.\n\n' +
        'Deseja continuar?'
    );
    if (!confirmacao) return;

    // Exibe overlay de loading
    document.getElementById('loadingOverlay')?.classList.add('active');

    try {
        let contador = 0;

        // Atualiza cada produto com oldPrice
        for (const product of productsData) {
            if (product.oldPrice) {
                await db.collection("produtos").doc(product.id).update({
                    isBlackFriday: true
                });

                product.isBlackFriday = true;
                contador++;
            }
        }

        // Limpa cache e recarrega produtos
        productCache.clear();
        await carregarProdutosDoFirestore();
        renderProducts();

        alert(`✅ ${contador} produtos foram marcados como Black Friday!`);

    } catch (error) {
        console.error("Erro:", error);
        alert('Erro ao marcar produtos: ' + error.message);

    } finally {
        // Remove overlay
        document.getElementById('loadingOverlay')?.classList.remove('active');
    }
}

// Mensagem no console para admins
console.log(
    'Para marcar produtos Black Friday automaticamente, execute: marcarProdutosBlackFriday()'
);


// ================================================================
// CLEANUP AO SAIR DA PÁGINA
// ================================================================
window.addEventListener('beforeunload', function () {
    clearCarouselIntervals();
    stopHeroCarousel();
});


// ================================================================
// SERVICE WORKER - FORÇA ATUALIZAÇÃO
// ================================================================
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.update();
        }
    });
}

// ==================== INDICADOR DE FORÇA DE SENHA (LIGHT VERSION) ====================
document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('registerPassword');
    const strengthDiv = document.getElementById('passwordStrength');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');

    if (!passwordInput || !strengthDiv || !strengthBar || !strengthText) {
        console.warn('⚠️ Elementos de força de senha não encontrados.');
        return;
    }

    passwordInput.addEventListener('input', (e) => {
        const password = e.target.value.trim();

        if (!password) {
            strengthDiv.style.display = 'none';
            strengthBar.style.width = '0%';
            strengthText.textContent = '';
            return;
        }

        strengthDiv.style.display = 'block';

        // Regras simplificadas
        const rules = [
            password.length >= 6,
            password.length >= 8,
            /[a-z]/.test(password) && /[A-Z]/.test(password),
            /\d/.test(password)
        ];

        const score = rules.filter(Boolean).length;

        const levels = [
            { text: '🔴 Senha fraca', color: '#e74c3c', width: '25%' },
            { text: '🟠 Senha razoável', color: '#e67e22', width: '50%' },
            { text: '🟡 Senha boa', color: '#f39c12', width: '75%' },
            { text: '🟢 Senha forte', color: '#27ae60', width: '100%' }
        ];

        const level = levels[Math.min(score - 1, levels.length - 1)] || levels[0];

        strengthBar.style.width = level.width;
        strengthBar.style.backgroundColor = level.color;
        strengthText.textContent = level.text;
        strengthText.style.color = level.color;
    });
});

// ==================== BUSCA INTELIGENTE (LIVE SEARCH) ====================

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('headerSearchInput');
    const dropdown = document.getElementById('headerDropdown');

    if (!searchInput || !dropdown) return;

    // Função de delay para não buscar a cada milissegundo (Debounce)
    let timeout = null;

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        
        clearTimeout(timeout);

        // Se limpar o input ou tiver menos de 2 letras, esconde a lista
        if (query.length < 2) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }

        // Espera 300ms após parar de digitar para buscar
        timeout = setTimeout(() => {
            const filteredProducts = productsData.filter(product => 
                product.name.toLowerCase().includes(query) || 
                product.category.toLowerCase().includes(query)
            );

            renderDropdownResults(filteredProducts);
        }, 300);
    });

    // Clicar fora fecha a lista
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
});

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

    // Limita a 6 resultados para não ficar uma lista gigante
    const topProducts = products.slice(0, 6);

    dropdown.innerHTML = topProducts.map(product => {
        // Lógica para pegar a imagem (reutilizando sua lógica atual)
        let imageUrl = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; // Fallback
        
        if (Array.isArray(product.images) && product.images.length > 0) {
            imageUrl = product.images[0];
        } else if (product.image) {
            imageUrl = product.image;
        }

        // Verifica se é imagem real ou gradiente para o estilo CSS correto
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
    
    // Botão "Ver todos os resultados" se houver mais produtos
    if (products.length > 6) {
        dropdown.innerHTML += `
            <div class="search-dropdown-item" style="justify-content: center; color: #667eea; font-weight: bold;" onclick="performHeaderSearch()">
                Ver todos os ${products.length} resultados
            </div>
        `;
    }

    dropdown.classList.add('active');
}

// ==================== FUNÇÕES DE CUPONS (ADMIN) ====================

function openCouponModal(couponId = null) {
    const modal = document.getElementById('couponModal');
    const form = document.getElementById('couponForm');
    
    if (couponId) {
        // Modo edição
        loadCouponData(couponId);
    } else {
        // Modo criação
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

// ✅ Marcar cliques no logo/navbar como navegação interna
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (link) {
        const href = link.getAttribute('href');
        // Se for link interno do mesmo domínio
        if (href && (href.startsWith('/') || href.startsWith('index.html') || href.startsWith('produto.html'))) {
            isInternalNavigation = true;
        }
    }
});

// Validação de CPF com feedback visual
function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) return false;
    
    // Validação de CPF real
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

// Validação de Email com feedback visual
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Aplicar validação visual a inputs
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


// Monitoramento de Performance (apenas em desenvolvimento)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.addEventListener('load', () => {
        if (window.performance && window.performance.timing) {
            const perfData = window.performance.timing;
            const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
            const connectTime = perfData.responseEnd - perfData.requestStart;
            const renderTime = perfData.domComplete - perfData.domLoading;
            
            console.log('%c⚡ Performance Metrics', 'color: #667eea; font-weight: bold; font-size: 14px;');
            console.log(`Page Load Time: ${pageLoadTime}ms`);
            console.log(`Server Response: ${connectTime}ms`);
            console.log(`DOM Render: ${renderTime}ms`);
        }
    });
}

window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.sendToWhatsApp = sendToWhatsApp;
window.closeCustomerDataModal = closeCustomerDataModal;
window.collectGuestCustomerData = collectGuestCustomerData;
window.isValidCPF = isValidCPF;
window.getUserPhone = getUserPhone;
window.getUserCPF = getUserCPF;
window.applyCoupon = applyCoupon;
window.removeCoupon = removeCoupon;
window.checkout = checkout;


















