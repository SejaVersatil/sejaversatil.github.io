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
    appliedCoupon: null,        // ← ADICIONE ESTA LINHA
    couponDiscount: 0            // ← ADICIONE ESTA LINHA
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

const isImageUrl = (s) => typeof s === 'string' && (s.startsWith('http') || s.startsWith('data:image'));
const isGradient = (s) => typeof s === 'string' && s.includes('gradient(');

const normalizeIdPart = (str = '') =>
    String(str).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();

const nowMs = () => (new Date()).getTime();

/* =========================
   LocalStorage (carrinho)
   ========================= */
function loadCartFromStorage() {


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

    try {
        const raw = localStorage.getItem('sejaVersatilCart');
        if (!raw) {
            state.cart = [];
            state.appliedCoupon = null;
            state.couponDiscount = 0;
            return;
        }
        
        const parsed = JSON.parse(raw);
        
        // ✅ CORREÇÃO: Aceita AMBOS os formatos
        if (parsed.items && Array.isArray(parsed.items)) {
            // Formato novo: {items: [], appliedCoupon: {}, couponDiscount: 0}
            state.cart = parsed.items.map(item => ({
                ...item,
                quantity: safeNumber(item.quantity, 1),
                price: safeNumber(item.price, 0)
            }));
            state.appliedCoupon = parsed.appliedCoupon || null;
            state.couponDiscount = safeNumber(parsed.couponDiscount, 0);
        } else if (Array.isArray(parsed)) {
            // Formato antigo: [{item1}, {item2}]
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
        
        // ✅ Sincroniza com variável global (se existir)
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
        // ✅ SEMPRE salva no formato novo
        const cartData = {
            items: state.cart || [],
            appliedCoupon: state.appliedCoupon || null,
            couponDiscount: safeNumber(state.couponDiscount, 0)
        };
        localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
        
        // ✅ Sincroniza com variável global (se existir)
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
        console.log('🚀 Inicializando produto...');

        loadCartFromStorage();
        updateCartUI();

        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (!productId) {
            console.warn('Parametro id ausente');
            // window.location.href = 'index.html'; // Descomentar em produção
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
        console.warn('Erro variantes:', err);
        state.productVariants[productId] = [];
    }
}

/* =========================
   Renderização Principal
   ========================= */
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
    renderGallery(); // Chama a nova galeria mosaico
    renderSizes();
    renderDescription();
    renderRelatedProducts();
}

/* =========================
   Preços
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
            discountBadge.style.display = 'inline-flex'; // inline-flex para centralizar
        }
    } else {
        if (priceOldEl) priceOldEl.style.display = 'none';
        if (discountBadge) discountBadge.style.display = 'none';
    }

    // Lógica de Parcelamento (Atualizado para 3x)
    if (installments && price) {
        const maxParcelas = 3; // Máximo de parcelas
        const parcelaValue = price / maxParcelas;
        installments.textContent = `ou ${maxParcelas}x de R$ ${parcelaValue.toFixed(2)} sem juros`;
    }
}

/* =========================
   Galeria: Lógica "Hero + Thumbnails" (Novo Layout)
   ========================= */
function renderGallery(specificImages = null) {
    const p = state.currentProduct;
    if (!p) return;

    // 1. Determina quais imagens usar
    let imagesToRender = specificImages;
    if (!imagesToRender) {
        if (Array.isArray(p.images) && p.images.length > 0) {
            imagesToRender = p.images;
        } else if (p.image) {
            imagesToRender = [p.image];
        } else {
            imagesToRender = [];
        }
    }

    // 2. Chama a função que atualiza o DOM sem apagar a estrutura
    updateGalleryDisplay(imagesToRender);
}

// Função que distribui as fotos nos lugares certos (Hero 1, Hero 2 e Grid)
// Função para clicar na miniatura e jogar ela para a principal

/* =========================
   Cores (Renderização Blindada)
   ========================= */
function renderColors() {
    const colorSelector = $('colorSelector');
    if (!colorSelector) return;
    const p = state.currentProduct;

    let availableColors = [];

    // 1. Extração Inteligente de Cores do Firebase
    if (Array.isArray(p.colors) && p.colors.length > 0) {
        availableColors = p.colors.map(c => {
            if (typeof c === 'object' && c !== null) {
                return {
                    name: c.name || 'Cor',
                    hex: c.hex || getColorHex(c.name),
                    images: (Array.isArray(c.images) && c.images.length > 0) ? c.images : (p.images || [])
                };
            } else {
                return {
                    name: String(c),
                    hex: getColorHex(c),
                    images: p.images || []
                };
            }
        });
    } else {
        const variants = state.productVariants[p.id] || [];
        const unique = [...new Set(variants.map(v => v.color).filter(Boolean))];
        availableColors = unique.map(name => ({
            name,
            hex: getColorHex(name),
            images: p.images || []
        }));
    }

    if (!availableColors.length) {
        const group = colorSelector.closest('.product-selector-group');
        if (group) group.style.display = 'none';
        return;
    }

    colorSelector.innerHTML = '';

    // 2. Criar as Bolinhas
    availableColors.forEach((colorObj) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isActive = state.selectedColor === colorObj.name;
        btn.className = `color-option ${isActive ? 'active' : ''}`;
        btn.title = colorObj.name;
        btn.dataset.color = colorObj.name;

        const rawHex = colorObj.hex || getColorHex(colorObj.name);
        const colors = rawHex.split(',').map(c => c.trim());

        if (colors.length === 1) {
            btn.style.background = colors[0];
            if (['#ffffff', '#fff', 'white'].includes(colors[0].toLowerCase())) {
                btn.style.border = '1px solid #ccc';
            }
        } else {
            const gradient = colors.length === 2 
                ? `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`
                : `linear-gradient(135deg, ${colors[0]} 33%, ${colors[1]} 33% 66%, ${colors[2]} 66%)`;
            btn.style.background = gradient;
        }

        // 3. O Clique que muda a foto e o estado
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            selectColor(colorObj.name); // Chama a nova função selectColor abaixo
        });

        colorSelector.appendChild(btn);
    });

    // Se nenhuma cor estiver selecionada, seleciona a primeira visualmente (opcional) ou mantém estado
    if (!state.selectedColor && availableColors.length > 0) {
       if (elExists('selectedColorName')) $('selectedColorName').textContent = 'Selecione';
       // Renderiza as imagens padrão do produto ao iniciar
       renderGallery(p.images);
    }
}

