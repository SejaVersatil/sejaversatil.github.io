function renderProductImages() {
    const container = document.getElementById('productImagesList');
    if (!container) return;
    
    container.innerHTML = tempProductImages.map((img, index) => {
        const isImage = img.startsWith('data:image') || img.startsWith('http');
        return `
            <div class="image-item">
                <div class="image-item-preview" style="${isImage ? '' : 'background: ' + img}">
                    ${isImage ? `<img src="${img}" alt="Produto">` : ''}
                </div>
                <button type="button" class="image-item-remove" onclick="removeProductImage(${index})">×</button>
            </div>
        `;
    }).join('');
}

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files.length) return;
    
    if (!storage) {
        showToast('Firebase Storage não está configurado', 'error');
        event.target.value = '';
        return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    for (const file of files) {
        if (file.size > MAX_SIZE) {
            showToast(`Arquivo "${file.name}" é muito grande! Máximo: 5MB`, 'error');
            event.target.value = '';
            return;
        }
    }
    
    const loadingMsg = document.createElement('div');
    loadingMsg.style.cssText = 'padding: 1rem; background: #f0f0f0; margin-bottom: 1rem; border-radius: 4px;';
    loadingMsg.textContent = '⏳ Fazendo upload das imagens...';
    document.getElementById('productImagesList').parentElement.insertBefore(loadingMsg, document.getElementById('productImagesList'));

    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            showToast('Por favor, selecione apenas arquivos de imagem!', 'error');
            continue;
        }

        try {
            const storageRef = storage.ref();
            const imageRef = storageRef.child(`produtos/${Date.now()}_${file.name}`);
            await imageRef.put(file);
            const imageUrl = await imageRef.getDownloadURL();
            tempProductImages.push(imageUrl);
            renderProductImages();
        } catch (error) {
            console.error('Erro ao fazer upload:', error);
            showToast('Erro ao fazer upload da imagem: ' + error.message, 'error');
        }
    }

    loadingMsg.remove();
    event.target.value = '';
}

function toggleUrlInput() {
    const urlBox = document.getElementById('imageUrlInputBox');
    const gradientBox = document.getElementById('imageGradientInputBox');
    
    if (urlBox) {
        if (gradientBox && gradientBox.classList.contains('active')) {
            gradientBox.classList.remove('active');
        }
        
        urlBox.classList.toggle('active');
        if (urlBox.classList.contains('active')) {
            const urlField = document.getElementById('imageUrlField');
            if (urlField) urlField.focus();
        } else {
            const urlField = document.getElementById('imageUrlField');
            if (urlField) urlField.value = '';
        }
    }
}

function toggleGradientInput() {
    const gradientBox = document.getElementById('imageGradientInputBox');
    const urlBox = document.getElementById('imageUrlInputBox');
    
    if (gradientBox) {
        if (urlBox && urlBox.classList.contains('active')) {
            urlBox.classList.remove('active');
        }
        
        gradientBox.classList.toggle('active');
        if (gradientBox.classList.contains('active')) {
            const gradientField = document.getElementById('gradientField');
            if (gradientField) gradientField.focus();
        } else {
            const gradientField = document.getElementById('gradientField');
            if (gradientField) gradientField.value = '';
        }
    }
}

function addImageFromUrl() {
    const urlField = document.getElementById('imageUrlField');
    if (!urlField) return;
    
    const imageUrl = urlField.value.trim();
    
    if (!imageUrl) {
        showToast('Cole o link da imagem!', 'error');
        return;
    }

    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        showToast('URL inválida! Deve começar com http:// ou https://', 'error');
        return;
    }

    const img = new Image();
    img.onload = function() {
        tempProductImages.push(imageUrl);
        renderProductImages();
        urlField.value = '';
        toggleUrlInput();
        showToast('Imagem adicionada com sucesso!', 'success');
    };
    img.onerror = function() {
        showToast('Não foi possível carregar a imagem desta URL', 'error');
    };
    img.src = imageUrl;
}

