// ==========================================================================
// CHECKOUT.JS - Lógica de Carrinho, Firebase, Validação e Finalização
// ==========================================================================

'use strict';

// Variáveis de Estado Global
const state = {
    cart: {
        items: [],
        appliedCoupon: null,
        couponDiscount: 0,
        subtotal: 0,
        shipping: 0,
        total: 0
    },
    user: null,
    address: null,
    selectedShipping: null,
    selectedPayment: 'pix',
    isProcessing: false
};

// ==================== UTILS ====================

const $ = (id) => document.getElementById(id);

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function applyMask(input, mask) {
    function format() {
        let i = 0;
        const v = input.value.replace(/\D/g, '');
        input.value = mask.replace(/#/g, () => v[i++] || '');
    }
    input.addEventListener('input', format);
    input.addEventListener('focus', format);
    input.addEventListener('blur', format);
    return format;
}

// ==================== LOCAL STORAGE (CARRINHO) ====================

function loadCartFromStorage() {
    try {
        const raw = localStorage.getItem('sejaVersatilCart');
        if (!raw) {
            return false; // Carrinho vazio
        }
        
        const parsed = JSON.parse(raw);
        
        if (parsed.items && Array.isArray(parsed.items)) {
            // Formato novo: {items: [], appliedCoupon: {}, couponDiscount: 0}
            state.cart.items = parsed.items.map(item => ({
                ...item,
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0
            }));
            state.cart.appliedCoupon = parsed.appliedCoupon || null;
            state.cart.couponDiscount = Number(parsed.couponDiscount) || 0;
        } else if (Array.isArray(parsed)) {
            // Formato antigo: [{item1}, {item2}]
            state.cart.items = parsed.map(item => ({
                ...item,
                quantity: Number(item.quantity) || 1,
                price: Number(item.price) || 0
            }));
            state.cart.appliedCoupon = null;
            state.cart.couponDiscount = 0;
        } else {
            return false;
        }

        if (state.cart.items.length === 0) {
            return false;
        }

        return true;

    } catch (err) {
        console.error('Erro ao carregar carrinho:', err);
        return false;
    }
}

function saveCartToStorage() {
    try {
        const cartData = {
            items: state.cart.items || [],
            appliedCoupon: state.cart.appliedCoupon || null,
            couponDiscount: state.cart.couponDiscount || 0
        };
        localStorage.setItem('sejaVersatilCart', JSON.stringify(cartData));
    } catch (err) {
        console.error('Erro ao salvar carrinho', err);
    }
}

function clearCart() {
    state.cart.items = [];
    state.cart.appliedCoupon = null;
    state.cart.couponDiscount = 0;
    state.cart.subtotal = 0;
    state.cart.shipping = 0;
    state.cart.total = 0;
    localStorage.removeItem('sejaVersatilCart');
}

// ==================== LÓGICA DE CUPOM (SIMULADA) ====================

// Simulação de base de dados de cupons
const availableCoupons = {
    'PRIMEIRACOMPRA': { type: 'percent', value: 0.10, description: '10% OFF na primeira compra' },
    'FRETEGRATIS': { type: 'shipping', value: 0, description: 'Frete Grátis' },
    'DEZREAIS': { type: 'fixed', value: 10.00, description: 'R$ 10,00 de desconto' }
};

function calculateDiscount(subtotal, shipping) {
    let discount = 0;
    let newShipping = shipping;

    if (state.cart.appliedCoupon) {
        const coupon = state.cart.appliedCoupon;
        if (coupon.type === 'percent') {
            discount = subtotal * coupon.value;
        } else if (coupon.type === 'fixed') {
            discount = coupon.value;
        } else if (coupon.type === 'shipping') {
            discount = shipping;
            newShipping = 0;
        }
    }

    // Garante que o desconto não seja maior que o subtotal
    discount = Math.min(discount, subtotal);
    
    state.cart.couponDiscount = discount;
    state.cart.shipping = newShipping;
    state.cart.total = subtotal - discount + newShipping;
}

function applyCoupon() {
    const input = $('checkoutCouponInput');
    const messageEl = $('checkoutCouponMessage');
    const code = input.value.toUpperCase().trim();

    messageEl.textContent = '';
    messageEl.style.color = 'red';

    if (!code) {
        messageEl.textContent = 'Digite um código de cupom.';
        return;
    }

    if (availableCoupons[code]) {
        state.cart.appliedCoupon = availableCoupons[code];
        messageEl.textContent = `Cupom "${code}" aplicado com sucesso!`;
        messageEl.style.color = 'green';
        updateSummary();
    } else {
        state.cart.appliedCoupon = null;
        state.cart.couponDiscount = 0;
        messageEl.textContent = 'Cupom inválido ou expirado.';
        updateSummary();
    }
}

function removeCoupon() {
    state.cart.appliedCoupon = null;
    state.cart.couponDiscount = 0;
    $('checkoutCouponInput').value = '';
    $('checkoutCouponMessage').textContent = '';
    updateSummary();
}

// ==================== FIREBASE (AUTENTICAÇÃO) ====================

function setupAuthListener() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            state.user = user;
            // Simula a busca do nome do usuário (o Firebase Auth só retorna displayName se foi setado)
            state.user.displayName = user.displayName || $('name').value || 'Cliente'; 
            updateIdentificationStep(true);
        } else {
            state.user = null;
            updateIdentificationStep(false);
        }
    });
}