/* Função Unificada de Seleção de Cor */
/* =========================
   Tamanhos (Corrigido: Clique + Sem Pré-seleção)
   ========================= */
function renderSizes() {
    const sizeSelector = $('sizeSelector');
    if (!sizeSelector) return;

    const p = state.currentProduct;
    const variants = state.productVariants[p.id] || [];
    const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['P', 'M', 'G', 'GG'];

    sizeSelector.innerHTML = '';

    sizes.forEach((size) => {
        let hasStock = false;
        let stock = 0;

        // Se TEM cor selecionada, verifica estoque real da variante
        if (state.selectedColor) {
            const variant = variants.find(v =>
                String(v.size) === String(size) &&
                String(v.color) === String(state.selectedColor)
            );
            if (variant) {
                stock = safeNumber(variant.stock, 0);
                hasStock = stock > 0;
            }
        } else {
            // Se NÃO TEM cor selecionada, mostra como disponível (ou neutro)
            hasStock = true;
        }

        // Cria Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'size-wrapper';

        // Cria Botão
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `size-option ${state.selectedSize === size ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}`;
        btn.textContent = size;

        // Desabilita apenas se já escolheu cor e não tem estoque
        btn.disabled = state.selectedColor && !hasStock;

        // CLICK HANDLER (Importante!)
        btn.onclick = (e) => {
            e.stopPropagation();
            selectSize(size);
        };

        wrapper.appendChild(btn);

        // Mensagens de Estoque (Só mostra se já tiver cor selecionada)
        if (state.selectedColor) {
            if (!hasStock) {
                const msg = document.createElement('span');
                msg.className = 'stock-msg error';
                msg.textContent = 'Esgotado';
                wrapper.appendChild(msg);
            } else if (stock > 0 && stock <= 3) {
                const msg = document.createElement('span');
                msg.className = 'stock-msg warning';
                msg.textContent = 'Últimas';
                wrapper.appendChild(msg);
            }
        }

        sizeSelector.appendChild(wrapper);
    });

    if (elExists('selectedSizeName')) $('selectedSizeName').textContent = state.selectedSize || '-';
}

function selectSize(size) {
    // Verifica se já selecionou uma cor
    if (!state.selectedColor) {
        showToast(' Selecione uma cor primeiro', 'error');
        return; // Impede a seleção do tamanho
    }
    
    state.selectedSize = size;
    // Atualiza visual dos botões
    document.querySelectorAll('.size-option').forEach(opt => {
        opt.classList.toggle('active', opt.textContent === size);
    });
    if (elExists('selectedSizeName')) $('selectedSizeName').textContent = size;
}