function addGradientImage() {
    const gradientField = document.getElementById('gradientField');
    if (!gradientField) return;
    
    const gradient = gradientField.value.trim();
    
    if (!gradient) {
        showToast('Digite um gradiente CSS!', 'error');
        return;
    }

    if (!gradient.includes('gradient')) {
        showToast('Formato inválido! Exemplo: linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'error');
        return;
    }

    tempProductImages.push(gradient);
    renderProductImages();
    gradientField.value = '';
    toggleGradientInput();
    showToast('Gradiente adicionado com sucesso!', 'success');
}

function removeProductImage(index) {
    if (tempProductImages.length > 1) {
        tempProductImages.splice(index, 1);
        renderProductImages();
        showToast('Imagem removida', 'info');
    } else {
        showToast('O produto precisa ter pelo menos 1 imagem!', 'error');
    }
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    editingProductId = null;
}

function editProduct(productId) {
    openProductModal(productId);
}

async function deleteProduct(productId) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        document.getElementById('loadingOverlay').classList.add('active');
        
        try {
            await db.collection("produtos").doc(productId).delete();
            
            const index = productsData.findIndex(p => p.id === productId);
            if (index !== -1) {
                productsData.splice(index, 1);
            }
            
            productCache.clear();
            saveProducts();
            renderAdminProducts();
            renderProducts();
            updateAdminStats();
            showToast('Produto excluído com sucesso!', 'success');
            
        } catch (error) {
            console.error("Erro ao excluir produto:", error);
            showToast('Erro ao excluir produto: ' + error.message, 'error');
        } finally {
            document.getElementById('loadingOverlay').classList.remove('active');
        }
    }
}

