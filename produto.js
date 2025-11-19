// ============================================
// PRODUTO.JS - VERSÃO PROFISSIONAL LIVE!
// Mobile Optimized + Performance Boost
// ============================================

'use strict';

/* =========================
   PERFORMANCE OPTIMIZATION
   ========================= */

// Debounce helper para performance
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle para scroll events
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Intersection Observer para lazy load
const observeElement = (element, callback, options = {}) => {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, ...options });
    
    observer.observe(element);
    return observer;
  } else {
    // Fallback para browsers antigos
    callback(element);
  }
};

/* =========================
   ESTADO GLOBAL
   ========================= */
window.productState = window.productState || {};

const state = {
  currentProduct: null,
  selectedColor: null,
  selectedSize: null,
  selectedQuantity: 1,
  cart: [],
  productVariants: {},
  countdownInterval: null,
  isLoading: false
};

window.productState = state;

/* =========================
   UTILITÁRIOS DOM
   ========================= */
const $ = (id) => document.getElementById(id);
const q = (sel, ctx = document) => ctx.querySelector(sel);
const qa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

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
   LOCALSTORAGE (CARRINHO)
   ========================= */
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('sejaVersatilCart');
    const parsed = raw ? JSON.parse(raw) : [];
    state.cart = Array.isArray(parsed)
      ? parsed.map(item => ({
          ...item,
          quantity: safeNumber(item.quantity, 1),
          price: safeNumber(item.price, 0)
        }))
      : [];
    if (window.cart) window.cart = state.cart;
  } catch (err) {
    console.warn('❌ Erro ao carregar carrinho:', err);
    state.cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('sejaVersatilCart', JSON.stringify(state.cart));
  } catch (err) {
    console.warn('❌ Erro ao salvar carrinho:', err);
  }
}

/* =========================
   CRIAÇÃO DE THUMBNAILS
   ========================= */
function createThumbnail(img, index) {
  const thumb = document.createElement('div');
  thumb.className = 'thumbnail';
  thumb.dataset.index = String(index);
  thumb.dataset.src = img;
  thumb.setAttribute('role', 'button');
  thumb.setAttribute('aria-label', `Ver imagem ${index + 1}`);
  thumb.setAttribute('tabindex', '0');

  // Estilo LIVE! - proporção exata
  if (isImageUrl(img)) {
    thumb.style.backgroundImage = `url("${img}")`;
    thumb.style.backgroundSize = 'cover';
    thumb.style.backgroundPosition = 'center';
    thumb.style.backgroundRepeat = 'no-repeat';
  } else if (isGradient(img)) {
    thumb.style.background = img;
  } else {
    thumb.style.background = '#f5f5f5';
  }

  if (index === 0) {
    thumb.classList.add('active');
    thumb.setAttribute('aria-pressed', 'true');
  }

  // Click handler
  thumb.addEventListener('click', () => {
    changeMainImageFromData(img, index);
  });
  
  // Keyboard accessibility
  thumb.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      changeMainImageFromData(img, index);
    }
  });

  return thumb;
}

/* =========================
   MUDAR IMAGEM PRINCIPAL
   ========================= */
function changeMainImageFromData(imageSrc, index = 0) {
  const mainImage = $('mainProductImage');
  if (!mainImage) return;

  // Animação fade suave
  mainImage.classList.add('image-fade-out');

  setTimeout(() => {
    if (isImageUrl(imageSrc)) {
      mainImage.style.background = '';
      mainImage.style.backgroundImage = `url("${imageSrc}")`;
      mainImage.style.backgroundSize = 'cover';
      mainImage.style.backgroundPosition = 'center';
      mainImage.style.backgroundRepeat = 'no-repeat';
    } else if (isGradient(imageSrc)) {
      mainImage.style.backgroundImage = '';
      mainImage.style.background = imageSrc;
    } else {
      mainImage.style.backgroundImage = '';
      mainImage.style.background = '#f5f5f5';
    }

    // Update thumbnails active state
    const thumbs = qa('.thumbnail');
    thumbs.forEach((t, i) => {
      t.classList.toggle('active', i === index);
      t.setAttribute('aria-pressed', i === index ? 'true' : 'false');
    });

    mainImage.classList.remove('image-fade-out');
  }, 150);
}

/* =========================
   INICIALIZAÇÃO DA PÁGINA
   ========================= */
