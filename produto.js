// ==================== VARIÁVEIS GLOBAIS ====================
let currentProduct = null;
let selectedColor = null;
let selectedSize = null;
let selectedQuantity = 1;
let cart = [];
let productVariants = {};

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando página do produto...');
    
    // Mostrar loading
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        // Carregar carrinho do localStorage
        loadCart();
        updateCartUI();
        
        // Pegar ID do produto da URL
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        
        if (!productId) {
            alert('❌ Produto não encontrado!');
            window.location.href = 'index.html';
            return;
        }
        
        // Carregar produto do Firestore
        await loadProduct(productId);
        
        // Iniciar countdown Black Friday
        initBlackFridayCountdown();
        
    } catch (error) {
        console.error('❌ Erro ao carregar produto:', error);
        alert('Erro ao carregar produto. Voltando para a página inicial...');
        window.location.href = 'index.html';
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
});

// ==================== CARREGAR PRODUTO DO FIRESTORE ====================
async function loadProduct(productId) {
    try {
        const doc = await db.collection('produtos').doc(productId).get();
        
        if (!doc.exists) {
            throw new Error('Produto não encontrado');
        }
        
        currentProduct = { id: doc.id, ...doc.data() };
        console.log('✅ Produto carregado:', currentProduct.name);
        
        // Carregar variantes (estoque)
        await loadProductVariants(productId);
        
        // Renderizar produto
        renderProduct();
        
    } catch (error) {
        console.error('❌ Erro ao carregar produto:', error);
        throw error;
    }
}