function updateIdentificationStep(isLoggedIn) {
    const displayEl = $('user-info-display');
    const formEl = $('identification-form');
    const nameInput = $('name');
    const emailInput = $('email');

    if (isLoggedIn && state.user) {
        displayEl.style.display = 'flex';
        formEl.style.display = 'none';
        $('user-name-display').textContent = state.user.displayName;
        $('user-email-display').textContent = state.user.email;
        
        // Preenche os campos de entrega com os dados do usuário logado (se houver)
        nameInput.value = state.user.displayName || '';
        emailInput.value = state.user.email || '';
        nameInput.disabled = true;
        emailInput.disabled = true;

    } else {
        displayEl.style.display = 'none';
        formEl.style.display = 'flex';
        nameInput.disabled = false;
        emailInput.disabled = false;
    }
    
    // Adiciona listener ao botão de logout
    $('logout-btn').onclick = () => {
        auth.signOut().then(() => {
            console.log('Usuário deslogado.');
            // Limpa os campos de nome/email
            $('name').value = '';
            $('email').value = '';
        }).catch((error) => {
            console.error('Erro ao deslogar:', error);
        });
    };

    // Simula o botão de Login/Cadastro
    $('login-register-btn').onclick = () => {
        alert('Funcionalidade de Login/Cadastro simulada. Em uma aplicação real, um modal de login seria aberto aqui.');
    };
}

// ==================== ENDEREÇO E FRETE ====================

async function searchCep() {
    const cepInput = $('cep');
    const cep = cepInput.value.replace(/\D/g, '');
    const addressFieldsEl = $('address-fields');
    const shippingOptionsEl = $('shipping-options-container');

    if (cep.length !== 8) {
        alert('CEP inválido.');
        return;
    }

    // Simulação da API ViaCEP
    // Em produção, usaríamos: fetch(`https://viacep.com.br/ws/${cep}/json/`)
    const simulatedAddress = {
        logradouro: 'Rua Simulação de Endereço',
        bairro: 'Bairro Teste',
        localidade: 'São Paulo',
        uf: 'SP'
    };

    try {
        // Simula um delay de rede
        await new Promise(resolve => setTimeout(resolve, 500)); 

        state.address = {
            cep: cep,
            street: simulatedAddress.logradouro,
            neighborhood: simulatedAddress.bairro,
            city: simulatedAddress.localidade,
            state: simulatedAddress.uf,
            number: '',
            complement: ''
        };

        // Preenche os campos
        $('street').value = state.address.street;
        $('neighborhood').value = state.address.neighborhood;
        $('city').value = state.address.city;
        $('state').value = state.address.state;
        $('number').value = ''; // O número deve ser preenchido pelo usuário
        $('complement').value = '';

        addressFieldsEl.style.display = 'flex';
        shippingOptionsEl.style.display = 'block';
        
        // Foca no campo de número
        $('number').focus();

        // Simula o cálculo do frete e atualiza o resumo
        simulateShippingCalculation();

    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        alert('Erro ao buscar CEP. Por favor, preencha o endereço manualmente.');
        addressFieldsEl.style.display = 'flex';
        shippingOptionsEl.style.display = 'none';
    }
}

