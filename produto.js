// produto.js - Versão Live! Replica
// Compatível com HTML e CSS atualizados

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
  countdownInterval: null,
  currentImageIndex: 0, // Novo: Para controlar a imagem principal
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
    // updateCartUI(); // Assumindo que esta função existe em outro lugar ou será implementada

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
      console.warn('Parametro id ausente');
      // window.location.href = 'index.html'; // Descomentar em produção
    } else {
      // await waitForDbReady(3000); // Assumindo que db está disponível ou esta função será implementada
      await loadProduct(productId);
    }

    // if (typeof initBlackFridayCountdown === 'function') initBlackFridayCountdown(); // Assumindo que esta função existe em outro lugar ou será implementada
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
   Firestore: Carregar Dados (Simulação)
   ========================= */
// Mantendo a estrutura original, mas simplificando a chamada ao DB para evitar erros de dependência
async function loadProduct(productId) {
  try {
    // Simulação de dados do produto (adapte para sua chamada real ao Firestore)
    const data = {
        name: 'Conjunto Nex',
        price: 139.90,
        oldPrice: 179.90,
        category: 'Conjunto Short',
        images: [
            'https://via.placeholder.com/600x800/FF5733/FFFFFF?text=Imagem+1',
            'https://via.placeholder.com/600x800/33FF57/FFFFFF?text=Imagem+2',
            'https://via.placeholder.com/600x800/3357FF/FFFFFF?text=Imagem+3',
            'https://via.placeholder.com/600x800/FF33A1/FFFFFF?text=Imagem+4',
        ],
        colors: [
            { name: 'Verde', hex: '#33FF57' },
            { name: 'Azul', hex: '#3357FF' },
            { name: 'Preto', hex: '#000000' },
            { name: 'Rosa', hex: '#FF33A1' },
        ],
        sizes: ['P', 'M', 'G', 'GG'],
        shortDescription: 'O Conjunto Nex é perfeito para quem busca conforto e estilo. Desenvolvido com tecnologia Seamless, sem costura, possui alças largas e toque macio.',
        fullDescription: '<p>O Top desenvolvido em tecnologia Seamless, sem costura, possui alças largas e toque macio, proporcionando ajuste confortável ao corpo. O decote alongado nas costas e o cós canelado favorecem a liberdade de movimento durante práticas esportivas de médio impacto, enquanto o bojo removível, acessível por uma pequena abertura interna no forro, proporciona maior versatilidade. Seu design moderno possui mix de texturas construído diretamente no tecido, trazendo estilo e durabilidade ao produto.</p><p>Feito no Brasil.</p><p>Composição: 96% Poliamida, 4% Elastano</p>',
        relatedProducts: [
            { id: 'rel1', name: 'Top Seamless', price: 99.90, image: 'https://via.placeholder.com/300x400/FF5733/FFFFFF?text=Relacionado+1' },
            { id: 'rel2', name: 'Legging Knit', price: 159.90, image: 'https://via.placeholder.com/300x400/33FF57/FFFFFF?text=Relacionado+2' },
            { id: 'rel3', name: 'Shorts Versátil', price: 79.90, image: 'https://via.placeholder.com/300x400/3357FF/FFFFFF?text=Relacionado+3' },
            { id: 'rel4', name: 'Jaqueta Live', price: 299.90, image: 'https://via.placeholder.com/300x400/FF33A1/FFFFFF?text=Relacionado+4' },
        ]
    };

    // Se você estiver usando o Firebase, descomente e adapte o código original:
    /*
    const doc = await db.collection('produtos').doc(productId).get();
    if (!doc.exists) throw new Error('Produto não encontrado');
    const data = doc.data() || {};
    */

    // Normalização de dados (Mantida)
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

    state.currentProduct = Object.freeze({ id: productId, ...data });
    
    // await loadProductVariants(productId); // Manter se necessário

    // Renderizar UI
    await new Promise(resolve => requestAnimationFrame(resolve));
    renderProduct();
    
  } catch (err) {
    console.error('Erro loadProduct', err);
    throw err;
  }
}

// Funções de renderização adaptadas para o novo HTML

