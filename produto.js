// produto.js - Versão profissional, compatível com o HTML fornecido
// Mantém IDs e contratos usados pelo HTML: mainProductImage, thumbnailList, detailsProductName, etc.

'use strict';

/* =========================
   Estado global (único)
   ========================= */
window.productState = window.productState || {};

const state = {
  currentProduct: null,
  selectedColor: null,
  selectedSize: null,
  selectedQuantity: 1,
  cart: [],
  productVariants: {}, // { productId: [variants] }
  countdownInterval: null
};

window.productState = state;

/* =========================
   Utilitários DOM e helpers
   ========================= */
const $ = (id) => document.getElementById(id);
const q = (sel, ctx = document) => ctx.querySelector(sel);
const qa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
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
    // keep backward compat if other script expects window.cart
    if (window.cart) window.cart = state.cart;
  } catch (err) {
    console.warn('Erro ao carregar carrinho:', err);
    state.cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem('sejaVersatilCart', JSON.stringify(state.cart));
  } catch (err) {
    console.warn('Erro ao salvar carrinho', err);
  }
}

/* =========================
   Criação de thumbnails
   ========================= */
function createThumbnail(img, index) {
  const thumb = document.createElement('div');
  thumb.className = 'thumbnail';
  thumb.dataset.index = String(index);
  thumb.dataset.src = img;
  thumb.setAttribute('role', 'button');
  thumb.setAttribute('aria-label', `Ver imagem ${index + 1}`);
  thumb.setAttribute('tabindex', '0');

  // Style com melhor handling
  if (isImageUrl(img)) {
    thumb.style.backgroundImage = `url("${img}")`;
    thumb.style.backgroundSize = 'cover';
    thumb.style.backgroundPosition = 'center';
  } else if (isGradient(img)) {
    thumb.style.background = img;
  } else {
    thumb.style.background = '#f0f0f0';
  }

  if (index === 0) thumb.classList.add('active');

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
   Mudar imagem principal
   ========================= */
function changeMainImageFromData(imageSrc, index = 0) {
  const mainImage = $('mainProductImage');
  if (!mainImage) return;

  // Animação suave LIVE! style
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
  }, 150); // Timing similar ao LIVE!
}

/* =========================
   Inicialização da página
   ========================= */
document.addEventListener('DOMContentLoaded', async () => {
  const loadingOverlay = $('loadingOverlay');
  if (loadingOverlay) loadingOverlay.classList.add('active');

  try {
    console.log('🚀 Inicializando produto...');

    // carregar carrinho local
    loadCartFromStorage();
    updateCartUI();

    // pegar productId da URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    if (!productId) {
      console.warn('Parametro id ausente - redirecionando');
      // fallback: não quebrajs
      // window.location.href = 'index.html';
    } else {
      // aguardar Firestore iniciar (db global)
      await waitForDbReady(3000); // 3s total
      if (typeof db === 'undefined' || !db) {
        throw new Error('Firestore não disponível');
      }
      await loadProduct(productId);
    }

    // start countdown if element exists
    if (typeof initBlackFridayCountdown === 'function') initBlackFridayCountdown();

  } catch (err) {
    console.error('Erro na inicialização do produto:', err);
    // não forçar redirect se estamos em desenvolvimento - mas original fazia
    // window.location.href = 'index.html';
  } finally {
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }
});

/* Espera simples por db inicializado (máx msTimeout) */
async function waitForDbReady(msTimeout = 3000) {
  const start = nowMs();
  while ((typeof db === 'undefined' || !db) && (nowMs() - start < msTimeout)) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (typeof db === 'undefined' || !db) {
    console.error('❌ Firebase não inicializou!');
    throw new Error('Firebase DB não disponível');
  }
}

/* =========================
   Firestore: loadProduct & variants
   ========================= */
