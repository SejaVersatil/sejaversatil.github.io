// script2.js - Lógica Central (Core)
// Contém: Firebase Init, Carrinho, Auth, Admin e Funções Globais

// ==================== 1. CONFIGURAÇÃO FIREBASE ====================
const firebaseConfig = {
    apiKey: "AIzaSyAJ9-qnEhtiRVKiyF2TZcLgVgq5kLZYxSs",
    authDomain: "seja-versatil.firebaseapp.com",
    projectId: "seja-versatil",
    storageBucket: "seja-versatil.firebasestorage.app",
    messagingSenderId: "102339207381",
    appId: "1:102339207381:web:cbe1192e3550cd5bf0825c",
    measurementId: "G-86E5CX4S3T"
};

// Inicializa apenas se ainda não existir
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Variáveis globais do Firebase
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// ==================== 2. ESTADO GLOBAL ====================
let productsData = [];
let cart = []; // Carrinho Global
let favorites = JSON.parse(localStorage.getItem('sejaVersatilFavorites') || '[]');

// ==================== 3. CARRINHO DE COMPRAS (CORE) ====================

// Carregar carrinho do LocalStorage
function loadCart() {
    const saved = localStorage.getItem('sejaVersatilCart');
    if (saved) {
        try {
            cart = JSON.parse(saved);
        } catch (e) {
            console.error('Erro ao carregar carrinho:', e);
            cart = [];
        }
    }
    updateCartUI();
}

// Salvar carrinho
function saveCart() {
    localStorage.setItem('sejaVersatilCart', JSON.stringify(cart));
    updateCartUI();
}

// Atualizar UI do Carrinho (Global)
function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItemsContainer = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    const cartTotal = document.getElementById('cartTotal');

    // Atualizar badge
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    if (cartCount) {
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    // Se não estivermos na página que tem o sidebar do carrinho, para por aqui
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<div class="empty-cart">Seu carrinho está vazio</div>';
        if (cartFooter) cartFooter.style.display = 'none';
    } else {
        cartItemsContainer.innerHTML = '';
        cart.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            
            // Tratamento de imagem
            let bgImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            if (item.image) {
                if (item.image.startsWith('http') || item.image.startsWith('data:')) {
                    bgImage = `url('${item.image}')`;
                } else {
                    bgImage = item.image;
                }
            }

            itemDiv.innerHTML = `
                <div class="cart-item-img" style="background-image: ${bgImage.startsWith('url') ? bgImage : 'none'}; background: ${!bgImage.startsWith('url') ? bgImage : ''}; background-size: cover;"></div>
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div style="font-size: 0.75rem; color: #666;">
                        ${item.selectedSize ? `Tam: ${item.selectedSize}` : ''} 
                        ${item.selectedColor ? `| Cor: ${item.selectedColor}` : ''}
                    </div>
                    <div class="cart-item-price">R$ ${parseFloat(item.price).toFixed(2)}</div>
                    <div class="cart-item-qty">
                        <button class="qty-btn" onclick="updateQuantity('${item.cartItemId || item.id}', -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQuantity('${item.cartItemId || item.id}', 1)">+</button>
                    </div>
                    <div class="remove-item" onclick="removeFromCart('${item.cartItemId || item.id}')">Remover</div>
                </div>
            `;
            cartItemsContainer.appendChild(itemDiv);
        });

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (cartTotal) cartTotal.textContent = `R$ ${total.toFixed(2)}`;
        if (cartFooter) cartFooter.style.display = 'block';
    }
}

// Adicionar ao Carrinho (Função Universal)
// Usada tanto pela Home quanto pela página de Produto
function addToCart(product, size = null, color = null, quantity = 1) {
    // Gera ID único baseado nas variações
    const cartItemId = size || color ? `${product.id}_${size || ''}_${color || ''}` : product.id;
    
    const existingItem = cart.find(item => (item.cartItemId || item.id) === cartItemId);

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        // Tenta pegar a primeira imagem se for array
        let mainImage = product.image;
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            mainImage = product.images[0];
        }

        cart.push({
            id: product.id,
            cartItemId: cartItemId,
            name: product.name,
            price: product.price,
            image: mainImage,
            selectedSize: size,
            selectedColor: color,
            quantity: quantity
        });
    }

    saveCart();
    toggleCart(true); // Abre o carrinho
    showToast('Produto adicionado ao carrinho!', 'success');
}

