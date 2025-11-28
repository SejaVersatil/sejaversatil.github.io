// ==================================================================================
// LÓGICA ESPECÍFICA DA PÁGINA DE PRODUTO (produto.js)
// Depende de funções globais definidas em script2.js
// ==================================================================================

// Variáveis globais específicas do produto
let currentProductDetails = null;
let selectedSize = null;
let selectedColor = null;
let selectedQuantity = 1;

// =========================
// Funções Auxiliares
// =========================

function $(id) {
    return document.getElementById(id);
}

function updateQuantity(change) {
    const newQuantity = selectedQuantity + change;
    if (newQuantity >= 1) {
        selectedQuantity = newQuantity;
        const qtyInput = $('productQuantity');
        if (qtyInput) qtyInput.value = selectedQuantity;
    }
}

function selectSize(size) {
    selectedSize = size;
    const sizeOptions = document.querySelectorAll('.size-option');
    sizeOptions.forEach(option => {
        option.classList.remove('active');
        if (option.dataset.size === size) {
            option.classList.add('active');
        }
    });
    // Re-renderizar cores e estoque após selecionar o tamanho
    if (currentProductDetails) {
        renderAvailableColors(currentProductDetails.id);
    }
}

function selectColor(color) {
    selectedColor = color;
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.classList.remove('active');
        if (option.dataset.color === color) {
            option.classList.add('active');
        }
    });
    // Atualizar imagem principal
    if (currentProductDetails) {
        const image = getImageForColor(currentProductDetails, color);
        const mainImage = $('mainProductImage');
        if (mainImage) {
            mainImage.style.backgroundImage = `url('${image}')`;
        }
    }
}

function getImageForColor(product, color) {
    if (product.colors && Array.isArray(product.colors)) {
        const colorVariant = product.colors.find(c => c.name === color);
        if (colorVariant && colorVariant.images && colorVariant.images.length > 0) {
            return colorVariant.images[0];
        }
    }
    // Fallback para a primeira imagem do produto
    return getProductImage(product);
}

// =========================
// Renderização do Produto
// =========================

function renderProductDetails(product) {
    const container = $('productDetailsContainer');
    if (!container) return;

    currentProductDetails = product;

    // 1. Renderizar a seção de detalhes
    container.innerHTML = `
        <div class="product-gallery">
            <div class="main-image" id="mainProductImage" style="background-image: url('${getProductImage(product)}');">
                <!-- Imagem principal -->
            </div>
            <div class="thumbnail-gallery" id="thumbnailGallery">
                <!-- Thumbnails -->
            </div>
        </div>
        <div class="product-info-details">
            <h1 class="product-title">${product.name}</h1>
            <p class="product-category">${product.category}</p>
            <div class="product-price-details">
                ${product.oldPrice ? `<span class="price-old">R$ ${product.oldPrice.toFixed(2)}</span>` : ''}
                <span class="price-new">R$ ${product.price.toFixed(2)}</span>
            </div>

            <!-- Opções de Tamanho -->
            <div class="product-option">
                <label>Tamanho:</label>
                <div class="size-selector" id="sizeSelector">
                    <!-- Tamanhos serão injetados aqui -->
                </div>
            </div>

            <!-- Opções de Cor -->
            <div class="product-option">
                <label>Cor:</label>
                <div class="color-selector" id="colorSelector">
                    <!-- Cores serão injetadas aqui -->
                </div>
            </div>

            <!-- Quantidade e Botões -->
            <div class="product-actions">
                <div class="quantity-selector">
                    <button onclick="updateQuantity(-1)">-</button>
                    <input type="number" id="productQuantity" value="1" min="1" readonly>
                    <button onclick="updateQuantity(1)">+</button>
                </div>
                <button class="btn-add-cart-large" onclick="addToCartFromDetails()">
                    <i class="fas fa-shopping-cart"></i> Adicionar ao Carrinho
                </button>
                <button class="btn-buy-now" onclick="buyNow()">
                    Comprar Agora
                </button>
            </div>

            <!-- Descrição e Especificações (Tabs) -->
            <div class="product-tabs">
                <div class="tab-buttons">
                    <button class="tab-btn active" onclick="switchTab('description')">Descrição</button>
                    <button class="tab-btn" onclick="switchTab('specs')">Especificações</button>
                </div>
                <div class="tab-content active" id="descriptionTab">
                    <p>${product.description || 'Nenhuma descrição disponível.'}</p>
                </div>
                <div class="tab-content" id="specsTab">
                    <p>${product.specs || 'Nenhuma especificação disponível.'}</p>
                </div>
            </div>

            <!-- Produtos Relacionados -->
            <div class="related-products">
                <h3>Produtos Relacionados</h3>
                <div class="products-grid" id="relatedProductsGrid">
                    <!-- Relacionados serão injetados aqui -->
                </div>
            </div>
        </div>
    `;

    // 2. Renderizar tamanhos e cores
    renderAvailableSizes(product.id);
    renderAvailableColors(product.id);
    renderRelatedProducts(product.category, product.id);
}