document.addEventListener('DOMContentLoaded', async () => {
  const loadingOverlay = $('loadingOverlay');
  if (loadingOverlay) loadingOverlay.classList.add('active');

  try {
    console.log('🚀 Inicializando produto...');
    
    // Performance mark
    if (window.performance && window.performance.mark) {
      performance.mark('product-init-start');
    }

    // Carregar carrinho (síncrono e rápido)
    loadCartFromStorage();
    updateCartUI();

    // Pegar productId da URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
      console.warn('⚠️ Parâmetro id ausente na URL');
      throw new Error('ID do produto não encontrado');
    }

    // Aguardar Firestore com timeout menor
    await waitForDbReady(2000); // 2s ao invés de 3s
    
    if (typeof window.db === 'undefined' || !window.db) {
      throw new Error('Firestore não disponível');
    }

    // Carregar produto com cache
    await loadProduct(productId);

    // Iniciar countdown (non-blocking)
    requestIdleCallback(() => {
      if (typeof initBlackFridayCountdown === 'function') {
        initBlackFridayCountdown();
      } else {
        startBlackFridayCountdown();
      }
    });
    
    // Performance mark
    if (window.performance && window.performance.mark) {
      performance.mark('product-init-end');
      performance.measure('product-init', 'product-init-start', 'product-init-end');
    }

  } catch (err) {
    console.error('❌ Erro na inicialização:', err);
    
    // UI feedback amigável
    const container = q('.product-page-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:3rem;">
          <h2>Ops! Algo deu errado</h2>
          <p style="color:#666;margin:1rem 0">Não conseguimos carregar este produto.</p>
          <button onclick="window.location.href='index.html'" 
                  style="padding:1rem 2rem;background:#000;color:#fff;border:none;border-radius:6px;cursor:pointer;">
            Voltar para Início
          </button>
        </div>
      `;
    }
  } finally {
    if (loadingOverlay) {
      setTimeout(() => loadingOverlay.classList.remove('active'), 200);
    }
  }
});

/* Espera por db com timeout otimizado */
async function waitForDbReady(msTimeout = 2000) {
  const start = nowMs();
  const checkInterval = 50; // Check a cada 50ms
  
  while ((typeof window.db === 'undefined' || !window.db) && (nowMs() - start < msTimeout)) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  if (typeof window.db === 'undefined' || !window.db) {
    console.error('❌ Firebase não inicializou a tempo!');
    throw new Error('Firebase DB não disponível');
  }
}

/* =========================
   FIRESTORE: LOAD PRODUCT
   ========================= */
async function loadProduct(productId) {
  if (state.isLoading) return;
  state.isLoading = true;
  
  try {
    const doc = await window.db.collection('produtos').doc(productId).get();
    
    if (!doc.exists) {
      throw new Error('Produto não encontrado no Firestore');
    }

    const data = doc.data() || {};

    // Normalizar dados
    data.price = safeNumber(data.price, 0);
    data.oldPrice = data.oldPrice !== undefined ? safeNumber(data.oldPrice, 0) : null;

    // Normalizar imagens
    data.images = Array.isArray(data.images) && data.images.length
      ? data.images.filter(Boolean)
      : (data.image ? [data.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);

    // Normalizar cores
    data.colors = Array.isArray(data.colors) && data.colors.length
      ? data.colors
      : (data.color ? [data.color] : []);

    // Normalizar tamanhos
    data.sizes = Array.isArray(data.sizes) && data.sizes.length
      ? data.sizes
      : ['P', 'M', 'G', 'GG'];

    // Freeze e salvar
    state.currentProduct = Object.freeze({ id: doc.id, ...data });

    // Carregar variantes em paralelo (não bloqueante)
    const variantsPromise = loadProductVariants(productId);

    // Renderizar imediatamente (progressive rendering)
    requestAnimationFrame(() => {
      renderProduct();
    });

    // Aguardar variantes e re-render sizes
    await variantsPromise;
    requestAnimationFrame(() => {
      renderSizes();
    });

    console.log('✅ Produto carregado:', state.currentProduct.name || state.currentProduct.id);
  } catch (err) {
    console.error('❌ Erro loadProduct:', err);
    throw err;
  } finally {
    state.isLoading = false;
  }
}

async function loadProductVariants(productId) {
  try {
    const snapshot = await window.db.collection('produtos').doc(productId).collection('variants').get();
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
    console.log(`✅ Variantes carregadas: ${variants.length}`);
  } catch (err) {
    console.warn('⚠️ Erro ao carregar variantes:', err);
    state.productVariants[productId] = [];
  }
}

/* =========================
   RENDER PRINCIPAL
   ========================= */
function renderProduct() {
  const p = state.currentProduct;
  if (!p) return;

  // Title & Meta
  document.title = `${p.name || 'Produto'} - Seja Versátil`;
  if ($('productPageTitle')) {
    $('productPageTitle').textContent = `${p.name || 'Produto'} - Seja Versátil`;
  }

  // Breadcrumbs
  if ($('breadcrumbCategory')) {
    $('breadcrumbCategory').textContent = getCategoryName(p.category);
  }
  if ($('breadcrumbProduct')) {
    $('breadcrumbProduct').textContent = p.name || '';
  }

  // Nome
  if ($('detailsProductName')) {
    $('detailsProductName').textContent = p.name || '';
  }

  renderPrices();
  renderGallery();
  renderColors();
  renderSizes();
  renderDescription();
  renderRelatedProducts();
}

/* =========================
   PREÇOS
   ========================= */
function renderPrices() {
  const p = state.currentProduct;
  if (!p) return;

  const priceOldEl = $('detailsPriceOld');
  const priceNewEl = $('detailsPriceNew');
  const discountBadge = $('discountBadge');
  const installments = $('detailsInstallments');

  const price = safeNumber(p.price, null);

  if (price === null) {
    if (priceNewEl) priceNewEl.textContent = 'Preço indisponível';
  } else {
    if (priceNewEl) priceNewEl.textContent = `R$ ${price.toFixed(2)}`;
  }

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
    const installmentValue = price / 10;
    installments.textContent = `ou 10x de R$ ${installmentValue.toFixed(2)} sem juros`;
  }
}

/* =========================
   GALERIA - MOBILE FIRST
   ========================= */
function renderGallery() {
  const p = state.currentProduct;
  if (!p) return;

  const images = Array.isArray(p.images) && p.images.length
    ? p.images
    : (p.image ? [p.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);

  const mainImage = $('mainProductImage');
  const thumbnailList = $('thumbnailList');

  if (!mainImage || !thumbnailList) {
    console.error('❌ Elementos da galeria não encontrados!');
    return;
  }

  // Renderizar imagem principal
  const firstImage = images[0];

  if (isImageUrl(firstImage)) {
    mainImage.style.background = '';
    mainImage.style.backgroundImage = `url("${firstImage}")`;
    mainImage.style.backgroundSize = 'cover';
    mainImage.style.backgroundPosition = 'center';
    mainImage.style.backgroundRepeat = 'no-repeat';
  } else if (isGradient(firstImage)) {
    mainImage.style.backgroundImage = '';
    mainImage.style.background = firstImage;
  } else {
    mainImage.style.backgroundImage = '';
    mainImage.style.background = '#f5f5f5';
  }

  mainImage.classList.remove('image-fade-out');

  // Renderizar thumbnails (usando DocumentFragment para performance)
  const fragment = document.createDocumentFragment();
  images.forEach((img, index) => {
    fragment.appendChild(createThumbnail(img, index));
  });
  
  thumbnailList.innerHTML = '';
  thumbnailList.appendChild(fragment);
  
  // Lazy load de imagens (só carregar quando visível)
  if ('IntersectionObserver' in window) {
    const thumbs = thumbnailList.querySelectorAll('.thumbnail');
    thumbs.forEach(thumb => {
      observeElement(thumb, (el) => {
        const imgUrl = el.dataset.src;
        if (isImageUrl(imgUrl)) {
          const img = new Image();
          img.src = imgUrl;
        }
      });
    });
  }
}

/* =========================
   CORES
   ========================= */
function renderColors() {
  const colorSelector = $('colorSelector');
  if (!colorSelector) return;

  const p = state.currentProduct;
  const variants = state.productVariants[p.id] || [];

  let availableColors = [];

  if (Array.isArray(p.colors) && p.colors.length > 0) {
    availableColors = p.colors.map(c => {
      if (typeof c === 'string') {
        return { name: c, hex: getColorHex(c), images: p.images || [] };
      } else {
        return {
          name: c.name || 'Cor',
          hex: c.hex || getColorHex(c.name),
          images: Array.isArray(c.images) && c.images.length ? c.images : (p.images || [])
        };
      }
    });
  } else {
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
  availableColors.forEach((colorObj, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `color-option ${idx === 0 ? 'active' : ''}`;
    btn.title = colorObj.name;
    btn.dataset.color = colorObj.name;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', idx === 0 ? 'true' : 'false');
    btn.setAttribute('aria-label', `Cor ${colorObj.name}`);

    const hex = colorObj.hex || getColorHex(colorObj.name);
    btn.style.background = hex;
    
    if (hex.toLowerCase() === '#ffffff') {
      btn.style.border = '2px solid #ddd';
    }

    btn.addEventListener('click', () => selectColor(colorObj.name, colorObj.images));
    colorSelector.appendChild(btn);
  });

  // Seleção default
  state.selectedColor = availableColors[0].name;
  if ($('selectedColorName')) {
    $('selectedColorName').textContent = state.selectedColor;
  }
}

function selectColor(colorName, images = null) {
  state.selectedColor = colorName;
  
  // Update buttons
  qa('.color-option').forEach(opt => {
    const isActive = opt.dataset.color === colorName;
    opt.classList.toggle('active', isActive);
    opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  
  // Update label
  if ($('selectedColorName')) {
    $('selectedColorName').textContent = colorName;
  }

  // Trocar imagens se disponível
  const p = state.currentProduct;
  if (Array.isArray(p.colors) && p.colors.length) {
    const found = p.colors.find(c => 
      (typeof c === 'string' ? c === colorName : c.name === colorName)
    );
    
    if (found) {
      const imgs = (typeof found === 'string') 
        ? (p.images || []) 
        : (Array.isArray(found.images) && found.images.length ? found.images : (p.images || []));
      
      if (imgs && imgs.length) {
        const thumbnailList = $('thumbnailList');
        if (thumbnailList) {
          thumbnailList.innerHTML = '';
          imgs.forEach((img, idx) => {
            thumbnailList.appendChild(createThumbnail(img, idx));
          });
        }
        changeMainImageFromData(imgs[0], 0);
      }
    }
  }

  // Re-render sizes (estoque pode depender da cor)
  renderSizes();
}

/* =========================
   TAMANHOS
   ========================= */
function renderSizes() {
  const sizeSelector = $('sizeSelector');
  if (!sizeSelector) return;

  const p = state.currentProduct;
  const variants = state.productVariants[p.id] || [];
  const sizes = Array.isArray(p.sizes) && p.sizes.length 
    ? p.sizes 
    : ['P', 'M', 'G', 'GG'];

  sizeSelector.innerHTML = '';

  sizes.forEach((size, idx) => {
    const hasStock = variants.some(v =>
      String(v.size) === String(size) &&
      (state.selectedColor ? String(v.color) === String(state.selectedColor) : true) &&
      v.stock > 0
    );

    const stockItem = variants.find(v =>
      String(v.size) === String(size) &&
      (state.selectedColor ? String(v.color) === String(state.selectedColor) : true)
    );
    
    const stock = stockItem ? safeNumber(stockItem.stock, 0) : 0;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `size-option ${!hasStock ? 'unavailable' : ''}`;
    btn.dataset.size = size;
    btn.disabled = !hasStock;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.setAttribute('aria-label', `Tamanho ${size}`);

    // LIVE! não usa <br>, usa structure com divs
    const sizeText = document.createElement('span');
    sizeText.textContent = size;
    sizeText.style.fontSize = '0.85rem';
    sizeText.style.fontWeight = '700';
    btn.appendChild(sizeText);

    if (!hasStock) {
      const esgotado = document.createElement('small');
      esgotado.textContent = 'Esgotado';
      esgotado.style.fontSize = '0.65rem';
      esgotado.style.color = '#ff4444';
      esgotado.style.fontWeight = '500';
      esgotado.style.marginTop = '2px';
      btn.appendChild(esgotado);
    } else if (stock > 0 && stock <= 3) {
      const ultimas = document.createElement('small');
      ultimas.textContent = 'Últimas';
      ultimas.style.fontSize = '0.65rem';
      ultimas.style.color = '#ff9800';
      ultimas.style.fontWeight = '500';
      ultimas.style.marginTop = '2px';
      btn.appendChild(ultimas);
    }

    btn.addEventListener('click', () => selectSize(size));
    sizeSelector.appendChild(btn);
  });

  // Selecionar primeiro disponível
  const firstAvailable = sizes.find(sz => 
    variants.some(v => 
      String(v.size) === String(sz) && 
      v.stock > 0 && 
      (state.selectedColor ? String(v.color) === String(state.selectedColor) : true)
    )
  );

  if (firstAvailable) {
    selectSize(firstAvailable);
  } else {
    state.selectedSize = null;
    if ($('selectedSizeName')) {
      $('selectedSizeName').textContent = 'Selecione';
    }
  }
}

function selectSize(size) {
  state.selectedSize = size;
  
  // Update buttons
  qa('.size-option').forEach(opt => {
    const isActive = opt.dataset.size === size;
    opt.classList.toggle('active', isActive);
    opt.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  
  // Update label
  if ($('selectedSizeName')) {
    $('selectedSizeName').textContent = size;
  }
}

/* =========================
   DESCRIÇÃO
   ========================= */
function renderDescription() {
  const p = state.currentProduct;
  if (!p) return;

  const descEl = $('productDescription');
  if (!descEl) return;

  const text = p.description || 
    `${p.name || 'Produto'} - Peça versátil e confortável para seus treinos. Fabricado com tecnologia de alta performance, oferece compressão adequada e secagem rápida.`;
  
  descEl.textContent = text;
}

/* =========================
   PRODUTOS RELACIONADOS - LAZY LOAD
   ========================= */
async function renderRelatedProducts() {
  const relatedGrid = $('relatedProductsGrid');
  if (!relatedGrid) return;

  // Lazy load - só carregar quando seção for visível
  observeElement(relatedGrid, async () => {
    try {
      const p = state.currentProduct;
      if (!p) return;

      const relatedSnapshot = await window.db
        .collection('produtos')
        .where('category', '==', p.category)
        .limit(5)
        .get();

      const related = [];
      relatedSnapshot.forEach(doc => {
        if (doc.id !== p.id) {
          related.push({ id: doc.id, ...(doc.data() || {}) });
        }
      });

      if (!related.length) {
        relatedGrid.innerHTML = '<p style="text-align:center;color:#999;padding:3rem;">Nenhum produto relacionado</p>';
        return;
      }

      // Usar DocumentFragment para performance
      const fragment = document.createDocumentFragment();
      
      related.slice(0, 4).forEach(prod => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('role', 'listitem');
        
        // Touch-friendly
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          window.location.href = `produto.html?id=${prod.id}`;
        });

        const images = Array.isArray(prod.images) && prod.images.length 
          ? prod.images 
          : (prod.image ? [prod.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);
        
        const firstImage = images[0];

        const imgWrap = document.createElement('div');
        imgWrap.className = 'product-image';
        
        const slide = document.createElement('div');
        slide.className = 'product-image-slide active';
        
        if (isImageUrl(firstImage)) {
          slide.style.backgroundImage = `url("${firstImage}")`;
          slide.style.backgroundSize = 'cover';
          slide.style.backgroundPosition = 'center';
        } else {
          slide.style.background = firstImage;
        }
        
        imgWrap.appendChild(slide);

        const info = document.createElement('div');
        info.className = 'product-info';
        
        const h4 = document.createElement('h4');
        h4.textContent = prod.name || 'Produto';
        
        const priceDiv = document.createElement('div');
        priceDiv.className = 'product-price';
        
        const priceSpan = document.createElement('span');
        priceSpan.className = 'price-new';
        priceSpan.textContent = `R$ ${safeNumber(prod.price, 0).toFixed(2)}`;

        priceDiv.appendChild(priceSpan);
        info.appendChild(h4);
        info.appendChild(priceDiv);

        card.appendChild(imgWrap);
        card.appendChild(info);
        fragment.appendChild(card);
      });
      
      relatedGrid.innerHTML = '';
      relatedGrid.appendChild(fragment);
      
    } catch (err) {
      console.error('❌ Erro ao renderizar produtos relacionados:', err);
      relatedGrid.innerHTML = '<p style="text-align:center;color:#999;">Erro ao carregar produtos</p>';
    }
  });
}

/* =========================
   QUANTIDADE
   ========================= */
function changeQuantity(delta) {
  const input = $('productQuantity');
  if (!input) {
    state.selectedQuantity = Math.max(1, Math.min(10, state.selectedQuantity + delta));
    return;
  }
  
  let newValue = parseInt(input.value || '1', 10) + delta;
  if (Number.isNaN(newValue)) newValue = state.selectedQuantity;
  
  newValue = Math.max(1, Math.min(10, newValue));
  input.value = newValue;
  state.selectedQuantity = newValue;
}

/* =========================
   CALCULAR FRETE
   ========================= */
function calculateShipping() {
  const zipInput = $('zipCodeInput');
  const resultsDiv = $('shippingResults');
  
  if (!zipInput || !resultsDiv) return;

  const zipCode = zipInput.value.replace(/\D/g, '');
  
  if (zipCode.length !== 8) {
    alert('Por favor, digite um CEP válido com 8 dígitos.');
    return;
  }

  resultsDiv.innerHTML = `
    <div class="shipping-option">
      <div>
        <strong>PAC</strong>
        <small>Entrega em 5-10 dias úteis</small>
      </div>
      <strong>R$ 15,90</strong>
    </div>
    <div class="shipping-option">
      <div>
        <strong>SEDEX</strong>
        <small>Entrega em 2-4 dias úteis</small>
      </div>
      <strong>R$ 25,90</strong>
    </div>
    <div class="shipping-option">
      <div>
        <strong>FRETE GRÁTIS</strong>
        <small>Entrega em 7-12 dias úteis</small>
      </div>
      <strong>R$ 0,00</strong>
    </div>
  `;
  
  resultsDiv.classList.add('active');
}

/* =========================
   CARRINHO
   ========================= */
function addToCartFromDetails() {
  const p = state.currentProduct;
  if (!p) return;

  if (!state.selectedSize) {
    alert('⚠️ Por favor, selecione um tamanho disponível.');
    return;
  }

  if (!state.selectedColor) {
    alert('⚠️ Por favor, selecione uma cor.');
    return;
  }

  if (!Number.isInteger(state.selectedQuantity) || state.selectedQuantity < 1) {
    state.selectedQuantity = 1;
  }

  const cartItemId = `${p.id}__${normalizeIdPart(state.selectedSize)}__${normalizeIdPart(state.selectedColor)}`;
  const existing = state.cart.find(i => i.cartItemId === cartItemId);

  const itemPayload = {
    cartItemId,
    productId: p.id,
    name: p.name,
    price: safeNumber(p.price, 0),
    quantity: state.selectedQuantity,
    selectedSize: state.selectedSize,
    selectedColor: state.selectedColor,
    image: Array.isArray(p.images) && p.images.length ? p.images[0] : (p.image || '')
  };

  if (existing) {
    existing.quantity = safeNumber(existing.quantity, 1) + itemPayload.quantity;
  } else {
    state.cart.push(itemPayload);
  }

  saveCartToStorage();
  updateCartUI();

  // Feedback visual
  const btn = q('.btn-add-to-cart');
  if (btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ Adicionado!';
    btn.style.background = '#00b894';
    btn.style.borderColor = '#00b894';
    
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
      btn.style.borderColor = '';
    }, 2000);
  }

  console.log(`✅ Adicionado: ${state.selectedQuantity}x ${p.name}`);
}

function buyNow() {
  addToCartFromDetails();
  setTimeout(() => {
    toggleCart();
    setTimeout(() => checkout(), 300);
  }, 300);
}

function buyViaWhatsApp() {
  const p = state.currentProduct;
  if (!p) return;

  if (!state.selectedSize) {
    alert('⚠️ Por favor, selecione um tamanho disponível.');
    return;
  }

  if (!state.selectedColor) {
    alert('⚠️ Por favor, selecione uma cor.');
    return;
  }

  const message = `*🛍️ INTERESSE EM PRODUTO - SEJA VERSÁTIL*\n\n` +
    `*Produto:* ${p.name}\n` +
    `*Tamanho:* ${state.selectedSize}\n` +
    `*Cor:* ${state.selectedColor}\n` +
    `*Quantidade:* ${state.selectedQuantity}\n` +
    `*Preço:* R$ ${safeNumber(p.price, 0).toFixed(2)}\n\n` +
    `Gostaria de mais informações sobre este produto.`;

  const whatsappURL = `https://wa.me/5571991427103?text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, '_blank');
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

    const imgDiv = document.createElement('div');
    imgDiv.className = 'cart-item-img';
    
    if (isImageUrl(item.image)) {
      imgDiv.style.backgroundImage = `url("${item.image}")`;
      imgDiv.style.backgroundSize = 'cover';
    } else if (isGradient(item.image)) {
      imgDiv.style.background = item.image;
    } else {
      imgDiv.style.background = '#f0f0f0';
    }

    const info = document.createElement('div');
    info.className = 'cart-item-info';
    
    const title = document.createElement('div');
    title.className = 'cart-item-title';
    title.textContent = item.name;

    const meta = document.createElement('div');
    meta.style.fontSize = '0.75rem';
    meta.style.color = '#666';
    meta.innerHTML = `${item.selectedSize ? `Tamanho: ${item.selectedSize}` : ''}${item.selectedSize && item.selectedColor ? ' | ' : ''}${item.selectedColor ? `Cor: ${item.selectedColor}` : ''}`;

    const price = document.createElement('div');
    price.className = 'cart-item-price';
    price.textContent = `R$ ${safeNumber(item.price, 0).toFixed(2)}`;

    const qtyBox = document.createElement('div');
    qtyBox.className = 'cart-item-qty';
    
    const btnMinus = document.createElement('button');
    btnMinus.className = 'qty-btn';
    btnMinus.textContent = '-';
    btnMinus.setAttribute('aria-label', 'Diminuir quantidade');
    btnMinus.addEventListener('click', () => updateQuantity(item.cartItemId, -1));
    
    const spanQty = document.createElement('span');
    spanQty.textContent = item.quantity;
    
    const btnPlus = document.createElement('button');
    btnPlus.className = 'qty-btn';
    btnPlus.textContent = '+';
    btnPlus.setAttribute('aria-label', 'Aumentar quantidade');
    btnPlus.addEventListener('click', () => updateQuantity(item.cartItemId, 1));
    
    qtyBox.appendChild(btnMinus);
    qtyBox.appendChild(spanQty);
    qtyBox.appendChild(btnPlus);

    const remove = document.createElement('div');
    remove.className = 'remove-item';
    remove.textContent = 'Remover';
    remove.addEventListener('click', () => removeFromCart(item.cartItemId));

    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(price);
    info.appendChild(qtyBox);
    info.appendChild(remove);

    row.appendChild(imgDiv);
    row.appendChild(info);
    cartItems.appendChild(row);
  });

  const total = state.cart.reduce((s, it) => s + (safeNumber(it.price, 0) * safeNumber(it.quantity, 0)), 0);
  
  if (cartTotal) {
    cartTotal.textContent = `R$ ${total.toFixed(2)}`;
  }
  
  if (cartFooter) {
    cartFooter.style.display = 'block';
  }
}