/* =========================
   Descrição do Produto (Estava faltando)
   ========================= */
function renderDescription() {
    const p = state.currentProduct;
    if (!p) return;

    const descEl = document.getElementById('productDescription');
    if (!descEl) return;

    // Se não tiver descrição no banco, usa um texto padrão
    const content = p.description ||
        `<p><strong>${p.name}</strong></p>
      <p>Desenvolvido com tecnologia de alta performance, oferecendo conforto e estilo para seus treinos e dia a dia. 
      Modelagem que valoriza o corpo e tecido de toque suave.</p>`;

    descEl.innerHTML = content;
}
/* =========================
   Produtos relacionados (CORRIGIDO E ROBUSTO)
   ========================= */
async function renderRelatedProducts() {
    try {
        const p = state.currentProduct;
        if (!p) return;

        const relatedGrid = $('relatedProductsGrid');
        if (!relatedGrid) return;

        // Busca produtos da mesma categoria
        const relatedSnapshot = await db.collection('produtos')
            .where('category', '==', p.category)
            .limit(5)
            .get();

        const related = [];
        relatedSnapshot.forEach(doc => {
            // Exclui o produto atual da lista
            if (doc.id !== p.id) {
                related.push({
                    id: doc.id,
                    ...(doc.data() || {})
                });
            }
        });

        if (!related.length) {
            relatedGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;">Nenhum produto similar no momento.</p>';
            return;
        }

        relatedGrid.innerHTML = '';

        // Pega até 4 produtos para exibir
        related.slice(0, 4).forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.onclick = () => window.location.href = `produto.html?id=${prod.id}`;
            card.style.cursor = 'pointer';

            // --- LÓGICA DE IMAGEM CORRIGIDA ---
            let imgUrl = '';
            // 1. Prioridade: Array de imagens
            if (Array.isArray(prod.images) && prod.images.length > 0) {
                imgUrl = prod.images[0];
            }
            // 2. Fallback: String única 'image'
            else if (prod.image) {
                imgUrl = prod.image;
            }
            // 3. Fallback final: String 'img' (caso exista legado)
            else if (prod.img) {
                imgUrl = prod.img;
            }

            // Container da Imagem
            const imgWrap = document.createElement('div');
            imgWrap.className = 'product-image';
            imgWrap.style.width = '100%';
            imgWrap.style.aspectRatio = '3/4';
            imgWrap.style.position = 'relative';
            imgWrap.style.backgroundColor = '#f5f5f5'; // Fundo cinza enquanto carrega

            // Elemento de Imagem (TAG IMG para maior compatibilidade)
            const imgElem = document.createElement('img');
            imgElem.style.width = '100%';
            imgElem.style.height = '100%';
            imgElem.style.objectFit = 'cover';
            imgElem.style.display = 'block';

            if (imgUrl && imgUrl.trim() !== '') {
                imgElem.src = imgUrl;
                imgElem.alt = prod.name || 'Produto';

                // Se der erro ao carregar a URL (quebrada), mostra ícone
                imgElem.onerror = function() {
                    this.style.display = 'none';
                    imgWrap.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:24px;">📷</div>';
                };
            } else {
                // Se não tiver URL nenhuma
                imgElem.style.display = 'none';
                imgWrap.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:12px;">Sem Foto</div>';
            }

            imgWrap.appendChild(imgElem);

            // Informações
            const info = document.createElement('div');
            info.className = 'product-info';
            info.style.padding = '1rem';

            const h4 = document.createElement('h4');
            h4.textContent = prod.name || 'Produto';
            h4.style.fontSize = '0.9rem';
            h4.style.fontWeight = '600';
            h4.style.margin = '0 0 5px 0';
            h4.style.color = '#000';

            const priceDiv = document.createElement('div');
            priceDiv.className = 'product-price';

            const priceSpan = document.createElement('span');
            priceSpan.className = 'price-new';
            priceSpan.style.fontWeight = '700';
            priceSpan.style.color = '#000';

            const priceVal = safeNumber(prod.price, 0);
            priceSpan.textContent = priceVal > 0 ? `R$ ${priceVal.toFixed(2)}` : 'Sob Consulta';

            priceDiv.appendChild(priceSpan);
            info.appendChild(h4);
            info.appendChild(priceDiv);

            card.appendChild(imgWrap);
            card.appendChild(info);
            relatedGrid.appendChild(card);
        });
    } catch (err) {
        console.error('Erro relacionados', err);
    }
}
/* =========================
   Carrinho & Checkout
   ========================= */
