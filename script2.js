// ==================== CONFIGURAÇÃO GLOBAL ====================
const state = {
    products: [],
    cart: [],
    currentFilter: 'all',
    currentUser: null
};

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Home Inicializando...');

    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search');
    
    if (searchTerm) {
        // Espera os produtos carregarem e aplica o filtro
        setTimeout(() => {
            const headerInput = document.getElementById('headerSearchInput');
            if(headerInput) {
                headerInput.value = searchTerm;
                performHeaderSearch(); // Usa a função já existente no script2
                
                // Rola até os produtos
                const productsSection = document.getElementById('produtos');
                if(productsSection) productsSection.scrollIntoView({behavior: 'smooth'});
            }
        }, 1500); // Delay para garantir que produtos carregaram
    }
    // Verifica Auth
    auth.onAuthStateChanged(user => {
        state.currentUser = user;
        console.log('Auth State:', user ? user.email : 'Guest');
    });

    // Carrega dados
    loadCart();
    await loadProducts();
    
    // UI
    initHeroCarousel();
    initBlackFridayCountdown();
    
    document.getElementById('loadingOverlay')?.classList.remove('active');
});

// ==================== PRODUTOS (FIRESTORE) ====================
async function loadProducts() {
    try {
        const snapshot = await db.collection("produtos").get();
        state.products = [];
        snapshot.forEach(doc => state.products.push({ id: doc.id, ...doc.data() }));
        
        renderProducts();
        renderBestSellers();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        showToast("Erro ao carregar produtos", "error");
    }
}

