// produto.js - Versão Final "Mosaico Live!" 
// Compatível com HTML atualizado e CSS Grid

'use strict';

/* =========================
   Estado global
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
    
    data.images = Array.isArray(data.images) && data.images.length
      ? data.images.filter(Boolean)
      : (data.image ? [data.image] : []);
      
    data.colors = Array.isArray(data.colors) && data.colors.length
      ? data.colors
      : (data.colors ? [data.colors] : []);
      
    data.sizes = Array.isArray(data.sizes) && data.sizes.length
      ? data.sizes
      : ['P', 'M', 'G', 'GG'];

    state.currentProduct = Object.freeze({ id: doc.id, ...data });
    
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
  renderGallery(); // Chama a nova galeria mosaico
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

  if (installments && price) {
    const installmentValue = price / 10;
    installments.textContent = `ou 10x de R$ ${installmentValue.toFixed(2)} sem juros`;
  }
}

/* =========================
   Galeria (Estilo Mosaico)
   ========================= */
/* =========================
   Galeria Mosaico com "Mostrar Mais"
   ========================= */
function renderGallery(specificImages = null) {
  const p = state.currentProduct;
  if (!p) return;

  const galleryContainer = document.getElementById('galleryContainer');
  const btnShowMore = document.getElementById('btnShowMore');

  if (!galleryContainer) return;

  // Limpa conteúdo anterior
  galleryContainer.innerHTML = '';

  // Define quais imagens usar
  let imagesToRender = specificImages;
  if (!imagesToRender) {
      imagesToRender = Array.isArray(p.images) && p.images.length
        ? p.images
        : (p.image ? [p.image] : []);
  }

  // Loop para criar as fotos
  imagesToRender.forEach((img, index) => {
    const photoDiv = document.createElement('div');
    photoDiv.className = 'gallery-photo-full';

    // Lógica LIVE!: Mostra apenas as 2 primeiras (index 0 e 1). 
    // Oculta da 3ª em diante (index >= 2).
    if (index >= 2) {
        photoDiv.classList.add('gallery-hidden');
    }

    if (isImageUrl(img)) {
      photoDiv.style.backgroundImage = `url("${img}")`;
    } else if (isGradient(img)) {
      photoDiv.style.background = img;
    } else {
      photoDiv.style.background = '#eee';
    }

    galleryContainer.appendChild(photoDiv);
  });

  // Lógica do Botão Mostrar Mais
  if (btnShowMore) {
      // Se tivermos mais de 2 imagens, mostra o botão
      if (imagesToRender.length > 2) {
          btnShowMore.style.display = 'flex';
          
          // Evento de clique
          btnShowMore.onclick = function() {
              // Remove a classe 'gallery-hidden' de todas as fotos escondidas
              const hiddenPhotos = galleryContainer.querySelectorAll('.gallery-hidden');
              hiddenPhotos.forEach(photo => {
                  photo.classList.remove('gallery-hidden');
                  // Pequena animação de fade (opcional)
                  photo.style.opacity = '0';
                  photo.style.transition = 'opacity 0.5s';
                  requestAnimationFrame(() => photo.style.opacity = '1');
              });
              
              // Esconde o botão após expandir
              this.style.display = 'none';
          };
      } else {
          // Se tiver 2 ou menos, não precisa de botão
          btnShowMore.style.display = 'none';
      }
  }
}

/* =========================
   Cores
   ========================= */
function renderColors() {
  const colorSelector = $('colorSelector');
  if (!colorSelector) return;
  const p = state.currentProduct;
  
  // Prepara lista de cores disponíveis
  const variants = state.productVariants[p.id] || [];
  let availableColors = [];

  if (Array.isArray(p.colors) && p.colors.length > 0) {
    // Se o produto tem cores definidas
    availableColors = p.colors.map(c => {
      if (typeof c === 'string') return { name: c, hex: getColorHex(c), images: p.images || [] };
      else return { name: c.name || 'Cor', hex: c.hex || getColorHex(c.name), images: c.images || p.images || [] };
    });
  } else {
    // Tenta extrair das variantes
    const unique = [...new Set(variants.map(v => v.color).filter(Boolean))];
    availableColors = unique.map(name => ({ name, hex: getColorHex(name), images: p.images || [] }));
  }

  if (!availableColors.length) {
     const group = colorSelector.closest('.product-selector-group');
     if(group) group.style.display = 'none';
     return;
  }

  colorSelector.innerHTML = '';
  availableColors.forEach((colorObj) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    // Adiciona classe 'active' se for a cor selecionada
    btn.className = `color-option ${state.selectedColor === colorObj.name ? 'active' : ''}`; 
    btn.title = colorObj.name;
    btn.dataset.color = colorObj.name;

    const hex = colorObj.hex || getColorHex(colorObj.name);
    btn.style.background = hex;
    
    // Borda sutil para branco
    if (hex.toLowerCase() === '#ffffff' || hex.toLowerCase() === '#fff') {
        btn.style.border = '1px solid #ccc';
    }

    // Clique chama a função unificada
    btn.addEventListener('click', () => selectColor(colorObj.name, colorObj.images));
    colorSelector.appendChild(btn);
  });

  // Auto-selecionar primeira cor se nenhuma estiver selecionada
  if (!state.selectedColor && availableColors.length) {
      // Apenas define estado, não re-renderiza galeria para evitar loop
      state.selectedColor = availableColors[0].name;
      if (elExists('selectedColorName')) $('selectedColorName').textContent = state.selectedColor;
      // Renderiza visualmente o botão ativo
      const firstBtn = colorSelector.querySelector('.color-option');
      if(firstBtn) firstBtn.classList.add('active');
  }
}