// ==================== CARREGAR VARIANTES (ESTOQUE) ====================
async function loadProductVariants(productId) {
    try {
        const variantsSnapshot = await db.collection('produtos')
            .doc(productId)
            .collection('variants')
            .get();
        
        const variants = [];
        variantsSnapshot.forEach(doc => {
            variants.push({ id: doc.id, ...doc.data() });
        });
        
        productVariants[productId] = variants;
        console.log(`✅ ${variants.length} variantes carregadas`);
        
    } catch (error) {
        console.error(⚠️ Erro ao carregar variantes:', error);
        productVariants[productId] = [];
    }
}

// ==================== RENDERIZAR PRODUTO ====================
function renderProduct() {
    // Atualizar título da página
    document.title = `${currentProduct.name} - Seja Versátil`;
    document.getElementById('productPageTitle').textContent = `${currentProduct.name} - Seja Versátil`;
    
    // Breadcrumb
    document.getElementById('breadcrumbCategory').textContent = getCategoryName(currentProduct.category);
    document.getElementById('breadcrumbProduct').textContent = currentProduct.name;
    
    // Nome do produto
    document.getElementById('detailsProductName').textContent = currentProduct.name;
    
    // Preços
    renderPrices();
    
    // Galeria de imagens
    renderGallery();
    
    // Cores disponíveis
    renderColors();
    
    // Tamanhos disponíveis
    renderSizes();
    
    // Descrição
    renderDescription();
    
    // Produtos relacionados
    renderRelatedProducts();
}

// ==================== RENDERIZAR PREÇOS ====================
function renderPrices() {
    const priceOld = document.getElementById('detailsPriceOld');
    const priceNew = document.getElementById('detailsPriceNew');
    const discountBadge = document.getElementById('discountBadge');
    const installments = document.getElementById('detailsInstallments');
    
    // Preço antigo
    if (currentProduct.oldPrice) {
        priceOld.textContent = `De R$ ${currentProduct.oldPrice.toFixed(2)}`;
        priceOld.style.display = 'block';
        
        // Calcular desconto
        const discount = Math.round(((currentProduct.oldPrice - currentProduct.price) / currentProduct.oldPrice) * 100);
        discountBadge.textContent = `-${discount}%`;
        discountBadge.style.display = 'inline-block';
    } else {
        priceOld.style.display = 'none';
        discountBadge.style.display = 'none';
    }
    
    // Preço atual
    priceNew.textContent = `R$ ${currentProduct.price.toFixed(2)}`;
    
    // Parcelamento
    const installmentValue = (currentProduct.price / 10).toFixed(2);
    installments.textContent = `ou 10x de R$ ${installmentValue} sem juros`;
}

// ==================== RENDERIZAR GALERIA ====================
function renderGallery() {
    let images = [];
    
    if (Array.isArray(currentProduct.images) && currentProduct.images.length > 0) {
        images = currentProduct.images;
    } else if (currentProduct.image) {
        images = [currentProduct.image];
    } else {
        images = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
    }
    
    // Imagem principal
    const mainImage = document.getElementById('mainProductImage');
    const firstImage = images[0];
    const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
    
    if (isRealImage) {
        mainImage.style.backgroundImage = `url('${firstImage}')`;
        mainImage.style.backgroundSize = 'cover';
        mainImage.style.backgroundPosition = 'center';
    } else {
        mainImage.style.background = firstImage;
    }
    
    // Thumbnails
    const thumbnailList = document.getElementById('thumbnailList');
    thumbnailList.innerHTML = images.map((img, index) => {
        const isImg = img.startsWith('data:image') || img.startsWith('http');
        return `
            <div class="thumbnail ${index === 0 ? 'active' : ''}" 
                 onclick="changeMainImage('${img}', ${index})"
                 style="${isImg ? `background-image: url('${img}')` : `background: ${img}`}; background-size: cover; background-position: center;"></div>
        `;
    }).join('');
}

// ==================== TROCAR IMAGEM PRINCIPAL ====================
function changeMainImage(imageSrc, index) {
    const mainImage = document.getElementById('mainProductImage');
    const isImg = imageSrc.startsWith('data:image') || imageSrc.startsWith('http');
    
    if (isImg) {
        mainImage.style.backgroundImage = `url('${imageSrc}')`;
        mainImage.style.backgroundSize = 'cover';
        mainImage.style.backgroundPosition = 'center';
    } else {
        mainImage.style.background = imageSrc;
    }
    
    // Atualizar thumbnails
    document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

// ==================== RENDERIZAR CORES ====================
function renderColors() {
    const colorSelector = document.getElementById('colorSelector');
    let availableColors = [];
    
    // Priorizar cores cadastradas no produto
    if (currentProduct.colors && Array.isArray(currentProduct.colors) && currentProduct.colors.length > 0) {
        availableColors = currentProduct.colors;
    } else {
        // Fallback: cores das variantes
        const variants = productVariants[currentProduct.id] || [];
        const uniqueColors = [...new Set(variants.map(v => v.color))];
        availableColors = uniqueColors.map(colorName => ({
            name: colorName,
            hex: getColorHex(colorName),
            images: currentProduct.images || []
        }));
    }
    
    if (availableColors.length === 0) {
        // Sem cores - ocultar seletor
        colorSelector.closest('.product-selector-group').style.display = 'none';
        return;
    }
    
    // Renderizar cores
    colorSelector.innerHTML = availableColors.map((color, index) => {
        const borderStyle = (color.hex === '#FFFFFF' || color.hex === '#ffffff') ? 'border: 3px solid #ddd;' : '';
        
        return `
            <div class="color-option ${index === 0 ? 'active' : ''}" 
                 data-color="${color.name}"
                 style="background: ${color.hex}; ${borderStyle}"
                 onclick="selectColor('${color.name.replace(/'/g, "\\'")}')"
                 title="${color.name}">
            </div>
        `;
    }).join('');
    
    // Selecionar primeira cor
    if (availableColors.length > 0) {
        selectedColor = availableColors[0].name;
        document.getElementById('selectedColorName').textContent = selectedColor;
    }
}

// ==================== SELECIONAR COR ====================
function selectColor(color) {
    selectedColor = color;
    
    // Atualizar visual
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.color === color);
    });
    
    // Atualizar label
    document.getElementById('selectedColorName').textContent = color;
    
    // Trocar imagens se houver imagens específicas da cor
    if (currentProduct.colors && Array.isArray(currentProduct.colors)) {
        const selectedColorData = currentProduct.colors.find(c => c.name === color);
        
        if (selectedColorData && selectedColorData.images && selectedColorData.images.length > 0) {
            const mainImage = document.getElementById('mainProductImage');
            const thumbnailList = document.getElementById('thumbnailList');
            
            // Atualizar imagem principal
            const firstImage = selectedColorData.images[0];
            const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
            
            if (isRealImage) {
                mainImage.style.backgroundImage = `url('${firstImage}')`;
            } else {
                mainImage.style.background = firstImage;
            }
            
            // Atualizar thumbnails
            thumbnailList.innerHTML = selectedColorData.images.map((img, index) => {
                const isImg = img.startsWith('data:image') || img.startsWith('http');
                return `
                    <div class="thumbnail ${index === 0 ? 'active' : ''}" 
                         onclick="changeMainImage('${img}', ${index})"
                         style="${isImg ? `background-image: url('${img}')` : `background: ${img}`}; background-size: cover; background-position: center;"></div>
                `;
            }).join('');
        }
    }
    
    // Atualizar tamanhos disponíveis
    renderSizes();
}