async function saveProduct(event) {
    event.preventDefault();
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    const name = sanitizeInput(document.getElementById('productName').value.trim());
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const oldPrice = document.getElementById('productOldPrice').value ? parseFloat(document.getElementById('productOldPrice').value) : null;
    const badge = document.getElementById('productBadge').value.trim() || null;
    const productId = document.getElementById('productId').value;

    const productData = {
        name: name,
        category: category,
        price: price,
        oldPrice: oldPrice,
        badge: badge,
        images: tempProductImages,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const errors = validateProductData(productData);
    if (errors.length > 0) {
        showToast(errors[0], 'error');
        document.getElementById('loadingOverlay').classList.remove('active');
        return;
    }

    try {
        if (productId) {
            await db.collection("produtos").doc(productId).update(productData);
            
            const product = productsData.find(p => p.id === productId);
            if (product) {
                Object.assign(product, productData);
                product.id = productId;
            }
            showToast('Produto atualizado com sucesso!', 'success');
        } else {
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection("produtos").add(productData);
            
            productsData.push({
                id: docRef.id,
                ...productData
            });
            showToast('Produto adicionado com sucesso!', 'success');
        }

        productCache.clear();
        saveProducts();
        closeProductModal();
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        
        await carregarProdutosDoFirestore();
        
    } catch (error) {
        console.error("Erro ao salvar produto:", error);
        showToast('Erro ao salvar produto: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

function saveSettings() {
    const bannerTitle = sanitizeInput(document.getElementById('settingBannerTitle').value.trim());
    const bannerSubtitle = sanitizeInput(document.getElementById('settingBannerSubtitle').value.trim());
    const topBanner = sanitizeInput(document.getElementById('settingTopBanner').value.trim());

    localStorage.setItem('sejaVersatilSettings', JSON.stringify({
        bannerTitle,
        bannerSubtitle,
        topBanner
    }));

    showToast('Configurações salvas com sucesso!', 'success');
}

async function limparTodosProdutos() {
    const confirmacao = confirm(
        '⚠️ ATENÇÃO! Esta ação irá DELETAR TODOS os produtos do Firestore.\n\n' +
        'Esta ação NÃO pode ser desfeita!\n\n' +
        'Tem CERTEZA ABSOLUTA que deseja continuar?'
    );
    
    if (!confirmacao) return;
    
    const confirmacaoDupla = prompt('Digite "DELETAR TUDO" (sem aspas) para confirmar:');
    
    if (confirmacaoDupla !== 'DELETAR TUDO') {
        showToast('Ação cancelada', 'info');
        return;
    }
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const snapshot = await db.collection("produtos").get();
        
        if (snapshot.empty) {
            showToast('Não há produtos para deletar', 'info');
            return;
        }
        
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        productsData.length = 0;
        productCache.clear();
        
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        
        showToast(`✅ ${snapshot.size} produtos foram deletados!`, 'success');
        
    } catch (error) {
        console.error("Erro ao limpar produtos:", error);
        showToast('Erro ao limpar produtos: ' + error.message, 'error');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

function loadSettings() {
    const saved = localStorage.getItem('sejaVersatilSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        document.querySelector('.top-banner').textContent = settings.topBanner;

        document.getElementById('settingBannerTitle').value = settings.bannerTitle;
        document.getElementById('settingBannerSubtitle').value = settings.bannerSubtitle;
        document.getElementById('settingTopBanner').value = settings.topBanner;
    }
}

// ==================== UI COMPONENTS ====================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('hamburgerBtn');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    btn.classList.toggle('active');
}

// ==================== CHAT WIDGET ====================

function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.classList.toggle('active');
    
    if (chatBox.classList.contains('active')) {
        document.getElementById('chatInput').focus();
    }
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message === '') return;
    
    addChatMessage(message, 'user');
    input.value = '';
    
    setTimeout(() => {
        const responses = [
            'Obrigado pela sua mensagem! Como posso ajudar com seus produtos fitness?',
            'Estou aqui para ajudar! Temos ótimas promoções hoje. O que você procura?',
            'Que legal! Temos leggings, tops e conjuntos incríveis. Quer que eu mostre?',
            'Posso te ajudar a encontrar o tamanho ideal! Qual peça te interessou?',
            'Nossa equipe está disponível para atendimento personalizado. Em que posso ajudar?'
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        addChatMessage(response, 'bot');
    }, 1000);
}

function addChatMessage(text, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    
    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ==================== PRODUTOS ====================

function filterProducts(category) {
    currentFilter = category;
    currentPage = 1;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderProducts();
    trackEvent('Products', 'Filter', category);
}

function sortProducts(sortType) {
    currentSort = sortType;
    renderProducts();
    trackEvent('Products', 'Sort', sortType);
}

function getFilteredProducts() {
    let filtered = productsData;
    
    if (currentFilter !== 'all') {
        if (currentFilter === 'sale') {
            filtered = filtered.filter(p => p.oldPrice !== null);
        } else {
            filtered = filtered.filter(p => p.category === currentFilter);
        }
    }
    
    if (currentSort === 'price-asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return filtered;
}

function renderProductsSkeleton() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = Array(12).fill(0).map(() => `
        <div class="product-skeleton">
            <div class="skeleton-image"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text short"></div>
        </div>
    `).join('');
}

function renderProducts() {
    const filtered = getFilteredProducts();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginatedProducts = filtered.slice(start, end);
    
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = paginatedProducts.map(product => {
        const images = product.images || (product.image ? [product.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);
        const hasMultipleImages = images.length > 1;
        const isFav = isFavorite(product.id);
        
        // Calcular desconto
        const discount = product.oldPrice ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;
        
        // Calcular parcelas
        const installmentValue = (product.price / 10).toFixed(2);
        
        return `
            <div class="product-card">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')" 
                            aria-label="Adicionar aos favoritos">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    
                    ${discount > 0 ? `<span class="product-badge">-${discount}%</span>` : (product.badge ? `<span class="product-badge">${sanitizeInput(product.badge)}</span>` : '')}
                    
                    <div class="product-image-carousel">
                        ${images.map((img, index) => {
                            const isRealImage = img.startsWith('data:image') || img.startsWith('http');
                            return `
                                <div class="product-image-slide ${index === 0 ? 'active' : ''}" style="${isRealImage ? `background-image: url(${img}); background-size: cover; background-position: center;` : `background: ${img}`}"></div>
                            `;
                        }).join('')}
                    </div>
                    
                    ${hasMultipleImages ? `
                        <div class="product-carousel-arrows">
                            <button class="product-carousel-arrow" onclick="prevProductImage('${product.id}', event)">‹</button>
                            <button class="product-carousel-arrow" onclick="nextProductImage('${product.id}', event)">›</button>
                        </div>
                        <div class="product-carousel-dots">
                            ${images.map((_, index) => `
                                <div class="product-carousel-dot ${index === 0 ? 'active' : ''}" onclick="goToProductImage('${product.id}', ${index}, event)"></div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <button class="add-to-cart-btn" onclick="addToCart('${product.id}')">Adicionar ao Carrinho</button>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    ${product.oldPrice ? `<span class="product-original-price">De: R$ ${product.oldPrice.toFixed(2)}</span>` : ''}
                    <div class="product-price">
                        <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                    </div>
                    <div class="price-installment">Ou 10x de R$ ${installmentValue} s/juros</div>
                    <div class="product-sizes">
                        <div class="size-option">P</div>
                        <div class="size-option">M</div>
                        <div class="size-option">G</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    renderPagination(totalPages);
}

// ==================== RENDER BEST SELLERS ====================

function renderBestSellers() {
    const bestSellersGrid = document.getElementById('bestSellersGrid');
    if (!bestSellersGrid) return;
    
    const bestSellers = productsData.filter(p => p.oldPrice).slice(0, 6);
    
    if (bestSellers.length === 0) {
        bestSellersGrid.innerHTML = '<p class="empty-section-message">Nenhum produto em destaque no momento</p>';
        return;
    }
    
    bestSellersGrid.innerHTML = bestSellers.map(product => {
        const images = product.images || ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
        const isFav = isFavorite(product.id);
        const firstImage = images[0];
        const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
        
        // Calcular desconto
        const discount = product.oldPrice ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100) : 0;
        
        // Calcular parcelas
        const installmentValue = (product.price / 10).toFixed(2);
        
        return `
            <div class="product-card">
                <div class="product-image">
                    <button class="favorite-btn ${isFav ? 'active' : ''}" 
                            onclick="event.stopPropagation(); toggleFavorite('${product.id}')" 
                            aria-label="Adicionar aos favoritos">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    
                    ${discount > 0 ? `<span class="product-badge">-${discount}%</span>` : (product.badge ? `<span class="product-badge">${sanitizeInput(product.badge)}</span>` : '')}
                    
                    <div class="product-image-carousel">
                        <div class="product-image-slide active" style="${isRealImage ? `background-image: url(${firstImage}); background-size: cover; background-position: center;` : `background: ${firstImage}`}"></div>
                    </div>
                    <button class="add-to-cart-btn" onclick="addToCart('${product.id}')">Adicionar ao Carrinho</button>
                </div>
                <div class="product-info">
                    <h4>${sanitizeInput(product.name)}</h4>
                    ${product.oldPrice ? `<span class="product-original-price">De: R$ ${product.oldPrice.toFixed(2)}</span>` : ''}
                    <div class="product-price">
                        <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                    </div>
                    <div class="price-installment">Ou 10x de R$ ${installmentValue} s/juros</div>
                    <div class="product-sizes">
                        <div class="size-option">P</div>
                        <div class="size-option">M</div>
                        <div class="size-option">G</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function nextProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    
    slides[currentIndex].classList.remove('active');
    if (dots.length > 0) dots[currentIndex].classList.remove('active');
    
    currentIndex = (currentIndex + 1) % slides.length;
    
    slides[currentIndex].classList.add('active');
    if (dots.length > 0) dots[currentIndex].classList.add('active');
}

function prevProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    
    slides[currentIndex].classList.remove('active');
    if (dots.length > 0) dots[currentIndex].classList.remove('active');
    
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    
    slides[currentIndex].classList.add('active');
    if (dots.length > 0) dots[currentIndex].classList.add('active');
}

function goToProductImage(productId, index, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    slides[index].classList.add('active');
    dots[index].classList.add('active');
}

// ==================== SELEÇÃO DE TAMANHO ====================

function setupSizeSelection() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('size-option')) {
            const card = e.target.closest('.product-card');
            if (card) {
                const sizes = card.querySelectorAll('.size-option');
                sizes.forEach(s => s.classList.remove('selected'));
                e.target.classList.add('selected');
            }
        }
    });
}

// ==================== PAGINAÇÃO ====================

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    if (currentPage > 1) {
        html += `<button class="page-btn" onclick="changePage(${currentPage - 1})">‹</button>`;
    }
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="page-btn" style="border: none; cursor: default;">...</span>`;
        }
    }
    
    if (currentPage < totalPages) {
        html += `<button class="page-btn" onclick="changePage(${currentPage + 1})">›</button>`;
    }
    
    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    renderProducts();
    document.getElementById('produtos').scrollIntoView({ behavior: 'smooth' });
}

// ==================== CARRINHO ====================

function addToCart(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        const productWithImage = {
            ...product,
            quantity: 1,
            image: product.images ? product.images[0] : (product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
        };
        cart.push(productWithImage);
    }
    
    saveCart();
    updateCartUI();
    trackEvent('E-commerce', 'Add to Cart', product.name);
    
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Adicionado!';
    btn.style.background = 'rgba(76, 175, 80, 0.9)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = 'rgba(0,0,0,0.8)';
    }, 1500);
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
        cartItems.innerHTML = cart.map(item => {
            const itemImage = item.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            const isRealImage = itemImage.startsWith('data:image') || itemImage.startsWith('http');
            
            return `
                <div class="cart-item">
                    <div class="cart-item-img" style="${isRealImage ? `background-image: url(${itemImage}); background-size: cover; background-position: center;` : `background: ${itemImage}`}"></div>
                    <div class="cart-item-info">
                        <div class="cart-item-title">${sanitizeInput(item.name)}</div>
                        <div class="cart-item-price">R$ ${item.price.toFixed(2)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                        </div>
                        <div class="remove-item" onclick="removeFromCart('${item.id}')">Remover</div>
                    </div>
                </div>
            `;
        }).join('');
        
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = `R$ ${total.toFixed(2)}`;
        cartFooter.style.display = 'block';
    }
}

function updateQuantity(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            saveCart();
            updateCartUI();
        }
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showToast('Item removido do carrinho', 'info');
}

function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

function saveCart() {
    const cartData = cart.map(item => ({
        id: item.id,
        quantity: item.quantity
    }));
    localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
}

function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if (saved) {
        const cartData = JSON.parse(saved);
        cart = cartData.map(item => {
            const product = productsData.find(p => p.id === item.id);
            if (!product) return null;
            
            return { 
                ...product, 
                quantity: item.quantity,
                image: product.images ? product.images[0] : (product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
            };
        }).filter(item => item && item.name);
    }
}

function checkout() {
    if (cart.length === 0) return;
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    showToast(`Total: R$ ${total.toFixed(2)} - Função de pagamento em desenvolvimento`, 'info');
    trackEvent('E-commerce', 'Checkout', `R$ ${total.toFixed(2)}`);
}

// ==================== BUSCA ====================

function openSearch() {
    const modal = document.getElementById('searchModal');
    modal.classList.add('active');
    document.getElementById('searchInput').focus();
}

function closeSearch() {
    const modal = document.getElementById('searchModal');
    modal.classList.remove('active');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

document.getElementById('searchModal').addEventListener('click', (e) => {
    if (e.target.id === 'searchModal') {
        closeSearch();
    }
});

const debouncedSearch = debounce(function() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const results = document.getElementById('searchResults');
    
    if (query.length < 2) {
        results.innerHTML = '';
        return;
    }
    
    const filtered = productsData.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.category.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        results.innerHTML = '<div style="padding: 1rem; text-align: center; color: #999;">Nenhum produto encontrado</div>';
        return;
    }
    
    results.innerHTML = filtered.map(product => {
        const productImage = product.images ? product.images[0] : (product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
        const isRealImage = productImage.startsWith('data:image') || productImage.startsWith('http');
        
        return `
            <div class="search-result-item" onclick="selectSearchResult('${product.id}')">
                <div class="search-result-img" style="${isRealImage ? `background-image: url(${productImage}); background-size: cover; background-position: center;` : `background: ${productImage}`}"></div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.3rem;">${sanitizeInput(product.name)}</div>
                    <div style="color: var(--primary); font-weight: 700;">R$ ${product.price.toFixed(2)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    trackEvent('Search', 'Query', query);
}, 300);

function performSearch() {
    debouncedSearch();
}

function selectSearchResult(productId) {
    addToCart(productId);
    closeSearch();
    toggleCart();
}

// ==================== FAVORITOS ====================

function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    if (index > -1) {
        favorites.splice(index, 1);
        showToast('Removido dos favoritos', 'info');
    } else {
        favorites.push(productId);
        showToast('Adicionado aos favoritos', 'success');
    }
    localStorage.setItem('sejaVersatilFavorites', JSON.stringify(favorites));
    renderProducts();
}

function isFavorite(productId) {
    return favorites.includes(productId);
}

// ==================== CONEXÃO E OFFLINE ====================

function setupConnectionMonitor() {
    window.addEventListener('online', () => {
        showToast('Conexão restaurada!', 'success');
    });
    
    window.addEventListener('offline', () => {
        showToast('Você está offline', 'error');
    });
}

function setupCartAbandonmentTracking() {
    let cartTimer;
    
    const startCartTimer = () => {
        clearTimeout(cartTimer);
        if (cart.length > 0) {
            cartTimer = setTimeout(() => {
                showToast('Não esqueça de finalizar sua compra! 🛍️', 'info');
            }, 300000);
        }
    };
    
    window.addEventListener('beforeunload', (e) => {
        if (cart.length > 0) {
            e.preventDefault();
            e.returnValue = 'Você tem itens no carrinho. Deseja realmente sair?';
        }
    });
    
    setInterval(startCartTimer, 60000);
}

// ==================== ATALHOS DE TECLADO ====================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSearch();
        if (document.getElementById('cartSidebar').classList.contains('active')) {
            toggleCart();
        }
        if (document.getElementById('userPanel').classList.contains('active')) {
            closeUserPanel();
        }
        if (document.getElementById('productModal').classList.contains('active')) {
            closeProductModal();
        }
    }
});