/* Função Unificada de Seleção de Cor */
function selectColor(colorName, specificImages = null) {
  state.selectedColor = colorName;
  
  // 1. Atualiza UI dos botões (Círculo/Quadrado ativo)
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.color === colorName);
  });
  
  // 2. Atualiza texto da cor
  if (elExists('selectedColorName')) $('selectedColorName').textContent = colorName;

  // 3. ATUALIZA A GALERIA INTEIRA (Lógica Mosaico)
  if (specificImages && Array.isArray(specificImages) && specificImages.length > 0) {
      renderGallery(specificImages);
  } else {
      // Se não passou imagens diretas, tenta achar no objeto do produto original
      const p = state.currentProduct;
      const found = p.colors && p.colors.find(c => (typeof c === 'string' ? c === colorName : c.name === colorName));
      
      if (found && found.images && found.images.length) {
          renderGallery(found.images);
      } else {
          // Se não tem fotos específicas da cor, restaura a galeria padrão
          renderGallery(); 
      }
  }

  // 4. Re-calcula tamanhos disponíveis para esta cor
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

  sizes.forEach((size) => {
    // Lógica de Estoque
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

    // 1. Cria o Wrapper (Container vertical)
    const wrapper = document.createElement('div');
    wrapper.className = 'size-wrapper';

    // 2. Cria o Botão (Apenas a letra do tamanho)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `size-option ${state.selectedSize === size ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}`;
    btn.textContent = size; // Apenas P, M, G...
    btn.disabled = !hasStock;
    
    btn.onclick = () => selectSize(size);

    // 3. Cria a mensagem de baixo (se necessário)
    wrapper.appendChild(btn);

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

    // Adiciona o wrapper ao grid principal
    sizeSelector.appendChild(wrapper);
  });
  
  // Atualiza nome do tamanho selecionado se houver
  if (elExists('selectedSizeName')) $('selectedSizeName').textContent = state.selectedSize || '-';
}

/* =========================
   Descrição & Relacionados
   ========================= */
function renderDescription() {
  const p = state.currentProduct;
  if (!p) return;
  const descEl = $('productDescription');
  if (!descEl) return;
  // Mantém texto simples se não houver HTML
  descEl.textContent = p.description || `${p.name} - Peça versátil e confortável. Tecnologia de alta performance.`;
}