function updateQuantity(id, delta) {
    const item = cart.find(i => (i.cartItemId || i.id) === id);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromCart(id);
        } else {
            saveCart();
        }
    }
}

function removeFromCart(id) {
    cart = cart.filter(i => (i.cartItemId || i.id) !== id);
    saveCart();
}

function toggleCart(forceOpen = false) {
    const sidebar = document.getElementById('cartSidebar');
    const overlay = document.getElementById('cartOverlay');
    if (!sidebar || !overlay) return;

    if (forceOpen) {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    } else {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// ==================== 4. CHECKOUT (WhatsApp) ====================

function checkout() {
    if (cart.length === 0) return;
    
    // Abre modal de pagamento se existir
    const modal = document.getElementById('paymentModal');
    if (modal) {
        // Renderizar resumo no modal
        const summary = document.getElementById('paymentCartItems');
        const totalEl = document.getElementById('paymentTotal');
        if(summary) {
            summary.innerHTML = cart.map(item => `
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; border-bottom:1px solid #eee; padding-bottom:0.5rem;">
                    <div>
                        <div style="font-weight:600;">${item.name}</div>
                        <div style="font-size:0.8rem; color:#666;">${item.quantity}x R$ ${item.price.toFixed(2)}</div>
                    </div>
                    <div>R$ ${(item.quantity * item.price).toFixed(2)}</div>
                </div>
            `).join('');
        }
        if(totalEl) {
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            totalEl.textContent = `R$ ${total.toFixed(2)}`;
        }
        modal.classList.add('active');
    }
}

function sendToWhatsApp() {
    const WHATSAPP_NUMBER = '5571991427103';
    
    const methodInput = document.querySelector('input[name="paymentMethod"]:checked');
    const paymentMethod = methodInput ? methodInput.value : 'pix';
    
    let methodText = 'PIX';
    if(paymentMethod === 'boleto') methodText = 'Boleto';
    if(paymentMethod === 'credito-avista') methodText = 'Crédito à Vista';
    if(paymentMethod === 'credito-parcelado') {
        const parc = document.getElementById('installments') ? document.getElementById('installments').value : '2';
        methodText = `Crédito Parcelado (${parc}x)`;
    }

    let msg = `*🛍️ NOVO PEDIDO - SEJA VERSÁTIL*\n\n`;
    cart.forEach((item, i) => {
        msg += `${i+1}. *${item.name}*\n`;
        if(item.selectedSize || item.selectedColor) {
            msg += `   📏 ${item.selectedSize || '-'} | 🎨 ${item.selectedColor || '-'}\n`;
        }
        msg += `   Qtd: ${item.quantity} | R$ ${item.price.toFixed(2)}\n\n`;
    });

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    msg += `*💰 TOTAL: R$ ${total.toFixed(2)}*\n`;
    msg += `💳 Pagamento: ${methodText}\n`;
    
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
    
    // Opcional: Limpar carrinho
    // cart = []; saveCart();
    if(document.getElementById('paymentModal')) document.getElementById('paymentModal').classList.remove('active');
}

// ==================== 5. UTILITÁRIOS ====================

function showToast(msg, type = 'success') {
    // Cria toast dinamicamente se não existir
    let toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = type === 'success' ? '#27ae60' : '#e74c3c';
    toast.style.color = 'white';
    toast.style.padding = '1rem 2rem';
    toast.style.borderRadius = '50px';
    toast.style.zIndex = '10000';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    toast.innerText = msg;
    
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    
    // Listeners Globais de Fechamento
    document.addEventListener('click', (e) => {
        if(e.target.id === 'cartOverlay') toggleCart();
        if(e.target.id === 'sidebarOverlay') toggleSidebar();
        if(e.target.id === 'paymentModal' || e.target.classList.contains('payment-modal-close')) {
            document.getElementById('paymentModal').classList.remove('active');
        }
    });
});

// Expõe funções para uso global (Produto.js)
window.addToCart = addToCart;
window.toggleCart = toggleCart;
window.checkout = checkout;
window.db = db;