// ==================== RENDERIZAR TAMANHOS ====================
function renderSizes() {
    const sizeSelector = document.getElementById('sizeSelector');
    const sizes = ['P', 'M', 'G', 'GG'];
    const variants = productVariants[currentProduct.id] || [];
    
    sizeSelector.innerHTML = sizes.map((size, index) => {
        const hasStock = variants.some(v => v.size === size && v.color === selectedColor && v.stock > 0);
        const stock = variants.find(v => v.size === size && v.color === selectedColor)?.stock || 0;
        
        return `
            <button class="size-option ${index === 1 ? 'active' : ''} ${!hasStock ? 'unavailable' : ''}" 
                    data-size="${size}"
                    ${!hasStock ? 'disabled' : ''}
                    onclick="selectSize('${size}')">
                ${size}
                ${!hasStock ? '<br><small style="font-size: 0.7rem; color: red;">Esgotado</small>' : 
                  stock > 0 && stock <= 3 ? '<br><small style="font-size: 0.7rem; color: #ff9800;">Últimas unidades</small>' : ''}
            </button>
        `;
    }).join('');
    
    // Selecionar primeiro tamanho disponível
    const firstAvailable = sizes.find(size => 
        variants.some(v => v.size === size && v.color === selectedColor && v.stock > 0)
    );
    
    if (firstAvailable) {
        selectedSize = firstAvailable;
        document.getElementById('selectedSizeName').textContent = selectedSize;
    } else {
        selectedSize = 'M';
        document.getElementById('selectedSizeName').textContent = selectedSize;
    }
}

// ==================== SELECIONAR TAMANHO ====================
function selectSize(size) {
    selectedSize = size;
    
    // Atualizar visual
    document.querySelectorAll('.size-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.size === size);
    });
    
    // Atualizar label
    document.getElementById('selectedSizeName').textContent = size;
}

// ==================== RENDERIZAR DESCRIÇÃO ====================
function renderDescription() {
    document.getElementById('productDescription').textContent = 
        `${currentProduct.name} - Peça versátil e confortável para seus treinos. Tecnologia de alta performance com tecido respirável e secagem rápida.`;
}