async function renderRelatedProducts() {
  try {
    const p = state.currentProduct;
    if (!p) return;
    const relatedGrid = $('relatedProductsGrid');
    if (!relatedGrid) return;

    const relatedSnapshot = await db.collection('produtos')
        .where('category', '==', p.category)
        .limit(5)
        .get();

    const related = [];
    relatedSnapshot.forEach(doc => {
      if (doc.id !== p.id) related.push({ id: doc.id, ...(doc.data() || {}) });
    });

    if (!related.length) {
      relatedGrid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;">Nenhum produto similar no momento.</p>';
      return;
    }

    relatedGrid.innerHTML = '';
    related.slice(0, 4).forEach(prod => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.addEventListener('click', () => window.location.href = `produto.html?id=${prod.id}`);

      const images = Array.isArray(prod.images) && prod.images.length ? prod.images : (prod.image ? [prod.image] : []);
      const firstImage = images[0];

      const imgWrap = document.createElement('div');
      imgWrap.className = 'product-image';
      const slide = document.createElement('div');
      slide.className = 'product-image-slide'; // remove active, css handles hover
      
      if (isImageUrl(firstImage)) {
        slide.style.backgroundImage = `url("${firstImage}")`;
      } else {
        slide.style.background = '#eee';
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
  if (!state.selectedSize) { alert('Selecione um tamanho.'); return; }
  if (!state.selectedColor) { alert('Selecione uma cor.'); return; }

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

    const imgDiv = document.createElement('div');
    imgDiv.className = 'cart-item-img';
    if (isImageUrl(item.image)) {
      imgDiv.style.backgroundImage = `url("${item.image}")`;
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

  const total = state.cart.reduce((s, it) => s + (safeNumber(it.price) * safeNumber(it.quantity)), 0);
  if (cartTotal) cartTotal.textContent = `R$ ${total.toFixed(2)}`;
  if (cartFooter) cartFooter.style.display = 'block';
}

function updateQuantity(cartItemId, change) {
  const item = state.cart.find(i => i.cartItemId === cartItemId);
  if (!item) return;
  item.quantity = safeNumber(item.quantity, 0) + change;
  if (item.quantity <= 0) removeFromCart(cartItemId);
  else {
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
  if (!state.cart.length) return alert('Carrinho vazio!');
  openPaymentModal();
}

/* =========================
   Modal Pagamento / WhatsApp
   ========================= */
function openPaymentModal() {
  const modal = $('paymentModal');
  const itemsContainer = $('paymentCartItems');
  const totalContainer = $('paymentTotal');
  if (!modal || !itemsContainer) return;

  itemsContainer.innerHTML = '';
  state.cart.forEach(it => {
    const row = document.createElement('div');
    row.className = 'payment-cart-item';
    
    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'payment-cart-item-name';
    name.textContent = it.name;
    const det = document.createElement('div');
    det.className = 'payment-cart-item-details';
    det.textContent = `Qtd: ${it.quantity} (${it.selectedSize}/${it.selectedColor})`;
    left.append(name, det);
    
    const right = document.createElement('div');
    right.style.fontWeight = '700';
    right.textContent = `R$ ${(safeNumber(it.quantity) * safeNumber(it.price)).toFixed(2)}`;
    
    row.append(left, right);
    itemsContainer.appendChild(row);
  });

  const total = state.cart.reduce((s, it) => s + (safeNumber(it.price) * safeNumber(it.quantity)), 0);
  if (totalContainer) totalContainer.textContent = `R$ ${total.toFixed(2)}`;
  
  modal.classList.add('active');
  setupPaymentListeners();
}

function closePaymentModal() {
  const modal = $('paymentModal');
  if (modal) modal.classList.remove('active');
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

function sendToWhatsApp() {
  if (!state.cart.length) return;
  const checked = document.querySelector('input[name="paymentMethod"]:checked');
  if (!checked) return alert('Selecione a forma de pagamento.');
  
  const method = checked.value;
  const inst = $('installments') ? $('installments').value : '1';
  
  const mapMethod = {
    'pix': 'PIX',
    'boleto': 'Boleto Bancário',
    'credito-avista': 'Cartão de Crédito (À vista)',
    'credito-parcelado': `Cartão Parcelado (${inst}x)`
  };
  
  const total = state.cart.reduce((s, it) => s + (safeNumber(it.price) * safeNumber(it.quantity)), 0);
  
  let msg = `*🛍️ PEDIDO - SEJA VERSÁTIL*\n\n`;
  state.cart.forEach((item, i) => {
    msg += `${i+1}. *${item.name}*\n`;
    msg += `   TAM: ${item.selectedSize} | COR: ${item.selectedColor}\n`;
    msg += `   QTD: ${item.quantity} x R$ ${item.price.toFixed(2)}\n\n`;
  });
  
  msg += `*TOTAL: R$ ${total.toFixed(2)}*\n`;
  msg += `Pagamento: ${mapMethod[method] || method}\n`;
  msg += `\n_Enviado pelo site_`;
  
  window.open(`https://wa.me/5571991427103?text=${encodeURIComponent(msg)}`, '_blank');
  closePaymentModal();
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
    'Rosa': '#FFB6C1', 'Preto': '#000000', 'Azul': '#4169E1',
    'Verde': '#32CD32', 'Branco': '#FFFFFF', 'Vermelho': '#DC143C',
    'Amarelo': '#FFD700', 'Cinza': '#808080', 'Lilás': '#9370DB',
    'Coral': '#FF7F50', 'Nude': '#E8BEAC', 'Bege': '#F5F5DC', 'Laranja': '#FFA500'
  };
  return map[name] || '#ddd';
}

function toggleSidebar() {
  const sb = $('sidebarMenu');
  const ov = $('sidebarOverlay');
  if (sb) sb.classList.toggle('active');
  if (ov) ov.classList.toggle('active');
}

function initBlackFridayCountdown() {
    // Ajuste a data aqui se necessário
    const end = new Date(2025, 10, 30, 23, 59, 59); 
    if (state.countdownInterval) clearInterval(state.countdownInterval);

    const update = () => {
        const diff = end.getTime() - Date.now();
        if (diff <= 0) return clearInterval(state.countdownInterval);
        
        const d = Math.floor(diff / (1000*60*60*24));
        const h = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
        const m = Math.floor((diff % (1000*60*60)) / (1000*60));
        const s = Math.floor((diff % (1000*60)) / 1000);
        
        if(elExists('bfDays')) $('bfDays').textContent = String(d).padStart(2,'0');
        if(elExists('bfHours')) $('bfHours').textContent = String(h).padStart(2,'0');
        if(elExists('bfMinutes')) $('bfMinutes').textContent = String(m).padStart(2,'0');
        if(elExists('bfSeconds')) $('bfSeconds').textContent = String(s).padStart(2,'0');
    };
    update();
    state.countdownInterval = setInterval(update, 1000);
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