async function loadProduct(productId) {
  try {
    const doc = await db.collection('produtos').doc(productId).get();
    if (!doc.exists) throw new Error('Produto não encontrado no Firestore');
    const data = doc.data() || {};

    // Normalize data
    data.price = safeNumber(data.price, 0);
    data.oldPrice = data.oldPrice !== undefined ? safeNumber(data.oldPrice, 0) : null;

    data.images = Array.isArray(data.images) && data.images.length
      ? data.images.filter(Boolean)
      : (data.image ? [data.image] : []);

    data.colors = Array.isArray(data.colors) && data.colors.length
      ? data.colors
      : (data.colors ? [data.colors] : []);

    data.sizes = Array.isArray(data.sizes) && data.sizes.length
      ? data.sizes
      : ['P', 'M', 'G', 'GG'];

 // freeze shallow
state.currentProduct = Object.freeze({ id: doc.id, ...data });

// load variants collection if exists
await loadProductVariants(productId);

// render - AGUARDAR o próximo frame
await new Promise(resolve => requestAnimationFrame(resolve));
renderProduct();

    console.log('Produto carregado:', state.currentProduct.name || state.currentProduct.id);
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
    console.log(`Variants carregadas: ${variants.length}`);
  } catch (err) {
    console.warn('Erro ao carregar variantes (continua sem variantes):', err);
    state.productVariants[productId] = [];
  }
}

/* =========================
   Render principal
   ========================= */
function renderProduct() {
  const p = state.currentProduct;
  if (!p) return;

  // Title
  document.title = `${p.name || 'Produto'} - Seja Versátil`;
  if (elExists('productPageTitle')) $('productPageTitle').textContent = `${p.name || 'Produto'} - Seja Versátil`;

  // Breadcrumbs
  if (elExists('breadcrumbCategory')) $('breadcrumbCategory').textContent = getCategoryName(p.category);
  if (elExists('breadcrumbProduct')) $('breadcrumbProduct').textContent = p.name || '';

  // Nome
  if (elExists('detailsProductName')) $('detailsProductName').textContent = p.name || '';

  renderPrices();
  renderGallery();
  renderColors();
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
      discountBadge.style.display = 'inline-block';
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
   Galeria e thumbnails
   ========================= */
function renderGallery() {
  const p = state.currentProduct;
  if (!p) return;

  const images = Array.isArray(p.images) && p.images.length
    ? p.images
    : (p.image ? [p.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);

  const mainImage = $('mainProductImage');
if (mainImage) {
  // ✅ CORREÇÃO: Setar background IMEDIATAMENTE (sem delay)
  const firstImage = images[0];
  
  if (isImageUrl(firstImage)) {
  mainImage.style.background = '';  // ← Limpar ANTES
  mainImage.style.backgroundImage = `url("${firstImage}")`;
  mainImage.style.backgroundSize = 'cover';
  mainImage.style.backgroundPosition = 'center';
  mainImage.style.backgroundRepeat = 'no-repeat';
}
  } else if (isGradient(firstImage)) {
    mainImage.style.backgroundImage = '';
    mainImage.style.background = firstImage;
  } else {
    mainImage.style.backgroundImage = '';
    mainImage.style.background = '#f5f5f5';
  }
  
  // Depois atualiza thumbnails
  const thumbs = qa('.thumbnail');
  thumbs.forEach((t, i) => {
    t.classList.toggle('active', i === 0);
    t.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
  });
} else {
  console.error('❌ Elemento #mainProductImage não encontrado no HTML!');
}

  const thumbnailList = $('thumbnailList');
  if (thumbnailList) {
    thumbnailList.innerHTML = '';
    images.forEach((img, idx) => {
      const thumb = createThumbnail(img, idx);
      thumbnailList.appendChild(thumb);
    });
  } else {
    console.error('❌ Elemento #thumbnailList não encontrado no HTML!');
  }
} 

/* =========================
   Cores
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
    availableColors = unique.map(name => ({ name, hex: getColorHex(name), images: p.images || [] }));
  }

  if (!availableColors.length) {
    const group = colorSelector.closest && colorSelector.closest('.product-selector-group');
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

    const hex = colorObj.hex || getColorHex(colorObj.name);
    btn.style.background = hex;
    if (hex.toLowerCase() === '#ffffff') btn.style.border = '2px solid #ddd';

    btn.addEventListener('click', () => selectColor(colorObj.name));
    colorSelector.appendChild(btn);
  });

  // default selection
  state.selectedColor = availableColors[0].name;
  if (elExists('selectedColorName')) $('selectedColorName').textContent = state.selectedColor;
}

/* chamada ao selecionar cor */
function selectColor(colorName) {
  state.selectedColor = colorName;
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.color === colorName);
  });
  if (elExists('selectedColorName')) $('selectedColorName').textContent = colorName;

  // trocar imagens caso cor tenha imagens específicas
  const p = state.currentProduct;
  if (Array.isArray(p.colors) && p.colors.length) {
    const found = p.colors.find(c => (typeof c === 'string' ? c === colorName : c.name === colorName));
    if (found) {
      const imgs = (typeof found === 'string') ? (p.images || []) : (Array.isArray(found.images) ? found.images : (p.images || []));
      if (imgs && imgs.length) {
        const thumbnailList = $('thumbnailList');
        if (thumbnailList) {
          thumbnailList.innerHTML = '';
          imgs.forEach((img, idx) => thumbnailList.appendChild(createThumbnail(img, idx)));
        }
        changeMainImageFromData(imgs[0], 0);
      }
    }
  }

  // re-render sizes as stock may depend on color
  renderSizes();
}

