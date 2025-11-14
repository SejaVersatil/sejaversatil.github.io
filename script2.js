// ==================== VARIÁVEIS GLOBAIS ====================
let productsData = [];
let cart = [];
let currentFilter = 'all';
let currentSort = '';
let currentPage = 1;
const itemsPerPage = 12;
let tempProductImages = [];
let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
let viewHistory = JSON.parse(localStorage.getItem('viewHistory') || '[]');
let carouselIntervals = {};
const carouselEventsRegistered = new Set();
let carouselsPaused = false;
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
        image: 'https://i.imgur.com/kvruQ8k.jpeg',
        title: 'COLEÇÃO 2025',
        subtitle: 'Conforto e estilo para seus treinos',
        cta: 'EXPLORAR AGORA'
    },
    {
        image: 'https://i.imgur.com/iapKUtF.jpeg',
        title: 'LANÇAMENTO',
        subtitle: 'Tecnologia para máxima performance',
        cta: 'VER COLEÇÃO'
    },
    {
        image: 'https://i.imgur.com/ZVqxl8B.jpeg',
        title: 'FITNESS & LIFESTYLE',
        subtitle: 'Do treino ao dia a dia com versatilidade',
        cta: 'DESCOBRIR'
    }
];

function initHeroCarousel() {
    const heroContainer = document.querySelector('.hero-carousel');
    if (!heroContainer) return;

    heroContainer.innerHTML = heroSlides.map((slide, index) => `
        <div class="hero-slide ${index === 0 ? 'active' : ''}" style="background-image: url('${slide.image}')">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <h1 class="hero-title">${slide.title}</h1>
                <p class="hero-subtitle">${slide.subtitle}</p>
                <button class="hero-cta" onclick="scrollToProducts()">${slide.cta}</button>
            </div>
        </div>
    `).join('');

    const dotsContainer = document.querySelector('.carousel-dots');
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
    }, 5000);
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
    showToast(`📦 ${getCategoryName(category)}`, 'info');
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
    // ← Regex mais rigorosa
    const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return re.test(email.trim().toLowerCase());
}

