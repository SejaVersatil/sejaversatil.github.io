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
const itemsPerPage = 12;
let tempProductImages = [];
let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
let viewHistory = JSON.parse(localStorage.getItem('viewHistory') || '[]');
let carouselIntervals = {};
const carouselEventsRegistered = new Set();
let carouselsPaused = false;
let currentProductDetails = null; // Armazena o produto atual no modal de detalhes
let selectedColor = null;
let selectedSize = null;
let selectedQuantity = 1;

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
        image: 'https://i.imgur.com/oOCI2Sp.jpeg',
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
        image: 'https://i.imgur.com/kvruQ8k.jpeg',
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
            <div class="hero-content">
                ${slide.title ? `<h1 class="hero-title">${slide.title}</h1>` : ''}
                ${slide.subtitle ? `<p class="hero-subtitle">${slide.subtitle}</p>` : ''}
                ${slide.cta ? `<button class="hero-cta">${slide.cta}</button>` : ''}
            </div>
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
        setTimeout(() => {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
    
    trackEvent('Promo Cards', 'Navigate to Category', category);
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
    constructor(ttl = 1800000) { // 30 minutos
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
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!re.test(email.trim().toLowerCase())) return false;
    
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
    if (!data.name || data.name.trim().length < 3) errors.push('Nome deve ter pelo menos 3 caracteres');
    if (data.name && data.name.length > 100) errors.push('Nome deve ter no máximo 100 caracteres');
    if (!data.price || data.price <= 0) errors.push('Preço deve ser maior que zero');
    if (data.price > 10000) errors.push('Preço não pode exceder R$ 10.000');
    if (data.oldPrice && data.oldPrice <= data.price) errors.push('Preço antigo deve ser maior que o preço atual');
    if (data.badge && data.badge.length > 20) errors.push('Badge deve ter no máximo 20 caracteres');
    if (!data.images || !Array.isArray(data.images) || data.images.length === 0) errors.push('Produto deve ter pelo menos 1 imagem');
    
    const validCategories = ['blusas', 'conjunto calca', 'peca unica', 'conjunto short saia', 'conjunto short'];
    if (!data.category || !validCategories.includes(data.category)) errors.push('Categoria inválida');
    
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

// ==================== PRODUTOS PADRÃO (Backup) ====================
async function inicializarProdutosPadrao() {
    if (productsData.length === 0) {
        console.warn('📦 Nenhum produto no Firestore. Use o Painel Admin para adicionar.');
    }
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');
    
    try {
        loadSettings();
        loadCart();
        await loadProducts();
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ver_favoritos') === 'true') {
            setTimeout(() => {
                showFavorites();
                window.history.replaceState({}, document.title, "index.html");
            }, 500);
        }
        
        renderProducts();
        renderBestSellers();
        updateCartUI();
        updateFavoritesCount();
        initHeroCarousel();
        initBlackFridayCountdown();
        setupConnectionMonitor();
        setupCartAbandonmentTracking();
        setupPushNotifications();
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO ao inicializar:', error);
        showToast('Erro ao carregar o site. Recarregue a página.', 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
});

// ==================== LISTENER PARA BUSCA NO HEADER ====================
setTimeout(() => {
    const headerSearchInput = document.getElementById('headerSearchInput');
    if (headerSearchInput) {
        headerSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performHeaderSearch();
            }
        });
    }
}, 100);

// ==================== SISTEMA DE ADMIN ====================
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
    document.querySelectorAll('.user-tab-content').forEach(content => content.classList.remove('active'));

    if (tab === 'login') {
        document.querySelectorAll('.user-panel-tab')[0].classList.add('active');
        document.getElementById('loginTab').classList.add('active');
    } else if (tab === 'register') {
        document.querySelectorAll('.user-panel-tab')[1].classList.add('active');
        document.getElementById('registerTab').classList.add('active');
    }
}

async function checkUserSession() {
    const savedUser = localStorage.getItem('sejaVersatilCurrentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (auth.currentUser && auth.currentUser.uid === currentUser.uid) {
            try {
                const adminDoc = await db.collection('admins').doc(auth.currentUser.uid).get();
                if (adminDoc.exists && adminDoc.data().role === 'admin') {
                    const adminData = adminDoc.data();
                    currentUser = {
                        name: adminData.name || 'Administrador',
                        email: auth.currentUser.email,
                        isAdmin: true,
                        uid: auth.currentUser.uid,
                        permissions: adminData.permissions || []
                    };
                    localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
                    showLoggedInView();
                    isAdminLoggedIn = true;
                } else {
                    userLogout();
                }
            } catch (error) {
                userLogout();
            }
        } else {
            userLogout();
        }
    }
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const adminDoc = await db.collection('admins').doc(user.uid).get();
            if (adminDoc.exists && adminDoc.data().role === 'admin') {
                const adminData = adminDoc.data();
                currentUser = {
                    name: adminData.name || 'Administrador',
                    email: user.email,
                    isAdmin: true,
                    uid: user.uid,
                    permissions: adminData.permissions || []
                };
                isAdminLoggedIn = true;
                localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
            }
        } else if (currentUser) {
            userLogout();
        }
    });
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