/* =========================
   Tamanhos
   ========================= */
function renderSizes() {
  const sizeSelector = $('sizeSelector');
  if (!sizeSelector) return;
  const p = state.currentProduct;
  const variants = state.productVariants[p.id] || [];

  const sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['P', 'M', 'G', 'GG'];

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
    btn.className = `size-option ${idx === 1 ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}`;
    btn.dataset.size = size;
    btn.disabled = !hasStock;
    btn.innerHTML = size + (!hasStock ? '<br><small style="font-size:0.7rem;color:red;">Esgotado</small>' : (stock > 0 && stock <= 3 ? '<br><small style="font-size:0.7rem;color:#ff9800;">Últimas unidades</small>' : ''));
    btn.addEventListener('click', () => selectSize(size));
    sizeSelector.appendChild(btn);
  });

  const firstAvailable = sizes.find(sz => state.productVariants[state.currentProduct.id]?.some(v => String(v.size) === String(sz) && v.stock > 0 && (state.selectedColor ? String(v.color) === String(state.selectedColor) : true)));
  state.selectedSize = firstAvailable || null;
  if (elExists('selectedSizeName')) $('selectedSizeName').textContent = state.selectedSize || '-';
}

function selectSize(size) {
  state.selectedSize = size;
  document.querySelectorAll('.size-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.size === size);
  });
  if (elExists('selectedSizeName')) $('selectedSizeName').textContent = size;
}

/* =========================
   Descrição
   ========================= */
function renderDescription() {
  const p = state.currentProduct;
  if (!p) return;
  const descEl = $('productDescription');
  if (!descEl) return;
  const text = p.description || `${p.name || 'Produto'} - Peça versátil e confortável. Tecnologia de alta performance.`;
  descEl.textContent = text;
}

/* =========================
   Produtos relacionados
   ========================= */