function renderAvailableSizes(productId) {
    const product = productsData.find(p => p.id === productId);
    const sizeSelector = $('sizeSelector');
    if (!product || !sizeSelector) return;

    let availableSizes = [];

    if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
        availableSizes = product.sizes;
    } else if (productVariants[productId] && productVariants[productId].length > 0) {
        // Se houver variantes, pega os tamanhos únicos
        availableSizes = [...new Set(productVariants[productId].map(v => v.size))];
    } else {
        // Se não houver tamanhos ou variantes, esconde a opção
        const sizeOption = sizeSelector.closest('.product-option');
        if (sizeOption) sizeOption.style.display = 'none';
        return;
    }

    const sizeOption = sizeSelector.closest('.product-option');
    if (sizeOption) sizeOption.style.display = 'block';

    sizeSelector.innerHTML = availableSizes.map((size, index) => {
        // Verifica se o tamanho tem estoque (se houver variantes)
        const hasStock = productVariants[productId] ? productVariants[productId].some(v => v.size === size && v.stock > 0) : true;
        
        return `
            <div class="size-option ${index === 0 ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                 data-size="${size}"
                 data-has-stock="${hasStock}"
                 onclick="selectSize('${size}')">
                ${size}
            </div>
        `;
    }).join('');

    // Selecionar o primeiro tamanho por padrão
    if (availableSizes.length > 0) {
        selectedSize = availableSizes[0];
    }
}

// =========================
// Inicialização da página
// =========================

async function initializeProductPage() {
    const loadingOverlay = $('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        console.log('🚀 Inicializando página de produto...');

        // 1. Carregar dados globais (se existirem)
        if (typeof loadCartFromStorage === 'function') loadCartFromStorage();
        if (typeof updateCartUI === 'function') updateCartUI();
        if (typeof checkUserSession === 'function') checkUserSession();
        if (typeof loadProducts === 'function') await loadProducts(); // Garante que productsData esteja carregado

        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (productId) {
            // 2. Carregar detalhes do produto
            const product = productsData.find(p => p.id === productId);
            if (product) {
                // 3. Carregar variantes (estoque)
                if (typeof loadProductVariants === 'function') {
                    await loadProductVariants(productId);
                }
                // 4. Renderizar
                renderProductDetails(product);
            } else {
                // Produto não encontrado
                const container = $('productDetailsContainer');
                if (container) {
                    container.innerHTML = '<div class="error-message-large">Produto não encontrado.</div>';
                }
            }
        } else {
            // ID não fornecido
            const container = $('productDetailsContainer');
            if (container) {
                container.innerHTML = '<div class="error-message-large">ID do produto não fornecido.</div>';
            }
        }

        // 5. Inicializar outros componentes globais
        if (typeof initBlackFridayCountdown === 'function') initBlackFridayCountdown();
    } catch (err) {
        console.error('Erro na inicialização do produto:', err);
        const container = $('productDetailsContainer');
        if (container) {
            container.innerHTML = `<div class="error-message-large">Erro ao carregar detalhes do produto: ${err.message}</div>`;
        }
    } finally {
        // Garantir que o overlay desapareça, mesmo em caso de erro.
        const finalLoadingOverlay = $('loadingOverlay');
        if (finalLoadingOverlay) {
            finalLoadingOverlay.classList.remove('active');
        }
    }
}

// =========================
// Listeners e Chamadas
// =========================

// A chamada para initializeProductPage está no HTML para garantir que o DOM esteja pronto.
// document.addEventListener('DOMContentLoaded', initializeProductPage);

// Funções globais que podem ser chamadas pelo HTML (para evitar erros de referência)
window.updateQuantity = updateQuantity;
window.selectSize = selectSize;
window.selectColor = selectColor;
window.initializeProductPage = initializeProductPage;
window.getImageForColor = getImageForColor;
window.renderAvailableSizes = renderAvailableSizes;
window.renderProductDetails = renderProductDetails;
