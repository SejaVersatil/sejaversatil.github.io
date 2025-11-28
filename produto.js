// produto.js - Versão Final "Mosaico Live!"
// Compatível com HTML atualizado e CSS Grid

'use strict';

/* =========================
   Estado global
   ========================= */
const state = {
    currentProduct: null,
    selectedColor: null,
    selectedSize: null,
    selectedQuantity: 1,
    cart: [],
    productVariants: {},
    countdownInterval: null,
    galleryExpanded: false,
    appliedCoupon: null,
    couponDiscount: 0
};
window.productState = state;

/* =========================
   Utilitários DOM e helpers
   ========================= */
const $ = (id) => document.getElementById(id);
const elExists = (id) => !!$(id);

const safeNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const isImageUrl = (s) => typeof s === 'string' && (s.startsWith('http' ) || s.startsWith('data:image'));

const nowMs = () => (new Date()).getTime();

/* =========================
   LocalStorage (carrinho)
   ========================= */
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
    } catch (err) {
        console.warn('Erro ao salvar carrinho', err);
    }
}

/* =========================
   Inicialização da página
   ========================= */
document.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = $('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        loadCartFromStorage();
        if (typeof updateCartUI === 'function') updateCartUI();

        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (!productId) {
            console.warn('Parâmetro id ausente na URL.');
        } else {
            await waitForDbReady(3000);
            await loadProduct(productId);
        }

        if (typeof initBlackFridayCountdown === 'function') initBlackFridayCountdown();
    } catch (err) {
        console.error('Erro na inicialização do produto:', err);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
});

async function waitForDbReady(msTimeout = 3000) {
    const start = nowMs();
    while ((typeof db === 'undefined' || !db) && (nowMs() - start < msTimeout)) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (typeof db === 'undefined' || !db) {
        throw new Error('Firebase DB não disponível');
    }
}

/* =========================
   Firestore: Carregar Dados
   ========================= */
async function loadProduct(productId) {
    try {
        const doc = await db.collection('produtos').doc(productId).get();
        if (!doc.exists) throw new Error('Produto não encontrado');

        const data = doc.data() || {};

        data.price = safeNumber(data.price, 0);
        data.oldPrice = data.oldPrice !== undefined ? safeNumber(data.oldPrice, 0) : null;
        data.images = Array.isArray(data.images) && data.images.length ? data.images.filter(Boolean) : (data.image ? [data.image] : []);
        data.colors = Array.isArray(data.colors) && data.colors.length ? data.colors : (data.colors ? [data.colors] : []);
        data.sizes = Array.isArray(data.sizes) && data.sizes.length ? data.sizes : ['P', 'M', 'G', 'GG'];

        state.currentProduct = Object.freeze({ id: doc.id, ...data });

        await loadProductVariants(productId);
        renderProduct();

    } catch (err) {
        console.error('Erro em loadProduct:', err);
        throw err;
    }
}

async function loadProductVariants(productId) {
    try {
        const snapshot = await db.collection('produtos').doc(productId).collection('variants').get();
        const variants = [];
        snapshot.forEach(d => {
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
        console.warn('Erro ao carregar variantes:', err);
        state.productVariants[productId] = [];
    }
}

/* =========================
   Renderização Principal
   ========================= */
function renderProduct() {
    const p = state.currentProduct;
    if (!p) return;

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
}

/* =========================
   Renderização de Componentes
   ========================= */

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

    let imagesToRender = specificImages || (Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.image ? [p.image] : []));
    updateGalleryDisplay(imagesToRender);
}

function renderColors() {
    const colorSelector = $('colorSelector');
    if (!colorSelector) return;
    const p = state.currentProduct;

    let availableColors = [];
    if (Array.isArray(p.colors) && p.colors.length > 0) {
        availableColors = p.colors.map(c => typeof c === 'object' ? { ...c, images: c.images || p.images || [] } : { name: String(c), hex: getColorHex(c), images: p.images || [] });
    }

    if (!availableColors.length) {
        const group = colorSelector.closest('.product-selector-group');
        if (group) group.style.display = 'none';
        return;
    }

    colorSelector.innerHTML = '';
    availableColors.forEach((colorObj) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `color-option`;
        btn.title = colorObj.name;
        btn.dataset.color = colorObj.name;
        btn.style.background = colorObj.hex || getColorHex(colorObj.name);
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            selectColor(colorObj.name);
        });
        colorSelector.appendChild(btn);
    });

    if (!state.selectedColor && availableColors.length > 0) {
       if (elExists('selectedColorName')) $('selectedColorName').textContent = 'Selecione';
       renderGallery(p.images);
    }
}

function renderSizes() {
    const sizeSelector = $('sizeSelector');
    if (!sizeSelector) return;

    const p = state.currentProduct;
    const variants = state.productVariants[p.id] || [];
    const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['P', 'M', 'G', 'GG'];

    sizeSelector.innerHTML = '';
    sizes.forEach((size) => {
        let hasStock = !state.selectedColor || variants.some(v => String(v.size) === String(size) && String(v.color) === String(state.selectedColor) && v.stock > 0);
        const wrapper = document.createElement('div');
        wrapper.className = 'size-wrapper';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `size-option ${!hasStock ? 'unavailable' : ''}`;
        btn.textContent = size;
        btn.disabled = state.selectedColor && !hasStock;
        btn.onclick = (e) => { e.stopPropagation(); selectSize(size); };
        wrapper.appendChild(btn);
        sizeSelector.appendChild(wrapper);
    });

    if (elExists('selectedSizeName')) $('selectedSizeName').textContent = state.selectedSize || '-';
}