function changeQuantity(delta) {
    const input = $('productQuantity');
    if (!input) {
        state.selectedQuantity = Math.max(1, Math.min(10, state.selectedQuantity + delta));
        return;
    }
    let newValue = parseInt(input.value || '0', 10) + delta;
    if (Number.isNaN(newValue)) newValue = state.selectedQuantity;
    newValue = Math.max(1, Math.min(10, newValue));
    input.value = newValue;
    state.selectedQuantity = newValue;
}

function calculateShipping() {
    const zipInput = $('zipCodeInput');
    const resultsDiv = $('shippingResults');
    if (!zipInput || !resultsDiv) return;

    const zipCode = zipInput.value.replace(/\D/g, '');
    if (zipCode.length !== 8) {
        alert('Digite um CEP válido (8 dígitos).');
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







window.addEventListener('storage', (e) => {
    if (e.key === 'sejaVersatilCart' && e.newValue !== e.oldValue) {
        console.log('🔄 Carrinho atualizado em outra aba');
        loadCartFromStorage();
        updateCartUI();
    }
});
/* =========================
   Modal Pagamento / WhatsApp
   ========================= */


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


/* =========================
   Compra Direta (Botão WhatsApp abaixo de comprar)
   ========================= */
function buyViaWhatsApp() {
    const p = state.currentProduct;
    if (!p) return;
    const msg = `Olá! Gostaria de comprar o produto: *${p.name}*\n` +
        `Preço: R$ ${p.price.toFixed(2)}\n` +
        `Link: ${window.location.href}`;

    window.open(`https://wa.me/5571991427103?text=${encodeURIComponent(msg)}`, '_blank');
}

/* =========================
   Helpers & Countdown
   ========================= */




/* Máscara CEP */
document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'zipCodeInput') {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
        e.target.value = v;
    }
});

/* =========================
   Expor Globalmente (Para HTML onclick)
   ========================= */
window.toggleCart = toggleCart;
window.checkout = checkout;
window.changeQuantity = changeQuantity;
window.calculateShipping = calculateShipping;
window.addToCartFromDetails = addToCartFromDetails;
window.buyViaWhatsApp = buyViaWhatsApp;
window.toggleSidebar = toggleSidebar;
window.closePaymentModal = closePaymentModal;
window.sendToWhatsApp = sendToWhatsApp;

console.log('✅ Produto.js (Mosaico) carregado.');

// ==================== SISTEMA DE CUPONS NA PÁGINA DE PRODUTO ====================

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
            resetCouponButton();
            return;
        }

        const coupon = { id: couponDoc.id, ...couponDoc.data() };

        if (!coupon.active) {
            showCouponMessage('❌ Cupom inativo', 'error');
            resetCouponButton();
            return;
        }

        const now = new Date();
        const validFrom = coupon.validFrom ? coupon.validFrom.toDate() : null;
        const validUntil = coupon.validUntil ? coupon.validUntil.toDate() : null;

        if (validFrom && now < validFrom) {
            showCouponMessage('❌ Este cupom ainda não está válido', 'error');
            resetCouponButton();
            return;
        }

        if (validUntil && now > validUntil) {
            showCouponMessage('❌ Este cupom expirou', 'error');
            resetCouponButton();
            return;
        }

        const cartValue = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        if (coupon.minValue && cartValue < coupon.minValue) {
            showCouponMessage(`❌ Valor mínimo: R$ ${coupon.minValue.toFixed(2)}`, 'error');
            resetCouponButton();
            return;
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

state.appliedCoupon = coupon;
state.couponDiscount = discount;

        input.classList.add('success');
        showAppliedCouponBadge(coupon, discount);
        updateCartUI();
        saveCartToStorage();

        showCouponMessage(`✅ Cupom aplicado! Desconto de R$ ${discount.toFixed(2)}`, 'success');

        input.value = '';
        input.disabled = true;
        btn.style.display = 'none';

    } catch (error) {
        console.error('Erro ao aplicar cupom:', error);
        showCouponMessage('❌ Erro ao validar cupom', 'error');
        resetCouponButton();
    }
}

