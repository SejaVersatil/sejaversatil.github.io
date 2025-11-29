// ====================================================================================
// ARQUIVO: produto.js
// DESCRIÇÃO: Script específico para a página de detalhes do produto (produto.html).
// Lida com carregamento de dados, seleção de variantes, galeria e adição ao carrinho.
// ====================================================================================

// ==================== ESTADO GLOBAL ====================
const state = {
    currentProduct: null,
    selectedColor: null,
    selectedSize: null,
    selectedQuantity: 1,
    cart: [],
    productVariants: {},
    galleryExpanded: false,
    appliedCoupon: null,
    couponDiscount: 0
};
window.productState = state;

// ==================== VARIÁVEIS E FUNÇÕES GLOBAIS (Importadas de main.js ou simuladas) ====================
// Variáveis globais do Firebase (serão inicializadas no HTML)
let db;
let auth;
let firebase; // Necessário para FieldValue e Timestamp

// Variáveis de Estado de Autenticação (para uso em funções de favoritos/carrinho)
let currentUser = JSON.parse(localStorage.getItem('sejaVersatilCurrentUser') || 'null');
let isAdminLoggedIn = currentUser && currentUser.isAdmin;

// Funções utilitárias (assumindo que estão disponíveis ou definidas localmente)
const $ = (id) => document.getElementById(id);
const elExists = (id) => !!$(id);
const safeNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};
const isImageUrl = (s) => typeof s === 'string' && (s.startsWith('http') || s.startsWith('data:image'));
const isGradient = (s) => typeof s === 'string' && s.includes('gradient(');
const getCategoryName = (cat) => cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ');
const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<div class="toast-content"><span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span><span class="toast-message">${message}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
};
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
};
const updateFavoritesCount = () => { /* Simulação */ };

// ==================== LOCAL STORAGE (CARRINHO) ====================

function loadCartFromStorage() {
    try {
        const raw = localStorage.getItem('sejaVersatilCart');
        if (!raw) {
            state.cart = [];
            state.appliedCoupon = null;
            state.couponDiscount = 0;
            return;
        }
        
        const parsed = JSON.parse(raw);
        
        if (parsed.items && Array.isArray(parsed.items)) {
            state.cart = parsed.items.map(item => ({
                ...item,
                quantity: safeNumber(item.quantity, 1),
                price: safeNumber(item.price, 0)
            }));
            state.appliedCoupon = parsed.appliedCoupon || null;
            state.couponDiscount = safeNumber(parsed.couponDiscount, 0);
        } else if (Array.isArray(parsed)) {
            state.cart = parsed.map(item => ({
                ...item,
                quantity: safeNumber(item.quantity, 1),
                price: safeNumber(item.price, 0)
            }));
            state.appliedCoupon = null;
            state.couponDiscount = 0;
        } else {
            state.cart = [];
            state.appliedCoupon = null;
            state.couponDiscount = 0;
        }
        
        if (typeof window.cart !== 'undefined') {
            window.cart = state.cart;
        }
        
        // Sincroniza com o main.js se estiver na mesma aba
        if (typeof window.updateCartUI === 'function') {
            window.updateCartUI();
        }
        
    } catch (err) {
        console.warn('Erro ao carregar carrinho:', err);
        state.cart = [];
        state.appliedCoupon = null;
        state.couponDiscount = 0;
    }
}

function saveCartToStorage() {
    try {
        const cartData = {
            items: state.cart || [],
            appliedCoupon: state.appliedCoupon || null,
            couponDiscount: safeNumber(state.couponDiscount, 0)
        };
        localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
        
        if (typeof window.cart !== 'undefined') {
            window.cart = state.cart;
        }
        
        // Sincroniza com o main.js se estiver na mesma aba
        if (typeof window.updateCartUI === 'function') {
            window.updateCartUI();
        }
    } catch (err) {
        console.warn('Erro ao salvar carrinho', err);
    }
}

// ==================== CARREGAMENTO DE DADOS ====================