// ==================== RENDERIZAÇÃO (CORREÇÃO DE IMAGEM APLICADA) ====================
function renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    let filtered = state.products;
    if (state.currentFilter !== 'all') {
        filtered = filtered.filter(p => p.category === state.currentFilter);
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem;">Nenhum produto encontrado.</div>';
        return;
    }

    grid.innerHTML = filtered.map(product => {
        // LÓGICA DE IMAGEM ROBUSTA (A mesma da página de produto)
        let imgUrl = '';
        if (Array.isArray(product.images) && product.images.length > 0) imgUrl = product.images[0];
        else if (product.image) imgUrl = product.image;
        else if (product.img) imgUrl = product.img;

        // Fallback para URL vazia
        if (!imgUrl) imgUrl = 'https://via.placeholder.com/400x500?text=Sem+Foto';

        const price = parseFloat(product.price) || 0;
        const oldPrice = parseFloat(product.oldPrice) || 0;

        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                    <img src="${imgUrl}" alt="${product.name}" loading="lazy" 
                         onerror="this.src='https://via.placeholder.com/400x500?text=Erro+Img'">
                    ${product.badge ? `<span class="product-badge" style="position:absolute;top:10px;left:10px;background:black;color:white;padding:5px;">${product.badge}</span>` : ''}
                </div>
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <div class="product-price">
                        ${oldPrice > price ? `<span class="price-old">R$ ${oldPrice.toFixed(2)}</span>` : ''}
                        <span class="price-new">R$ ${price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== RENDER BEST SELLERS (Faltou esta função) ====================
function renderBestSellers() {
    const bestSellersGrid = document.getElementById('bestSellersGrid');
    if (!bestSellersGrid) return;

    // Filtra produtos que têm "Preço Antigo" (Promoção) para serem os Best Sellers
    // Pega apenas os 6 primeiros
    const bestSellers = state.products.filter(p => p.oldPrice).slice(0, 6);
    
    if (bestSellers.length === 0) {
        bestSellersGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:#999;">Nenhum destaque no momento.</div>';
        return;
    }
    
    bestSellersGrid.innerHTML = bestSellers.map(product => {
        // LÓGICA DE IMAGEM ROBUSTA (Mesma do renderProducts)
        let imgUrl = '';
        if (Array.isArray(product.images) && product.images.length > 0) imgUrl = product.images[0];
        else if (product.image) imgUrl = product.image;
        else if (product.img) imgUrl = product.img;

        // Fallback se não tiver imagem
        if (!imgUrl) imgUrl = 'https://via.placeholder.com/400x500?text=Sem+Foto';
        
        const price = parseFloat(product.price) || 0;
        const oldPrice = parseFloat(product.oldPrice) || 0;
        
        return `
            <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="product-image">
                    <img src="${imgUrl}" alt="${product.name}" loading="lazy" 
                         onerror="this.src='https://via.placeholder.com/400x500?text=Erro+Img'">
                    
                    ${product.badge ? `<span class="product-badge" style="position:absolute;top:10px;left:10px;background:black;color:white;padding:5px;">${product.badge}</span>` : ''}
                    
                    <button class="add-to-cart-btn" onclick="event.stopPropagation(); quickAddToCart('${product.id}')">
                        ADICIONAR AO CARRINHO
                    </button>
                </div>
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <div class="product-price">
                        ${oldPrice > price ? `<span class="price-old">R$ ${oldPrice.toFixed(2)}</span>` : ''}
                        <span class="price-new">R$ ${price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== ADMIN PANEL (RESTAURADO) ====================
function openUserPanel() {
    document.getElementById('userPanel').classList.add('active');
    if (state.currentUser) {
        document.getElementById('loginTab').style.display = 'none';
        document.getElementById('userLoggedTab').style.display = 'block';
        document.getElementById('userName').textContent = state.currentUser.email;
        
        // Verifica Admin simples (pode ser melhorado com claims)
        if(state.currentUser.email.includes('admin')) {
            document.getElementById('adminAccessBtn').style.display = 'block';
        }
    } else {
        document.getElementById('loginTab').style.display = 'block';
        document.getElementById('userLoggedTab').style.display = 'none';
    }
}

function closeUserPanel() { document.getElementById('userPanel').classList.remove('active'); }

async function userLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        showToast('Login realizado!', 'success');
        openUserPanel(); // Recarrega painel
    } catch (err) {
        alert('Erro no login: ' + err.message);
    }
}

function userLogout() {
    auth.signOut();
    closeUserPanel();
    showToast('Saiu da conta.');
}

function openAdminPanel() {
    document.getElementById('adminPanel').classList.add('active');
    renderAdminProducts();
}
function closeAdminPanel() { document.getElementById('adminPanel').classList.remove('active'); }

// Renderização da Grade do Admin (Com Imagens Pequenas)
function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    if(!grid) return;
    grid.innerHTML = state.products.map(p => {
         let imgUrl = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : (p.image || '');
         return `
            <div class="admin-product-card">
                <div class="admin-product-image" style="background-image: url('${imgUrl}')"></div>
                <h4>${p.name}</h4>
                <p>R$ ${p.price}</p>
                <div style="display:flex; gap:5px; margin-top:10px;">
                    <button class="admin-btn-edit" onclick="openProductModal('${p.id}')">Editar</button>
                    <button style="background:red; color:white; border:none; padding:5px;" onclick="deleteProduct('${p.id}')">Excluir</button>
                </div>
            </div>
         `;
    }).join('');
}

// Salvar Produto (Admin)
async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const data = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        oldPrice: parseFloat(document.getElementById('productOldPrice').value) || null,
        badge: document.getElementById('productBadge').value,
        // Captura simples de imagem via URL
        image: document.getElementById('imageUrlField').value || null,
        images: document.getElementById('imageUrlField').value ? [document.getElementById('imageUrlField').value] : []
    };

    try {
        if (id) await db.collection("produtos").doc(id).update(data);
        else await db.collection("produtos").add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        
        closeProductModal();
        loadProducts(); // Recarrega tudo
        showToast('Produto salvo!', 'success');
    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
    }
}

async function deleteProduct(id) {
    if(!confirm('Excluir produto?')) return;
    await db.collection("produtos").doc(id).delete();
    loadProducts();
}

function openProductModal(id = null) {
    document.getElementById('productModal').classList.add('active');
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    
    if(id) {
        const p = state.products.find(x => x.id === id);
        if(p) {
            document.getElementById('productId').value = p.id;
            document.getElementById('productName').value = p.name;
            document.getElementById('productPrice').value = p.price;
            // Preencher resto...
        }
    }
}
function closeProductModal() { document.getElementById('productModal').classList.remove('active'); }

// ==================== CARRINHO & UTILS ====================
function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if(saved) state.cart = JSON.parse(saved);
    updateCartUI();
}

function updateCartUI() {
    const count = document.getElementById('cartCount');
    if(count) count.textContent = state.cart.reduce((a, b) => a + b.quantity, 0);
    // Logica de renderizar itens do carrinho (igual ao produto.js)
}

function showToast(msg, type='success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Helpers de Navegação
function navigateToCategory(cat) {
    state.currentFilter = cat;
    renderProducts();
    document.getElementById('produtos').scrollIntoView({behavior: 'smooth'});
    document.getElementById('categoryNameDisplay').textContent = cat.toUpperCase();
    document.getElementById('activeCategoryBadge').style.display = 'flex';
}

function clearCategoryFilter() {
    state.currentFilter = 'all';
    renderProducts();
    document.getElementById('activeCategoryBadge').style.display = 'none';
}

// Carrossel Hero Simples
const slides = [
    'https://i.imgur.com/kvruQ8k.jpeg',
    'https://i.imgur.com/iapKUtF.jpeg'
];
function initHeroCarousel() {
    const container = document.getElementById('heroCarousel');
    if(container) {
        container.innerHTML = slides.map((s, i) => 
            `<div class="hero-slide ${i===0?'active':''}" style="background-image:url('${s}')"></div>`
        ).join('');
    }
}

function initBlackFridayCountdown() {
    // Mesma lógica do produto.js
    document.getElementById('bfDays').textContent = '11'; 
}