function resetCouponButton() {
    const btn = document.getElementById('applyCouponBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'APLICAR';
        btn.style.opacity = '1';
    }
}




/* =================================================================== */
/* BUSCA INTELIGENTE COMPLETA (LIVE SEARCH) - PÁGINA DE PRODUTO        */
/* =================================================================== */

let globalSearchCache = []; // Armazena os produtos para a busca

// Função para carregar dados básicos de todos os produtos (Executa em background)
async function loadGlobalSearchData() {
    if (globalSearchCache.length > 0) return; // Já carregado

    try {
        // Pega apenas os campos necessários para economizar dados
        const snapshot = await db.collection('produtos').get();
        globalSearchCache = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        console.log('🔍 Dados da busca carregados:', globalSearchCache.length);
    } catch (error) {
        console.warn('Erro ao carregar dados da busca:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Carrega os dados da busca 1.5 segundos após abrir a página (para não travar o carregamento principal)
    setTimeout(loadGlobalSearchData, 1500);

    const searchInput = document.getElementById('headerSearchInput');
    const dropdown = document.getElementById('headerDropdown');

    if (!searchInput || !dropdown) return;

    let timeout = null;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        // Se o usuário começar a digitar e os dados ainda não chegaram, tenta carregar agora
        if (globalSearchCache.length === 0) loadGlobalSearchData();

        clearTimeout(timeout);

        if (query.length < 2) {
            dropdown.classList.remove('active');
            dropdown.innerHTML = '';
            return;
        }

        timeout = setTimeout(() => {
            // Filtra no cache local
            const filtered = globalSearchCache.filter(p =>
                (p.name && p.name.toLowerCase().includes(query)) ||
                (p.category && p.category.toLowerCase().includes(query))
            );

            renderSearchDropdown(filtered, query);
        }, 300);
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
});

// Renderiza as miniaturas (Igual à Home)
function renderSearchDropdown(products, query) {
    const dropdown = document.getElementById('headerDropdown');

    if (products.length === 0) {
        dropdown.innerHTML = `
            <div style="padding: 1rem; text-align: center; color: #999; font-size: 0.85rem;">
                Nenhum produto encontrado para "<strong>${query}</strong>"
            </div>`;
        dropdown.classList.add('active');
        return;
    }

    // Limita a 5 resultados
    const topProducts = products.slice(0, 5);

    dropdown.innerHTML = topProducts.map(product => {
        // Lógica de Imagem Otimizada (Usa o helper existente isImageUrl)
        let img = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

        if (Array.isArray(product.images) && product.images.length > 0) {
            img = product.images[0];
        } else if (product.image) {
            img = product.image;
        }

        const isRealImg = isImageUrl(img); // Usando helper global
        const style = isRealImg ?
            `background-image: url('${img}'); background-size: cover; background-position: center;` :
            `background: ${img};`;

        const price = product.price ? Number(product.price).toFixed(2) : '0.00';

        return `
            <div class="search-dropdown-item" onclick="window.location.href='produto.html?id=${product.id}'">
                <div class="search-dropdown-thumb" style="${style}"></div>
                <div class="search-dropdown-info">
                    <div class="search-dropdown-title">${product.name || 'Produto'}</div>
                    <div class="search-dropdown-price">R$ ${price}</div>
                </div>
            </div>
        `;
    }).join('');

    dropdown.classList.add('active');
}

/* =================================================================== */
/* SISTEMA DE LOGIN / USUÁRIO (ADICIONADO PARA PÁGINA DE PRODUTO)       */
/* =================================================================== */

let currentUser = null;







async function userLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // O onAuthStateChanged vai lidar com a UI
    } catch (error) {
        console.error(error);
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'E-mail ou senha incorretos';
    }
}

async function userRegister(event) {
    event.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorMsg = document.getElementById('registerError');

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({
            displayName: name
        });

        // Salvar no Firestore (Opcional para manter padrão)
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            createdAt: new Date()
        });

        document.getElementById('registerSuccess').classList.add('active');
        setTimeout(() => switchUserTab('login'), 1500);
    } catch (error) {
        console.error(error);
        errorMsg.style.display = 'block';
        if (error.code === 'auth/email-already-in-use') errorMsg.textContent = 'E-mail já cadastrado';
        else if (error.code === 'auth/weak-password') errorMsg.textContent = 'Senha muito fraca (min 6 caracteres)';
        else errorMsg.textContent = 'Erro ao criar conta';
    }
}