async function loadProduct(productId) {
    try {
        // Simulação de busca de produto (em um ambiente real, usaria a função db.collection)
        const doc = await db.collection('produtos').doc(productId).get();
        if (!doc.exists) throw new Error('Produto não encontrado');

        const data = doc.data() || {};

        // Normalização de dados
        data.price = safeNumber(data.price, 0);
        data.oldPrice = data.oldPrice !== undefined ? safeNumber(data.oldPrice, 0) : null;

        data.images = Array.isArray(data.images) && data.images.length ?
            data.images.filter(Boolean) :
            (data.image ? [data.image] : []);

        data.colors = Array.isArray(data.colors) && data.colors.length ?
            data.colors :
            (data.colors ? [data.colors] : []);

        data.sizes = Array.isArray(data.sizes) && data.sizes.length ?
            data.sizes : ['P', 'M', 'G', 'GG'];

        state.currentProduct = Object.freeze({
            id: doc.id,
            ...data
        });

        await loadProductVariants(productId);

        // Renderizar UI
        await new Promise(resolve => requestAnimationFrame(resolve));
        renderProduct();

    } catch (err) {
        console.error('Erro loadProduct', err);
        // Em caso de erro, redireciona para a página inicial
        // window.location.href = 'index.html';
    }
}

async function loadProductVariants(productId) {
    try {
        const snapshot = await db.collection('produtos').doc(productId).collection('variants').get();
        const variants = [];
        snapshot.docs.forEach(d => {
            const dv = d.data() || {};
            variants.push({
                id: d.id,
                size: dv.size || null,
                color: dv.color || null,
                stock: safeNumber(dv.stock, 0),
                price: dv.price !== undefined ? safeNumber(dv.price, null) : null
            });
        });
        state.productVariants[productId] = variants;
    } catch (err) {
        console.warn('Erro variantes:', err);
        state.productVariants[productId] = [];
    }
}

// ==================== RENDERIZAÇÃO ====================

function renderProduct() {
    const p = state.currentProduct;
    if (!p) return;

    // Títulos e Breadcrumbs
    document.title = `${p.name || 'Produto'} - Seja Versátil`;
    if (elExists('productPageTitle')) $('productPageTitle').textContent = `${p.name} - Seja Versátil`;
    if (elExists('breadcrumbCategory')) $('breadcrumbCategory').textContent = getCategoryName(p.category);
    if (elExists('breadcrumbProduct')) $('breadcrumbProduct').textContent = p.name || '';
    if (elExists('detailsProductName')) $('detailsProductName').textContent = p.name || '';

    renderPrices();
    renderColors();
    renderGallery();
    renderSizes();
    renderDescription();
    renderRelatedProducts();
    updateFavoriteStatus(); // Atualiza o estado do botão de favorito
}

function renderPrices() {
    const p = state.currentProduct;
    if (!p) return;

    const priceOldEl = $('detailsPriceOld');
    const priceNewEl = $('detailsPriceNew');
    const discountBadge = $('discountBadge');
    const installments = $('detailsInstallments');

    const price = safeNumber(p.price, null);

    if (priceNewEl) priceNewEl.textContent = price !== null ? `R$ ${price.toFixed(2)}` : '---';

    if (p.oldPrice && price && p.oldPrice > price) {
        if (priceOldEl) {
            priceOldEl.textContent = `De R$ ${safeNumber(p.oldPrice).toFixed(2)}`;
            priceOldEl.style.display = 'block';
        }
        const discount = Math.round(((p.oldPrice - price) / p.oldPrice) * 100);
        if (discountBadge) {
            discountBadge.textContent = `-${discount}%`;
            discountBadge.style.display = 'inline-flex';
        }
    } else {
        if (priceOldEl) priceOldEl.style.display = 'none';
        if (discountBadge) discountBadge.style.display = 'none';
    }

    if (installments && price) {
        const maxParcelas = 3;
        const parcelaValue = price / maxParcelas;
        installments.textContent = `ou ${maxParcelas}x de R$ ${parcelaValue.toFixed(2)} sem juros`;
    }
}

