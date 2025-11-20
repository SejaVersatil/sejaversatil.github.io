// produto.js - Lógica Específica da Página de Produto
// Depende de script2.js estar carregado antes

'use strict';

const state = {
  currentProduct: null,
  selectedColor: null,
  selectedSize: null,
  selectedQuantity: 1,
  productVariants: {} 
};

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.classList.add('active');

  try {
    // Aguarda DB (script2.js)
    await waitForDb();

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (!productId) {
      console.warn('ID ausente, redirecionando...');
      window.location.href = 'index.html';
      return;
    }

    await loadProductData(productId);

  } catch (err) {
    console.error('Erro ao carregar produto:', err);
    alert('Erro ao carregar produto. Tente novamente.');
  } finally {
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }
});

async function waitForDb() {
    let attempts = 0;
    while (!window.db && attempts < 20) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (!window.db) throw new Error('Banco de dados não inicializado.');
}

// ==================== CARREGAMENTO DE DADOS ====================
async function loadProductData(productId) {
    // Busca Produto
    const doc = await window.db.collection('produtos').doc(productId).get();
    if (!doc.exists) throw new Error('Produto não encontrado');
    
    const data = doc.data();
    state.currentProduct = { id: doc.id, ...data };

    // Busca Variantes
    const vSnap = await window.db.collection('produtos').doc(productId).collection('variants').get();
    const variants = [];
    vSnap.forEach(v => variants.push({ id: v.id, ...v.data() }));
    state.productVariants[productId] = variants;

    renderProductUI();
}

// ==================== RENDERIZAÇÃO ====================
function renderProductUI() {
    const p = state.currentProduct;
    
    // Textos Básicos
    setText('detailsProductName', p.name);
    setText('productPageTitle', `${p.name} - Seja Versátil`);
    
    // Preço
    const price = parseFloat(p.price || 0);
    const oldPrice = parseFloat(p.oldPrice || 0);
    setText('detailsPriceNew', `R$ ${price.toFixed(2)}`);
    
    if (oldPrice > price) {
        setText('detailsPriceOld', `De R$ ${oldPrice.toFixed(2)}`);
        document.getElementById('detailsPriceOld').style.display = 'block';
    }

    // Galeria Mosaico
    renderGallery(p.images || [p.image]);

    // Cores
    renderColors(p);

    // Tamanhos
    renderSizes(p);
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// --- Galeria ---
function renderGallery(images) {
    const container = document.getElementById('galleryContainer');
    if (!container) return;
    
    container.innerHTML = '';
    const imgs = Array.isArray(images) ? images : [images];

    imgs.forEach(img => {
        const div = document.createElement('div');
        div.className = 'gallery-photo-full';
        
        if (img.startsWith('http') || img.startsWith('data:')) {
            div.style.backgroundImage = `url('${img}')`;
        } else {
            div.style.background = img; // Gradiente ou cor
        }
        container.appendChild(div);
    });
}

// --- Seletores ---
function renderColors(product) {
    const container = document.getElementById('colorSelector');
    if (!container) return;
    container.innerHTML = '';

    let colors = product.colors || [];
    // Se não houver cores explícitas, tenta extrair das variantes ou string simples
    if (colors.length === 0 && state.productVariants[product.id]) {
        colors = [...new Set(state.productVariants[product.id].map(v => v.color))];
    }

    colors.forEach(c => {
        const colorName = typeof c === 'string' ? c : c.name;
        const colorHex = typeof c === 'string' ? getColorHex(colorName) : c.hex;
        
        const btn = document.createElement('div');
        btn.className = 'color-option';
        btn.style.backgroundColor = colorHex;
        btn.title = colorName;
        btn.onclick = () => selectColor(colorName);
        
        if (colorName === state.selectedColor) btn.classList.add('active');
        
        container.appendChild(btn);
    });
}

function renderSizes(product) {
    const container = document.getElementById('sizeSelector');
    if (!container) return;
    container.innerHTML = '';

    const sizes = ['P', 'M', 'G', 'GG']; // Padrão ou pegar do produto
    const variants = state.productVariants[product.id] || [];

    sizes.forEach(size => {
        // Verifica estoque se cor estiver selecionada
        let available = true;
        if (state.selectedColor) {
            const v = variants.find(va => va.size === size && va.color === state.selectedColor);
            if (!v || v.stock <= 0) available = false;
        }

        const btn = document.createElement('div');
        btn.className = `size-option ${available ? '' : 'unavailable'}`;
        btn.textContent = size;
        
        if (available) {
            btn.onclick = () => selectSize(size);
        }
        
        if (size === state.selectedSize) btn.classList.add('active');
        
        container.appendChild(btn);
    });
}

// ==================== INTERAÇÃO ====================
function selectColor(color) {
    state.selectedColor = color;
    state.selectedSize = null; // Reseta tamanho ao mudar cor
    renderColors(state.currentProduct);
    renderSizes(state.currentProduct);
}

function selectSize(size) {
    state.selectedSize = size;
    renderSizes(state.currentProduct);
}

function changeQuantity(delta) {
    let newQty = state.selectedQuantity + delta;
    if (newQty < 1) newQty = 1;
    state.selectedQuantity = newQty;
    document.getElementById('productQuantity').value = newQty;
}

// ==================== AÇÃO DE COMPRA (Integração) ====================
function addToCartFromDetails() {
    if (!state.selectedColor || !state.selectedSize) {
        alert('Por favor, selecione Cor e Tamanho.');
        return;
    }

    // Chama função GLOBAL do script2.js
    window.addToCart(
        state.currentProduct, 
        state.selectedSize, 
        state.selectedColor, 
        state.selectedQuantity
    );
}

function buyViaWhatsApp() {
    const p = state.currentProduct;
    const msg = `Olá! Tenho interesse no produto: ${p.name}\nCor: ${state.selectedColor || '?'}\nTamanho: ${state.selectedSize || '?'}`;
    window.open(`https://wa.me/5571991427103?text=${encodeURIComponent(msg)}`, '_blank');
}

// Helper Simples
function getColorHex(name) {
    const map = {
        'Preto': '#000', 'Branco': '#FFF', 'Rosa': '#FFC0CB', 'Azul': '#0000FF',
        'Verde': '#008000', 'Cinza': '#808080', 'Vermelho': '#FF0000'
    };
    return map[name] || '#ccc';
}
