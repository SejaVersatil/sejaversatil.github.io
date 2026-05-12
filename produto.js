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
    swipeHintPlayed: false,
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

const MIRRORED_IMGUR_PRODUCT_IDS = new Set([
    '03tiX6j', '17qlyzb', '2rgUtOU', '3hTU0up', '4o3susq', '4Vs8k74',
    '5MEWtCl', '6sTXk2i', '83ZXzTs', '8eeWAIh', '8k1ICUP', '9WKPh4d',
    'a2Rfz1I', 'bG3eVyR', 'dBxwsUb', 'DlFvHVr', 'DpQmOWU', 'eHnKzfC',
    'fcFKj2y', 'FoAlEvr', 'FpBLzXT', 'FpF7Amr', 'fXKo0lq', 'G4H8FlR',
    'GLEiXoW', 'hdxd93U', 'HIeEUtb', 'HP8BC4z', 'I2VY4pX', 'iouCHMx',
    'JqNlpeG', 'jrk12xN', 'JSXnwCr', 'k9gXnLG', 'mf6kD1R', 'MjzLjEy',
    'NhNE8l0', 'PtMkRJs', 'PvNVQi7', 'QCiEHWI', 'RI1MIaW', 'ROFoQNG',
    'RSGfdcN', 'SkU255o', 'SmfJP4C', 'sSIoUuE', 'sxYA5nn', 'tarIomv',
    'TCTpRrB', 'TeHPgbE', 'TeKmlUc', 'UcpA7Bm', 'UDu4sdz', 'UHKvJ3f',
    'VjUgOdx', 'WG5D9Y9', 'X89eUU7', 'XcSUGlu', 'Yfhup24', 'YrO3bNv',
    'z0fniHc', 'zJ1dgwP'
]);

const mirrorProductImageUrl = (imageUrl) => {
    const value = typeof imageUrl === 'string' ? imageUrl.trim() : '';
    const match = value.match(/^https:\/\/i\.imgur\.com\/([A-Za-z0-9]+)\.(?:jpe?g|png|webp)(?:\?.*)?$/i);

    if (match && MIRRORED_IMGUR_PRODUCT_IDS.has(match[1])) {
        return `assets/products/${match[1]}.webp`;
    }

    return value;
};

const normalizeProductImageList = (value) => {
    const list = Array.isArray(value) ? value : (value ? [value] : []);
    return [...new Set(list.map(mirrorProductImageUrl).filter(Boolean))];
};

const normalizeProductMedia = (data = {}) => {
    const rawImages = Array.isArray(data.images) && data.images.length ? data.images : data.image;
    const images = normalizeProductImageList(rawImages);
    const colors = Array.isArray(data.colors) && data.colors.length ? data.colors : (data.colors ? [data.colors] : []);

    return {
        ...data,
        image: images[0] || mirrorProductImageUrl(data.image || ''),
        images,
        colors: colors.map(color => {
            if (!color || typeof color !== 'object') return color;
            return {
                ...color,
                images: normalizeProductImageList(color.images)
            };
        })
    };
};

const isImageUrl = (s) => (
    typeof s === 'string' &&
    /^(https?:\/\/|data:image|blob:|\.?\.?\/?assets\/|\.?\.?\/?images\/)/i.test(s.trim())
);
const isGradient = (s) => typeof s === 'string' && s.includes('gradient(');
const isLocalProductAsset = (s) => typeof s === 'string' && /^\.?\/?assets\/products\//i.test(s.trim());

function getPreferredProductImage(product = {}) {
    const images = normalizeProductImageList(
        Array.isArray(product.images) && product.images.length ? product.images : product.image
    );

    return images.find(isLocalProductAsset) ||
        images.find(img => isImageUrl(img) && !/^https:\/\/i\.imgur\.com\//i.test(img)) ||
        '';
}

const normalizeIdPart = (str = '') =>
    String(str).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();

const nowMs = () => (new Date()).getTime();
const productDetailsUrl = (productId) => `produto.html?id=${encodeURIComponent(String(productId))}`;
const formatBRL = (value) => safeNumber(value, 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
});

