// =============================================================================
// SCRIPT MESTRE - SEJA VERSÁTIL (HOME + GLOBAL + ADMIN)
// Versão Limpa e Unificada
// =============================================================================

// --- 1. CONFIGURAÇÃO GLOBAL E FIREBASE ---
const db = window.db || firebase.firestore();
const auth = window.auth || firebase.auth();
const storage = window.storage || firebase.storage();

// --- 2. ESTADO DA APLICAÇÃO ---
const state = {
    products: [],
    cart: [],
    currentFilter: 'all',
    currentUser: null,
    heroInterval: null,
    heroIndex: 0,
    // Variáveis de Produto (caso script rode na pág de detalhes)
    currentProductDetails: null
};

// --- 3. STORAGE SEGURO E CACHE ---
class SecureStorage {
    constructor(key) { this.key = key; }
    encrypt(data) { return btoa(encodeURIComponent(JSON.stringify(data))); }
    decrypt(data) { try { return JSON.parse(decodeURIComponent(atob(data))); } catch { return null; } }
    set(key, value) { localStorage.setItem(key, this.encrypt(value)); }
    get(key) { const data = localStorage.getItem(key); return data ? this.decrypt(data) : null; }
}

const productCache = new Map(); // Cache simples em memória para sessão

// --- 4. LÓGICA DE BUSCA VIA URL (REDIRECIONAMENTO) ---
const urlParams = new URLSearchParams(window.location.search);
const searchTerm = urlParams.get('search');

if (searchTerm) {
    const headerInput = document.getElementById('headerSearchInput');
    if (headerInput) {
        headerInput.value = searchTerm;
        setTimeout(() => {
            performHeaderSearch();
            document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
        }, 800);
    }
}

// --- 5. LÓGICA DE HASH (AÇÕES DE BOTÕES) ---
const hash = window.location.hash;

if (hash === '#login') setTimeout(openUserPanel, 500);
else if (hash === '#favorites') setTimeout(showFavorites, 800);
else if (hash === '#cart') setTimeout(toggleCart, 500);

// --- 6. SCRIPTS AUXILIARES ---
setupConnectionMonitor();
setupCartAbandonmentTracking();
setupPushNotifications();


// =============================================================================
// MÓDULO DE PRODUTOS (FIRESTORE & RENDERIZAÇÃO)
// =============================================================================

async function loadProducts() {
    try {
        // Tenta cache primeiro (localStorage para persistência rápida)
        const cached = localStorage.getItem('sejaVersatilProducts');
        if (cached) {
            state.products = JSON.parse(cached);
            renderProducts();
            renderBestSellers();
        }

        // Busca atualizada do Firestore
        const snapshot = await db.collection("produtos").orderBy('createdAt', 'desc').limit(100).get();
        const freshProducts = [];
        snapshot.forEach(doc => freshProducts.push({ id: doc.id, ...doc.data() }));
        
        // Atualiza estado e cache
        state.products = freshProducts;
        localStorage.setItem('sejaVersatilProducts', JSON.stringify(state.products));
        
        // Re-renderiza com dados frescos
        renderProducts();
        renderBestSellers();
        
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
    }
}