function simulateShippingCalculation() {
    // Simula preços de frete
    const pacPrice = 25.00;
    const sedexPrice = 45.00;

    $('pac-price').textContent = formatCurrency(pacPrice);
    $('sedex-price').textContent = formatCurrency(sedexPrice);

    // Seleciona o PAC por padrão se nenhum estiver selecionado
    if (!state.selectedShipping) {
        $('shipping-pac').checked = true;
        state.selectedShipping = { method: 'PAC', price: pacPrice };
    }
    
    updateSummary();
}

function handleShippingSelection(event) {
    const selectedRadio = event.target;
    const priceEl = $(selectedRadio.id.replace('shipping', ''));
    const price = Number(priceEl.textContent.replace('R$', '').replace(',', '.').trim());

    state.selectedShipping = {
        method: selectedRadio.value,
        price: price
    };
    updateSummary();
}

// ==================== PAGAMENTO ====================

function handlePaymentTabClick(event) {
    const method = event.target.dataset.method;
    state.selectedPayment = method;

    document.querySelectorAll('.payment-tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.querySelectorAll('.payment-content').forEach(content => content.style.display = 'none');
    $(`payment-${method}`).style.display = 'block';
}

// ==================== RESUMO DO PEDIDO ====================

function renderSummaryProducts() {
    const listEl = $('summary-product-list');
    
    if (state.cart.items.length === 0) {
        listEl.innerHTML = '<div class="empty-cart-summary">Seu carrinho está vazio.</div>';
        return;
    }

    listEl.innerHTML = state.cart.items.map(item => `
        <div class="summary-item">
            <img src="${item.image || 'https://via.placeholder.com/60x80?text=SV'}" alt="${item.name}" class="summary-item-image">
            <div class="summary-item-details">
                <strong>${item.name}</strong>
                <p>${item.color ? item.color + ' / ' : ''}${item.size || 'Tamanho Único'}</p>
                <p>Qtd: ${item.quantity}</p>
            </div>
            <span class="summary-item-price">${formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');
}

function updateSummary() {
    const subtotal = state.cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    state.cart.subtotal = subtotal;
    
    let shippingCost = state.selectedShipping ? state.selectedShipping.price : 0;

    // Calcula o desconto e o total
    calculateDiscount(subtotal, shippingCost);

    // Atualiza o DOM
    $('summary-subtotal').textContent = formatCurrency(subtotal);
    $('summary-shipping').textContent = formatCurrency(state.cart.shipping);
    $('summary-total').textContent = formatCurrency(state.cart.total);

    const discountRow = $('summary-discount-row');
    const discountEl = $('summary-discount');
    const finalizeBtn = $('finalize-order-btn');

    if (state.cart.couponDiscount > 0) {
        discountEl.textContent = `- ${formatCurrency(state.cart.couponDiscount)}`;
        discountRow.style.display = 'flex';
    } else {
        discountRow.style.display = 'none';
    }

    // Atualiza o badge do cupom
    const badgeEl = $('checkoutAppliedCouponBadge');
    if (state.cart.appliedCoupon) {
        $('checkoutAppliedCouponCode').textContent = state.cart.appliedCoupon.description;
        badgeEl.style.display = 'flex';
    } else {
        badgeEl.style.display = 'none';
    }

    // Habilita o botão de finalizar se houver itens e frete selecionado
    if (state.cart.items.length > 0 && state.selectedShipping && !state.isProcessing) {
        finalizeBtn.disabled = false;
    } else {
        finalizeBtn.disabled = true;
    }
}

// ==================== VALIDAÇÃO E FINALIZAÇÃO ====================

function validateForm() {
    // 1. Validação de Identificação
    const name = $('name').value.trim();
    const email = $('email').value.trim();
    if (!name || !email || !email.includes('@')) {
        alert('Por favor, preencha seu Nome e Email corretamente.');
        return false;
    }

    // 2. Validação de Entrega
    const cep = $('cep').value.replace(/\D/g, '');
    const street = $('street').value.trim();
    const number = $('number').value.trim();
    const neighborhood = $('neighborhood').value.trim();
    const city = $('city').value.trim();
    const state_uf = $('state').value.trim();
    
    if (cep.length !== 8 || !street || !number || !neighborhood || !city || state_uf.length !== 2) {
        alert('Por favor, preencha todos os campos de endereço e selecione o frete.');
        return false;
    }

    if (!state.selectedShipping) {
        alert('Por favor, selecione uma opção de frete.');
        return false;
    }

    // 3. Validação de Pagamento
    if (state.selectedPayment === 'credit-card') {
        const cardNumber = $('card-number').value.replace(/\s/g, '');
        const cardName = $('card-name').value.trim();
        const cardExpiry = $('card-expiry').value.trim();
        const cardCvv = $('card-cvv').value.trim();

        if (cardNumber.length < 16 || !cardName || cardExpiry.length !== 5 || cardCvv.length < 3) {
            alert('Por favor, preencha todos os dados do Cartão de Crédito corretamente.');
            return false;
        }
    }

    return true;
}

async function finalizeOrder() {
    if (state.isProcessing) return;

    if (!validateForm()) {
        return;
    }

    state.isProcessing = true;
    $('finalize-order-btn').disabled = true;
    $('finalize-order-btn').textContent = 'PROCESSANDO...';
    $('loading-feedback').style.display = 'block';

    const orderData = {
        userId: state.user ? state.user.uid : 'guest',
        userName: $('name').value.trim(),
        userEmail: $('email').value.trim(),
        date: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'Aguardando Pagamento',
        items: state.cart.items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            size: item.size,
            color: item.color
        })),
        subtotal: state.cart.subtotal,
        shippingMethod: state.selectedShipping.method,
        shippingCost: state.selectedShipping.price,
        couponCode: state.cart.appliedCoupon ? state.cart.appliedCoupon.code : null,
        discount: state.cart.couponDiscount,
        total: state.cart.total,
        paymentMethod: state.selectedPayment,
        address: {
            cep: $('cep').value.replace(/\D/g, ''),
            street: $('street').value.trim(),
            number: $('number').value.trim(),
            complement: $('complement').value.trim(),
            neighborhood: $('neighborhood').value.trim(),
            city: $('city').value.trim(),
            state: $('state').value.trim(),
        },
        // Dados de pagamento sensíveis NÃO devem ser salvos no Firestore
        // Apenas uma referência de transação seria salva após o processamento real
    };

    try {
        // 1. Salvar o pedido no Firestore
        const docRef = await db.collection('orders').add(orderData);
        console.log('Pedido salvo com ID:', docRef.id);

        // 2. Limpar o carrinho
        clearCart();

        // 3. Redirecionar para a página de sucesso (simulação)
        // Em um cenário real, você passaria o ID do pedido para a página de sucesso
        alert(`Pedido #${docRef.id} finalizado com sucesso! Status: Aguardando Pagamento (${state.selectedPayment}).`);
        window.location.href = 'index.html?order=success'; // Redireciona para a home com um parâmetro de sucesso

    } catch (error) {
        console.error('Erro ao finalizar pedido:', error);
        alert('Ocorreu um erro ao finalizar seu pedido. Por favor, tente novamente.');
        
        state.isProcessing = false;
        $('finalize-order-btn').disabled = false;
        $('finalize-order-btn').textContent = 'FINALIZAR PEDIDO';
        $('loading-feedback').style.display = 'none';
    }
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Carregar Carrinho
    const cartLoaded = loadCartFromStorage();
    if (!cartLoaded) {
        alert('Seu carrinho está vazio. Redirecionando para a loja.');
        window.location.href = 'index.html';
        return;
    }

    // 2. Setup Listeners
    setupAuthListener();
    
    // Máscaras
    applyMask($('cep'), '##.###-###');
    applyMask($('card-number'), '#### #### #### ####');
    applyMask($('card-expiry'), '##/##');
    applyMask($('card-cvv'), '####');

    // Eventos
    $('search-cep-btn').addEventListener('click', searchCep);
    document.querySelectorAll('input[name="shipping-method"]').forEach(radio => {
        radio.addEventListener('change', handleShippingSelection);
    });
    document.querySelectorAll('.payment-tab-btn').forEach(btn => {
        btn.addEventListener('click', handlePaymentTabClick);
    });
    $('checkoutApplyCouponBtn').addEventListener('click', applyCoupon);
    $('checkoutRemoveCouponBtn').addEventListener('click', removeCoupon);
    $('finalize-order-btn').addEventListener('click', finalizeOrder);

    // 3. Renderização Inicial
    renderSummaryProducts();
    simulateShippingCalculation(); // Inicializa o frete e chama updateSummary
});