function renderDescription() {
    const p = state.currentProduct;
    if (!p) return;
    const descEl = document.getElementById('productDescription');
    if (!descEl) return;
    descEl.innerHTML = p.description || `<p><strong>${p.name}</strong></p><p>Desenvolvido com tecnologia de alta performance, oferecendo conforto e estilo para seus treinos e dia a dia.</p>`;
}

async function renderRelatedProducts() {
    const p = state.currentProduct;
    if (!p) return;
    const relatedGrid = $('relatedProductsGrid');
    if (!relatedGrid) return;

    const relatedSnapshot = await db.collection('produtos').where('category', '==', p.category).limit(5).get();
    const related = [];
    relatedSnapshot.forEach(doc => { if (doc.id !== p.id) related.push({ id: doc.id, ...doc.data() }); });

    if (!related.length) {
        relatedGrid.innerHTML = '<p>Nenhum produto similar no momento.</p>';
        return;
    }

    relatedGrid.innerHTML = related.slice(0, 4).map(prod => {
        let imgUrl = (Array.isArray(prod.images) && prod.images.length > 0) ? prod.images[0] : (prod.image || (prod.img || ''));
        return `<div class="product-card" onclick="window.location.href='produto.html?id=${prod.id}'" style="cursor: pointer;">
                    <div class="product-image" style="background-image: url('${imgUrl}');"></div>
                    <div class="product-info"><h4>${prod.name || 'Produto'}</h4><div class="product-price"><span class="price-new">R$ ${safeNumber(prod.price, 0).toFixed(2)}</span></div></div>
                </div>`;
    }).join('');
}

/* =========================
   Ações do Usuário
   ========================= */

function selectColor(colorName) {
    if (!state.currentProduct || !state.currentProduct.colors) return;
    const selectedColorData = state.currentProduct.colors.find(c => c.name === colorName);
    if (!selectedColorData || !selectedColorData.images || selectedColorData.images.length === 0) {
        showToast('Imagens desta cor indisponíveis', 'error');
        return;
    }
    state.selectedColor = colorName;
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.toggle('active', opt.dataset.color === colorName));
    updateGalleryDisplay(selectedColorData.images);
    renderSizes();
}

function selectSize(size) {
    if (!state.selectedColor) {
        showToast('Selecione uma cor primeiro', 'error');
        return;
    }
    state.selectedSize = size;
    document.querySelectorAll('.size-option').forEach(opt => opt.classList.toggle('active', opt.textContent.trim() === size));
    if (elExists('selectedSizeName')) $('selectedSizeName').textContent = size;
}

function changeQuantity(delta) {
    const input = $('productQuantity');
    let newValue = (input ? parseInt(input.value, 10) : state.selectedQuantity) + delta;
    newValue = Math.max(1, Math.min(10, newValue));
    if (input) input.value = newValue;
    state.selectedQuantity = newValue;
}

function addToCartFromDetails() {
    const p = state.currentProduct;
    if (!p || !state.selectedColor || !state.selectedSize) {
        showToast('Selecione cor e tamanho', 'error');
        return;
    }
    const cartItemId = `${p.id}-${state.selectedColor}-${state.selectedSize}`;
    const existingItem = state.cart.find(item => item.cartItemId === cartItemId);
    if (existingItem) {
        existingItem.quantity += state.selectedQuantity;
    } else {
        state.cart.push({ ...p, cartItemId, quantity: state.selectedQuantity, selectedColor: state.selectedColor, selectedSize: state.selectedSize });
    }
    saveCartToStorage();
    if (typeof updateCartUI === 'function') updateCartUI();
    showToast('Produto adicionado ao carrinho!', 'success');
}

/* =========================
   Funções da Galeria
   ========================= */

function updateGalleryDisplay(images) {
    const heroWrapper1 = $('heroWrapper1');
    const heroWrapper2 = $('heroWrapper2');
    const thumbnailList = $('thumbnailList');
    const btnShowMore = $('btnShowMore');

    if (heroWrapper1) heroWrapper1.style.backgroundImage = images[0] ? `url('${images[0]}')` : 'none';
    if (heroWrapper2) heroWrapper2.style.backgroundImage = images[1] ? `url('${images[1]}')` : 'none';

    const extraImages = images.slice(2);
    if (thumbnailList) {
        thumbnailList.innerHTML = extraImages.map(img => `<div class="gallery-photo-extra" style="background-image: url('${img}');"></div>`).join('');
    }
    if (btnShowMore) btnShowMore.style.display = extraImages.length > 0 ? 'flex' : 'none';
}

window.toggleGalleryExpansion = function() {
    const container = $('thumbnailList');
    const btn = $('btnShowMore');
    if (!container || !btn) return;
    state.galleryExpanded = !state.galleryExpanded;
    container.classList.toggle('expanded', state.galleryExpanded);
    btn.innerHTML = state.galleryExpanded ? 'MOSTRAR MENOS <svg>...</svg>' : 'MOSTRAR MAIS <svg>...</svg>';
};

/* =========================
   Helpers Adicionais
   ========================= */

function getCategoryName(category) {
    const names = { 'blusas': 'Blusas', 'conjunto calca': 'Conjunto Calça', 'peca unica': 'Peça Única', 'conjunto short saia': 'Conjunto Short Saia', 'conjunto short': 'Conjunto Short', 'all': 'Todos' };
    return names[category] || category;
}

function getColorHex(colorName) {
    const map = { 'Preto': '#000000', 'Branco': '#FFFFFF', 'Azul': '#0000FF', 'Vermelho': '#FF0000' };
    return map[colorName] || '#CCCCCC';
}

function showToast(message, type = 'info') {
    // Implementação de um toast simples
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Expondo funções globais necessárias para os `onclick` no HTML
window.addToCartFromDetails = addToCartFromDetails;
window.changeQuantity = changeQuantity;
window.selectSize = selectSize;
window.selectColor = selectColor;

