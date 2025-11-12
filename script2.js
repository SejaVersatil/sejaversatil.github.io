let productsData = [];
let cart = [];
let currentFilter = 'all';
let currentSort = '';
let currentPage = 1;
const itemsPerPage = 12;
let tempProductImages = [];

// Produtos padrão (usados apenas se Firestore estiver vazio)
const DEFAULT_PRODUCTS = [
    { name: 'Legging High Waist Premium', category: 'leggings', price: 149.90, oldPrice: 189.90, badge: 'Novo', images: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)'] },
    { name: 'Top Fitness Sem Costura', category: 'tops', price: 89.90, oldPrice: null, badge: 'Destaque', images: ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'] },
    { name: 'Conjunto Ribbed Marsala', category: 'conjuntos', price: 209.90, oldPrice: 299.90, badge: '-30%', images: ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)'] },
    { name: 'Shorts Bike Seamless', category: 'leggings', price: 79.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'] },
    { name: 'Legging Scrunch Bum', category: 'leggings', price: 169.90, oldPrice: null, badge: 'Novo', images: ['linear-gradient(135deg, #fa709a 0%, #fee140 100%)'] },
    { name: 'Top Cropped Strappy', category: 'tops', price: 79.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #30cfd0 0%, #330867 100%)'] },
    { name: 'Macaquinho Fitness Premium', category: 'conjuntos', price: 149.90, oldPrice: 199.90, badge: '-25%', images: ['linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'] },
    { name: 'Jaqueta Oversized', category: 'conjuntos', price: 189.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)'] },
    { name: 'Legging Metallic Rose', category: 'leggings', price: 159.90, oldPrice: null, badge: 'Novo', images: ['linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'] },
    { name: 'Top Push Up Ribbed', category: 'tops', price: 99.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'] },
    { name: 'Conjunto Seamless Pro', category: 'conjuntos', price: 229.90, oldPrice: 279.90, badge: '-20%', images: ['linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)'] },
    { name: 'Legging Cintura Alta Preta', category: 'leggings', price: 139.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #434343 0%, #000000 100%)'] },
    { name: 'Top Regata Fitness', category: 'tops', price: 69.90, oldPrice: 89.90, badge: '-22%', images: ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'] },
    { name: 'Conjunto Power Mesh', category: 'conjuntos', price: 249.90, oldPrice: null, badge: 'Lançamento', images: ['linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'] },
    { name: 'Legging Tie Dye', category: 'leggings', price: 159.90, oldPrice: 199.90, badge: '-20%', images: ['linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'] },
    { name: 'Top Básico Essential', category: 'tops', price: 59.90, oldPrice: null, badge: null, images: ['linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'] }
];

async function inicializarProdutosPadrao() {
    if (productsData.length === 0) {
        console.log('📦 Nenhum produto no Firestore, adicionando produtos padrão...');
        
        for (const produto of DEFAULT_PRODUCTS) {
            try {
                const docRef = await db.collection("produtos").add({
                    ...produto,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ Produto "${produto.name}" adicionado com ID: ${docRef.id}`);
            } catch (error) {
                console.error(`❌ Erro ao adicionar "${produto.name}":`, error);
            }
        }
        
        // Recarregar do Firestore após adicionar
        await carregarProdutosDoFirestore();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        loadSettings();
        loadCart();
        await loadProducts();
        renderProducts();
        updateCartUI();
        initCarousel();
        console.log('✅ Site carregado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar:', error);
        alert('Erro ao carregar o site. Por favor, recarregue a página.');
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
});

// Admin System
const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'sejaversatil2025',
    email: 'admin@sejaversatil.com.br'
};

let isAdminLoggedIn = false;
let currentUser = null;
let editingProductId = null;

// User System
function openUserPanel() {
    const panel = document.getElementById('userPanel');
    panel.classList.add('active');
    
    // Check if user is logged in
    checkUserSession();
}

function closeUserPanel() {
    document.getElementById('userPanel').classList.remove('active');
}

function switchUserTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.user-panel-tab').forEach(btn => btn.classList.remove('active'));
    
    // Update tab content
    document.querySelectorAll('.user-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tab === 'login') {
        document.querySelectorAll('.user-panel-tab')[0].classList.add('active');
        document.getElementById('loginTab').classList.add('active');
    } else if (tab === 'register') {
        document.querySelectorAll('.user-panel-tab')[1].classList.add('active');
        document.getElementById('registerTab').classList.add('active');
    }
}

function checkUserSession() {
    const savedUser = localStorage.getItem('sejaVersatilCurrentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showLoggedInView();
    }
}

function showLoggedInView() {
    // Hide tabs
    document.getElementById('userPanelTabs').style.display = 'none';
    
    // Hide login/register tabs
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('registerTab').classList.remove('active');
    
    // Show logged in view
    document.getElementById('userLoggedTab').classList.add('active');
    
    // Update user info
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userEmail').textContent = currentUser.email;
    
    // Check if admin
    if (currentUser.isAdmin) {
        document.getElementById('userStatus').innerHTML = 'Administrador <span class="admin-badge">ADMIN</span>';
        document.getElementById('adminAccessBtn').style.display = 'block';
        isAdminLoggedIn = true;
    } else {
        document.getElementById('userStatus').textContent = 'Cliente';
        document.getElementById('adminAccessBtn').style.display = 'none';
    }
}

function hideLoggedInView() {
    document.getElementById('userPanelTabs').style.display = 'flex';
    document.getElementById('userLoggedTab').classList.remove('active');
    switchUserTab('login');
}

function userLogin(event) {
    event.preventDefault();
    
    const emailOrUsername = document.getElementById('loginEmail').value.toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const errorMsg = document.getElementById('loginError');

    // Check if admin
    if ((emailOrUsername === ADMIN_CREDENTIALS.username || emailOrUsername === ADMIN_CREDENTIALS.email) && 
        password === ADMIN_CREDENTIALS.password) {
        currentUser = {
            name: 'Administrador',
            email: ADMIN_CREDENTIALS.email,
            isAdmin: true
        };
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        showLoggedInView();
        errorMsg.classList.remove('active');
        return;
    }

    // Check regular users
    const users = JSON.parse(localStorage.getItem('sejaVersatilUsers') || '[]');
    const user = users.find(u => u.email.toLowerCase() === emailOrUsername && u.password === password);

    if (user) {
        currentUser = {
            name: user.name,
            email: user.email,
            isAdmin: false
        };
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        showLoggedInView();
        errorMsg.classList.remove('active');
    } else {
        errorMsg.classList.add('active');
    }
}

function userRegister(event) {
    event.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value.toLowerCase();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorMsg = document.getElementById('registerError');
    const successMsg = document.getElementById('registerSuccess');

    // Clear previous messages
    errorMsg.classList.remove('active');
    successMsg.classList.remove('active');

    // Validate passwords match
    if (password !== confirmPassword) {
        errorMsg.textContent = 'As senhas não coincidem';
        errorMsg.classList.add('active');
        return;
    }

    // Check if email already exists
    const users = JSON.parse(localStorage.getItem('sejaVersatilUsers') || '[]');
    if (users.some(u => u.email === email)) {
        errorMsg.textContent = 'Este e-mail já está cadastrado';
        errorMsg.classList.add('active');
        return;
    }

    // Check if trying to use admin email
    if (email === ADMIN_CREDENTIALS.email) {
        errorMsg.textContent = 'Este e-mail não pode ser usado';
        errorMsg.classList.add('active');
        return;
    }

    // Create new user
    const newUser = { name, email, password };
    users.push(newUser);
    localStorage.setItem('sejaVersatilUsers', JSON.stringify(users));

    // Show success message
    successMsg.classList.add('active');
    
    // Clear form
    document.getElementById('registerName').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('registerConfirmPassword').value = '';

    // Switch to login after 2 seconds
    setTimeout(() => {
        switchUserTab('login');
        successMsg.classList.remove('active');
    }, 2000);
}

function userLogout() {
    if (confirm('Deseja realmente sair da sua conta?')) {
        currentUser = null;
        isAdminLoggedIn = false;
        localStorage.removeItem('sejaVersatilCurrentUser');
        hideLoggedInView();
    }
}

async function carregarProdutosDoFirestore() {
    try {
        console.log('🔄 Carregando produtos do Firestore...');
        
        // ✅ CORRETO: Usar API compat
        const snapshot = await db.collection("produtos").get();

        productsData.length = 0;

        snapshot.forEach((doc) => {
            productsData.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`✅ ${productsData.length} produtos carregados do Firestore`);
        return productsData;
        
    } catch (error) {
        console.error("❌ Erro ao carregar produtos do Firestore:", error);

        // Mensagens de erro mais específicas
        if (error.code === 'permission-denied') {
            console.error('🔒 Permissão negada. Verifique as regras do Firestore.');
        } else if (error.code === 'unavailable') {
            console.error('🌐 Firestore indisponível. Verifique sua conexão com a internet.');
        }

        throw error;
    }
}

// Load products from localStorage or use defaults
async function loadProducts() {
    try {
        await carregarProdutosDoFirestore();
        
        // Se não houver produtos, inicializar com padrões
        await inicializarProdutosPadrao();
        
    } catch (error) {
        console.error("Erro ao carregar do Firestore:", error);
        alert('⚠️ Erro ao conectar com o banco de dados. Verifique sua conexão.');
    }
}

function saveProducts() {
    localStorage.setItem('sejaVersatilProducts', JSON.stringify(productsData));
}

function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('adminUsername').focus();
}

function adminLogin() {
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    const errorMsg = document.getElementById('loginError');

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        isAdminLoggedIn = true;
        document.getElementById('loginModal').classList.remove('active');
        openAdminPanel();
        errorMsg.classList.remove('active');
        // Clear inputs
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
    } else {
        errorMsg.classList.add('active');
    }
}

function openAdminPanel() {
    if (!isAdminLoggedIn) {
        alert('Você precisa estar logado como administrador para acessar esta área.');
        openUserPanel();
        return;
    }
    document.getElementById('adminPanel').classList.add('active');
    renderAdminProducts();
    updateAdminStats();
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('active');
    isAdminLoggedIn = false;
}

function switchAdminTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tab === 'products') {
        document.getElementById('productsTab').classList.add('active');
    } else if (tab === 'settings') {
        document.getElementById('settingsTab').classList.add('active');
    }
}

function updateAdminStats() {
    const totalProducts = productsData.length;
    const totalValue = productsData.reduce((sum, p) => sum + p.price, 0);
    const activeProducts = productsData.filter(p => !p.oldPrice).length;

    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalRevenue').textContent = `R$ ${totalValue.toFixed(2)}`;
    document.getElementById('totalOrders').textContent = Math.floor(Math.random() * 50) + 10;
    document.getElementById('activeProducts').textContent = activeProducts;
}

function renderAdminProducts() {
    const grid = document.getElementById('adminProductsGrid');
    grid.innerHTML = productsData.map(product => {
        const images = product.images || (product.image ? [product.image] : ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)']);
        const firstImage = images[0];
        const isRealImage = firstImage.startsWith('data:image') || firstImage.startsWith('http');
        
        return `
            <div class="admin-product-card">
                <div class="admin-product-image" style="${isRealImage ? `background-image: url(${firstImage}); background-size: cover; background-position: center;` : `background: ${firstImage}`}"></div>
                <div class="admin-product-info">
                    <h4>${product.name}</h4>
                    <p><strong>Categoria:</strong> ${product.category}</p>
                    <p><strong>Preço:</strong> R$ ${product.price.toFixed(2)}</p>
                    ${product.oldPrice ? `<p><strong>De:</strong> R$ ${product.oldPrice.toFixed(2)}</p>` : ''}
                    ${product.badge ? `<p><strong>Badge:</strong> ${product.badge}</p>` : ''}
                    <p><strong>Imagens:</strong> ${images.length}</p>
                </div>
                <div class="admin-actions">
                    <button class="admin-btn admin-btn-edit" onclick="editProduct('${product.id}')">Editar</button>
                    <button class="admin-btn admin-btn-delete" onclick="deleteProduct('${product.id}')">Excluir</button>
                </div>
            </div>
        `;
    }).join('');
}

function openProductModal(productId = null) {
    editingProductId = productId;
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modalTitle');

    if (productId) {
        // Edit mode
        const product = productsData.find(p => p.id === productId);
        title.textContent = 'Editar Produto';
        document.getElementById('productId').value = productId;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productOldPrice').value = product.oldPrice || '';
        document.getElementById('productBadge').value = product.badge || '';
        tempProductImages = [...(product.images || (product.image ? [product.image] : []))];
    } else {
        // Add mode
        title.textContent = 'Adicionar Novo Produto';
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        tempProductImages = ['linear-gradient(135deg, #667eea 0%, #764ba2 100%)'];
    }

    renderProductImages();
    modal.classList.add('active');
}

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
    
    // Verificar se Storage está configurado
    if (!storage) {
        alert('⚠️ Firebase Storage não está configurado. Use URLs de imagem ou gradientes.');
        event.target.value = '';
        return;
    }

    // Verificar tamanho dos arquivos
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    for (const file of files) {
        if (file.size > MAX_SIZE) {
            alert(`❌ Arquivo "${file.name}" é muito grande! Máximo: 5MB`);
            event.target.value = '';
            return;
        }
    }
    
    // Mostrar loading
    const loadingMsg = document.createElement('div');
    loadingMsg.style.cssText = 'padding: 1rem; background: #f0f0f0; margin-bottom: 1rem; border-radius: 4px;';
    loadingMsg.textContent = '⏳ Fazendo upload das imagens...';
    document.getElementById('productImagesList').parentElement.insertBefore(loadingMsg, document.getElementById('productImagesList'));

    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione apenas arquivos de imagem!');
            continue;
        }

        try {
            // Upload para Firebase Storage
            const storageRef = storage.ref();
            const imageRef = storageRef.child(`produtos/${Date.now()}_${file.name}`);
            
            // Upload do arquivo
            await imageRef.put(file);
            
            // Obter URL pública
            const imageUrl = await imageRef.getDownloadURL();
            
            // Adicionar à lista de imagens
            tempProductImages.push(imageUrl);
            renderProductImages();
            
        } catch (error) {
            console.error('Erro ao fazer upload:', error);
            alert('Erro ao fazer upload da imagem: ' + error.message);
        }
    }

    // Remover loading
    loadingMsg.remove();
    
    // Reset input
    event.target.value = '';
}

function toggleUrlInput() {
    const urlBox = document.getElementById('imageUrlInputBox');
    const gradientBox = document.getElementById('imageGradientInputBox');
    
    if (urlBox) {
        // Close gradient if open
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
        // Close URL if open
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
        alert('Cole o link da imagem!');
        return;
    }

    // Validate URL format
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        alert('URL inválida! Deve começar com http:// ou https://');
        return;
    }

    // Test if image loads
    const img = new Image();
    img.onload = function() {
        tempProductImages.push(imageUrl);
        renderProductImages();
        urlField.value = '';
        toggleUrlInput();
    };
    img.onerror = function() {
        alert('Não foi possível carregar a imagem desta URL. Verifique se o link está correto e tente novamente.');
    };
    img.src = imageUrl;
}

function addGradientImage() {
    const gradientField = document.getElementById('gradientField');
    if (!gradientField) return;
    
    const gradient = gradientField.value.trim();
    
    if (!gradient) {
        alert('Digite um gradiente CSS!');
        return;
    }

    // Basic validation for CSS gradient
    if (!gradient.includes('gradient')) {
        alert('Formato inválido! Exemplo: linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
        return;
    }

    tempProductImages.push(gradient);
    renderProductImages();
    gradientField.value = '';
    toggleGradientInput();
}

function removeProductImage(index) {
    if (tempProductImages.length > 1) {
        tempProductImages.splice(index, 1);
        renderProductImages();
    } else {
        alert('O produto precisa ter pelo menos 1 imagem!');
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
            // Deletar do Firestore
            await db.collection("produtos").doc(productId).delete();
            
            // Deletar do array local
            const index = productsData.findIndex(p => p.id === productId);
            if (index !== -1) {
                productsData.splice(index, 1);
            }
            
            saveProducts();
            renderAdminProducts();
            renderProducts();
            updateAdminStats();
            alert('Produto excluído com sucesso!');
            
        } catch (error) {
            console.error("Erro ao excluir produto:", error);
            alert('Erro ao excluir produto: ' + error.message);
        } finally {
            document.getElementById('loadingOverlay').classList.remove('active');
        }
    }
}

async function saveProduct(event) {
    event.preventDefault();
    
    // Mostrar loading
    document.getElementById('loadingOverlay').classList.add('active');
    
    const name = document.getElementById('productName').value;
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const oldPrice = document.getElementById('productOldPrice').value ? parseFloat(document.getElementById('productOldPrice').value) : null;
    const badge = document.getElementById('productBadge').value || null;
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

    try {
        if (productId) {
            // EDITAR produto existente
            await db.collection("produtos").doc(productId).update(productData);
            
            // Atualizar no array local também
            const product = productsData.find(p => p.id === productId);
            if (product) {
                Object.assign(product, productData);
                product.id = productId;
            }
        } else {
            // ADICIONAR novo produto
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection("produtos").add(productData);
            
            // Adicionar ao array local
            productsData.push({
                id: docRef.id,
                ...productData
            });
        }

        saveProducts();
        closeProductModal();
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        alert('Produto salvo com sucesso no Firestore!');
        
        // Recarregar produtos do Firestore
        await carregarProdutosDoFirestore();
        
    } catch (error) {
        console.error("Erro ao salvar produto:", error);
        alert('Erro ao salvar produto: ' + error.message);
        return;
    }
    
    // Recarregar produtos do Firestore para garantir sincronia
    try {
        await carregarProdutosDoFirestore();
        renderProducts();
        updateAdminStats();
    } catch (error) {
        console.error("Erro ao recarregar produtos:", error);
    } finally {
        // Esconder loading
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

function saveSettings() {
    const bannerTitle = document.getElementById('settingBannerTitle').value;
    const bannerSubtitle = document.getElementById('settingBannerSubtitle').value;
    const topBanner = document.getElementById('settingTopBanner').value;

    // Update hero section
    document.querySelector('.hero h1').textContent = bannerTitle;
    document.querySelector('.hero-subtitle').textContent = bannerSubtitle;
    document.querySelector('.top-banner').textContent = topBanner;

    // Save to localStorage
    localStorage.setItem('sejaVersatilSettings', JSON.stringify({
        bannerTitle,
        bannerSubtitle,
        topBanner
    }));

    alert('Configurações salvas com sucesso!');
}
// Função para limpar todos os produtos do Firestore
async function limparTodosProdutos() {
    const confirmacao = confirm(
        '⚠️ ATENÇÃO! Esta ação irá DELETAR TODOS os produtos do Firestore.\n\n' +
        'Esta ação NÃO pode ser desfeita!\n\n' +
        'Tem CERTEZA ABSOLUTA que deseja continuar?'
    );
    
    if (!confirmacao) return;
    
    const confirmacaoDupla = prompt(
        'Digite "DELETAR TUDO" (sem aspas) para confirmar:'
    );
    
    if (confirmacaoDupla !== 'DELETAR TUDO') {
        alert('❌ Ação cancelada. Texto não corresponde.');
        return;
    }
    
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const snapshot = await db.collection("produtos").get();
        
        if (snapshot.empty) {
            alert('ℹ️ Não há produtos para deletar.');
            return;
        }
        
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        
        productsData.length = 0;
        
        renderAdminProducts();
        renderProducts();
        updateAdminStats();
        
        alert(`✅ ${snapshot.size} produtos foram deletados do Firestore!`);
        
    } catch (error) {
        console.error("Erro ao limpar produtos:", error);
        alert('❌ Erro ao limpar produtos: ' + error.message);
    } finally {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}
// Load settings on page load
function loadSettings() {
    const saved = localStorage.getItem('sejaVersatilSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        document.querySelector('.hero h1').textContent = settings.bannerTitle;
        document.querySelector('.hero-subtitle').textContent = settings.bannerSubtitle;
        document.querySelector('.top-banner').textContent = settings.topBanner;

        document.getElementById('settingBannerTitle').value = settings.bannerTitle;
        document.getElementById('settingBannerSubtitle').value = settings.bannerSubtitle;
        document.getElementById('settingTopBanner').value = settings.topBanner;
    }
}

// Sidebar Menu
function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    const btn = document.getElementById('hamburgerBtn');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    btn.classList.toggle('active');
}

// Hero Carousel
let currentSlide = 0;
let carouselInterval;

function initCarousel() {
    const slides = document.querySelectorAll('.hero-slide');
    const dotsContainer = document.getElementById('carouselDots');
    
    // Create dots
    slides.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = 'carousel-dot' + (index === 0 ? ' active' : '');
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });
    
    // Start auto-play
    startCarousel();
}

function startCarousel() {
    carouselInterval = setInterval(() => {
        nextSlide();
    }, 5000);
}

function stopCarousel() {
    clearInterval(carouselInterval);
}

function nextSlide() {
    const slides = document.querySelectorAll('.hero-slide');
    currentSlide = (currentSlide + 1) % slides.length;
    updateCarousel();
}

function goToSlide(index) {
    stopCarousel();
    currentSlide = index;
    updateCarousel();
    startCarousel();
}

function updateCarousel() {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    
    slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentSlide);
    });
    
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
}

// Chat Widget
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
    
    // Add user message
    addChatMessage(message, 'user');
    input.value = '';
    
    // Simulate bot response
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
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Filter Products
function filterProducts(category) {
    currentFilter = category;
    currentPage = 1;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderProducts();
}

// Sort Products
function sortProducts(sortType) {
    currentSort = sortType;
    renderProducts();
}

// Get Filtered Products
function getFilteredProducts() {
    let filtered = productsData;
    
    // Apply category filter
    if (currentFilter !== 'all') {
        if (currentFilter === 'sale') {
            filtered = filtered.filter(p => p.oldPrice !== null);
        } else {
            filtered = filtered.filter(p => p.category === currentFilter);
        }
    }
    
    // Apply sorting
    if (currentSort === 'price-asc') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-desc') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return filtered;
}

// Render Products
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
        
        return `
            <div class="product-card">
                <div class="product-image">
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
                    ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ''}
                    <button class="add-to-cart-btn" onclick="addToCart('${product.id}')">Adicionar ao Carrinho</button>
                </div>
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <div class="product-price">
                        ${product.oldPrice ? `<span class="price-old">R$ ${product.oldPrice.toFixed(2)}</span>` : ''}
                        <span class="price-new">R$ ${product.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    renderPagination(totalPages);
}

// Product Image Carousel Functions
function nextProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    
    slides[currentIndex].classList.remove('active');
    dots[currentIndex].classList.remove('active');
    
    currentIndex = (currentIndex + 1) % slides.length;
    
    slides[currentIndex].classList.add('active');
    dots[currentIndex].classList.add('active');
}

function prevProductImage(productId, event) {
    event.stopPropagation();
    const card = event.target.closest('.product-card');
    const slides = card.querySelectorAll('.product-image-slide');
    const dots = card.querySelectorAll('.product-carousel-dot');
    let currentIndex = Array.from(slides).findIndex(slide => slide.classList.contains('active'));
    
    slides[currentIndex].classList.remove('active');
    dots[currentIndex].classList.remove('active');
    
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    
    slides[currentIndex].classList.add('active');
    dots[currentIndex].classList.add('active');
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

// Render Pagination
function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    if (currentPage > 1) {
        html += `<button class="page-btn" onclick="changePage(${currentPage - 1})">‹</button>`;
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="page-btn" style="border: none; cursor: default;">...</span>`;
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        html += `<button class="page-btn" onclick="changePage(${currentPage + 1})">›</button>`;
    }
    
    pagination.innerHTML = html;
}

// Change Page
function changePage(page) {
    currentPage = page;
    renderProducts();
    document.getElementById('produtos').scrollIntoView({ behavior: 'smooth' });
}

// Add to Cart
function addToCart(productId) {
    const product = productsData.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        // Garantir que o produto tenha a primeira imagem disponível
        const productWithImage = {
            ...product,
            quantity: 1,
            image: product.images ? product.images[0] : (product.image || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
        };
        cart.push(productWithImage);
    }
    
    saveCart();
    updateCartUI();
    
    // Show feedback
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Adicionado!';
    btn.style.background = 'rgba(76, 175, 80, 0.9)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = 'rgba(0,0,0,0.8)';
    }, 1500);
}

// Update Cart UI
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
                        <div class="cart-item-title">${item.name}</div>
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

// Update Quantity
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

// Remove from Cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

// Toggle Cart
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Save Cart to LocalStorage
function saveCart() {
    const cartData = cart.map(item => ({
        id: item.id,
        quantity: item.quantity
    }));
    localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
}

// Load Cart from LocalStorage
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

// Checkout
function checkout() {
    if (cart.length === 0) return;
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    alert(`Finalizando compra!\n\nTotal: R$ ${total.toFixed(2)}\n\nEm breve você será redirecionado para o pagamento.`);
}

// Search Functions
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

// Close search when clicking outside
document.getElementById('searchModal').addEventListener('click', (e) => {
    if (e.target.id === 'searchModal') {
        closeSearch();
    }
});

// Perform Search
function performSearch() {
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
                    <div style="font-weight: 600; margin-bottom: 0.3rem;">${product.name}</div>
                    <div style="color: var(--primary); font-weight: 700;">R$ ${product.price.toFixed(2)}</div>
                </div>
            </div>
        `;
    }).join('');
}

function selectSearchResult(productId) {
    addToCart(productId);
    closeSearch();
    toggleCart();
}

// Close modals with ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSearch();
        if (document.getElementById('cartSidebar').classList.contains('active')) {
            toggleCart();
        }
    }
});