// ==================== RENDERIZAR PRODUTOS RELACIONADOS ====================
async function renderRelatedProducts() {
    try {
        const relatedSnapshot = await db.collection('produtos')
            .where('category', '==', currentProduct.category)
            .limit(5)
            .get();
        
        const relatedProducts = [];
        relatedSnapshot.forEach(doc => {
            if (doc.id !== currentProduct.id) {
                relatedProducts.push({ id: doc.id, ...doc.data() });
            }
        });
        
        const grid = document.getElementById('relatedProductsGrid');
        
        if (relatedProducts.length === 0) {
            grid.innerHTML = '<p style="text-align: center; color: #999;">Nenhum produto relacionado encontrado</p>';
            return;
        }
        
        grid.innerHTML = relatedProducts.slice(0, 4).map(product => {
            let images = [];
            if (Array.isArray(product.images) && product.images.length > 0) {
                images = product.images;
            } else if (product.image) {
                images = [product.image];
            } else {
                images = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
            }
            
            const firstImage = images[0];
            const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
            
            return `
                <div class="product-card" onclick="window.location.href='produto.html?id=${product.id}'">
                    <div class="product-image">
                        <div class="product-image-slide active" 
                             style="${isRealImage ? `background-image: url('${firstImage}'); background-size: cover; background-position: center;` : `background: ${firstImage}`}">
                        </div>
                    </div>
                    <div class="product-info">
                        <h4>${product.name}</h4>
                        <div class="product-price">
                            <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('❌ Erro ao carregar produtos relacionados:', error);
    }
}

// ==================== FUNÇÕES DE QUANTIDADE ====================
function changeQuantity(delta) {
    const input = document.getElementById('productQuantity');
    let newValue = parseInt(input.value) + delta;
    
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    
    input.value = newValue;
    selectedQuantity = newValue;
}

// ==================== CALCULAR FRETE ====================
function calculateShipping() {
    const zipCode = document.getElementById('zipCodeInput').value.replace(/\D/g, '');
    const resultsDiv = document.getElementById('shippingResults');
    
    if (zipCode.length !== 8) {
        alert('Digite um CEP válido');
        return;
    }
    
    resultsDiv.innerHTML = `
        <div class="shipping-option">
            <div>
                <strong>PAC</strong><br>
                <small>Entrega em 5-10 dias úteis</small>
            </div>
            <strong>R$ 15,90</strong>
        </div>
        <div class="shipping-option">
            <div>
                <strong>SEDEX</strong><br>
                <small>Entrega em 2-4 dias úteis</small>
            </div>
            <strong>R$ 25,90</strong>
        </div>
        <div class="shipping-option">
            <div>
                <strong>GRÁTIS</strong><br>
                <small>Entrega em 7-12 dias úteis</small>
            </div>
            <strong>R$ 0,00</strong>
        </div>
    `;
    
    resultsDiv.classList.add('active');
}

// ==================== ADICIONAR AO CARRINHO ====================
function addToCartFromDetails() {
    if (!currentProduct) return;
    
    const cartItemId = `${currentProduct.id}_${selectedSize}_${selectedColor}`;
    const existingItem = cart.find(item => item.cartItemId === cartItemId);
    
    if (existingItem) {
        existingItem.quantity += selectedQuantity;
    } else {
        cart.push({
            ...currentProduct,
            cartItemId: cartItemId,
            quantity: selectedQuantity,
            selectedSize: selectedSize,
            selectedColor: selectedColor,
            image: currentProduct.images ? currentProduct.images[0] : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        });
    }
    
    saveCart();
    updateCartUI();
    
    alert(`✅ ${selectedQuantity}x ${currentProduct.name} (${selectedSize}, ${selectedColor}) adicionado ao carrinho!`);
}

// ==================== COMPRAR AGORA ====================
function buyNow() {
    addToCartFromDetails();
    setTimeout(() => {
        toggleCart();
        setTimeout(() => {
            checkout();
        }, 500);
    }, 600);
}

// ==================== FUNÇÕES DO CARRINHO ====================
function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if (saved) {
        cart = JSON.parse(saved);
    }
}

function saveCart() {
    localStorage.setItem('sejaVersatilCart', JSON.stringify(cart));
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    const cartTotal = document.getElementById('cartTotal');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
        cartFooter.style.display = 'none';
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-img" style="background-image: url('${item.image}'); background-size: cover;"></div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    ${item.selectedSize || item.selectedColor ? `
                        <div style="font-size: 0.75rem; color: #666;">
                            ${item.selectedSize ? `Tamanho: ${item.selectedSize}` : ''}
                            ${item.selectedSize && item.selectedColor ? ' | ' : ''}
                            ${item.selectedColor ? `Cor: ${item.selectedColor}` : ''}
                        </div>
                    ` : ''}
                    <div class="cart-item-price">R$ ${item.price.toFixed(2)}</div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="updateQuantity('${item.cartItemId}', -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQuantity('${item.cartItemId}', 1)">+</button>
                    </div>
                    <div class="remove-item" onclick="removeFromCart('${item.cartItemId}')">Remover</div>
                </div>
            </div>
        `).join('');
        
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = `R$ ${total.toFixed(2)}`;
        cartFooter.style.display = 'block';
    }
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function updateQuantity(cartItemId, change) {
    const item = cart.find(i => i.cartItemId === cartItemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(cartItemId);
        } else {
            saveCart();
            updateCartUI();
        }
    }
}

function removeFromCart(cartItemId) {
    cart = cart.filter(item => item.cartItemId !== cartItemId);
    saveCart();
    updateCartUI();
}

function checkout() {
    if (cart.length === 0) {
        alert('Seu carrinho está vazio!');
        return;
    }
    openPaymentModal();
}

// ==================== PAYMENT MODAL ====================
function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const cartItemsContainer = document.getElementById('paymentCartItems');
    const totalContainer = document.getElementById('paymentTotal');
    
    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="payment-cart-item">
            <div>
                <div class="payment-cart-item-name">${item.name}</div>
                <div class="payment-cart-item-details">Qtd: ${item.quantity} × R$ ${item.price.toFixed(2)}</div>
            </div>
            <div style="font-weight: 700;">R$ ${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `).join('');
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalContainer.textContent = `R$ ${total.toFixed(2)}`;
    modal.classList.add('active');
    setupPaymentListeners();
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function setupPaymentListeners() {
    const paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
    const installmentsBox = document.getElementById('installmentsBox');
    
    paymentOptions.forEach(option => {
        option.addEventListener('change', function() {
            installmentsBox.style.display = this.value === 'credito-parcelado' ? 'block' : 'none';
        });
    });
}

function sendToWhatsApp() {
    if (cart.length === 0) return;
    
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const installments = document.getElementById('installments').value;
    
    const paymentMethods = {
        'pix': 'PIX',
        'boleto': 'Boleto Bancário',
        'credito-avista': 'Cartão de Crédito à Vista',
        'credito-parcelado': `Cartão de Crédito Parcelado em ${installments}x sem juros`
    };
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let message = `*🛍️ NOVO PEDIDO - SEJA VERSÁTIL*\n\n*📦 PRODUTOS:*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    cart.forEach((item, index) => {
        message += `${index + 1}. *${item.name}*\n`;
        if (item.selectedSize || item.selectedColor) {
            message += `   📏 Tamanho: ${item.selectedSize || 'Não selecionado'}\n`;
            message += `   🎨 Cor: ${item.selectedColor || 'Não selecionada'}\n`;
        }
        message += `   Qtd: ${item.quantity}\n`;
        message += `   Valor Unit.: R$ ${item.price.toFixed(2)}\n`;
        message += `   Subtotal: R$ ${(item.price * item.quantity).toFixed(2)}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━━\n*💰 VALOR TOTAL: R$ ${total.toFixed(2)}*\n\n`;
    message += `*💳 FORMA DE PAGAMENTO:*\n${paymentMethods[paymentMethod]}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n_Pedido gerado automaticamente via site_`;
    
    const whatsappURL = `https://wa.me/5571991427103?text=${encodeURIComponent(message)}`;
    window.open(whatsappURL, '_blank');
    closePaymentModal();
}

// ==================== FUNÇÕES AUXILIARES ====================
function getCategoryName(category) {
    const names = {
        'blusas': 'Blusas',
        'conjunto calca': 'Conjunto Calça',
        'peca unica': 'Peça Única',
        'conjunto short saia': 'Conjunto Short Saia',
        'conjunto short': 'Conjunto Short',
        'all': 'Todos os Produtos'
    };
    return names[category] || category.toUpperCase();
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

function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('hamburgerBtn');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    btn.classList.toggle('active');
}

// ==================== BLACK FRIDAY COUNTDOWN ====================
function initBlackFridayCountdown() {
    const blackFridayEnd = new Date(2025, 10, 30, 23, 59, 59);
    
    function updateCountdown() {
        const now = new Date().getTime();
        const distance = blackFridayEnd - now;
        
        if (distance < 0) {
            clearInterval(countdownInterval);
            return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        const daysEl = document.getElementById('bfDays');
        const hoursEl = document.getElementById('bfHours');
        const minutesEl = document.getElementById('bfMinutes');
        const secondsEl = document.getElementById('bfSeconds');
        
        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    }
    
    updateCountdown();
    const countdownInterval = setInterval(updateCountdown, 1000);
}

// Máscara de CEP
document.addEventListener('input', function(e) {
    if (e.target.id === 'zipCodeInput') {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 5) {
            value = value.slice(0, 5) + '-' + value.slice(5, 8);
        }
        e.target.value = value;
    }
});

console.log('✅ produto.js carregado com sucesso');

// ==================== TRATAMENTO DE ERROS GLOBAIS ====================
window.addEventListener('unhandledrejection', function(event) {
    console.warn('⚠️ Promise não tratada:', event.reason);
    event.preventDefault();
});