async function userLogout() {
    try {
        await auth.signOut();
        hideLoggedInView();
    } catch (error) {
        console.error(error);
    }
}

async function resetPassword() {
    const email = prompt("Digite seu e-mail para redefinir a senha:");
    if (email) {
        try {
            await auth.sendPasswordResetEmail(email);
            alert("E-mail de redefinição enviado!");
        } catch (error) {
            alert("Erro: " + error.message);
        }
    }
}

/* =================================================================== */
/* SISTEMA DE FAVORITOS (PÁGINA DE PRODUTO)                            */
/* =================================================================== */

// 1. Carregar Estado Inicial (Ao abrir a página)
document.addEventListener('DOMContentLoaded', () => {
    updateFavoriteStatus();
    updateFavoritesCount();
});

// 2. Alternar Favorito (Adicionar/Remover)
function toggleProductFavorite() {
    const p = state.currentProduct;
    if (!p) return;

    let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    const index = favorites.indexOf(p.id);

    if (index > -1) {
        // Remover
        favorites.splice(index, 1);
        showToast('💔 Removido dos favoritos', 'info');
    } else {
        // Adicionar
        favorites.push(p.id);
        showToast('❤️ Adicionado aos favoritos', 'success');
    }

    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    updateFavoriteStatus();
    updateFavoritesCount();
}

// 3. Atualizar Visual dos Botões (Header e Mobile/Desktop Flutuante)
function updateFavoriteStatus() {
    const p = state.currentProduct;
    if (!p) return; // Aguarda carregar produto

    const favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');
    const isFav = favorites.includes(p.id);

    // --- LÓGICA NOVA DO BOTÃO FLUTUANTE ---
    const btnFloating = document.querySelector('.btn-favorite-floating');
    if (btnFloating) {
        if (isFav) {
            // Se é favorito: Adiciona classe active (fica vermelho pelo CSS)
            btnFloating.classList.add('active');
        } else {
            // Se não é favorito: Remove classe active (volta a ser contorno preto)
            btnFloating.classList.remove('active');
        }
    }

    // Ícone do Header (Coração do menu superior)
    const headerIcon = document.querySelector('.nav-icon[title="Meus favoritos"] svg');
    if (headerIcon) {
        if (isFav) {
            headerIcon.setAttribute('fill', '#ff4444');
            headerIcon.setAttribute('stroke', '#ff4444');
        } else {
            headerIcon.setAttribute('fill', 'none');
            headerIcon.setAttribute('stroke', 'currentColor');
        }
    }
}

// 4. Atualizar Contador do Header

// 5. Redirecionar Fav
function goToFavoritesPage() {
    // Redireciona para a Home com o parâmetro especial
    window.location.href = 'index.html?ver_favoritos=true';
}

/* =========================
   Funções de Compartilhamento
   ========================= */

function shareToWhatsApp() {
    const p = state.currentProduct;
    if (!p) return;

    const text = `Olha esse produto que encontrei na Seja Versátil: *${p.name}*\n${window.location.href}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function shareToInstagram() {
    // Como não existe API direta para postar no IG via Web, copiamos o link
    const url = window.location.href;

    navigator.clipboard.writeText(url).then(() => {
        // Feedback visual simples (Toast)
        showToast('📋 Link copiado! Cole no seu Instagram.', 'success');
    }).catch(err => {
        console.error('Erro ao copiar', err);
        showToast('Erro ao copiar link', 'error');
    });
}

// Função auxiliar de Toast (caso você ainda não tenha no código, adicione esta também)

// Função que o botão "MOSTRAR MAIS" chama no onclick
window.toggleGalleryExpansion = function() {
    const container = document.getElementById('thumbnailList');
    const btn = document.getElementById('btnShowMore');
    
    if (!container || !btn) return;

    state.galleryExpanded = !state.galleryExpanded;

    if (state.galleryExpanded) {
        // Expande
        container.style.maxHeight = '2000px';
        container.classList.add('expanded');
        btn.innerHTML = `MOSTRAR MENOS <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" style="transform: rotate(180deg);"><path d="M1 1L5 5L9 1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else {
        // Recolhe
        container.style.maxHeight = '0';
        container.classList.remove('expanded');
        btn.innerHTML = `MOSTRAR MAIS <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"><path d="M1 1L5 5L9 1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        
        // Rola suavemente para o topo
        const galleryTop = document.getElementById('galleryContainer');
        if (galleryTop) {
            galleryTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
};


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