function renderProduct() {
  const p = state.currentProduct;
  if (!p) return;

  // Títulos e Breadcrumbs
  document.title = `${p.name || 'Produto'} - Seja Versátil`;
  if (elExists('productPageTitle')) $('productPageTitle').textContent = `${p.name} - Seja Versátil`;
  // Assumindo que getCategoryName existe ou será implementada
  // if (elExists('breadcrumbCategory')) $('breadcrumbCategory').textContent = getCategoryName(p.category);
  if (elExists('breadcrumbProduct')) $('breadcrumbProduct').textContent = p.name || '';
  if (elExists('detailsProductName')) $('detailsProductName').textContent = p.name || '';

  renderPrices();
  renderColors();
  renderSizes();
  renderGallery(); // Atualizado para o novo modelo de galeria
  renderDescription(); // Novo
  renderRelatedProducts(); // Novo
}

/* =========================
   Preços (Mantido)
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

  // Lógica de Parcelamento (Atualizado para 3x)
  if (installments && price) {
    const maxParcelas = 3; // Máximo de parcelas
    const parcelaValue = price / maxParcelas;
    installments.textContent = `ou ${maxParcelas}x de R$ ${parcelaValue.toFixed(2)} sem juros`;
  }
}

/* =========================
   Galeria (Live! Style: Miniaturas + Imagem Principal)
   ========================= */
function renderGallery() {
  const p = state.currentProduct;
  if (!p || !p.images || p.images.length === 0) return;

  const galleryContainer = $('galleryContainer');
  const thumbnailContainer = $('thumbnailContainer');

  if (!galleryContainer || !thumbnailContainer) return;

  galleryContainer.innerHTML = '';
  thumbnailContainer.innerHTML = '';

  // 1. Renderiza Miniaturas (Thumbnails)
  p.images.forEach((imgUrl, index) => {
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'thumbnail-item';
    thumbDiv.style.backgroundImage = `url("${imgUrl}")`;
    thumbDiv.dataset.index = index;
    thumbDiv.onclick = () => selectImage(index);
    thumbnailContainer.appendChild(thumbDiv);
  });

  // 2. Renderiza Imagens Principais (Para Mobile Swipe)
  p.images.forEach((imgUrl, index) => {
    const photoDiv = document.createElement('div');
    photoDiv.className = 'gallery-photo-full';
    photoDiv.style.backgroundImage = `url("${imgUrl}")`;
    photoDiv.dataset.index = index;
    galleryContainer.appendChild(photoDiv);
  });

  // Seleciona a primeira imagem por padrão
  selectImage(0);
}

function selectImage(index) {
    const p = state.currentProduct;
    if (!p || !p.images || p.images.length === 0) return;

    state.currentImageIndex = index;

    // Atualiza o estado das miniaturas
    const thumbnails = document.querySelectorAll('#thumbnailContainer .thumbnail-item');
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });

    // Rola o container principal para a imagem selecionada (apenas para mobile/swipe)
    const galleryContainer = $('galleryContainer');
    if (galleryContainer) {
        const photo = galleryContainer.querySelector(`.gallery-photo-full[data-index="${index}"]`);
        if (photo) {
            // Usa scrollIntoView para garantir que a imagem esteja visível
            photo.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
    }
}

/* =========================
   Seletores de Cor (Mantido)
   ========================= */
function renderColors() {
  const p = state.currentProduct;
  if (!p || !p.colors) return;

  const colorSelector = $('colorSelector');
  if (!colorSelector) return;

  colorSelector.innerHTML = '';

  p.colors.forEach(color => {
    const colorDiv = document.createElement('div');
    colorDiv.className = 'color-option';
    colorDiv.style.backgroundColor = color.hex;
    colorDiv.title = color.name;
    colorDiv.dataset.color = color.name;
    colorDiv.onclick = () => selectColor(color.name);
    colorSelector.appendChild(colorDiv);
  });

  // Seleciona a primeira cor por padrão
  if (p.colors.length > 0) {
    selectColor(p.colors[0].name);
  }
}

function selectColor(colorName) {
  state.selectedColor = colorName;
  const selectedColorNameEl = $('selectedColorName');
  if (selectedColorNameEl) selectedColorNameEl.textContent = colorName;

  document.querySelectorAll('.color-option').forEach(el => {
    el.classList.toggle('active', el.dataset.color === colorName);
  });

  // Lógica para trocar as imagens da galeria com base na cor (se aplicável)
  // ...
}