async function renderRelatedProducts() {
  try {
    const p = state.currentProduct;
    if (!p) return;
    const relatedGrid = $('relatedProductsGrid');
    if (!relatedGrid) return;

    const relatedSnapshot = await db.collection('produtos').where('category', '==', p.category).limit(5).get();
    const related = [];
    relatedSnapshot.forEach(doc => {
      if (doc.id !== p.id) related.push({ id: doc.id, ...(doc.data() || {}) });
    });

    if (!related.length) {
      relatedGrid.innerHTML = '<p style="text-align:center;color:#999;">Nenhum produto relacionado encontrado</p>';
      return;
    }

    relatedGrid.innerHTML = '';
    related.slice(0, 4).forEach(prod => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.addEventListener('click', () => window.location.href = `produto.html?id=${prod.id}`);

      const images = Array.isArray(prod.images) && prod.images.length ? prod.images : (prod.image ? [prod.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);
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
      relatedGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao renderizar produtos relacionados', err);
  }
}

/* =========================
   Quantidade
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

/* =========================
   Calcular Frete (mock)
   ========================= */
function calculateShipping() {
  const zipInput = $('zipCodeInput');
  const resultsDiv = $('shippingResults');
  if (!zipInput || !resultsDiv) return;
  const zipCode = zipInput.value.replace(/\D/g, '');
  if (zipCode.length !== 8) {
    alert('Digite um CEP válido (8 dígitos).');
    return;
  }
  resultsDiv.innerHTML = `
    <div class="shipping-option">
      <div><strong>PAC</strong><br><small>Entrega em 5-10 dias úteis</small></div>
      <strong>R$ 15,90</strong>
    </div>
    <div class="shipping-option">
      <div><strong>SEDEX</strong><br><small>Entrega em 2-4 dias úteis</small></div>
      <strong>R$ 25,90</strong>
    </div>
    <div class="shipping-option">
      <div><strong>GRÁTIS</strong><br><small>Entrega em 7-12 dias úteis</small></div>
      <strong>R$ 0,00</strong>
    </div>
  `;
  resultsDiv.classList.add('active');
}

/* =========================
   Carrinho
   ========================= */
function addToCartFromDetails() {
  const p = state.currentProduct;
  if (!p) return;

  if (!state.selectedSize) {
    alert('Selecione um tamanho disponível.');
    return;
  }
  if (!state.selectedColor) {
    alert('Selecione uma cor.');
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

  alert(`✅ ${state.selectedQuantity}x ${p.name} (${state.selectedSize}, ${state.selectedColor}) adicionado ao carrinho!`);
}

function buyNow() {
  addToCartFromDetails();
  toggleCart();
  checkout();
}

function loadCart() { loadCartFromStorage(); }
function saveCart() { saveCartToStorage(); }

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
      imgDiv.style.background = '#eee';
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
    btnMinus.addEventListener('click', () => updateQuantity(item.cartItemId, -1));
    const spanQty = document.createElement('span');
    spanQty.textContent = item.quantity;
    const btnPlus = document.createElement('button');
    btnPlus.className = 'qty-btn';
    btnPlus.textContent = '+';
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
  if (cartTotal) cartTotal.textContent = `R$ ${total.toFixed(2)}`;
  if (cartFooter) cartFooter.style.display = 'block';
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
    saveCart();
    updateCartUI();
  }
}

function removeFromCart(cartItemId) {
  state.cart = state.cart.filter(i => i.cartItemId !== cartItemId);
  saveCart();
  updateCartUI();
}

function checkout() {
  if (!state.cart.length) {
    alert('Seu carrinho está vazio!');
    return;
  }
  openPaymentModal();
}

/* =========================
   Payment Modal / WhatsApp
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
    details.textContent = `Qtd: ${it.quantity} × R$ ${safeNumber(it.price,0).toFixed(2)}`;
    left.appendChild(name);
    left.appendChild(details);
    const right = document.createElement('div');
    right.style.fontWeight = 700;
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
  const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
  const installmentsBox = $('installmentsBox');
  if (!paymentOptions.length || !installmentsBox) return;
  paymentOptions.forEach(opt => {
    opt.addEventListener('change', function () {
      installmentsBox.style.display = this.value === 'credito-parcelado' ? 'block' : 'none';
    });
  });
}

function sendToWhatsApp() {
  if (!state.cart.length) return;
  const checked = document.querySelector('input[name="paymentMethod"]:checked');
  if (!checked) {
    alert('Selecione a forma de pagamento.');
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

  const total = state.cart.reduce((s, it) => s + (safeNumber(it.price,0) * safeNumber(it.quantity,0)), 0);

  let message = `*🛍️ NOVO PEDIDO - SEJA VERSÁTIL*\n\n*📦 PRODUTOS:*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  state.cart.forEach((item, idx) => {
    message += `${idx + 1}. *${item.name}*\n`;
    if (item.selectedSize || item.selectedColor) {
      message += `   📏 Tamanho: ${item.selectedSize || 'Não selecionado'}\n`;
      message += `   🎨 Cor: ${item.selectedColor || 'Não selecionada'}\n`;
    }
    message += `   Qtd: ${item.quantity}\n`;
    message += `   Valor Unit.: R$ ${safeNumber(item.price,0).toFixed(2)}\n`;
    message += `   Subtotal: R$ ${(safeNumber(item.price,0) * safeNumber(item.quantity,0)).toFixed(2)}\n\n`;
  });
  message += `━━━━━━━━━━━━━━━━━━━━\n*💰 VALOR TOTAL: R$ ${total.toFixed(2)}*\n\n`;
  message += `*💳 FORMA DE PAGAMENTO:*\n${paymentMethods[paymentMethod] || paymentMethod}\n\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n_Pedido gerado automaticamente via site_`;

  const whatsappURL = `https://wa.me/5571991427103?text=${encodeURIComponent(message)}`;
  window.open(whatsappURL, '_blank');
  closePaymentModal();
}

/* =========================
   Helpers
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
    'Bege': '#F5F5DC'
  };
  return colorMap[colorName] || '#999999';
}

/* =========================
   Sidebar toggle
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
   Black Friday countdown
   ========================= */
function initBlackFridayCountdown() {
  // data: 30 de novembro de 2025 23:59:59
  const blackFridayEnd = new Date(2025, 10, 30, 23, 59, 59);
  if (state.countdownInterval) clearInterval(state.countdownInterval);

  function updateCountdown() {
    const now = Date.now();
    const distance = blackFridayEnd.getTime() - now;
    if (distance <= 0) {
      clearInterval(state.countdownInterval);
      // hide banner optionally
      return;
    }
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (elExists('bfDays')) $('bfDays').textContent = String(days).padStart(2, '0');
    if (elExists('bfHours')) $('bfHours').textContent = String(hours).padStart(2, '0');
    if (elExists('bfMinutes')) $('bfMinutes').textContent = String(minutes).padStart(2, '0');
    if (elExists('bfSeconds')) $('bfSeconds').textContent = String(seconds).padStart(2, '0');
  }

  updateCountdown();
  state.countdownInterval = setInterval(updateCountdown, 1000);
}

/* =========================
   Máscara CEP (input event)
   ========================= */
document.addEventListener('input', (e) => {
  if (!e.target) return;
  if (e.target.id === 'zipCodeInput') {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
    e.target.value = v;
  }
});

/* =========================
   Unhandled promise rejections (dev)
   ========================= */
window.addEventListener('unhandledrejection', (event) => {
  console.warn('Unhandled promise rejection:', event.reason);
});

/* =========================
   Close product details modal
   ========================= */
function closeProductDetails() {
  // ✅ CORREÇÃO: Na página produto.html, não há modal para fechar
  // Esta função só deve funcionar se houver um modal overlay
  const modal = $('productDetailsModal');
  
  if (!modal) {
    // Se não há modal, voltamos para a página anterior
    console.log('🔙 Voltando para página anterior...');
    window.history.back();
    return;
  }
  
  // Se o modal existe (caso seja chamado do index.html)
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
   Expor funções para HTML (compat)
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
  closeProductDetails
};

// ✅ ADICIONE ESTA LINHA: Expor closeProductDetails globalmente
window.closeProductDetails = closeProductDetails;

/* =========================
   Final log
   ========================= */
console.log('✅ produto.js carregado e pronto.');