// Renderiza Grid Principal
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    let filtered = getFilteredProducts();
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:#666;">Nenhum produto encontrado.</div>';
        return;
    }

    grid.innerHTML = filtered.map(product => {
        const imgUrl = getSafeImageUrl(product);
        const price = safeNumber(product.price);
        const oldPrice = safeNumber(product.oldPrice);
        const isFav = isFavorite(product.id);
        const discountPercent = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${product.id}')">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    
                    <img src="${imgUrl}" alt="${sanitizeInput(product.name)}" loading="lazy" 
                         style="width:100%; height:100%; object-fit:cover; display:block;"
                         onerror="this.src='https://via.placeholder.com/400x500?text=Sem+Foto'">
                    
                    ${product.isBlackFriday && discountPercent > 0 ? `
                        <div class="bf-product-badge" style="position:absolute; bottom:10px; left:10px; pointer-events:none;">
                            <div class="bf-badge-content" style="background:black; color:white; padding:5px 10px; border-radius:4px;">
                                <span style="font-weight:900; color:#FF6B35;">-${discountPercent}%</span> BLACK
                            </div>
                        </div>
                    ` : ''}
                    
                    ${product.badge && !product.isBlackFriday ? `<span class="product-badge" style="position:absolute;top:10px;left:10px;background:black;color:white;padding:5px;font-size:0.7rem;">${sanitizeInput(product.badge)}</span>` : ''}
                    
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
}

// Renderiza Mais Vendidos (Best Sellers)
function renderBestSellers() {
    const grid = document.getElementById('bestSellersGrid');
    if (!grid) return;

    const best = state.products.filter(p => p.oldPrice).slice(0, 6); // Produtos com desconto são destaque
    
    if (best.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#999;">Confira nossas novidades!</div>';
        return;
    }

    grid.innerHTML = best.map(product => {
        const imgUrl = getSafeImageUrl(product);
        const price = safeNumber(product.price);
        const oldPrice = safeNumber(product.oldPrice);

        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                    <img src="${imgUrl}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://via.placeholder.com/400x500?text=Img'">
                    <div style="position:absolute; top:10px; right:10px; background:#e74c3c; color:white; padding:4px 8px; font-weight:bold; font-size:0.7rem; border-radius:4px;">OFERTA</div>
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart('${product.id}')">ADICIONAR</button>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    <div class="product-price">
                        <span class="price-old">R$ ${oldPrice.toFixed(2)}</span>
                        <span class="price-new">R$ ${price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// =============================================================================
// MÓDULO DE CARRINHO E CHECKOUT
// =============================================================================

function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if (saved) state.cart = JSON.parse(saved);
}

function saveCart() {
    localStorage.setItem('sejaVersatilCart', JSON.stringify(state.cart));
    updateCartUI();
}

function addToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    // Adiciona item genérico
    const cartItem = {
        ...product,
        id: product.id,
        quantity: 1,
        cartItemId: `${product.id}_generic`,
        image: getSafeImageUrl(product)
    };

    const existing = state.cart.find(i => i.cartItemId === cartItem.cartItemId);
    if (existing) existing.quantity++;
    else state.cart.push(cartItem);

    saveCart();
    updateCartUI();
    toggleCart();
    
    // Animação
    if (event && event.target) animateProductToCart(event.target, product);
    showToast('Produto adicionado!', 'success');
}

function updateCartUI() {
    const count = document.getElementById('cartCount');
    const items = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const footer = document.getElementById('cartFooter');

    // Atualiza contador
    const totalQty = state.cart.reduce((acc, item) => acc + item.quantity, 0);
    if (count) {
        count.textContent = totalQty;
        count.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    if (!items) return;

    if (state.cart.length === 0) {
        items.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
        if (footer) footer.style.display = 'none';
        return;
    }

    if (footer) footer.style.display = 'block';
    
    let totalPrice = 0;
    items.innerHTML = state.cart.map(item => {
        totalPrice += (item.price * item.quantity);
        const img = item.image || 'https://via.placeholder.com/70';
        
        return `
            <div class="cart-item">
                <div class="cart-item-img" style="background-image: url('${img}'); background-size:cover; background-position:center;"></div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${sanitizeInput(item.name)}</div>
                    ${item.selectedSize ? `<small style="color:#666">${item.selectedSize} | ${item.selectedColor}</small>` : ''}
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

    if (totalEl) totalEl.textContent = `R$ ${totalPrice.toFixed(2)}`;
}

function updateQuantity(itemId, change) {
    const item = state.cart.find(i => i.cartItemId === itemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) removeFromCart(itemId);
        else saveCart();
    }
}

function removeFromCart(itemId) {
    state.cart = state.cart.filter(i => i.cartItemId !== itemId);
    saveCart();
}

function toggleCart() {
    document.getElementById('cartSidebar')?.classList.toggle('active');
    document.getElementById('cartOverlay')?.classList.toggle('active');
}

function checkout() {
    if (state.cart.length === 0) return showToast('Carrinho vazio', 'error');
    document.getElementById('paymentModal').classList.add('active');
}

// =============================================================================
// MÓDULO DE FAVORITOS E FILTROS
// =============================================================================

function toggleFavorite(id) {
    const favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    const index = favorites.indexOf(id);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('Removido dos favoritos');
    } else {
        favorites.push(id);
        showToast('Adicionado aos favoritos', 'success');
    }
    
    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    updateFavoritesCount();
    renderProducts(); // Atualiza corações na tela
    
    if (state.currentFilter === 'favorites') showFavorites();
}

function isFavorite(id) {
    const favs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    return favs.includes(id);
}

function updateFavoritesCount() {
    const favCount = document.getElementById('favoritesCount');
    const favs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    if (favCount) {
        favCount.textContent = favs.length;
        favCount.style.display = favs.length > 0 ? 'flex' : 'none';
    }
}

function showFavorites() {
    state.currentFilter = 'favorites';
    renderProducts();
    
    const badge = document.getElementById('activeCategoryBadge');
    const text = document.getElementById('categoryNameDisplay');
    if (badge && text) {
        text.textContent = '❤️ Meus Favoritos';
        badge.style.display = 'flex';
    }
    document.getElementById('produtos')?.scrollIntoView({behavior: 'smooth'});
}

function navigateToCategory(cat) {
    state.currentFilter = cat;
    renderProducts();
    
    const badge = document.getElementById('activeCategoryBadge');
    const text = document.getElementById('categoryNameDisplay');
    if (badge && text) {
        badge.style.display = 'flex';
        text.textContent = cat === 'all' ? 'Todos' : cat.toUpperCase();
    }
    document.getElementById('produtos')?.scrollIntoView({behavior: 'smooth'});
}

function clearCategoryFilter() {
    state.currentFilter = 'all';
    renderProducts();
    document.getElementById('activeCategoryBadge').style.display = 'none';
}

function getFilteredProducts() {
    let filtered = state.products;
    if (state.currentFilter !== 'all') {
        if (state.currentFilter === 'favorites') {
            const favs = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
            filtered = filtered.filter(p => favs.includes(p.id));
        } else {
            filtered = filtered.filter(p => p.category === state.currentFilter);
        }
    }
    return filtered;
}

// =============================================================================
// MÓDULO DE BUSCA
// =============================================================================

function performHeaderSearch() {
    const input = document.getElementById('headerSearchInput');
    if (!input) return;
    
    const term = input.value.toLowerCase().trim();
    if (term.length < 2) return showToast('Digite pelo menos 2 letras', 'info');
    
    const filtered = state.products.filter(p => 
        p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
    );
    
    if (filtered.length === 0) return showToast('Nada encontrado', 'error');
    
    // Renderiza apenas o resultado da busca (Bypass no filtro global)
    const grid = document.getElementById('productsGrid');
    if (grid) {
        grid.innerHTML = filtered.map(product => {
            const imgUrl = getSafeImageUrl(product);
            const price = safeNumber(product.price);
            return `
                <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                    <div class="product-image"><img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover"></div>
                    <div class="product-info"><h4>${product.name}</h4><span>R$ ${price.toFixed(2)}</span></div>
                </div>
            `;
        }).join('');
        
        document.getElementById('categoryNameDisplay').textContent = `🔍 "${term}"`;
        document.getElementById('activeCategoryBadge').style.display = 'flex';
        document.getElementById('produtos').scrollIntoView({behavior: 'smooth'});
    }
}

// =============================================================================
// MÓDULO DE USUÁRIO E ADMIN (Painéis e Permissões)
// =============================================================================

function openUserPanel() {
    const panel = document.getElementById('userPanel');
    if (!panel) return;
    
    panel.classList.add('active');
    if (auth.currentUser) {
        checkUserSession();
    } else {
        document.getElementById('loginTab').style.display = 'block';
        document.getElementById('userLoggedTab').style.display = 'none';
    }
}

function closeUserPanel() {
    document.getElementById('userPanel')?.classList.remove('active');
}

function checkUserSession() {
    const user = auth.currentUser;
    if (user) {
        // Verifica se é admin pelo email (Simples) ou Firestore (Robusto)
        document.getElementById('loginTab').style.display = 'none';
        document.getElementById('registerTab').style.display = 'none';
        document.getElementById('userLoggedTab').style.display = 'block';
        document.getElementById('userName').textContent = user.email;
        
        if (user.email.includes('admin')) { // Lógica simples de admin
            isAdminLoggedIn = true;
            document.getElementById('adminAccessBtn').style.display = 'block';
        }
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
        openUserPanel(); // Atualiza UI
    } catch (err) {
        alert('Erro de login: ' + err.message);
    }
}

async function userRegister(e) {
    e.preventDefault();
    const pass = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirmPassword').value;
    if (pass !== confirm) return alert('Senhas não conferem');
    
    try {
        await auth.createUserWithEmailAndPassword(
            document.getElementById('registerEmail').value,
            pass
        );
        // Opcional: Atualizar nome
        const name = document.getElementById('registerName').value;
        if (auth.currentUser) await auth.currentUser.updateProfile({displayName: name});
        
        showToast('Conta criada!');
        openUserPanel();
    } catch (err) {
        alert('Erro no cadastro: ' + err.message);
    }
}

function userLogout() {
    auth.signOut();
    isAdminLoggedIn = false;
    closeUserPanel();
    showToast('Logout realizado');
    setTimeout(() => window.location.reload(), 500);
}

function switchUserTab(tab) {
    document.querySelectorAll('.user-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');
}

// --- PAINEL ADMIN ---
function openAdminPanel() {
    document.getElementById('adminPanel').classList.add('active');
    renderAdminProducts();
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('active');
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');
}

function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if (!grid) return;
    grid.innerHTML = state.products.map(p => `
        <div class="admin-product-card">
            <div style="height:150px; background-image:url('${getSafeImageUrl(p)}'); background-size:cover;"></div>
            <h4>${p.name}</h4>
            <p>R$ ${p.price}</p>
            <button onclick="openProductModal('${p.id}')">Editar</button>
            <button onclick="deleteProduct('${p.id}')" style="background:red;color:white">Excluir</button>
        </div>
    `).join('');
}

// --- CRUD PRODUTO (COM UPLOAD E CORES) ---
async function saveProduct(e) {
    e.preventDefault();
    if (!isAdminLoggedIn) return alert('Apenas admin');

    const id = document.getElementById('productId').value;
    const data = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        oldPrice: parseFloat(document.getElementById('productOldPrice').value) || null,
        badge: document.getElementById('productBadge').value,
        isBlackFriday: document.getElementById('productBlackFriday')?.checked,
        // Usa tempProductImages (upload/url) ou campo input direto
        images: tempProductImages.length > 0 ? tempProductImages : 
               (document.getElementById('imageUrlField').value ? [document.getElementById('imageUrlField').value] : []),
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
    if (confirm('Excluir permanentemente?')) {
        await db.collection("produtos").doc(id).delete();
        loadProducts();
        renderAdminProducts();
    }
}

function openProductModal(id = null) {
    document.getElementById('productModal').classList.add('active');
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    tempProductImages = [];
    productColors = [];
    document.getElementById('productImagesList').innerHTML = '';
    document.getElementById('productColorsManager').innerHTML = '';

    if (id) {
        const p = state.products.find(x => x.id === id);
        if (p) {
            document.getElementById('productId').value = p.id;
            document.getElementById('productName').value = p.name;
            document.getElementById('productCategory').value = p.category;
            document.getElementById('productPrice').value = p.price;
            document.getElementById('productOldPrice').value = p.oldPrice || '';
            document.getElementById('productBadge').value = p.badge || '';
            if (p.images) { tempProductImages = p.images; renderProductImages(); }
            if (p.colors) { productColors = p.colors; renderProductColorsManager(); }
        }
    }
}

function closeProductModal() { document.getElementById('productModal').classList.remove('active'); }

// Funções Auxiliares do Modal de Produto
function addImageFromUrl() {
    const url = document.getElementById('imageUrlField').value;
    if (url) {
        tempProductImages.push(url);
        renderProductImages();
        document.getElementById('imageUrlField').value = '';
    }
}

function renderProductImages() {
    const c = document.getElementById('productImagesList');
    if (c) c.innerHTML = tempProductImages.map((img, i) => 
        `<div class="image-item" style="display:inline-block; margin:5px;">
            <img src="${img}" style="width:50px; height:50px; object-fit:cover;">
            <button type="button" onclick="tempProductImages.splice(${i},1);renderProductImages()" style="background:red;color:white;border:none;">x</button>
        </div>`
    ).join('');
}

// Cores (Simples)
function addColorToProduct() {
    const name = prompt("Nome da Cor:");
    const hex = prompt("Hex da Cor (#000):");
    if(name && hex) {
        productColors.push({ name, hex, images: [...tempProductImages] }); // Associa imagens atuais à cor
        tempProductImages = []; // Limpa para a próxima cor
        renderProductImages();
        renderProductColorsManager();
    }
}

function renderProductColorsManager() {
    const c = document.getElementById('productColorsManager');
    if (c) c.innerHTML = productColors.map((col, i) => 
        `<div><span style="background:${col.hex};width:15px;height:15px;display:inline-block;"></span> ${col.name} (${col.images.length} fotos) <button type="button" onclick="productColors.splice(${i},1);renderProductColorsManager()">x</button></div>`
    ).join('');
}

// ==================== OUTRAS FUNCIONALIDADES ====================
const heroSlidesData = [
    { img: 'https://i.imgur.com/kvruQ8k.jpeg', title: 'NOVA COLEÇÃO', sub: 'Performance e Estilo' },
    { img: 'https://i.imgur.com/iapKUtF.jpeg', title: 'BLACK FRIDAY', sub: 'Até 30% OFF' }
];

function animateProductToCart(sourceElement, product) {
    const cartIcon = document.querySelector('.nav-icon[title="Carrinho"]');
    if (!cartIcon || !sourceElement) return;
    
    const flying = document.createElement('div');
    flying.style.cssText = `position:fixed; z-index:9999; width:50px; height:50px; background-image:url('${getSafeImageUrl(product)}'); background-size:cover; border-radius:50%; pointer-events:none; transition: all 0.8s ease;`;
    
    const rect = sourceElement.getBoundingClientRect();
    flying.style.top = rect.top + 'px';
    flying.style.left = rect.left + 'px';
    
    document.body.appendChild(flying);
    
    setTimeout(() => {
        const cartRect = cartIcon.getBoundingClientRect();
        flying.style.top = cartRect.top + 'px';
        flying.style.left = cartRect.left + 'px';
        flying.style.opacity = 0;
        flying.style.transform = 'scale(0.2)';
    }, 10);
    
    setTimeout(() => flying.remove(), 800);
}

function getSafeImageUrl(product) {
    if (Array.isArray(product.images) && product.images.length > 0) return product.images[0];
    if (product.image) return product.image;
    return 'https://via.placeholder.com/400x500?text=Sem+Foto';
}

// Helpers (Vazios para evitar erro se chamados)
function setupConnectionMonitor() {}
function setupCartAbandonmentTracking() {}
function setupPushNotifications() {}
function loadSettings() {}
function saveSettings() { showToast('Salvo!'); }

// Pagamento
function closePaymentModal() { document.getElementById('paymentModal').classList.remove('active'); }
function sendToWhatsApp() { 
    alert('Enviando pedido para o WhatsApp...'); 
    closePaymentModal();
    state.cart = [];
    saveCart();
}

// Funções Globais
window.toggleCart = toggleCart;
window.checkout = checkout;
window.openUserPanel = openUserPanel;

// Toast
function showToast(msg, type='success') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    if(type === 'error') t.style.borderLeft = '5px solid red';
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(), 300); }, 3000);
}

function initBlackFridayCountdown() {
    const el = document.getElementById('bfDays');
    if(el) el.innerText = '11'; // Placeholder visual
}

// ==================== FUNÇÕES AUXILIARES DO ADMIN (UPLOAD & UI) ====================

// Habilita o botão de "Upload Local" do HTML
async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    if (!storage) {
        alert('Firebase Storage não configurado. Use a opção "URL de Imagem".');
        return;
    }

    // Feedback de carregamento
    const btn = event.target.parentElement;
    const originalText = btn.innerHTML;
    btn.textContent = '⏳ Enviando...';

    try {
        for (const file of files) {
            // Cria referência no Firebase Storage
            const ref = storage.ref().child(`produtos/${Date.now()}_${file.name}`);
            await ref.put(file);
            const url = await ref.getDownloadURL();
            
            // Adiciona à lista temporária
            tempProductImages.push(url);
        }
        renderProductImages();
        showToast('Upload concluído!', 'success');
    } catch (error) {
        console.error(error);
        alert('Erro no upload: ' + error.message);
    } finally {
        btn.innerHTML = originalText; // Restaura botão
        event.target.value = ''; // Limpa input
    }
}

// Alterna visibilidade dos inputs no Admin
function toggleUrlInput() {
    const box = document.getElementById('imageUrlInputBox');
    if(box) box.classList.toggle('active');
    // Foca no input se abriu
    if(box && box.classList.contains('active')) document.getElementById('imageUrlField')?.focus();
}

function toggleGradientInput() {
    const box = document.getElementById('imageGradientInputBox');
    if(box) box.classList.toggle('active');
}

function addGradientImage() {
    const grad = document.getElementById('gradientField').value;
    if(grad) {
        tempProductImages.push(grad);
        renderProductImages();
        document.getElementById('gradientField').value = '';
        toggleGradientInput();
    }
}

function initHeroCarousel() {
    const container = document.getElementById('heroCarousel');
    if(!container) return;
    
    // Dados do slide
    const slides = [
        { img: 'https://i.imgur.com/kvruQ8k.jpeg', title: 'NOVA COLEÇÃO', sub: 'Performance e Estilo' },
        { img: 'https://i.imgur.com/iapKUtF.jpeg', title: 'BLACK FRIDAY', sub: 'Até 30% OFF' }
    ];

    container.innerHTML = slides.map((s, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image: url('${s.img}')">
            <div class="hero-content">
                <h1 class="hero-title">${s.title}</h1>
                <p class="hero-subtitle">${s.sub}</p>
                <button class="hero-cta" onclick="navigateToCategory('all')">VER PRODUTOS</button>
            </div>
        </div>
    `).join('');

    // Inicia rotação
    if (typeof startHeroInterval === 'function') startHeroInterval();
}
// =============================================================================
// INICIALIZAÇÃO (DOMContentLoaded)
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando Aplicação...');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');
    
    try {
        // 1. Carregamentos Visuais Imediatos
        loadSettings();
        loadCart();
        updateCartUI();
        updateFavoritesCount();
        initHeroCarousel(); 
        initBlackFridayCountdown();

        // 2. Monitoramento de Autenticação
        auth.onAuthStateChanged(user => {
            state.currentUser = user;
            console.log('Auth Status:', user ? 'Logado' : 'Guest');
            if (document.getElementById('userPanel')?.classList.contains('active')) {
                checkUserSession(); // Atualiza painel se estiver aberto
            }
        });

// 3. Carregamento de Dados (Assíncrono)
        await loadProducts();
        
        // 4. Lógica de Busca via URL (Redirecionamento)
        const urlParams = new URLSearchParams(window.location.search);
        const searchTerm = urlParams.get('search');
        if (searchTerm) {
            const headerInput = document.getElementById('headerSearchInput');
            if (headerInput) {
                headerInput.value = searchTerm;
                setTimeout(() => {
                    performHeaderSearch();
                    document.getElementById('produtos')?.scrollIntoView({behavior: 'smooth'});
                }, 800);
            }
        }

        // 5. Lógica de Hash (Ações de botões)
        const hash = window.location.hash;
        if (hash === '#login') setTimeout(openUserPanel, 500);
        else if (hash === '#favorites') setTimeout(showFavorites, 800);
        else if (hash === '#cart') setTimeout(toggleCart, 500);

        // 6. Scripts Auxiliares
        setupConnectionMonitor();
        setupCartAbandonmentTracking();
        setupPushNotifications();

    } catch (error) {
        console.error('❌ Erro crítico na inicialização:', error);
        showToast('Erro ao carregar componentes.', 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
});