/* =========================
   Seletores de Tamanho (Mantido)
   ========================= */
function renderSizes() {
  const p = state.currentProduct;
  if (!p || !p.sizes) return;

  const sizeSelector = $('sizeSelector');
  if (!sizeSelector) return;

  sizeSelector.innerHTML = '';

  p.sizes.forEach(size => {
    const sizeDiv = document.createElement('button');
    sizeDiv.className = 'size-option';
    sizeDiv.textContent = size;
    sizeDiv.dataset.size = size;
    sizeDiv.onclick = () => selectSize(size);
    sizeSelector.appendChild(sizeDiv);
  });

  // Seleciona o primeiro tamanho por padrão
  if (p.sizes.length > 0) {
    selectSize(p.sizes[0]);
  }
}

function selectSize(size) {
  state.selectedSize = size;
  document.querySelectorAll('.size-option').forEach(el => {
    el.classList.toggle('active', el.dataset.size === size);
  });
}

/* =========================
   Descrição (Novo)
   ========================= */
function renderDescription() {
    const p = state.currentProduct;
    if (!p) return;

    const shortDescEl = $('shortDescriptionText');
    if (shortDescEl) shortDescEl.innerHTML = p.shortDescription || '';

    const fullDescEl = $('productFullDescription');
    if (fullDescEl) fullDescEl.innerHTML = p.fullDescription || '';
}

function scrollToDescription() {
    const fullDescEl = $('fullDescription');
    if (fullDescEl) {
        fullDescEl.scrollIntoView({ behavior: 'smooth' });
    }
}

/* =========================
   Produtos Relacionados (Compre o Look) (Novo)
   ========================= */
function renderRelatedProducts() {
    const p = state.currentProduct;
    if (!p || !p.relatedProducts) return;

    const container = $('relatedProductsContainer');
    if (!container) return;

    container.innerHTML = '';

    p.relatedProducts.forEach(product => {
        const card = document.createElement('a');
        card.href = `produto.html?id=${product.id}`;
        card.className = 'related-product-card';

        card.innerHTML = `
            <div class="product-image" style="background-image: url('${product.image}');"></div>
            <div class="product-name">${product.name}</div>
            <div class="product-price">R$ ${safeNumber(product.price).toFixed(2)}</div>
        `;

        container.appendChild(card);
    });
}

/* =========================
   Controles de Quantidade (Mantido)
   ========================= */
function changeQuantity(delta) {
  const qtyInput = $('productQuantity');
  if (!qtyInput) return;

  let newQty = safeNumber(qtyInput.value) + delta;
  newQty = Math.max(1, Math.min(10, newQty)); // Limita entre 1 e 10

  qtyInput.value = newQty;
  state.selectedQuantity = newQty;
}

/* =========================
   Ações (Mantido)
   ========================= */
function addToCart() {
  if (!state.currentProduct || !state.selectedColor || !state.selectedSize) {
    alert('Por favor, selecione a cor e o tamanho.');
    return;
  }

  const item = {
    productId: state.currentProduct.id,
    name: state.currentProduct.name,
    price: state.currentProduct.price,
    color: state.selectedColor,
    size: state.selectedSize,
    quantity: state.selectedQuantity,
    image: state.currentProduct.images[0] || null
  };

  // Lógica de adicionar ao carrinho (simplificada)
  state.cart.push(item);
  saveCartToStorage();
  // updateCartUI(); // Assumindo que esta função existe
  alert(`${item.quantity}x ${item.name} (${item.color}/${item.size}) adicionado ao carrinho!`);
}

// Funções placeholder (Assumindo que existem ou serão implementadas)
function toggleSidebar() { /* ... */ }
function toggleCart() { /* ... */ }
function checkout() { /* ... */ }
function openUserPanel() { /* ... */ }
function goToFavoritesPage() { /* ... */ }
function toggleProductFavorite() { /* ... */ }
function calculateShipping() { /* ... */ }
function openSizeGuide() { alert('Tabela de medidas será aberta aqui.'); }
function updateCartUI() { /* ... */ }
function getCategoryName(category) { return category; }