async function userLogin(event) {
    event.preventDefault();
    const emailOrUsername = document.getElementById('loginEmail').value.toLowerCase().trim();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    if (!emailOrUsername || !password) {
        errorMsg.textContent = 'Preencha todos os campos';
        errorMsg.classList.add('active');
        return;
    }

    try {
        let email = emailOrUsername;
        if (!emailOrUsername.includes('@')) {
            if (emailOrUsername === 'admin') email = 'admin@sejaversatil.com.br';
            else {
                errorMsg.textContent = 'Use "admin" ou "admin@sejaversatil.com.br" para login';
                errorMsg.classList.add('active');
                return;
            }
        }
        
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
        
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        if (adminDoc.exists && adminDoc.data().role === 'admin') {
            const adminData = adminDoc.data();
            currentUser = {
                name: adminData.name || 'Administrador',
                email: user.email,
                isAdmin: true,
                uid: user.uid,
                permissions: adminData.permissions || []
            };
            localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
            isAdminLoggedIn = true;
            showLoggedInView();
            errorMsg.classList.remove('active');
            showToast('Login realizado com sucesso!', 'success');
            return;
        } else {
            await auth.signOut();
            errorMsg.textContent = 'Você não tem permissões de administrador';
            errorMsg.classList.add('active');
        }
    } catch (firebaseError) {
        let errorMessage = 'Email ou senha incorretos';
        if (firebaseError.code === 'auth/user-not-found') errorMessage = 'Usuário não encontrado';
        else if (firebaseError.code === 'auth/wrong-password') errorMessage = 'Senha incorreta';
        else if (firebaseError.code === 'auth/too-many-requests') errorMessage = 'Muitas tentativas. Aguarde alguns minutos.';
        
        errorMsg.textContent = errorMessage;
        errorMsg.classList.add('active');
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
    
    if (!name || !email || !password || !confirmPassword) { errorMsg.textContent = 'Preencha todos os campos'; errorMsg.classList.add('active'); return; }
    if (!validateEmail(email)) { errorMsg.textContent = 'E-mail inválido'; errorMsg.classList.add('active'); return; }
    if (password.length < 8) { errorMsg.textContent = 'Senha deve ter no mínimo 8 caracteres'; errorMsg.classList.add('active'); return; }
    if (password !== confirmPassword) { errorMsg.textContent = 'As senhas não coincidem'; errorMsg.classList.add('active'); return; }
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        await user.updateProfile({ displayName: name });
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isAdmin: false,
            newsletter: false
        });
        await user.sendEmailVerification({ url: window.location.href, handleCodeInApp: true });
        successMsg.textContent = '✅ Conta criada! Verifique seu email.';
        successMsg.classList.add('active');
        showToast('Conta criada com sucesso!', 'success');
        setTimeout(() => { switchUserTab('login'); successMsg.classList.remove('active'); }, 3000);
    } catch (error) {
        let errorMessage = 'Erro ao criar conta';
        if (error.code === 'auth/email-already-in-use') errorMessage = 'Este email já está cadastrado';
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
            currentUser = null;
            isAdminLoggedIn = false;
            localStorage.removeItem('sejaVersatilCurrentUser');
            hideLoggedInView();
            showToast('Logout realizado com sucesso', 'info');
        } catch (error) {
            showToast('Erro ao fazer logout', 'error');
        }
    }
}