function renderGallery(specificImages = null) {
    const p = state.currentProduct;
    if (!p) return;

    let imagesToRender = specificImages || p.images;
    const heroContainer = $('heroImageContainer');
    const thumbnailList = $('thumbnailList');
    const btnShowMore = $('btnShowMore');

    if (!heroContainer || !thumbnailList) return;

    // 1. Renderiza a imagem principal (Hero)
    const heroImage = imagesToRender[0] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    const isHeroRealImage = isImageUrl(heroImage);
    
    heroContainer.innerHTML = `
        <div class="hero-image-slide active" 
             style="${isHeroRealImage ? `background-image: url('${heroImage}')` : `background: ${heroImage}`}">
            ${isHeroRealImage ? `<img src="${heroImage}" alt="${sanitizeInput(p.name)}" loading="eager">` : ''}
        </div>
    `;
    
    // 2. Renderiza as miniaturas (Thumbnails)
    thumbnailList.innerHTML = imagesToRender.map((img, index) => {
        const isThumbRealImage = isImageUrl(img);
        const isActive = index === 0 ? 'active' : '';
        
        return `
            <div class="thumbnail-item ${isActive}" 
                 onclick="changeHeroImage('${img}', this)"
                 style="${isThumbRealImage ? `background-image: url('${img}')` : `background: ${img}`}">
            </div>
        `;
    }).join('');
    
    // 3. Lógica do botão "Mostrar Mais"
    if (imagesToRender.length > 4 && btnShowMore) {
        btnShowMore.style.display = 'block';
        btnShowMore.innerHTML = `MOSTRAR MAIS <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"><path d="M1 1L5 5L9 1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        thumbnailList.style.maxHeight = '280px'; // Altura inicial para 4 itens
        thumbnailList.classList.remove('expanded');
        state.galleryExpanded = false;
    } else if (btnShowMore) {
        btnShowMore.style.display = 'none';
        thumbnailList.style.maxHeight = 'none';
        thumbnailList.classList.add('expanded');
    }
}

function changeHeroImage(newImage, clickedElement) {
    const heroContainer = $('heroImageContainer');
    const p = state.currentProduct;
    if (!heroContainer || !p) return;

    // 1. Atualiza a imagem principal
    const isHeroRealImage = isImageUrl(newImage);
    heroContainer.innerHTML = `
        <div class="hero-image-slide active" 
             style="${isHeroRealImage ? `background-image: url('${newImage}')` : `background: ${newImage}`}">
            ${isHeroRealImage ? `<img src="${newImage}" alt="${sanitizeInput(p.name)}" loading="eager">` : ''}
        </div>
    `;

    // 2. Atualiza o estado "active" das miniaturas
    document.querySelectorAll('.thumbnail-item').forEach(item => item.classList.remove('active'));
    if (clickedElement) {
        clickedElement.classList.add('active');
    }
}

function toggleGalleryExpansion() {
    const container = document.getElementById('thumbnailList');
    const btn = document.getElementById('btnShowMore');
    
    if (!container || !btn) return;

    state.galleryExpanded = !state.galleryExpanded;

    if (state.galleryExpanded) {
        container.style.maxHeight = '2000px';
        container.classList.add('expanded');
        btn.innerHTML = `MOSTRAR MENOS <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" style="transform: rotate(180deg);"><path d="M1 1L5 5L9 1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else {
        container.style.maxHeight = '280px';
        container.classList.remove('expanded');
        btn.innerHTML = `MOSTRAR MAIS <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"><path d="M1 1L5 5L9 1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        
        const galleryTop = document.getElementById('galleryContainer');
        if (galleryTop) {
            galleryTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

function renderColors() {
    const p = state.currentProduct;
    const variants = state.productVariants[p.id] || [];
    const colorSelector = $('colorSelector');
    
    if (!colorSelector) return;
    
    let availableColors = p.colors;
    
    if (availableColors.length === 0) {
        const colorOption = colorSelector.closest('.product-option');
        if (colorOption) colorOption.style.display = 'none';
        return;
    }
    
    const colorOption = colorSelector.closest('.product-option');
    if (colorOption) colorOption.style.display = 'block';
    
    colorSelector.innerHTML = availableColors.map((color, index) => {
        const hasStock = variants.length === 0 || variants.some(v => v.color === color.name && v.stock > 0);
        const borderStyle = (color.hex === '#FFFFFF' || color.hex === '#ffffff') ? 'border: 3px solid #ddd;' : '';
        const isActive = index === 0;
        
        if (isActive) {
            state.selectedColor = color.name;
            renderGallery(color.images);
        }
        
        return `
            <div class="color-option ${isActive ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                 data-color="${sanitizeInput(color.name)}"
                 data-has-stock="${hasStock}"
                 onclick="selectColor('${sanitizeInput(color.name)}', this)"
                 style="background: ${color.hex}; ${borderStyle} ${!hasStock ? 'opacity: 0.3; cursor: not-allowed;' : ''}"
                 title="${sanitizeInput(color.name)}">
                ${!hasStock ? '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5rem; color: red;">✕</span>' : ''}
            </div>
        `;
    }).join('');
    
    // Se não houver variantes, assume que o primeiro é selecionado
    if (availableColors.length > 0 && variants.length === 0) {
        state.selectedColor = availableColors[0].name;
    }
}

function selectColor(colorName, element) {
    const p = state.currentProduct;
    const variants = state.productVariants[p.id] || [];
    
    // Verifica se a cor tem estoque (se houver variantes)
    if (variants.length > 0 && !variants.some(v => v.color === colorName && v.stock > 0)) {
        showToast('❌ Cor indisponível', 'error');
        return;
    }
    
    state.selectedColor = colorName;
    
    // Atualiza o visual
    document.querySelectorAll('.color-option').forEach(item => item.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        document.querySelector(`.color-option[data-color="${colorName}"]`)?.classList.add('active');
    }
    
    // Atualiza a galeria com as imagens da cor
    const colorData = p.colors.find(c => c.name === colorName);
    if (colorData && colorData.images) {
        renderGallery(colorData.images);
    } else {
        renderGallery(p.images);
    }
    
    // Re-renderiza tamanhos para atualizar o estoque
    renderSizes();
}

function renderSizes() {
    const p = state.currentProduct;
    const variants = state.productVariants[p.id] || [];
    const sizeSelector = $('sizeSelector');
    
    if (!sizeSelector) return;
    
    let availableSizes = p.sizes;
    
    if (availableSizes.length === 0) {
        const sizeOption = sizeSelector.closest('.product-option');
        if (sizeOption) sizeOption.style.display = 'none';
        return;
    }
    
    const sizeOption = sizeSelector.closest('.product-option');
    if (sizeOption) sizeOption.style.display = 'block';
    
    sizeSelector.innerHTML = availableSizes.map((size, index) => {
        const hasStock = variants.length === 0 || variants.some(v => v.size === size && v.color === state.selectedColor && v.stock > 0);
        const isActive = index === 0;
        
        if (isActive) {
            state.selectedSize = size;
        }
        
        return `
            <div class="size-option ${isActive ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                 data-size="${sanitizeInput(size)}"
                 data-has-stock="${hasStock}"
                 onclick="selectSize('${sanitizeInput(size)}', this)"
                 title="${sanitizeInput(size)}">
                ${sanitizeInput(size)}
            </div>
        `;
    }).join('');
    
    // Se não houver variantes, assume que o primeiro é selecionado
    if (availableSizes.length > 0 && variants.length === 0) {
        state.selectedSize = availableSizes[0];
    }
}

function selectSize(sizeName, element) {
    const p = state.currentProduct;
    const variants = state.productVariants[p.id] || [];
    
    // Verifica se o tamanho tem estoque (se houver variantes)
    if (variants.length > 0 && !variants.some(v => v.size === sizeName && v.color === state.selectedColor && v.stock > 0)) {
        showToast('❌ Tamanho indisponível para esta cor', 'error');
        return;
    }
    
    state.selectedSize = sizeName;
    
    // Atualiza o visual
    document.querySelectorAll('.size-option').forEach(item => item.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        document.querySelector(`.size-option[data-size="${sizeName}"]`)?.classList.add('active');
    }
}

function renderDescription() {
    const p = state.currentProduct;
    if (!p) return;

    const descEl = document.getElementById('productDescription');
    if (!descEl) return;

    const content = p.description ||
        `<p><strong>${p.name}</strong></p>
      <p>Desenvolvido com tecnologia de alta performance, oferecendo conforto e estilo para seus treinos e dia a dia. 
      Modelagem que valoriza o corpo e tecido de toque suave.</p>`;

    descEl.innerHTML = content;
}

async function renderRelatedProducts() {
    // Simulação de produtos relacionados (em um ambiente real, usaria a função db.collection)
    const relatedGrid = $('relatedProductsGrid');
    if (!relatedGrid) return;
    
    const related = [{
        id: 'p5', name: 'Blusa Regata Nova', category: 'blusas', price: 79.90, images: ['linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)']
    }, {
        id: 'p6', name: 'Short Saia Premium', category: 'conjunto short saia', price: 169.90, images: ['linear-gradient(135deg, #fa709a 0%, #fee140 100%)']
    }];

    if (!related.length) {
        relatedGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;">Nenhum produto similar no momento.</p>';
        return;
    }

    relatedGrid.innerHTML = related.slice(0, 4).map(prod => {
        let imgUrl = prod.images && prod.images.length > 0 ? prod.images[0] : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        const isRealImage = isImageUrl(imgUrl);
        
        return `
            <div class="product-card" onclick="window.location.href = 'produto.html?id=${prod.id}'">
                <div class="product-image" style="aspect-ratio: 3/4; background-color: #f5f5f5;">
                    <div style="width: 100%; height: 100%; ${isRealImage ? `background-image: url('${imgUrl}'); background-size: cover; background-position: center;` : `background: ${imgUrl}`}">
                        ${isRealImage ? `<img src="${imgUrl}" alt="${sanitizeInput(prod.name)}" style="width: 100%; height: 100%; object-fit: cover; display: none;">` : ''}
                    </div>
                </div>
                <div class="product-info" style="padding: 1rem;">
                    <h4 style="font-size: 0.9rem; font-weight: 600; margin: 0 0 5px 0; color: #000;">${sanitizeInput(prod.name)}</h4>
                    <div class="product-price">
                        <span class="price-new" style="font-weight: 700; color: #000;">R$ ${safeNumber(prod.price, 0).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== CARRINHO E COMPRA ====================

function changeQuantity(delta) {
    const input = $('productQuantity');
    let newValue = state.selectedQuantity + delta;
    newValue = Math.max(1, Math.min(10, newValue));
    
    if (input) input.value = newValue;
    state.selectedQuantity = newValue;
}

function addToCartFromDetails() {
    const p = state.currentProduct;
    if (!p) return;
    
    if (!state.selectedSize || !state.selectedColor) {
        showToast('Selecione o tamanho e a cor', 'error');
        return;
    }
    
    // Verifica estoque (se houver variantes)
    if (state.productVariants[p.id] && !state.productVariants[p.id].some(v => v.size === state.selectedSize && v.color === state.selectedColor && v.stock > 0)) {
        showToast('❌ Item fora de estoque', 'error');
        return;
    }
    
    const cartItemId = `${p.id}_${state.selectedSize}_${state.selectedColor}`;
    const existingItem = state.cart.find(item => item.cartItemId === cartItemId);
    
    // Pega a imagem da cor selecionada
    const colorData = p.colors.find(c => c.name === state.selectedColor);
    const imageForCart = colorData && colorData.images && colorData.images.length > 0 ? colorData.images[0] : p.images[0];
    
    if (existingItem) {
        existingItem.quantity += state.selectedQuantity;
    } else {
        state.cart.push({
            ...p,
            cartItemId: cartItemId,
            quantity: state.selectedQuantity,
            selectedSize: state.selectedSize,
            selectedColor: state.selectedColor,
            image: imageForCart
        });
    }
    
    saveCartToStorage();
    if (typeof updateCartUI === 'function') updateCartUI();
    
    // Simulação de animação
    const addButton = document.querySelector('.btn-add-cart-large');
    if (addButton) {
        // animateProductToCart(addButton, p); // Removido para simplificar
    }
    
    showToast(`${state.selectedQuantity}x ${p.name} (${state.selectedSize}, ${state.selectedColor}) adicionado ao carrinho!`, 'success');
}

function buyNow() {
    addToCartFromDetails();
    // Redireciona para o checkout (simulado)
    if (typeof window.toggleCart === 'function') {
        setTimeout(() => {
            window.toggleCart();
        }, 500);
    }
}

function buyViaWhatsApp() {
    const p = state.currentProduct;
    if (!p) return;
    
    if (!state.selectedSize || !state.selectedColor) {
        showToast('Selecione o tamanho e a cor', 'error');
        return;
    }
    
    const msg = `Olá! Gostaria de comprar o produto: *${p.name}*\n` +
        `Cor: ${state.selectedColor}\n` +
        `Tamanho: ${state.selectedSize}\n` +
        `Quantidade: ${state.selectedQuantity}\n` +
        `Preço: R$ ${p.price.toFixed(2)}\n` +
        `Link: ${window.location.href}`;

    window.open(`https://wa.me/5571991427103?text=${encodeURIComponent(msg)}`, '_blank');
}

function calculateShipping() {
    const zipInput = $('zipCodeInput');
    const resultsDiv = $('shippingResults');
    if (!zipInput || !resultsDiv) return;

    const zipCode = zipInput.value.replace(/\D/g, '');
    if (zipCode.length !== 8) {
        showToast('Digite um CEP válido (8 dígitos).', 'error');
        return;
    }
    
    // Mock results
    resultsDiv.innerHTML = `
    <div class="shipping-option">
      <div><strong>PAC</strong><br><small>Entrega em 5-10 dias úteis</small></div>
      <strong>R$ 15,90</strong>
    </div>
    <div class="shipping-option">
      <div><strong>SEDEX</strong><br><small>Entrega em 2-4 dias úteis</small></div>
      <strong>R$ 25,90</strong>
    </div>
  `;
    resultsDiv.classList.add('active');
}

// ==================== FAVORITOS ====================

function toggleProductFavorite() {
    const p = state.currentProduct;
    if (!p) return;

    let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    const index = favorites.indexOf(p.id);

    if (index > -1) {
        favorites.splice(index, 1);
        showToast('💔 Removido dos favoritos', 'info');
    } else {
        favorites.push(p.id);
        showToast('❤️ Adicionado aos favoritos', 'success');
    }

    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    updateFavoriteStatus();
    updateFavoritesCount();
}

function updateFavoriteStatus() {
    const p = state.currentProduct;
    if (!p) return;

    const favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    const isFav = favorites.includes(p.id);

    const btnFloating = document.querySelector('.btn-favorite-floating');
    if (btnFloating) {
        btnFloating.classList.toggle('active', isFav);
    }
}

// ==================== INICIALIZAÇÃO ====================

function initializeProductPage() {
    const loadingOverlay = $('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        console.log('🚀 Inicializando página de produto...');

        loadCartFromStorage();
        if (typeof window.updateCartUI === 'function') window.updateCartUI();

        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (!productId) {
            console.warn('Parametro id ausente. Redirecionando...');
            window.location.href = 'index.html';
        } else {
            // Espera o Firebase estar pronto
            await waitForDbReady(3000);
            loadProduct(productId);
        }
        
        // Configura listeners de pagamento e CEP
        setupPaymentListeners();
        setupZipCodeMask();

    } catch (err) {
        console.error('Erro na inicialização do produto:', err);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

function setupPaymentListeners() {
    const opts = document.querySelectorAll('input[name="paymentMethod"]');
    const box = $('installmentsBox');
    if (!opts.length || !box) return;
    opts.forEach(opt => {
        opt.addEventListener('change', function() {
            box.style.display = this.value === 'credito-parcelado' ? 'block' : 'none';
        });
    });
}

function setupZipCodeMask() {
    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'zipCodeInput') {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
            e.target.value = v;
        }
    });
}

// ==================== HELPERS DE FIREBASE ====================

async function waitForDbReady(msTimeout = 3000) {
    const start = (new Date()).getTime();
    while ((typeof db === 'undefined' || !db) && ((new Date()).getTime() - start < msTimeout)) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (typeof db === 'undefined' || !db) {
        console.error('Firebase DB não disponível. Verifique a inicialização no HTML.');
        // Não lança erro, apenas loga, para permitir a simulação de dados
    }
}

// ==================== EXPOR FUNÇÕES GLOBAIS ====================
window.initializeProductPage = initializeProductPage;
window.changeQuantity = changeQuantity;
window.calculateShipping = calculateShipping;
window.addToCartFromDetails = addToCartFromDetails;
window.buyNow = buyNow;
window.buyViaWhatsApp = buyViaWhatsApp;
window.toggleProductFavorite = toggleProductFavorite;
window.toggleGalleryExpansion = toggleGalleryExpansion;
window.selectColor = selectColor;
window.selectSize = selectSize;
window.changeHeroImage = changeHeroImage;
window.shareToWhatsApp = shareToWhatsApp;
window.shareToInstagram = shareToInstagram;
window.toggleProductFavorite = toggleProductFavorite; // Reexposto para clareza
window.updateFavoriteStatus = updateFavoriteStatus; // Reexposto para clareza

// Funções de Compartilhamento (Reintroduzidas)
function shareToWhatsApp() {
    const p = state.currentProduct;
    if (!p) return;

    const text = `Olha esse produto que encontrei na Seja Versátil: *${p.name}*\n${window.location.href}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function shareToInstagram() {
    const url = window.location.href;

    navigator.clipboard.writeText(url).then(() => {
        showToast('📋 Link copiado! Cole no seu Instagram.', 'success');
    }).catch(err => {
        console.error('Erro ao copiar', err);
        showToast('Erro ao copiar link', 'error');
    });
}

document.addEventListener('DOMContentLoaded', initializeProductPage);
console.log('✅ Produto.js carregado.');