function toggleCart() {
  const sidebar = $('cartSidebar');
  const overlay = $('cartOverlay');
  
  if (sidebar) sidebar.classList.toggle('active');
  if (overlay) overlay.classList.toggle('active');
}

function updateQuantity(cartItemId, change) {
  const item = state.cart.find(i => i.cartItemId === cartItemId);
  if (!item) return;
  
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
  if (!state.cart.length) {
    alert('❌ Seu carrinho está vazio!');
    return;
  }
  openPaymentModal();
}

/* =========================
   PAYMENT MODAL
   ========================= */
function openPaymentModal() {
  const modal = $('paymentModal');
  const itemsContainer = $('paymentCartItems');
  const totalContainer = $('paymentTotal');
  
  if (!modal || !itemsContainer || !totalContainer) return;

  itemsContainer.innerHTML = '';
  
  state.cart.forEach(it => {
    const row = document.createElement('div');
    row.className = 'payment-cart-item';
    
    const left = document.createElement('div');
    
    const name = document.createElement('div');
    name.className = 'payment-cart-item-name';
    name.textContent = it.name;
    
    const details = document.createElement('div');
    details.className = 'payment-cart-item-details';
    details.textContent = `Qtd: ${it.quantity} × R$ ${safeNumber(it.price, 0).toFixed(2)}`;
    
    left.appendChild(name);
    left.appendChild(details);
    
    const right = document.createElement('div');
    right.style.fontWeight = '700';
    right.textContent = `R$ ${(safeNumber(it.quantity) * safeNumber(it.price)).toFixed(2)}`;
    
    row.appendChild(left);
    row.appendChild(right);
    itemsContainer.appendChild(row);
  });

  const total = state.cart.reduce((s, it) => s + (safeNumber(it.price, 0) * safeNumber(it.quantity, 0)), 0);
  totalContainer.textContent = `R$ ${total.toFixed(2)}`;
  
  modal.classList.add('active');
  setupPaymentListeners();
}