// Sanitização de Input
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
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
        console.log('📦 Nenhum produto no Firestore, adicionando produtos padrão...');
        
        for (const produto of DEFAULT_PRODUCTS) {
            try {
                const docRef = await db.collection("produtos").add({
                    ...produto,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ Produto "${produto.name}" adicionado com ID: ${docRef.id}`);
            } catch (error) {
                console.error(`❌ Erro ao adicionar "${produto.name}":`, error);
            }
        }
        
        await carregarProdutosDoFirestore();
    }
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando carregamento do site...');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
    
    try {
        console.log('📋 Carregando configurações...');
        loadSettings();
        
        console.log('🛒 Carregando carrinho...');
        loadCart();
        
        console.log('📦 Carregando produtos...');
        await loadProducts();
        
        console.log('🎨 Renderizando skeleton...');
        
        
        setTimeout(() => {
            console.log('✅ Renderizando produtos...');
            renderProducts();
            renderBestSellers();
            updateCartUI();
            initHeroCarousel();
            setupConnectionMonitor();
            setupCartAbandonmentTracking();
            console.log('✅ Site carregado com sucesso!');
        }, 100);
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao inicializar:', error);
        console.error('Stack trace:', error.stack);
        showToast('Erro ao carregar o site. Recarregue a página.', 'error');
        
        // Mostrar erro na tela
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

// ==================== SISTEMA DE ADMIN ====================

const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'sejaversatil2025',
    email: 'admin@sejaversatil.com.br'
};

let isAdminLoggedIn = false;
let currentUser = null;
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

function checkUserSession() {
    const savedUser = localStorage.getItem('sejaVersatilCurrentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showLoggedInView();
    }
}

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

function userLogin(event) {
    event.preventDefault();
    
    const emailOrUsername = document.getElementById('loginEmail').value.toLowerCase().trim();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    if (!emailOrUsername || !password) {
        errorMsg.textContent = 'Preencha todos os campos';
        errorMsg.classList.add('active');
        return;
    }

    if ((emailOrUsername === ADMIN_CREDENTIALS.username || emailOrUsername === ADMIN_CREDENTIALS.email) && 
        password === ADMIN_CREDENTIALS.password) {
        currentUser = {
            name: 'Administrador',
            email: ADMIN_CREDENTIALS.email,
            isAdmin: true
        };
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        showLoggedInView();
        errorMsg.classList.remove('active');
        showToast('Login realizado com sucesso!', 'success');
        return;
    }

    const users = JSON.parse(localStorage.getItem('sejaVersatilUsers') || '[]');
    const user = users.find(u => u.email.toLowerCase() === emailOrUsername && u.password === password);

    if (user) {
        currentUser = {
            name: user.name,
            email: user.email,
            isAdmin: false
        };
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        showLoggedInView();
        errorMsg.classList.remove('active');
        showToast('Login realizado com sucesso!', 'success');
    } else {
        errorMsg.textContent = 'E-mail ou senha incorretos';
        errorMsg.classList.add('active');
    }
}

function userRegister(event) {
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
        errorMsg.textContent = 'Senha deve ter pelo menos 6 caracteres';
        errorMsg.classList.add('active');
        return;
    }

    if (password !== confirmPassword) {
        errorMsg.textContent = 'As senhas não coincidem';
        errorMsg.classList.add('active');
        return;
    }

    const users = JSON.parse(localStorage.getItem('sejaVersatilUsers') || '[]');
    if (users.some(u => u.email === email)) {
        errorMsg.textContent = 'Este e-mail já está cadastrado';
        errorMsg.classList.add('active');
        return;
    }

    if (email === ADMIN_CREDENTIALS.email) {
        errorMsg.textContent = 'Este e-mail não pode ser usado';
        errorMsg.classList.add('active');
        return;
    }

    const newUser = { name, email, password };
    users.push(newUser);
    localStorage.setItem('sejaVersatilUsers', JSON.stringify(users));

    successMsg.classList.add('active');
    showToast('Conta criada com sucesso!', 'success');
    
    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerConfirmPassword').value = '';

    setTimeout(() => {
        switchUserTab('login');
        successMsg.classList.remove('active');
    }, 2000);
}

function userLogout() {
    if (confirm('Deseja realmente sair da sua conta?')) {
        currentUser = null;
        isAdminLoggedIn = false;
        localStorage.removeItem('sejaVersatilCurrentUser');
        hideLoggedInView();
        showToast('Logout realizado com sucesso', 'info');
    }
}

// ==================== FIRESTORE ====================

async function carregarProdutosDoFirestore() {
    try {
        console.log('📄 Carregando produtos do Firestore...');
        
        // Verificar cache primeiro
        const cached = productCache.get('products');
        if (cached) {
            console.log('✅ Produtos carregados do cache');
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
        console.log(`✅ ${productsData.length} produtos carregados do Firestore`);
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

function openAdminPanel() {
    if (!isAdminLoggedIn) {
        showToast('Você precisa estar logado como administrador', 'error');
        openUserPanel();
        return;
    }
    document.getElementById('adminPanel').classList.add('active');
    renderAdminProducts();
    updateAdminStats();
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

    if (productId) {
        const product = productsData.find(p => p.id === productId);
        title.textContent = 'Editar Produto';
        document.getElementById('productId').value = productId;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productOldPrice').value = product.oldPrice || '';
        document.getElementById('productBadge').value = product.badge || '';
        tempProductImages = [...(product.images || (product.image ? [product.image] : []))];
    } else {
        title.textContent = 'Adicionar Novo Produto';
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        tempProductImages = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
    }

    renderProductImages();
    modal.classList.add('active');
}

function renderProductImages() {
    const container = document.getElementById('productImagesList');
    if (!container) return;
    
    container.innerHTML = tempProductImages.map((img, index) => {
        const isImage = img.startsWith('data:image') || img.startsWith('http');
        return `
            <div class="image-item">
                <div class="image-item-preview" style="${isImage ? '' : 'background: ' + img}">
                    ${isImage ? `<img src="${img}" alt="Produto">` : ''}
                </div>
                <button type="button" class="image-item-remove" onclick="removeProductImage(${index})">×</button>
            </div>
        `;
    }).join('');
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
    if (tempProductImages.length > 1) {
        tempProductImages.splice(index, 1);
        renderProductImages();
        showToast('Imagem removida', 'info');
    } else {
        showToast('O produto precisa ter pelo menos 1 imagem!', 'error');
    }
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    editingProductId = null;
}

function editProduct(productId) {
    openProductModal(productId);
}

async function deleteProduct(productId) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        document.getElementById('loadingOverlay').classList.add('active');
        
        try {
            await db.collection("produtos").doc(productId).delete();
            
            const index = productsData.findIndex(p => p.id === productId);
            if (index !== -1) {
                productsData.splice(index, 1);
            }
            
            productCache.clear();
            saveProducts();
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
}

async function saveProduct(event) {
    event.preventDefault();
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    const name = sanitizeInput(document.getElementById('productName').value.trim());
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const oldPrice = document.getElementById('productOldPrice').value ? parseFloat(document.getElementById('productOldPrice').value) : null;
    const badge = document.getElementById('productBadge').value.trim() || null;
    const productId = document.getElementById('productId').value;

    const productData = {
        name: name,
        category: category,
        price: price,
        oldPrice: oldPrice,
        badge: badge,
        images: tempProductImages,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const errors = validateProductData(productData);
    if (errors.length > 0) {
        showToast(errors[0], 'error');
        document.getElementById('loadingOverlay').classList.remove('active');
        return;
    }

    try {
        if (productId) {
            await db.collection("produtos").doc(productId).update(productData);
            
            const product = productsData.find(p => p.id === productId);
            if (product) {
                Object.assign(product, productData);
                product.id = productId;
            }
            showToast('Produto atualizado com sucesso!', 'success');
        } else {
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection("produtos").add(productData);
            
            productsData.push({
                id: docRef.id,
                ...productData
            });
            showToast('Produto adicionado com sucesso!', 'success');
        }

        productCache.clear();
        saveProducts();
        closeProductModal();
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        
        await carregarProdutosDoFirestore();
        
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
    
    console.log('🔍 Filtro atual:', currentFilter);
    console.log('📦 Total de produtos:', productsData.length);
    
    if (currentFilter !== 'all') {
        if (currentFilter === 'sale') {
            filtered = filtered.filter(p => p.oldPrice !== null);
        } else {
            // Filtrar por categoria exata
            filtered = filtered.filter(p => {
                const match = p.category === currentFilter;
                console.log(`Produto: "${p.name}" | Categoria: "${p.category}" | Match: ${match}`);
                return match;
            });
        }
    }
    
    console.log('✅ Produtos filtrados:', filtered.length);
    
    // Se não encontrar produtos, mostrar aviso
    if (filtered.length === 0 && currentFilter !== 'all') {
        console.warn('⚠️ Nenhum produto encontrado para a categoria:', currentFilter);
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
                <div style="font-size: 4rem; margin-bottom: 1rem;">📦</div>
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
        <div class="product-card" data-product-id="${product.id}" onclick="openProductDetails('${product.id}')">
            <div class="product-image">
                <!-- Favorite Button -->
                <button class="favorite-btn ${isFav ? 'active' : ''}" 
                        onclick="event.stopPropagation(); toggleFavorite('${product.id}')" 
                        aria-label="Adicionar aos favoritos">
                    ${isFav ? '❤️' : '🤍'}
                </button>
                
                <!-- Discount Badge -->
                ${discountPercent > 0 ? `<div class="discount-badge">-${discountPercent}%</div>` : ''}
                ${product.badge && discountPercent === 0 ? `<div class="product-badge">${sanitizeInput(product.badge)}</div>` : ''}
                
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
                
                <!-- Add to Cart Button -->
                <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">
                    Adicionar ao Carrinho
                </button>
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
    console.log('🧹 Limpando carousels ativos:', Object.keys(carouselIntervals).length);
    
    // Limpar todos os intervalos
    Object.keys(carouselIntervals).forEach(key => {
        clearInterval(carouselIntervals[key]);
    });
    
    // Resetar objetos
    carouselIntervals = {};
    carouselEventsRegistered.clear();
    
    console.log('✅ Carousels limpos');
}

function setupAutoCarousel() {
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const productId = card.getAttribute('data-product-id');
        
        // ✅ CORREÇÃO: Limpar interval existente
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
        
        // ✅ CORREÇÃO: Verificar se já tem listeners
        if (carouselEventsRegistered.has(productId)) {
            return;
        }
        
        carouselEventsRegistered.add(productId);
        
        let currentSlideIndex = 0;
        
        // ✅ CORREÇÃO: Usar função nomeada para poder remover listener
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
        
        // ✅ CORREÇÃO: Remover listeners antigos antes de adicionar novos
        card.removeEventListener('mouseenter', handleMouseEnter);
        card.removeEventListener('mouseleave', handleMouseLeave);
        
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
        ⚡ Comprar
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

// ==================== CARRINHO ====================

function addToCart(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        const productWithImage = {
            ...product,
            quantity: 1,
            image: product.images ? product.images[0] : (product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
        };
        cart.push(productWithImage);
    }
    
    saveCart();
    updateCartUI();
    trackEvent('E-commerce', 'Add to Cart', product.name);

    function quickBuy(productId) {
    addToCart(productId);
    setTimeout(() => {
        toggleCart();
        setTimeout(() => {
            checkout();
        }, 500);
    }, 600);
}
    
    // 🎬 ANIMAÇÃO DO CARD PARA O CARRINHO
    const clickedButton = event.target;
    if (clickedButton) {
        animateProductToCart(clickedButton, product);
    }
    
    // Feedback visual no botão
    const btn = clickedButton;
    const originalText = btn.textContent;
    const originalBg = btn.style.background;
    
    btn.textContent = '✓ Adicionado!';
    btn.style.background = '#27ae60';
    btn.style.transform = 'scale(1.05)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = originalBg;
        btn.style.transform = 'scale(1)';
    }, 2000);
    
    // Toast com delay
    setTimeout(() => {
        showToast(`${product.name} adicionado ao carrinho!`, 'success');
    }, 300);
    
    // Pequena animação no ícone do carrinho
    const cartIcon = document.querySelector('.nav-icon:last-child');
    if (cartIcon) {
        cartIcon.style.animation = 'none';
        setTimeout(() => {
            cartIcon.style.animation = 'heartBeat 0.5s';
        }, 10);
    }
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
                                ${item.selectedSize ? `Tamanho: <strong>${item.selectedSize}</strong>` : ''}
                                ${item.selectedSize && item.selectedColor ? ' | ' : ''}
                                ${item.selectedColor ? `Cor: <strong>${item.selectedColor}</strong>` : ''}
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
            
            // Atualizar total
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            cartTotal.textContent = `R$ ${total.toFixed(2)}`;
            cartFooter.style.display = 'block';
        }
    });
}

function updateQuantity(identifier, change) {
    const item = cart.find(i => {
        const itemId = i.cartItemId || i.id;
        return itemId === identifier;
    });
    
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(identifier);
        } else {
            saveCart();
            updateCartUI();
        }
    }
}

function removeFromCart(identifier) {
    cart = cart.filter(item => {
        const itemId = item.cartItemId || item.id;
        return itemId !== identifier;
    });
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
    const cartData = cart.map(item => ({
        id: item.id,
        quantity: item.quantity,
        selectedSize: item.selectedSize,
        selectedColor: item.selectedColor,
        cartItemId: item.cartItemId
    }));
    localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
}

function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if (saved) {
        try {
            const cartData = JSON.parse(saved);
            const validItems = [];
            
            cartData.forEach(item => {
                const product = productsData.find(p => p.id === item.id);
                
                if (!product) {
                    console.warn(`⚠️ Produto ${item.id} não encontrado, removendo do carrinho`);
                    return; // Pula este item
                }
                
                validItems.push({ 
    ...product, 
    quantity: item.quantity,
    selectedSize: item.selectedSize,
    selectedColor: item.selectedColor,
    cartItemId: item.cartItemId,
    image: getProductImage(product)
});
            });
            
            cart = validItems;
            
            // Se removeu algum item, salvar carrinho atualizado
            if (validItems.length !== cartData.length) {
                console.log(`🧹 Removidos ${cartData.length - validItems.length} itens inválidos do carrinho`);
                saveCart();
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar carrinho:', error);
            cart = [];
            localStorage.removeItem('sejaVersatilCart');
        }
    }
}

function checkout() {
    if (cart.length === 0) {
        showToast('Seu carrinho está vazio!', 'error');
        return;
    }
    
    openPaymentModal();
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

// ==================== FAVORITOS ====================

function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('Removido dos favoritos', 'info');
    } else {
        favorites.push(productId);
        showToast('Adicionado aos favoritos', 'success');
    }
    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    renderProducts();
}

function isFavorite(productId) {
    return favorites.includes(productId);
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
    
    window.addEventListener('beforeunload', (e) => {
        if (cart.length > 0) {
            e.preventDefault();
            e.returnValue = 'Você tem itens no carrinho. Deseja realmente sair?';
        }
    });
    
    setInterval(startCartTimer, 60000);
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

// ==================== CHECKOUT VIA WHATSAPP ====================

const WHATSAPP_NUMBER = '5571991427103'; // SEU NÚMERO COM DDI + DDD + NÚMERO

function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const cartItemsContainer = document.getElementById('paymentCartItems');
    const totalContainer = document.getElementById('paymentTotal');
    
    // Renderizar itens do carrinho
    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="payment-cart-item">
            <div>
                <div class="payment-cart-item-name">${sanitizeInput(item.name)}</div>
                <div class="payment-cart-item-details">Qtd: ${item.quantity} × R$ ${item.price.toFixed(2)}</div>
            </div>
            <div style="font-weight: 700;">
                R$ ${(item.price * item.quantity).toFixed(2)}
            </div>
        </div>
    `).join('');
    
    // Calcular e mostrar total
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalContainer.textContent = `R$ ${total.toFixed(2)}`;
    
    // Mostrar modal
    modal.classList.add('active');
    
    // Setup listeners para opções de pagamento
    setupPaymentListeners();
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function setupPaymentListeners() {
    const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
    const installmentsBox = document.getElementById('installmentsBox');
    
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

function sendToWhatsApp() {
    if (cart.length === 0) {
        showToast('Carrinho vazio!', 'error');
        return;
    }
    
    // Obter forma de pagamento selecionada
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const installments = document.getElementById('installments').value;
    
    // Mapear forma de pagamento para texto legível
    const paymentMethods = {
        'pix': 'PIX',
        'boleto': 'Boleto Bancário',
        'credito-avista': 'Cartão de Crédito à Vista',
        'credito-parcelado': `Cartão de Crédito Parcelado em ${installments}x sem juros`
    };
    
    const paymentText = paymentMethods[paymentMethod];
    
    // Calcular total
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Montar mensagem
    let message = `*🛍️ NOVO PEDIDO - SEJA VERSÁTIL*\n\n`;
    message += `*📦 PRODUTOS:*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    cart.forEach((item, index) => {
    message += `${index + 1}. *${item.name}*\n`;
    
    // ← ADICIONAR TAMANHO E COR
    if (item.selectedSize || item.selectedColor) {
        message += `   📏 Tamanho: ${item.selectedSize || 'Não selecionado'}\n`;
        message += `   🎨 Cor: ${item.selectedColor || 'Não selecionada'}\n`;
    }
    
    message += `   Qtd: ${item.quantity}\n`;
    message += `   Valor Unit.: R$ ${item.price.toFixed(2)}\n`;
    message += `   Subtotal: R$ ${(item.price * item.quantity).toFixed(2)}\n\n`;
});
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*💰 VALOR TOTAL: R$ ${total.toFixed(2)}*\n\n`;
    message += `*💳 FORMA DE PAGAMENTO:*\n`;
    message += `${paymentText}\n\n`;
    
    if (paymentMethod === 'credito-parcelado') {
        const installmentValue = (total / installments).toFixed(2);
        message += `📊 *${installments}x de R$ ${installmentValue}*\n\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `_Pedido gerado automaticamente via site_`;
    
    // Codificar mensagem para URL
    const encodedMessage = encodeURIComponent(message);
    
    // Montar URL do WhatsApp
    const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    // Abrir WhatsApp
    window.open(whatsappURL, '_blank');
    
    // Fechar modal e limpar carrinho
    closePaymentModal();
    showToast('Redirecionando para WhatsApp...', 'success');
    
    // Opcional: Limpar carrinho após envio
    setTimeout(() => {
        if (confirm('Pedido enviado! Deseja limpar o carrinho?')) {
            cart = [];
            saveCart();
            updateCartUI();
            toggleCart();
        }
    }, 2000);
    
    // Tracking
    trackEvent('E-commerce', 'Checkout WhatsApp', paymentText);
}

// Fechar modal ao clicar fora
document.addEventListener('click', function(e) {
    const modal = document.getElementById('paymentModal');
    if (e.target === modal) {
        closePaymentModal();
    }
});

// ==================== PRODUCT DETAILS PAGE ====================

let currentProductDetails = null;
let selectedColor = 'Rosa';
let selectedSize = 'M';
let selectedQuantity = 1;

function openProductDetails(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;
    
    currentProductDetails = product;
    const modal = document.getElementById('productDetailsModal');
    
    // Garantir que images seja array válido
    let images = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
        images = product.images;
    } else if (product.image) {
        images = [product.image];
    } else {
        images = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
    }
    
    // Renderizar galeria principal
    const mainImage = document.getElementById('mainProductImage');
    const firstImage = images[0];
    const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
    mainImage.style.backgroundImage = isRealImage ? `url('${firstImage}')` : firstImage;
    
    // Renderizar thumbnails
    const thumbnailList = document.getElementById('thumbnailList');
    thumbnailList.innerHTML = images.map((img, index) => {
        const isImg = img.startsWith('data:image') || img.startsWith('http');
        return `
            <div class="thumbnail ${index === 0 ? 'active' : ''}" 
                 onclick="changeMainImage('${img}', ${index})"
                 style="background-image: ${isImg ? `url('${img}')` : img}"></div>
        `;
    }).join('');
    
    // Preencher informações
    document.getElementById('detailsProductName').textContent = product.name;
    
    // Preços
    const priceOld = document.getElementById('detailsPriceOld');
    const priceNew = document.getElementById('detailsPriceNew');
    const installments = document.getElementById('detailsInstallments');
    
    if (product.oldPrice) {
        priceOld.textContent = `De R$ ${product.oldPrice.toFixed(2)}`;
        priceOld.style.display = 'block';
    } else {
        priceOld.style.display = 'none';
    }
    
    priceNew.textContent = `R$ ${product.price.toFixed(2)}`;
    
    const installmentValue = (product.price / 10).toFixed(2);
    installments.textContent = `ou 10x de R$ ${installmentValue} sem juros`;
    
    // Descrição
    document.getElementById('productDescription').textContent = 
        `${product.name} - Peça versátil e confortável para seus treinos. Tecnologia de alta performance com tecido respirável e secagem rápida.`;
    
    // Renderizar produtos relacionados
    renderRelatedProducts(product.category, product.id);
    
    // Resetar seleções
    selectedQuantity = 1;
    document.getElementById('productQuantity').value = 1;
    
    // Mostrar modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProductDetails() {
    const modal = document.getElementById('productDetailsModal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentProductDetails = null;
}

function changeMainImage(imageSrc, index) {
    const mainImage = document.getElementById('mainProductImage');
    
    // Validação
    if (!imageSrc) {
        console.error('Imagem inválida');
        return;
    }
    
    const isImg = imageSrc.startsWith('data:image') || imageSrc.startsWith('http');
    
    // Aplicar imagem/gradiente
    if (isImg) {
        mainImage.style.backgroundImage = `url('${imageSrc}')`;
        mainImage.style.backgroundSize = 'cover';
        mainImage.style.backgroundPosition = 'center';
    } else {
        mainImage.style.background = imageSrc;
    }
    
    // Atualizar thumbnails
    document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
    
    // Zoom (apenas para imagens reais)
    if (isImg) {
        mainImage.style.cursor = 'zoom-in';
        mainImage.onclick = () => {
            const zoomModal = document.createElement('div');
            zoomModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.95);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: zoom-out;
                animation: fadeIn 0.3s;
            `;
            
            zoomModal.innerHTML = `
                <img src="${imageSrc}" 
                     style="max-width: 95%; max-height: 95%; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);" 
                     alt="Zoom">
                <button style="position: absolute; top: 20px; right: 20px; background: white; border: none; width: 50px; height: 50px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">✕</button>
            `;
            
            zoomModal.onclick = () => {
                zoomModal.style.animation = 'fadeOut 0.3s';
                setTimeout(() => zoomModal.remove(), 300);
            };
            
            document.body.appendChild(zoomModal);
        };
    } else {
        mainImage.style.cursor = 'default';
        mainImage.onclick = null;
    }
}

function changeQuantity(delta) {
    const input = document.getElementById('productQuantity');
    let newValue = parseInt(input.value) + delta;
    
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    
    input.value = newValue;
    selectedQuantity = newValue;
}

function calculateShipping() {
    const zipCode = document.getElementById('zipCodeInput').value.replace(/\D/g, '');
    const resultsDiv = document.getElementById('shippingResults');
    
    if (zipCode.length !== 8) {
        showToast('Digite um CEP válido', 'error');
        return;
    }
    
    // Simulação de frete
    resultsDiv.innerHTML = `
        <div class="shipping-option">
            <div>
                <strong>PAC</strong><br>
                <small>Entrega em 5-10 dias úteis</small>
            </div>
            <strong>R$ 15,90</strong>
        </div>
        <div class="shipping-option">
            <div>
                <strong>SEDEX</strong><br>
                <small>Entrega em 2-4 dias úteis</small>
            </div>
            <strong>R$ 25,90</strong>
        </div>
        <div class="shipping-option">
            <div>
                <strong>GRÁTIS</strong><br>
                <small>Entrega em 7-12 dias úteis</small>
            </div>
            <strong>R$ 0,00</strong>
        </div>
    `;
    
    resultsDiv.classList.add('active');
}

// ==================== ANIMAÇÃO DE PRODUTO PARA CARRINHO ====================
function animateProductToCart(sourceElement, product) {
    // Pegar posição do botão de origem
    const sourceRect = sourceElement.getBoundingClientRect();
    
    // Pegar posição do ícone do carrinho
    const cartIcon = document.querySelector('.nav-icon:last-child .nav-icon-symbol');
    if (!cartIcon) return;
    
    const cartRect = cartIcon.getBoundingClientRect();
    
    // Criar elemento de animação (miniatura do produto)
    const flyingProduct = document.createElement('div');
    flyingProduct.style.cssText = `
        position: fixed;
        width: 80px;
        height: 100px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 9999;
        pointer-events: none;
        left: ${sourceRect.left + (sourceRect.width / 2) - 40}px;
        top: ${sourceRect.top + (sourceRect.height / 2) - 50}px;
        opacity: 1;
        transform: scale(1);
        transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        overflow: hidden;
        border: 2px solid var(--primary);
    `;
    
    // Adicionar imagem do produto
    const productImage = getProductImage(product);
    const isRealImage = productImage.startsWith('data:image') || productImage.startsWith('http');
    
    const imageDiv = document.createElement('div');
    imageDiv.style.cssText = `
        width: 100%;
        height: 100%;
        ${isRealImage ? `background-image: url('${productImage}'); background-size: cover; background-position: center;` : `background: ${productImage}`}
    `;
    
    flyingProduct.appendChild(imageDiv);
    document.body.appendChild(flyingProduct);
    
    // Forçar reflow para garantir que a animação funcione
    flyingProduct.offsetHeight;
    
    // Animar para o carrinho
    setTimeout(() => {
        flyingProduct.style.left = `${cartRect.left + (cartRect.width / 2) - 40}px`;
        flyingProduct.style.top = `${cartRect.top + (cartRect.height / 2) - 50}px`;
        flyingProduct.style.transform = 'scale(0.2) rotate(360deg)';
        flyingProduct.style.opacity = '0';
    }, 10);
    
    // Animação do ícone do carrinho (pulse)
    setTimeout(() => {
        const cartIconParent = document.querySelector('.nav-icon:last-child');
        if (cartIconParent) {
            cartIconParent.style.animation = 'none';
            setTimeout(() => {
                cartIconParent.style.animation = 'heartBeat 0.6s';
            }, 10);
        }
    }, 600);
    
    // Remover elemento após animação
    setTimeout(() => {
        flyingProduct.remove();
    }, 1000);
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
    } else {
        cart.push({
            ...product,
            cartItemId: cartItemId,
            quantity: selectedQuantity,
            selectedSize: selectedSize,
            selectedColor: selectedColor,
            image: product.images ? product.images[0] : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
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

// Listeners de seleção
document.addEventListener('click', function(e) {
    // Color selector
    if (e.target.classList.contains('color-option')) {
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
        e.target.classList.add('active');
        selectedColor = e.target.dataset.color;
    }
    
    // Size selector
    if (e.target.classList.contains('size-option')) {
        document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('active'));
        e.target.classList.add('active');
        selectedSize = e.target.dataset.size;
    }
});

// Máscara de CEP
document.addEventListener('input', function(e) {
    if (e.target.id === 'zipCodeInput') {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 5) {
            value = value.slice(0, 5) + '-' + value.slice(5, 8);
        }
        e.target.value = value;
    }
}); 
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
        console.log('🛑 Carousels pausados (aba inativa)');
    } else {
        carouselsPaused = false;
        startHeroCarousel();
        setupAutoCarousel();
        console.log('▶️ Carousels reativados (aba ativa)');
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

// SUBSTITUIR openProductDetails() existente por esta versão:
async function openProductDetails(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;
    
    currentProductDetails = product;
    const modal = document.getElementById('productDetailsModal');
    
    // Carregar variantes do produto
    await loadProductVariants(productId);
    
    // Garantir que images seja array válido
    let images = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
        images = product.images;
    } else if (product.image) {
        images = [product.image];
    } else {
        images = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
    }
    
    // Renderizar galeria principal
    const mainImage = document.getElementById('mainProductImage');
    const firstImage = images[0];
    const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
    mainImage.style.backgroundImage = isRealImage ? `url('${firstImage}')` : firstImage;
    
    // Renderizar thumbnails
    const thumbnailList = document.getElementById('thumbnailList');
    thumbnailList.innerHTML = images.map((img, index) => {
        const isImg = img.startsWith('data:image') || img.startsWith('http');
        return `
            <div class="thumbnail ${index === 0 ? 'active' : ''}" 
                 onclick="changeMainImage('${img}', ${index})"
                 style="background-image: ${isImg ? `url('${img}')` : img}"></div>
        `;
    }).join('');
    
    // Preencher informações
    document.getElementById('detailsProductName').textContent = product.name;
    
    // Preços
    const priceOld = document.getElementById('detailsPriceOld');
    const priceNew = document.getElementById('detailsPriceNew');
    const installments = document.getElementById('detailsInstallments');
    
    if (product.oldPrice) {
        priceOld.textContent = `De R$ ${product.oldPrice.toFixed(2)}`;
        priceOld.style.display = 'block';
    } else {
        priceOld.style.display = 'none';
    }
    
    priceNew.textContent = `R$ ${product.price.toFixed(2)}`;
    
    const installmentValue = (product.price / 10).toFixed(2);
    installments.textContent = `ou 10x de R$ ${installmentValue} sem juros`;
    
    // Descrição
    document.getElementById('productDescription').textContent = 
        `${product.name} - Peça versátil e confortável para seus treinos. Tecnologia de alta performance com tecido respirável e secagem rápida.`;
    
    // NOVO: Renderizar cores disponíveis dinamicamente
    await renderAvailableColors(productId);
    
    // NOVO: Renderizar tamanhos disponíveis dinamicamente
    await renderAvailableSizes(productId);
    
    // Renderizar produtos relacionados
    renderRelatedProducts(product.category, product.id);
    
    // Resetar seleções
    selectedQuantity = 1;
    document.getElementById('productQuantity').value = 1;
    
    // Mostrar modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Renderizar cores disponíveis
async function renderAvailableColors(productId) {
    const variants = productVariants[productId] || [];
    const colorSelector = document.getElementById('colorSelector');
    
    if (!colorSelector) return;
    
    // Cores únicas disponíveis
    const availableColors = [...new Set(variants.map(v => v.color))];
    
    const colorMap = {
        'Rosa': '#FFB6C1',
        'Preto': '#000000',
        'Azul': '#4169E1',
        'Verde': '#32CD32',
        'Branco': '#FFFFFF',
        'Vermelho': '#DC143C',
        'Amarelo': '#FFD700'
    };
    
    colorSelector.innerHTML = availableColors.map((color, index) => {
        const bgColor = colorMap[color] || '#999';
        const hasStock = variants.some(v => v.color === color && v.stock > 0);
        
        return `
            <div class="color-option ${index === 0 ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                 data-color="${color}"
                 style="background: ${bgColor}; ${!hasStock ? 'opacity: 0.3; cursor: not-allowed;' : ''}"
                 onclick="${hasStock ? `selectColor('${color}')` : 'event.preventDefault()'}">
                ${!hasStock ? '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5rem; color: red;">✕</span>' : ''}
            </div>
        `;
    }).join('');
    
    // Selecionar primeira cor disponível
    const firstAvailable = availableColors.find(color => 
        variants.some(v => v.color === color && v.stock > 0)
    );
    if (firstAvailable) {
        selectedColor = firstAvailable;
    }
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
                ${hasStock ? `<br><small style="font-size: 0.7rem; opacity: 0.7;">${stock} un.</small>` : '<br><small style="font-size: 0.7rem; color: red;">Esgotado</small>'}
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

// Selecionar cor
function selectColor(color) {
    selectedColor = color;
    
    // Atualizar visual
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.color === color);
    });
    
    // Atualizar tamanhos disponíveis para essa cor
    if (currentProductDetails) {
        renderAvailableSizes(currentProductDetails.id);
    }
}

// Selecionar tamanho
function selectSize(size) {
    // Verificar se está disponível
    if (!isVariantAvailable(currentProductDetails.id, size, selectedColor)) {
        showToast('Este tamanho está esgotado', 'error');
        return;
    }
    
    selectedSize = size;
    
    // Atualizar visual
    document.querySelectorAll('.size-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.size === size);
    });
    
    // Mostrar estoque
    const stock = getVariantStock(currentProductDetails.id, size, selectedColor);
    showToast(`✅ ${stock} unidades disponíveis`, 'info');
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
            image: product.images ? product.images[0] : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
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

// Carregar variantes ao carregar produtos
const originalLoadProducts = loadProducts;
loadProducts = async function() {
    await originalLoadProducts();
    
    // Pré-carregar variantes dos primeiros produtos
    const firstProducts = productsData.slice(0, 12);
    for (const product of firstProducts) {
        await loadProductVariants(product.id);
    }
};

console.log('✅ Sistema de estoque integrado ao site');

// ==================== FIM DO ARQUIVO ====================