function stripHtmlToText(html = '') {
    const el = document.createElement('div');
    el.innerHTML = String(html);
    return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
}

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
        
        // ✅ SYNC WITH GLOBAL SCOPE (for script2.js compatibility)
        if (typeof window.cart !== 'undefined') {
            window.cart = state.cart;
            window.appliedCoupon = state.appliedCoupon;
            window.couponDiscount = state.couponDiscount;
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
        setupPaymentListeners();

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

        const media = normalizeProductMedia(data);
        data.image = media.image;
        data.images = media.images;
        data.colors = media.colors;

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
        document.title = `${p.name || 'Produto'} - Versátil`;
        if (elExists('productPageTitle')) $('productPageTitle').textContent = `${p.name} - Versátil`;
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
    const pixNote = $('detailsPixNote');

    const price = safeNumber(p.price, null);

    if (priceNewEl) priceNewEl.textContent = price !== null ? formatBRL(price) : '---';

    if (p.oldPrice && price && p.oldPrice > price) {
        if (priceOldEl) {
            priceOldEl.textContent = `De ${formatBRL(p.oldPrice)}`;
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
        installments.textContent = `ou ${maxParcelas}x de ${formatBRL(parcelaValue)} sem juros`;
    }

    if (pixNote && price) {
        pixNote.textContent = `no PIX ${formatBRL(price * 0.9)} com 10% de desconto`;
    }
}

/* =========================
   Galeria: Lógica "Hero + Thumbnails" (Novo Layout)
   ========================= */
let swipeHintTimer = null;

function hideMobileSwipeHint() {
    const hint = document.getElementById('mobileSwipeHint');
    if (!hint) return;

    hint.classList.remove('is-active');
    if (swipeHintTimer) {
        clearTimeout(swipeHintTimer);
        swipeHintTimer = null;
    }
}

function showMobileSwipeHint(imageCount = 0) {
    const hint = document.getElementById('mobileSwipeHint');
    const galleryContainer = document.getElementById('galleryContainer');

    if (!hint || window.innerWidth > 768 || imageCount < 2) {
        if (hint) hint.classList.remove('is-active');
        return;
    }

    if (state.swipeHintPlayed) return;

    state.swipeHintPlayed = true;
    hint.classList.remove('is-active');
    void hint.offsetWidth;
    hint.classList.add('is-active');

    const dismissHint = () => {
        hideMobileSwipeHint();
        galleryContainer?.removeEventListener('touchstart', dismissHint);
    };

    galleryContainer?.addEventListener('touchstart', dismissHint, { once: true, passive: true });
    swipeHintTimer = setTimeout(dismissHint, 5200);
}

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
function updateGalleryDisplay(images) {
    if (!images || images.length === 0) return;

    const isMobile = window.innerWidth <= 768;

    // ========================================
    // MOBILE: TODAS AS FOTOS NO SWIPE
    // ========================================
    if (isMobile) {
        const galleryContainer = document.getElementById('galleryContainer');
        
        if (galleryContainer) {
            // Limpa container
            galleryContainer.innerHTML = '';
            
            // Injeta TODAS as fotos no swipe
            images.forEach((img, index) => {
                const photoDiv = document.createElement('div');
                photoDiv.className = 'gallery-photo-full';
                photoDiv.style.backgroundImage = `url('${img}')`;
                photoDiv.style.backgroundSize = 'cover';
                photoDiv.style.backgroundPosition = 'center';
                photoDiv.style.backgroundRepeat = 'no-repeat';
                
                const imgTag = document.createElement('img');
                imgTag.src = img;
                imgTag.alt = `Foto ${index + 1}`;
                imgTag.style.width = '100%';
                imgTag.style.height = '100%';
                imgTag.style.objectFit = 'cover';
                imgTag.style.opacity = '0'; // Invisível, só para SEO
                
                photoDiv.appendChild(imgTag);
                galleryContainer.appendChild(photoDiv);
            });
        }

        showMobileSwipeHint(images.length);

        // Esconde botão e thumbnails no mobile
        const thumbnailContainer = document.getElementById('thumbnailList');
        const btnShowMore = document.getElementById('btnShowMore');
        if (thumbnailContainer) thumbnailContainer.style.display = 'none';
        if (btnShowMore) btnShowMore.style.display = 'none';
        
        return; // Para aqui no mobile
    }

    hideMobileSwipeHint();

    // ========================================
    // DESKTOP: 2 PRINCIPAIS + THUMBNAILS
    // ========================================
    const img1 = document.getElementById('mainImg1');
    const img2 = document.getElementById('mainImg2');

    // Atualiza Foto 1
    if (img1) {
        const src1 = images[0];
        img1.src = src1;
        if (img1.parentElement) {
            img1.parentElement.style.backgroundImage = `url('${src1}')`;
            img1.parentElement.style.transition = 'opacity 0.3s';
            img1.parentElement.style.opacity = '0.5';
            setTimeout(() => img1.parentElement.style.opacity = '1', 200);
        }
    }

    // Atualiza Foto 2
    if (img2) {
        const src2 = images[1] || images[0];
        img2.src = src2;
        if (img2.parentElement) {
            img2.parentElement.style.display = images[1] ? 'block' : 'none';
            img2.parentElement.style.backgroundImage = `url('${src2}')`;
            img2.parentElement.style.transition = 'opacity 0.3s';
            img2.parentElement.style.opacity = '0.5';
            setTimeout(() => img2.parentElement.style.opacity = '1', 200);
        }
    }

    // THUMBNAILS (Desktop Only)
    const thumbnailContainer = document.getElementById('thumbnailList');
    const btnShowMore = document.getElementById('btnShowMore');

    if (!thumbnailContainer || !btnShowMore) return;

    state.galleryExpanded = false;

    const remainingImages = images.slice(2);

    if (remainingImages.length > 0) {
        thumbnailContainer.innerHTML = '';
        const productName = state.currentProduct?.name || 'Produto';

        remainingImages.forEach((img, index) => {
            const photoButton = document.createElement('button');
            photoButton.type = 'button';
            photoButton.className = 'gallery-photo-extra';
            photoButton.setAttribute('aria-label', `${productName} - ver foto ${index + 3}`);

            const photo = document.createElement('img');
            photo.src = img;
            photo.alt = `${productName} - foto ${index + 3}`;
            photo.loading = 'eager';
            photo.fetchPriority = 'low';
            photo.decoding = 'async';

            photo.addEventListener('error', () => {
                photoButton.classList.add('is-image-error');
            }, { once: true });

            photoButton.addEventListener('click', () => swapMainImage(img));
            photoButton.appendChild(photo);
            thumbnailContainer.appendChild(photoButton);
        });

        thumbnailContainer.style.maxHeight = '0';
        thumbnailContainer.style.overflow = 'hidden';
        thumbnailContainer.style.display = 'grid';
        thumbnailContainer.classList.remove('expanded');
        btnShowMore.style.display = 'flex';
        btnShowMore.classList.remove('expanded');
        btnShowMore.innerHTML = `MOSTRAR MAIS <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"><path d="M1 1L5 5L9 1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else {
        thumbnailContainer.innerHTML = '';
        thumbnailContainer.style.maxHeight = '0';
        thumbnailContainer.style.display = 'none';
        btnShowMore.style.display = 'none';
    }
}
// Função para clicar na miniatura e jogar ela para a principal
function swapMainImage(newSrc) {
    const img1 = document.getElementById('mainImg1');
    if (img1) {
        img1.scrollIntoView({ behavior: 'smooth', block: 'center' });
        img1.style.opacity = '0.5';
        setTimeout(() => {
            img1.src = newSrc;
            img1.style.opacity = '1';
        }, 200);
    }
}

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
function selectColor(colorName) {
    console.log('🎨 Trocando cor para:', colorName);
    
    // 1. Atualiza Estado Global
    state.selectedColor = colorName;

    // 2. Atualiza visual das bolinhas
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.color === colorName);
    });

    // 3. Atualiza o texto escrito
    if (elExists('selectedColorName')) {
        $('selectedColorName').textContent = colorName;
    }

    // 4. Busca as imagens da cor selecionada
    const p = state.currentProduct;
    let newImages = [];

    // ✅ LÓGICA MELHORADA: Busca as fotos da cor
    if (p.colors && Array.isArray(p.colors)) {
        const colorObj = p.colors.find(c => {
            // Normaliza para comparar strings exatas
            const cName = typeof c === 'object' ? String(c.name).trim() : String(c).trim();
            return cName === colorName;
        });
        
        if (colorObj) {
            console.log('✅ Cor encontrada:', colorObj);
            
            // Se o objeto for tipo string simples (só o nome)
            if (typeof colorObj === 'string') {
                console.warn('⚠️ Cor é string simples, usando fotos padrão');
                newImages = p.images || [];
            }
            // Se for objeto com array de imagens
            else if (colorObj.images && Array.isArray(colorObj.images) && colorObj.images.length > 0) {
                newImages = colorObj.images;
                console.log('✅ Imagens da cor carregadas:', newImages.length);
            }
            // Se for objeto mas sem imagens
            else {
                console.warn('⚠️ Cor encontrada mas sem campo "images"');
                newImages = p.images || [];
            }
        } else {
            console.warn('⚠️ Cor não encontrada no array');
            newImages = p.images || [];
        }
    } else {
        console.warn('⚠️ Produto sem array de cores');
        newImages = p.images || [];
    }

    // 5. Validação Final
    if (newImages.length === 0) {
        console.error('❌ Nenhuma imagem disponível, usando placeholder');
        newImages = ['https://via.placeholder.com/600x800/cccccc/666666?text=Sem+Foto'];
    }

   setTimeout(() => {
    const galleryContainer = document.getElementById('galleryContainer');
    if (galleryContainer) {
        galleryContainer.scrollTo({
            top: 0,
            left: 0,
            behavior: 'smooth'
        });
    }
}, 100);

    // 6. Atualiza a Galeria (SEMPRE)
    updateGalleryDisplay(newImages);

    // 7. Atualiza disponibilidade de tamanhos
    renderSizes();
}
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

    const shortDescEl = document.getElementById('productShortDescription');
    if (shortDescEl) {
        const source = p.shortDescription || p.summary || stripHtmlToText(content);
        const text = source.length > 155 ? `${source.slice(0, 152).trim()}...` : source;
        shortDescEl.textContent = text || 'Modelagem pensada para acompanhar seus movimentos com conforto e presença.';
    }
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
            .limit(12)
            .get();

        const related = [];
        relatedSnapshot.forEach(doc => {
            // Exclui o produto atual da lista
            if (doc.id !== p.id) {
                related.push({
                    id: doc.id,
                    ...normalizeProductMedia(doc.data() || {})
                });
            }
        });

        const productsToShow = related
            .map(prod => ({
                ...prod,
                preferredImage: getPreferredProductImage(prod)
            }))
            .filter(prod => Boolean(prod.preferredImage))
            .slice(0, 4);

        if (!productsToShow.length) {
            relatedGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;">Nenhum produto similar no momento.</p>';
            return;
        }

        relatedGrid.innerHTML = '';

        // Pega até 4 produtos para exibir
        productsToShow.forEach(prod => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.onclick = () => window.location.href = productDetailsUrl(prod.id);
            card.style.cursor = 'pointer';

            // --- LÓGICA DE IMAGEM CORRIGIDA ---
            let imgUrl = prod.preferredImage;
            // 1. Prioridade: Array de imagens
            if (!imgUrl && Array.isArray(prod.images) && prod.images.length > 0) {
                imgUrl = prod.images[0];
            }
            // 2. Fallback: String única 'image'
            else if (!imgUrl && prod.image) {
                imgUrl = prod.image;
            }
            // 3. Fallback final: String 'img' (caso exista legado)
            else if (!imgUrl && prod.img) {
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
            priceSpan.textContent = priceVal > 0 ? formatBRL(priceVal) : 'Sob consulta';

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

function addToCartFromDetails() {
    const p = state.currentProduct;
    if (!p) return;

    if (!state.selectedSize) {
        alert('Selecione um tamanho.');
        return;
    }
    if (!state.selectedColor) {
        alert('Selecione uma cor.');
        return;
    }

    const cartItemId = `${p.id}__${normalizeIdPart(state.selectedSize)}__${normalizeIdPart(state.selectedColor)}`;
    const existing = state.cart.find(i => i.cartItemId === cartItemId);

    // --- LÓGICA ROBUSTA DE IMAGEM ---
let imgUrl = '';

// Verifica se existe a função global getImageForColor
if (typeof getImageForColor === 'function') {
    imgUrl = getImageForColor(p, state.selectedColor);
} else {
    // Fallback: lógica inline
    if (state.selectedColor && Array.isArray(p.colors)) {
        const colorObj = p.colors.find(c => {
            const cName = typeof c === 'object' ? c.name : c;
            return String(cName).trim() === String(state.selectedColor).trim();
        });
        
        if (colorObj && colorObj.images && colorObj.images.length > 0) {
            imgUrl = colorObj.images[0];
        } else if (Array.isArray(p.images) && p.images.length > 0) {
            imgUrl = p.images[0];
        } else if (p.image) {
            imgUrl = p.image;
        }
    } else {
        if (Array.isArray(p.images) && p.images.length > 0) {
            imgUrl = p.images[0];
        } else if (p.image) {
            imgUrl = p.image;
        }
    }
}

const itemPayload = {
    cartItemId,
    productId: p.id,
    name: p.name,
    price: safeNumber(p.price, 0),
    quantity: state.selectedQuantity,
    selectedSize: state.selectedSize,
    selectedColor: state.selectedColor,
    image: imgUrl // ✅ Agora usa a imagem da cor correta
};
   
console.log('🛒 Adicionando ao carrinho:', itemPayload);
   
    if (existing) {
        existing.quantity = safeNumber(existing.quantity, 1) + itemPayload.quantity;
    } else {
        state.cart.push(itemPayload);
    }

    saveCartToStorage();
    updateCartUI();
    toggleCart(); // Abre o carrinho automaticamente
}

function toggleCart() {
    const sidebar = $('cartSidebar');
    const overlay = $('cartOverlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function updateCartUI() {
    const cartCount = $('cartCount');
    const cartItems = $('cartItems');
    const cartFooter = $('cartFooter');
    const cartTotal = $('cartTotal');

    const totalItems = state.cart.reduce((s, it) => s + safeNumber(it.quantity, 0), 0);
    if (cartCount) {
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    if (!cartItems) return;

    if (!state.cart.length) {
        cartItems.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
        if (cartFooter) cartFooter.style.display = 'none';
        return;
    }

    cartItems.innerHTML = '';

    state.cart.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';

        // --- IMAGEM DO ITEM ---
        const imgDiv = document.createElement('div');
        imgDiv.className = 'cart-item-img';

        // Força o estilo via JS para garantir
        imgDiv.style.width = '70px';
        imgDiv.style.height = '90px';
        imgDiv.style.backgroundSize = 'cover';
        imgDiv.style.backgroundPosition = 'center';
        imgDiv.style.borderRadius = '4px';
        imgDiv.style.flexShrink = '0';

        if (isImageUrl(item.image)) {
            imgDiv.style.backgroundImage = `url("${item.image}")`;
        } else {
            imgDiv.style.backgroundColor = '#eee'; // Cinza se não tiver foto
        }

        const info = document.createElement('div');
        info.className = 'cart-item-info';

        const title = document.createElement('div');
        title.className = 'cart-item-title';
        title.textContent = item.name;

        const meta = document.createElement('div');
        meta.style.fontSize = '0.75rem';
        meta.style.color = '#666';
        meta.innerHTML = `${item.selectedSize || ''} | ${item.selectedColor || ''}`;

        const price = document.createElement('div');
        price.className = 'cart-item-price';
        price.textContent = `R$ ${safeNumber(item.price, 0).toFixed(2)}`;

        const qtyBox = document.createElement('div');
        qtyBox.className = 'cart-item-qty';

        const btnMinus = document.createElement('button');
        btnMinus.className = 'qty-btn';
        btnMinus.textContent = '-';
        btnMinus.onclick = () => updateQuantity(item.cartItemId, -1);

        const spanQty = document.createElement('span');
        spanQty.textContent = item.quantity;

        const btnPlus = document.createElement('button');
        btnPlus.className = 'qty-btn';
        btnPlus.textContent = '+';
        btnPlus.onclick = () => updateQuantity(item.cartItemId, 1);

        qtyBox.appendChild(btnMinus);
        qtyBox.appendChild(spanQty);
        qtyBox.appendChild(btnPlus);

        const remove = document.createElement('div');
        remove.className = 'remove-item';
        remove.textContent = 'Remover';
        remove.onclick = () => removeFromCart(item.cartItemId);

        info.append(title, meta, price, qtyBox, remove);
        row.append(imgDiv, info);
        cartItems.appendChild(row);
    });

const subtotal = state.cart.reduce((s, it) => s + (safeNumber(it.price) * safeNumber(it.quantity)), 0);
const discount = state.couponDiscount || 0;
const total = Math.max(0, subtotal - discount);

// ✅ ADICIONA ATUALIZAÇÃO DO SUBTOTAL
const cartSubtotal = document.getElementById('cartSubtotal');
if (cartSubtotal) {
    cartSubtotal.textContent = `R$ ${subtotal.toFixed(2)}`;
}

if (cartTotal) cartTotal.textContent = `R$ ${total.toFixed(2)}`;
if (cartFooter) cartFooter.style.display = 'block';
}

function updateQuantity(cartItemId, change) {
    const item = state.cart.find(i => i.cartItemId === cartItemId);
    if (!item) return;
    
    // NOTA: Se você tiver lógica de estoque, ela deve ser verificada aqui antes de alterar a quantidade.
    
    item.quantity = safeNumber(item.quantity, 0) + change;
    
    if (item.quantity <= 0) {
        removeFromCart(cartItemId);
    } else {
        saveCartToStorage();
        updateCartUI();
    }
}

function removeFromCart(cartItemId) {
    state.cart = state.cart.filter(i => i.cartItemId !== cartItemId);
    saveCartToStorage();
    updateCartUI();
}

function checkout() {
    // Verifica se o carrinho está vazio antes de redirecionar (opcional, mas recomendado)
    const rawCart = localStorage.getItem('sejaVersatilCart');
    // Ajuste seguro para leitura do JSON caso ele tenha estrutura antiga ou nova
    let isEmpty = true;
    if (rawCart) {
        const parsed = JSON.parse(rawCart);
        if (parsed.items && Array.isArray(parsed.items)) {
             isEmpty = parsed.items.length === 0;
        } else if (Array.isArray(parsed)) {
             isEmpty = parsed.length === 0;
        }
    }

    if (isEmpty) {
        alert('Seu carrinho está vazio!');
        return;
    }
    
    // Redireciona para a nova página de checkout
    window.location.href = 'checkout.html';
}

window.addEventListener('storage', (e) => {
    if (e.key === 'sejaVersatilCart' && e.newValue !== e.oldValue) {
        console.log('🔄 Carrinho atualizado em outra aba');
        // Assumindo que loadCartFromStorage e updateCartUI estão definidas
        if (typeof loadCartFromStorage === 'function') loadCartFromStorage();
        if (typeof updateCartUI === 'function') updateCartUI();
    }
});
/* =========================
   Modal Pagamento / WhatsApp
   ========================= */
function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const cartItemsContainer = document.getElementById('paymentCartItems');
    const totalContainer = document.getElementById('paymentTotal');

    if (!modal || !cartItemsContainer || !totalContainer) {
        console.error('Elementos do modal de pagamento não encontrados!');
        return;
    }

    // Lógica para renderizar itens e total (copiada do script2.js)
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = state.couponDiscount || 0;
    const total = Math.max(0, subtotal - discount);

    cartItemsContainer.innerHTML = state.cart.map(item => `
        <div class="payment-cart-item">
            <div>
                <div class="payment-cart-item-name">${item.name}</div>
                <div class="payment-cart-item-details">Qtd: ${item.quantity} × R$ ${item.price.toFixed(2)}</div>
            </div>
            <div style="font-weight: 700;">R$ ${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `).join('');

    totalContainer.textContent = `R$ ${total.toFixed(2)}`;

    modal.classList.add('active');
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.classList.remove('active');
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

async function sendToWhatsApp() {
    // ✅ AGUARDA AUTH
    if (window.authReady) await window.authReady;
    
    // Validação do carrinho usando 'state.cart'
    if (!state.cart || state.cart.length === 0) {
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
        const installmentsSelect = document.getElementById('installmentsSelect');
        if (!installmentsSelect || !installmentsSelect.value) {
            showToast('Selecione o número de parcelas.', 'error');
            return;
        }
        installments = installmentsSelect.value;
    }

    let customerData = {};
    
    // ✅ USA currentUser DO AUTH.JS
    if (typeof currentUser !== 'undefined' && currentUser) {
        const phone = await getUserPhone();
        const cpf = await getUserCPF();
        
        if (!phone || !cpf) {
            showToast('Dados incompletos. Preencha telefone e CPF.', 'error');
            return;
        }

        customerData = {
            name: currentUser.name || 'Cliente',
            email: currentUser.email,
            phone: phone,
            cpf: cpf,
            uid: currentUser.uid
        };
    } else {
        const guestData = await collectGuestCustomerData();
        if (!guestData) return;
        customerData = guestData;
    }

    const subtotal = state.cart.reduce((s, it) => s + (safeNumber(it.price) * safeNumber(it.quantity)), 0);
    const discount = state.couponDiscount || 0;
    const total = Math.max(0, subtotal - discount);

    let orderId = 'PENDENTE';
    try {
        const orderData = {
            userId: customerData.uid || 'guest',
            customer: customerData,
            items: state.cart.map(item => ({
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
            appliedCoupon: state.appliedCoupon ? { code: state.appliedCoupon.code, value: state.appliedCoupon.value } : null
        };

        const docRef = await db.collection('pedidos').add(orderData);
        orderId = docRef.id;

        if (state.appliedCoupon) {
            await registerCouponUsage(state.appliedCoupon.id, total, discount);
        }

    } catch (error) {
        console.error('Erro ao salvar pedido:', error);
        showToast('Erro ao processar, mas vamos tentar enviar o WhatsApp.', 'error');
    }

    const msg = generateWhatsAppMessage(orderId, customerData, state.cart, { subtotal, discount, total }, paymentMethod, installments);

    const WHATSAPP_NUMBER = '5571993333570';
    const whatsappURL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(whatsappURL, '_blank');

    closePaymentModal();
    if (typeof closeCustomerDataModal === 'function') closeCustomerDataModal();
    
    state.cart = [];
    state.appliedCoupon = null;
    state.couponDiscount = 0;
    
    saveCartToStorage();
    updateCartUI();
    showToast('Pedido realizado com sucesso!', 'success');
}

// ✅ CORREÇÃO 3: Função geradora PURA (sem efeitos colaterais)
function generateWhatsAppMessage(orderId, customer, items, totals, paymentMethod, installments = null) {
    let msg = `*🛍️ PEDIDO #${orderId.toUpperCase().substring(0, 6)} - VERSÁTIL*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    msg += `*👤 CLIENTE:*\n`;
    msg += `Nome: ${customer.name}\n`;
    msg += `Tel: ${customer.phone}\n`;
    if(customer.cpf) msg += `CPF: ${customer.cpf}\n`;
    msg += `\n`;

    msg += `*📦 PRODUTOS:*\n`;
    items.forEach((item, index) => {
        msg += `${index + 1}. *${item.name}*\n`;
        msg += `   ${item.quantity}x R$ ${item.price.toFixed(2)} | Tam: ${item.selectedSize || '-'} Cor: ${item.selectedColor || '-'}\n`;
    });
    msg += `\n`;

    msg += `*💰 FINANCEIRO:*\n`;
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
    
    // ✅ CORREÇÃO 4: Adiciona parcelas se existir (sem validação)
    if (installments) {
        msg += `Parcelas: ${installments}x sem juros\n`;
    }

    return msg; // ← SEMPRE retorna string
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

    window.open(`https://wa.me/5571993333570?text=${encodeURIComponent(msg)}`, '_blank');
}

/* =========================
   Helpers & Countdown
   ========================= */
function getCategoryName(cat) {
    const map = {
        'blusas': 'Blusas',
        'conjunto calca': 'Conjunto Calça',
        'peca unica': 'Peça Única',
        'conjunto short saia': 'Conjunto Short Saia',
        'conjunto short': 'Conjunto Short',
        'all': 'Todos'
    };
    return map[String(cat).toLowerCase()] || String(cat).toUpperCase();
}

function getColorHex(name) {
    const map = {
        'Rosa': '#FFB6C1',
        'Preto': '#000000',
        'Azul': '#4169E1',
        'Azul Claro': '#87CEEB',
        'Azul Marinho': '#0B1F4D',
        'Verde': '#32CD32',
        'Verde Claro': '#90EE90',
        'Branco': '#FFFFFF',
        'Off': '#F8F5EF',
        'Vermelho': '#DC143C',
        'Amarelo': '#FFD700',
        'Cinza': '#808080',
        'Chumbo': '#4A4A4A',
        'Lilás': '#9370DB',
        'Lavanda': '#B57EDC',
        'Coral': '#FF7F50',
        'Nude': '#E8BEAC',
        'Bege': '#F5F5DC',
        'Laranja': '#FFA500',
        'Marrom': '#6B3F2A',
        'Marrom Claro': '#B6815A',
        'Caramelo': '#C8783A',
        'Marsala': '#7D2639',
        'Militar': '#4B5320',
        'Marinho': '#0B1F4D',
        'Ciano': '#00A7B5',
        'Magenta': '#D43D8C',
        'Violeta': '#7F3FBF',
        'Chiclete': '#FF5DA2'
    };
    const normalizedName = String(name || '').trim();
    if (normalizedName.includes('/')) {
        return normalizedName
            .split('/')
            .map(part => map[String(part || '').trim()] || '#ddd')
            .join(',');
    }

    return map[normalizedName] || '#ddd';
}

function toggleSidebar() {
    const sb = $('sidebarMenu');
    const ov = $('sidebarOverlay');
    if (sb) sb.classList.toggle('active');
    if (ov) ov.classList.toggle('active');
}

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
       if (typeof window.appliedCoupon !== 'undefined') {
    window.appliedCoupon = coupon;
    window.couponDiscount = discount;
}
saveCartToStorage();

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

function removeCoupon() {
    state.appliedCoupon = null;
    state.couponDiscount = 0;
    
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
    saveCartToStorage();
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
            ...normalizeProductMedia(doc.data() || {})
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

// Controle da busca compacta no header mobile
function initializeMobileHeaderSearchTrigger() {
    const searchBars = document.querySelectorAll('.search-bar');
    if (!searchBars.length) return;

    const mobileQuery = window.matchMedia('(max-width: 768px)');

    searchBars.forEach((bar) => {
        const input = bar.querySelector('input');
        const button = bar.querySelector('.search-btn');
        const dropdown = bar.querySelector('.search-dropdown');

        if (!input || !button || button.dataset.mobileSearchReady === '1') return;

        button.dataset.mobileSearchReady = '1';
        button.setAttribute('type', 'button');

        const openMobileSearch = () => {
            if (!mobileQuery.matches) return;
            bar.classList.add('mobile-search-open');
        };

        const closeMobileSearch = () => {
            bar.classList.remove('mobile-search-open');
            if (dropdown) dropdown.classList.remove('active');
        };

        button.addEventListener('click', (event) => {
            if (mobileQuery.matches && !bar.classList.contains('mobile-search-open')) {
                event.preventDefault();
                event.stopPropagation();
                openMobileSearch();
                requestAnimationFrame(() => input.focus({ preventScroll: true }));
                return;
            }

            input.focus({ preventScroll: true });
        });

        input.addEventListener('focus', openMobileSearch);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeMobileSearch();
                input.blur();
            }
        });

        document.addEventListener('click', (event) => {
            if (mobileQuery.matches && !bar.contains(event.target)) {
                closeMobileSearch();
            }
        });

        mobileQuery.addEventListener('change', (event) => {
            if (!event.matches) closeMobileSearch();
        });
    });
}

document.addEventListener('DOMContentLoaded', initializeMobileHeaderSearchTrigger);

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
            <div class="search-dropdown-item" onclick="window.location.href='${productDetailsUrl(product.id)}'">
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

function openUserPanel() {
    const panel = document.getElementById('userPanel');
    if (panel) panel.classList.add('active');
    checkUserSession();
}

function closeUserPanel() {
    const panel = document.getElementById('userPanel');
    if (panel) panel.classList.remove('active');
}

function openProductAdminPanel() {
    try {
        sessionStorage.setItem('sejaVersatilOpenAdminPanel', '1');
    } catch (error) {
        console.warn('Nao foi possivel salvar a solicitacao de abertura do painel admin:', error);
    }

    window.location.href = 'index.html?admin=1';
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

window.openProductAdminPanel = openProductAdminPanel;

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
function updateFavoritesCount() {
    const favCount = document.getElementById('favoritesCount');
    const favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');

    if (favCount) {
        favCount.textContent = favorites.length;
        favCount.style.display = favorites.length > 0 ? 'flex' : 'none';
    }
}

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

    const text = `Olha esse produto que encontrei na Versátil: *${p.name}*\n${window.location.href}`;
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
function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = type === 'success' ? '#333' : '#ff4444';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '30px';
    toast.style.zIndex = '10000';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.textContent = msg;

    document.body.appendChild(toast);

    // Animação de entrada
    toast.animate([
        { opacity: 0, transform: 'translate(-50%, 20px)' },
        { opacity: 1, transform: 'translate(-50%, 0)' }
    ], { duration: 300, fill: 'forwards' });

    // Remove após 3 segundos
    setTimeout(() => {
        toast.animate([
            { opacity: 1 },
            { opacity: 0 }
        ], { duration: 300, fill: 'forwards' }).onfinish = () => toast.remove();
    }, 3000);
}

// Função que o botão "MOSTRAR MAIS" chama no onclick
window.toggleGalleryExpansion = function() {
    const container = document.getElementById('thumbnailList');
    const btn = document.getElementById('btnShowMore');
    
    if (!container || !btn) return;

    state.galleryExpanded = !state.galleryExpanded;

    if (state.galleryExpanded) {
        // Expande
        container.style.maxHeight = '6000px';
        container.classList.add('expanded');
        btn.classList.add('expanded');
        btn.innerHTML = `MOSTRAR MENOS <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" style="transform: rotate(180deg);"><path d="M1 1L5 5L9 1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else {
        // Recolhe
        container.style.maxHeight = '0';
        container.classList.remove('expanded');
        btn.classList.remove('expanded');
        btn.innerHTML = `MOSTRAR MAIS <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"><path d="M1 1L5 5L9 1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        
        // Rola suavemente para o topo
        const galleryTop = document.getElementById('galleryContainer');
        if (galleryTop) {
            galleryTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
};


// ==================== FUNÇÕES AUXILIARES DE CHECKOUT ====================

// Validação de Email
function validateEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!re.test(normalizedEmail)) return false;
    const domain = normalizedEmail.split('@')[1];
    return Boolean(domain) && domain.split('.').every(part => part && !part.startsWith('-') && !part.endsWith('-'));
}

// Validação de CPF
function isValidCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
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

// Coleta dados de visitante
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
        
        const submitHandler = (e) => {
            e.preventDefault();
            const name = document.getElementById('guestName').value.trim();
            const email = document.getElementById('guestEmail').value.trim();
            const phone = document.getElementById('guestPhone').value.replace(/\D/g, '');
            const cpf = document.getElementById('guestCPF').value.replace(/\D/g, '');
            
            if (!name || !validateEmail(email) || phone.length < 10 || !isValidCPF(cpf)) {
                showToast('Preencha os dados corretamente.', 'error');
                return;
            }
            
            modal.classList.remove('active');
            form.removeEventListener('submit', submitHandler);
            resolve({ name, email, phone, cpf });
        };
        
        form.addEventListener('submit', submitHandler);
        
        window.closeCustomerDataModal = () => {
            modal.classList.remove('active');
            form.removeEventListener('submit', submitHandler);
            resolve(null);
        };
    });
}