function closePaymentModal() {
  const modal = $('paymentModal');
  if (modal) modal.classList.remove('active');
}

function setupPaymentListeners() {
  const paymentOptions = qa('input[name="paymentMethod"]');
  const installmentsBox = $('installmentsBox');
  
  if (!paymentOptions.length || !installmentsBox) return;
  
  paymentOptions.forEach(opt => {
    opt.addEventListener('change', function() {
      installmentsBox.style.display = this.value === 'credito-parcelado' ? 'block' : 'none';
    });
  });
}

function sendToWhatsApp() {
  if (!state.cart.length) return;
  
  const checked = q('input[name="paymentMethod"]:checked');
  if (!checked) {
    alert('⚠️ Por favor, selecione a forma de pagamento.');
    return;
  }
  
  const paymentMethod = checked.value;
  const installments = $('installments') ? $('installments').value : '1';

  const paymentMethods = {
    'pix': 'PIX',
    'boleto': 'Boleto Bancário',
    'credito-avista': 'Cartão de Crédito à Vista',
    'credito-parcelado': `Cartão de Crédito Parcelado em ${installments}x sem juros`
  };

  const total = state.cart.reduce((s, it) => s + (safeNumber(it.price, 0) * safeNumber(it.quantity, 0)), 0);

  let message = `*🛍️ NOVO PEDIDO - SEJA VERSÁTIL*\n\n`;
  message += `*📦 PRODUTOS:*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  state.cart.forEach((item, idx) => {
    message += `${idx + 1}. *${item.name}*\n`;
    if (item.selectedSize || item.selectedColor) {
      message += `   📏 Tamanho: ${item.selectedSize || 'Não selecionado'}\n`;
      message += `   🎨 Cor: ${item.selectedColor || 'Não selecionada'}\n`;
    }
    message += `   Qtd: ${item.quantity}\n`;
    message += `   Valor Unit.: R$ ${safeNumber(item.price, 0).toFixed(2)}\n`;
    message += `   Subtotal: R$ ${(safeNumber(item.price, 0) * safeNumber(item.quantity, 0)).toFixed(2)}\n\n`;
  });
  
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `*💰 VALOR TOTAL: R$ ${total.toFixed(2)}*\n\n`;
  message += `*💳 FORMA DE PAGAMENTO:*\n${paymentMethods[paymentMethod] || paymentMethod}\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `_Pedido gerado automaticamente via site_`;

  const whatsappURL = `https://wa.me/5571991427103?text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, '_blank');
  
  closePaymentModal();
}

/* =========================
   HELPERS
   ========================= */
function getCategoryName(category) {
  if (!category) return 'Todos os Produtos';
  
  const names = {
    'blusas': 'Blusas',
    'conjunto calca': 'Conjunto Calça',
    'peca unica': 'Peça Única',
    'conjunto short saia': 'Conjunto Short Saia',
    'conjunto short': 'Conjunto Short',
    'all': 'Todos os Produtos'
  };
  
  return names[category.toLowerCase()] || String(category).toUpperCase();
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
    'Bege': '#F5F5DC',
    'Roxo': '#800080',
    'Laranja': '#FF8C00',
    'Marrom': '#8B4513',
    'Dourado': '#FFD700',
    'Prata': '#C0C0C0'
  };
  
  return colorMap[colorName] || '#999999';
}

/* =========================
   SIDEBAR TOGGLE
   ========================= */
function toggleSidebar() {
  const sidebar = $('sidebarMenu');
  const overlay = $('sidebarOverlay');
  const btn = $('hamburgerBtn');
  
  if (sidebar) sidebar.classList.toggle('active');
  if (overlay) overlay.classList.toggle('active');
  if (btn) btn.classList.toggle('active');
}

/* =========================
   BLACK FRIDAY COUNTDOWN
   ========================= */
function startBlackFridayCountdown() {
  // Data: 30 de novembro de 2025 23:59:59
  const blackFridayEnd = new Date(2025, 10, 30, 23, 59, 59);
  
  if (state.countdownInterval) {
    clearInterval(state.countdownInterval);
  }

  function updateCountdown() {
    const now = Date.now();
    const distance = blackFridayEnd.getTime() - now;
    
    if (distance <= 0) {
      clearInterval(state.countdownInterval);
      // Opcional: esconder banner
      const banner = q('.black-friday-banner');
      if (banner) banner.style.display = 'none';
      return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if ($('bfDays')) $('bfDays').textContent = String(days).padStart(2, '0');
    if ($('bfHours')) $('bfHours').textContent = String(hours).padStart(2, '0');
    if ($('bfMinutes')) $('bfMinutes').textContent = String(minutes).padStart(2, '0');
    if ($('bfSeconds')) $('bfSeconds').textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  state.countdownInterval = setInterval(updateCountdown, 1000);
}

// Alias para compatibilidade
function initBlackFridayCountdown() {
  startBlackFridayCountdown();
}

/* =========================
   MÁSCARA CEP
   ========================= */
document.addEventListener('input', (e) => {
  if (!e.target) return;
  
  if (e.target.id === 'zipCodeInput') {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 5) {
      v = v.slice(0, 5) + '-' + v.slice(5, 8);
    }
    e.target.value = v;
  }
});

/* =========================
   CLOSE PRODUCT DETAILS (Modal)
   ========================= */
function closeProductDetails() {
  const modal = $('productDetailsModal');
  
  if (!modal) {
    // Se não há modal, voltar para página anterior
    console.log('🔙 Voltando para página anterior...');
    window.history.back();
    return;
  }
  
  // Se modal existe (caso seja chamado do index.html)
  modal.classList.add('closing');
  
  const animationDuration = 300;
  setTimeout(() => {
    modal.classList.remove('active', 'closing');
    
    // Limpar conteúdo do modal
    const mainImage = $('mainProductImage');
    if (mainImage) {
      mainImage.style.backgroundImage = '';
    }
    
    const thumbnailList = $('thumbnailList');
    if (thumbnailList) thumbnailList.innerHTML = '';
    
    // Reset seleções
    const selectedColorName = $('selectedColorName');
    if (selectedColorName) selectedColorName.textContent = '';
    
    const selectedSizeName = $('selectedSizeName');
    if (selectedSizeName) selectedSizeName.textContent = '';
  }, animationDuration);
  
  // Fechar overlay
  const overlay = $('modalOverlay') || $('cartOverlay');
  if (overlay) overlay.classList.remove('active');
}

/* =========================
   UNHANDLED REJECTIONS
   ========================= */
window.addEventListener('unhandledrejection', (event) => {
  console.warn('⚠️ Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Evitar erro no console em produção
});

/* =========================
   EXPOR FUNÇÕES GLOBAIS
   ========================= */
window.produtoModule = {
  changeQuantity,
  calculateShipping,
  addToCartFromDetails,
  buyNow,
  toggleCart,
  checkout,
  sendToWhatsApp,
  toggleSidebar,
  closeProductDetails,
  closePaymentModal,
  openPaymentModal
};

// Expor funções individuais para compatibilidade com HTML
window.changeQuantity = changeQuantity;
window.calculateShipping = calculateShipping;
window.addToCartFromDetails = addToCartFromDetails;
window.buyNow = buyNow;
window.buyViaWhatsApp = buyViaWhatsApp;
window.toggleCart = toggleCart;
window.checkout = checkout;
window.sendToWhatsApp = sendToWhatsApp;
window.toggleSidebar = toggleSidebar;
window.closeProductDetails = closeProductDetails;
window.closePaymentModal = closePaymentModal;
window.initBlackFridayCountdown = initBlackFridayCountdown;

/* =========================
   PERFORMANCE MONITORING
   ========================= */
if (window.performance && window.performance.timing) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      console.log(`⚡ Página carregada em ${loadTime}ms`);
    }, 0);
  });
}

/* =========================
   FIM DO CÓDIGO
   ========================= */
console.log('✅ produto.js carregado e pronto (estilo LIVE!)');