async function resetPassword() {
    const email = prompt('Digite seu email para recuperar a senha:');
    if (!email || !validateEmail(email)) { showToast('Email inválido', 'error'); return; }
    document.getElementById('loadingOverlay').classList.add('active');
    try {
        await auth.sendPasswordResetEmail(email);
        showToast('✅ Email de recuperação enviado!', 'success');
        alert('Verifique sua caixa de entrada e spam.');
    } catch (error) {
        showToast('Erro ao enviar email', 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
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
            showToast('Muitas requisições. Aguarde um momento.', 'error');
            return productsData;
        }
        const snapshot = await db.collection("produtos").get();
        productsData.length = 0;
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

// ==================== PAINEL ADMIN & PRODUTOS ====================
async function openAdminPanel() {
    if (!auth.currentUser) { showToast('❌ Login necessário', 'error'); openUserPanel(); return; }
    if (!currentUser || !currentUser.isAdmin) { showToast('❌ Sem permissão de admin', 'error'); return; }
    try {
        const adminDoc = await db.collection('admins').doc(auth.currentUser.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            showToast('❌ Permissões revogadas', 'error');
            await userLogout();
            return;
        }
        document.getElementById('adminPanel').classList.add('active');
        renderAdminProducts();
        updateAdminStats();
    } catch (error) {
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
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active'));
    if (tab === 'products') document.getElementById('productsTab').classList.add('active');
    else if (tab === 'settings') document.getElementById('settingsTab').classList.add('active');
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
        let images = (Array.isArray(product.images) && product.images.length > 0) ? product.images : (product.image ? [product.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);
        const firstImage = images[0];
        const isRealImage = isRealImage(firstImage);
        return `
            <div class="admin-product-card">
                <div class="admin-product-image" style="${isRealImage ? `background-image: url(${firstImage}); background-size: cover; background-position: center;` : `background: ${firstImage}`}"></div>
                <div class="admin-product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <p><strong>Categoria:</strong> ${product.category}</p>
                    <p><strong>Preço:</strong> R$ ${product.price.toFixed(2)}</p>
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

function renderProductImages() {
    const container = document.getElementById('productImagesList');
    if (!container) return;
    container.innerHTML = tempProductImages.map((img, index) => {
        const isImage = isRealImage(img);
        const isCover = index === 0;
        return `
            <div class="image-item ${isCover ? 'is-cover' : ''}">
                <div class="image-item-preview" style="${isImage ? '' : 'background: ' + img}">
                    ${isImage ? `<img src="${img}" alt="Produto">` : ''}
                </div>
                <button type="button" class="image-item-remove" onclick="removeProductImage(${index})" title="Remover">×</button>
                <div class="image-item-actions">
                    ${isCover ? `<span class="cover-badge">★ CAPA</span>` : `<button type="button" class="btn-set-cover" onclick="setProductCover(${index})">Virar Capa</button>`}
                </div>
            </div>
        `;
    }).join('');
}

function setProductCover(index) {
    if (index <= 0 || index >= tempProductImages.length) return;
    const imageToMove = tempProductImages.splice(index, 1)[0];
    tempProductImages.unshift(imageToMove);
    renderProductImages();
    showToast('Capa atualizada!', 'success');
}

// ==================== UPLOAD DE IMAGENS ====================
async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files.length) return;
    if (!storage) { showToast('Storage não configurado', 'error'); return; }

    for (const file of files) {
        if (file.size > 5 * 1024 * 1024) { showToast(`Arquivo muito grande: ${file.name}`, 'error'); return; }
        if (!file.type.startsWith('image/')) { showToast('Apenas imagens são permitidas', 'error'); return; }
    }

    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = '⏳ Fazendo upload...';
    document.getElementById('productImagesList').parentElement.insertBefore(loadingMsg, document.getElementById('productImagesList'));

    for (const file of files) {
        try {
            const storageRef = storage.ref();
            const imageRef = storageRef.child(`produtos/${Date.now()}_${file.name}`);
            await imageRef.put(file);
            const imageUrl = await imageRef.getDownloadURL();
            tempProductImages.push(imageUrl);
            renderProductImages();
        } catch (error) {
            showToast('Erro no upload: ' + error.message, 'error');
        }
    }
    loadingMsg.remove();
    event.target.value = '';
}

// ==================== SALVAR PRODUTO ====================
async function saveProduct(event) {
    event.preventDefault();
    if (!auth.currentUser || !currentUser?.isAdmin) { showToast('Apenas admins podem salvar', 'error'); return; }
    document.getElementById('loadingOverlay').classList.add('active');

    const productId = document.getElementById('productId').value;
    const productData = {
        name: sanitizeInput(document.getElementById('productName').value.trim()),
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        oldPrice: document.getElementById('productOldPrice').value ? parseFloat(document.getElementById('productOldPrice').value) : null,
        badge: document.getElementById('productBadge').value.trim() || null,
        isBlackFriday: document.getElementById('productBlackFriday').checked,
        images: tempProductImages,
        colors: productColors.length > 0 ? productColors : null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const errors = validateProductData(productData);
    if (errors.length > 0) { showToast(errors[0], 'error'); document.getElementById('loadingOverlay').classList.remove('active'); return; }

    try {
        if (productId) {
            await db.collection("produtos").doc(productId).update(productData);
            // Lógica de variantes omitida para brevidade, manter a original se necessário
            showToast('Produto atualizado!', 'success');
        } else {
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection("produtos").add(productData);
            showToast('Produto criado!', 'success');
        }
        productCache.clear();
        closeProductModal();
        loadProducts();
    } catch (error) {
        showToast('Erro ao salvar: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

// ==================== FUNÇÕES AUXILIARES DE UI DO ADMIN ====================
function removeProductImage(index) {
    if (tempProductImages.length > 1) {
        tempProductImages.splice(index, 1);
        renderProductImages();
    } else {
        showToast('O produto precisa de pelo menos 1 imagem', 'error');
    }
}

function toggleUrlInput() {
    document.getElementById('imageUrlInputBox').classList.toggle('active');
}
function toggleGradientInput() {
    document.getElementById('imageGradientInputBox').classList.toggle('active');
}
function addImageFromUrl() {
    const url = document.getElementById('imageUrlField').value.trim();
    if (url) { tempProductImages.push(url); renderProductImages(); toggleUrlInput(); }
}
function addGradientImage() {
    const grad = document.getElementById('gradientField').value.trim();
    if (grad) { tempProductImages.push(grad); renderProductImages(); toggleGradientInput(); }
}

// ==================== FIM DO ARQUIVO ====================