// Pegar telefone do usuário logado (Firestore)
async function getUserPhone() {
    if (!auth.currentUser) return null;
    const doc = await db.collection('users').doc(auth.currentUser.uid).get();
    if (doc.exists && doc.data().phone) return doc.data().phone;
    
    const phone = prompt('Confirme seu WhatsApp (com DDD):');
    if (phone) {
        await db.collection('users').doc(auth.currentUser.uid).update({ phone: phone.replace(/\D/g,'') });
        return phone.replace(/\D/g,'');
    }
    return null;
}

// Pegar CPF do usuário logado (Firestore)
async function getUserCPF() {
    if (!auth.currentUser) return null;
    const doc = await db.collection('users').doc(auth.currentUser.uid).get();
    if (doc.exists && doc.data().cpf) return doc.data().cpf;
    
    const cpf = prompt('Confirme seu CPF para a nota fiscal:');
    if (cpf && isValidCPF(cpf)) {
        await db.collection('users').doc(auth.currentUser.uid).update({ cpf: cpf.replace(/\D/g,'') });
        return cpf.replace(/\D/g,'');
    }
    return null;
}

// Registrar uso do cupom no Firestore
async function registerCouponUsage(couponId, orderValue, discountApplied) {
    if (!auth.currentUser) return;
    try {
        const batch = db.batch();
        const couponRef = db.collection('coupons').doc(couponId);
        const usageRef = db.collection('coupon_usage').doc();
        
        batch.update(couponRef, { usedCount: firebase.firestore.FieldValue.increment(1) });
        batch.set(usageRef, {
            couponId,
            userId: auth.currentUser.uid,
            usedAt: firebase.firestore.FieldValue.serverTimestamp(),
            orderValue,
            discountApplied
        });
        await batch.commit();
    } catch (err) {
        console.error('Erro ao registrar cupom:', err);
    }
}

// Máscaras de Input (Ativar no final do carregamento)
function setupMasks() {
    const cpfInput = document.getElementById('guestCPF');
    const phoneInput = document.getElementById('guestPhone');
    
    if (cpfInput) cpfInput.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        e.target.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    });
    
    if (phoneInput) phoneInput.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        e.target.value = v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    });
}
// Chamar setupMasks ao carregar
document.addEventListener('DOMContentLoaded', setupMasks);

