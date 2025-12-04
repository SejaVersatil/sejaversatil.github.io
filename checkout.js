// ============================================================================
// CHECKOUT-COMPLETE.JS - SEJA VERSÁTIL
// Controlador de Checkout com Desbloqueio Progressivo (4 Colunas)
// SINCRONIZADO COM script2-unified.js
// ============================================================================

'use strict';

// ==================== CONFIGURAÇÕES ====================
const CHECKOUT_CONFIG = {
    WHATSAPP_NUMBER: '5571991427103',
    CART_STORAGE_KEY: 'sejaVersatilCart',
    TOAST_DURATION: 5000,
    REDIRECT_DELAY: 3000,
    PIX_DISCOUNT: 0.10,
    MIN_NAME_LENGTH: 3,
    MIN_PHONE_LENGTH: 10,
    CPF_LENGTH: 11,
    CEP_LENGTH: 8
};

// ==================== ESTADO DO CHECKOUT ====================
const CheckoutState = {
    // Etapas de Validação
    step1Valid: false,  // Dados Pessoais
    step2Valid: false,  // Endereço
    step3Valid: false,  // Pagamento
    
    // Dados Coletados
    userData: {
        nome: '',
        email: '',
        telefone: '',
        cpf: ''
    },
    
    addressData: {
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: ''
    },
    
    paymentData: {
        method: 'pix',
        installments: 1
    },
    
    // Totais
    subtotal: 0,
    couponDiscount: 0,
    pixDiscount: 0,
    total: 0,
    
    // Carrinho
    cartCode: generateCartCode()
};

// ==================== CACHE DE ELEMENTOS DOM ====================
const CheckoutDOM = {
    // Coluna 1: Dados Pessoais
    authStateGuest: null,
    authStateLogged: null,
    authTabsContainer: null,
    tabLogin: null,
    tabCadastro: null,
    formDadosPessoais: null,
    inputNome: null,
    inputEmail: null,
    inputTelefone: null,
    inputCPF: null,
    loggedUserName: null,
    loggedUserEmail: null,
    col1Status: null,
    
    // Coluna 2: Endereço
    col2Container: null,
    col2Content: null,
    formEndereco: null,
    inputCEP: null,
    inputRua: null,
    inputNumero: null,
    inputComplemento: null,
    inputBairro: null,
    inputCidade: null,
    inputUF: null,
    col2Status: null,
    
    // Coluna 3: Pagamento
    col3Container: null,
    col3Content: null,
    formPagamento: null,
    paymentOptions: null,
    installmentsBox: null,
    installmentsSelect: null,
    cardDetailsBox: null,
    col3Status: null,
    
    // Coluna 4: Resumo
    summaryItems: null,
    summaryCartCode: null,
    summarySubtotal: null,
    summaryDiscountRow: null,
    summaryDiscount: null,
    summaryPixRow: null,
    summaryPixDiscount: null,
    summaryInstallmentRow: null,
    summaryInstallmentValue: null,
    summaryInstallmentDetail: null,
    summaryTotal: null,
    btnFinalizarCompra: null,
    
    // Utilitários
    loadingOverlay: null,
    toastContainer: null
};

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Checkout-Complete iniciando...');
    
    cacheDOMElements();
    initCheckout();
});

// ==================== CACHE DE ELEMENTOS DOM ====================
function cacheDOMElements() {
    // Coluna 1
    CheckoutDOM.authStateGuest = document.getElementById('authStateGuest');
    CheckoutDOM.authStateLogged = document.getElementById('authStateLogged');
    CheckoutDOM.authTabsContainer = document.querySelector('.auth-tabs');
    CheckoutDOM.tabLogin = document.getElementById('tabLogin');
    CheckoutDOM.tabCadastro = document.getElementById('tabCadastro');
    CheckoutDOM.formDadosPessoais = document.getElementById('formDadosPessoais');
    CheckoutDOM.inputEmail = document.getElementById('inputEmail');
    CheckoutDOM.inputTelefone = document.getElementById('inputTelefone');
    CheckoutDOM.inputCPF = document.getElementById('inputCPF');
    CheckoutDOM.loggedUserName = document.getElementById('loggedUserName');
    CheckoutDOM.loggedUserEmail = document.getElementById('loggedUserEmail');
    CheckoutDOM.col1Status = document.getElementById('col1Status');
    
    // Coluna 2
    CheckoutDOM.col2Container = document.getElementById('column2Delivery');
    CheckoutDOM.col2Content = document.getElementById('col2Content');
    CheckoutDOM.formEndereco = document.getElementById('formEndereco');
    CheckoutDOM.inputCEP = document.getElementById('inputCEP');
    CheckoutDOM.inputRua = document.getElementById('inputRua');
    CheckoutDOM.inputNumero = document.getElementById('inputNumero');
    CheckoutDOM.inputComplemento = document.getElementById('inputComplemento');
    CheckoutDOM.inputBairro = document.getElementById('inputBairro');
    CheckoutDOM.inputCidade = document.getElementById('inputCidade');
    CheckoutDOM.inputUF = document.getElementById('inputUF');
    CheckoutDOM.col2Status = document.getElementById('col2Status');
    
    // Coluna 3
    CheckoutDOM.col3Container = document.getElementById('column3Payment');
    CheckoutDOM.col3Content = document.getElementById('col3Content');
    CheckoutDOM.formPagamento = document.getElementById('formPagamento');
    CheckoutDOM.paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
    CheckoutDOM.installmentsBox = document.getElementById('installmentsBox');
    CheckoutDOM.installmentsSelect = document.getElementById('installmentsSelect');
    CheckoutDOM.cardDetailsBox = document.getElementById('cardDetailsBox');
    CheckoutDOM.col3Status = document.getElementById('col3Status');
    
    // Coluna 4
    CheckoutDOM.summaryItems = document.getElementById('summaryItems');
    CheckoutDOM.summaryCartCode = document.getElementById('summaryCartCode');
    CheckoutDOM.summarySubtotal = document.getElementById('summarySubtotal');
    CheckoutDOM.summaryDiscountRow = document.getElementById('summaryDiscountRow');
    CheckoutDOM.summaryDiscount = document.getElementById('summaryDiscount');
    CheckoutDOM.summaryPixRow = document.getElementById('summaryPixRow');
    CheckoutDOM.summaryPixDiscount = document.getElementById('summaryPixDiscount');
    CheckoutDOM.summaryInstallmentRow = document.getElementById('summaryInstallmentRow');
    CheckoutDOM.summaryInstallmentValue = document.getElementById('summaryInstallmentValue');
    CheckoutDOM.summaryInstallmentDetail = document.getElementById('summaryInstallmentDetail');
    CheckoutDOM.summaryTotal = document.getElementById('summaryTotal');
    CheckoutDOM.btnFinalizarCompra = document.getElementById('btnFinalizarCompra');
    
    // Utilitários
    CheckoutDOM.loadingOverlay = document.getElementById('checkoutLoadingOverlay');
    CheckoutDOM.toastContainer = document.getElementById('checkoutToastContainer');
}

// ==================== INICIALIZAÇÃO PRINCIPAL ====================
// ==================== INICIALIZAÇÃO PRINCIPAL ====================
async function initCheckout() {
    try {
        // [PARTE 1: CÓDIGO EXISTENTE - Proteção do CartManager]
        if (typeof CartManager === 'undefined') {
            let attempts = 0;
            while (typeof CartManager === 'undefined' && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (typeof CartManager === 'undefined') {
                console.error('❌ CRITICAL: CartManager failed to load');
                showToast('Erro ao carregar', 'Recarregue a página', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return;
            }
        }
        
        console.log('🚀 initCheckout começando...');
                
        // ✅ DEBUG: Verificar se elementos foram cacheados
        console.log('🔍 Verificando elementos DOM...');
        console.log('authStateGuest:', typeof CheckoutDOM !== 'undefined' ? CheckoutDOM.authStateGuest : 'Unknown');
        console.log('authStateLogged:', typeof CheckoutDOM !== 'undefined' ? CheckoutDOM.authStateLogged : 'Unknown');
        console.log('formDadosPessoais:', typeof CheckoutDOM !== 'undefined' ? CheckoutDOM.formDadosPessoais : 'Unknown');
                
        // 1. WAIT for auth to be ready
        if (window.authReady) {
            console.log('⏳ Aguardando auth estar pronto...');
            const user = await window.authReady;
            console.log('✅ Auth pronto. User:', user ? user.email : 'null');
            handleCheckoutAuthUpdate(user);
            
            // Chama a função de atualização
            if (typeof updateAuthUI === 'function') {
                updateAuthUI(user);
            } else if (typeof handleCheckoutAuthUpdate === 'function') {
                handleCheckoutAuthUpdate(user);
            }
        } else {
            console.warn('⚠️ window.authReady não existe');
            // Fallback
            if (typeof auth !== 'undefined') {
                auth.onAuthStateChanged((user) => {
                    console.log('🔄 onAuthStateChanged (fallback):', user ? user.email : 'null');
                    if (typeof updateAuthUI === 'function') {
                        updateAuthUI(user);
                    } else if (typeof handleCheckoutAuthUpdate === 'function') {
                        handleCheckoutAuthUpdate(user);
                    }
                });
            }
        }

        
// ==================== LÓGICA DE UI DO CHECKOUT ====================
function handleCheckoutAuthUpdate(user) {
    // Atualiza variável local
    currentUser = user; 
    
    if (user) {
        // LOGADO: Esconde abas de login, Mostra nome do usuário
        if (CheckoutDOM.authTabsContainer) CheckoutDOM.authTabsContainer.style.display = 'none';
        if (CheckoutDOM.authStateLogged) CheckoutDOM.authStateLogged.style.display = 'block';
        if (CheckoutDOM.authStateGuest) CheckoutDOM.authStateGuest.style.display = 'none';
        if (CheckoutDOM.loggedUserName) CheckoutDOM.loggedUserName.textContent = user.displayName || user.name || user.email;
        if (CheckoutDOM.loggedUserEmail) CheckoutDOM.loggedUserEmail.textContent = user.email || '';
        
        // Preenche inputs automaticamente
        const inputNome = document.getElementById('inputNome');
        const inputEmail = document.getElementById('inputEmail');
        
        if (inputNome && !inputNome.value) inputNome.value = user.displayName || user.name || '';
        if (inputEmail) {
            inputEmail.value = user.email || '';
            inputEmail.disabled = true;
        }
        
        // Mostrar formulário de dados pessoais
        if (CheckoutDOM.formDadosPessoais) {
            CheckoutDOM.formDadosPessoais.style.display = 'block';
        }
    } else {
        // DESLOGADO: Mostra abas de login/cadastro
        if (CheckoutDOM.authTabsContainer) CheckoutDOM.authTabsContainer.style.display = 'flex';
        if (CheckoutDOM.authStateLogged) CheckoutDOM.authStateLogged.style.display = 'none';
        if (CheckoutDOM.authStateGuest) CheckoutDOM.authStateGuest.style.display = 'block';
        
        // Esconder formulário de dados pessoais
        if (CheckoutDOM.formDadosPessoais) {
            CheckoutDOM.formDadosPessoais.style.display = 'none';
        }
    }
}
        
        // 2. Load cart
        CartManager.load();
        CheckoutState.subtotal = CartManager.getSubtotal();
        CheckoutState.couponDiscount = CartManager.couponDiscount || 0;
        
        // 3. Verify cart not empty
        if (!CartManager.cart || CartManager.cart.length === 0) {
            showToast('Carrinho vazio', 'Adicione produtos antes de finalizar', 'warning');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
        
        // Continue initialization...
        renderSummary();
        initMasks();
        initEvents();
        
        if (CheckoutDOM.summaryCartCode) {
            CheckoutDOM.summaryCartCode.textContent = `(${CheckoutState.cartCode})`;
        }
        
        console.log('✅ Checkout inicializado com sucesso');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showToast('Erro ao carregar', 'Tente recarregar a página', 'error');
    }
}
// ==================== AUTENTICAÇÃO ====================
window.updateAuthUICheckout = function(user) {
    console.log('🔄 Checkout UI updating for:', user ? user.email : 'Guest');
    
    if (user) {
        // Show logged-in state
        if (CheckoutDOM.authStateGuest) CheckoutDOM.authStateGuest.style.display = 'none';
        if (CheckoutDOM.authStateLogged) CheckoutDOM.authStateLogged.style.display = 'block';
        if (CheckoutDOM.loggedUserName) CheckoutDOM.loggedUserName.textContent = user.displayName || 'Usuário';
        if (CheckoutDOM.loggedUserEmail) CheckoutDOM.loggedUserEmail.textContent = user.email || '';
        
        // Auto-fill email
        if (CheckoutDOM.inputEmail) {
            CheckoutDOM.inputEmail.value = user.email || '';
            CheckoutDOM.inputEmail.disabled = true;
        }
        
        // ✅ Check Firestore for saved data (COLEÇÃO CORRETA: 'users')
        if (user.uid && typeof db !== 'undefined') {
            db.collection('users').doc(user.uid).get()
                .then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        
                        // Preencher telefone
                        if (userData.phone && CheckoutDOM.inputTelefone) {
                            CheckoutDOM.inputTelefone.value = userData.phone;
                        }
                        
                        // Preencher CPF
                        if (userData.cpf && CheckoutDOM.inputCPF) {
                            CheckoutDOM.inputCPF.value = userData.cpf;
                        }
                        
                        // Auto-validate if all fields present
                        if (userData.phone && userData.cpf) {
                            CheckoutState.step1Valid = true;
                            updateColumnStatus(1, 'Completo', 'success');
                            unlockColumn(2);
                            
                            // Mostrar formulário de dados pessoais já preenchido
                            if (CheckoutDOM.formDadosPessoais) {
                                CheckoutDOM.formDadosPessoais.style.display = 'block';
                            }
                        }
                    }
                })
                .catch(err => {
                    console.warn('⚠️ Erro ao carregar dados do usuário:', err);
                });
        }
    } else {
        // Show guest state
        if (CheckoutDOM.authStateGuest) CheckoutDOM.authStateGuest.style.display = 'block';
        if (CheckoutDOM.authStateLogged) CheckoutDOM.authStateLogged.style.display = 'none';
        CheckoutState.step1Valid = false;
        lockColumn(2);
        lockColumn(3);
    }
};
// ==================== TROCAR ABA DE AUTENTICAÇÃO ====================
function switchAuthTab(tab) {
    // Atualizar botões
    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Mostrar/ocultar conteúdo
    if (CheckoutDOM.tabLogin) CheckoutDOM.tabLogin.style.display = tab === 'login' ? 'block' : 'none';
    if (CheckoutDOM.tabCadastro) CheckoutDOM.tabCadastro.style.display = tab === 'cadastro' ? 'block' : 'none';
}

// ==================== HANDLE LOGIN ====================
window.handleLogin = async function() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        showToast('Campos obrigatórios', 'Preencha e-mail e senha', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        // ✅ FIX: Aguardar login completar
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        console.log('✅ Login realizado:', user.email);
        
        // ✅ FIX: Aguardar auth state se propagar
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ✅ FIX: Forçar atualização da UI imediatamente
        updateAuthUI(user);
        
        // ✅ FIX: Preencher formulário de dados pessoais
        if (CheckoutDOM.inputNome && user.displayName) {
            CheckoutDOM.inputNome.value = user.displayName;
        }
        if (CheckoutDOM.inputEmail) {
            CheckoutDOM.inputEmail.value = user.email;
            CheckoutDOM.inputEmail.disabled = true;
        }
        
        // ✅ FIX: Marcar etapa 1 como completa
        CheckoutState.step1Valid = true;
        CheckoutState.userData.nome = user.displayName || '';
        CheckoutState.userData.email = user.email;
        
        updateColumnStatus(1, 'Completo', 'success');
        unlockColumn(2);
        
        showToast('Login realizado', 'Bem-vindo de volta!', 'success');
        
    } catch (error) {
        console.error('❌ Erro no login:', error);
        let message = 'Erro ao fazer login';
        if (error.code === 'auth/user-not-found') message = 'Usuário não encontrado';
        if (error.code === 'auth/wrong-password') message = 'Senha incorreta';
        if (error.code === 'auth/invalid-email') message = 'E-mail inválido';
        if (error.code === 'auth/too-many-requests') message = 'Muitas tentativas. Aguarde alguns minutos';
        showToast('Erro', message, 'error');
    } finally {
        showLoading(false);
    }
}
// ==================== HANDLE CADASTRO ====================
window.handleRegister = async function() {
    const name = document.getElementById('registerName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim();
    const password = document.getElementById('registerPassword')?.value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm')?.value;
    
    if (!name || !email || !password || !passwordConfirm) {
        showToast('Campos obrigatórios', 'Preencha todos os campos', 'warning');
        return;
    }
    
    if (password !== passwordConfirm) {
        showToast('Senhas não conferem', 'Verifique as senhas digitadas', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Senha fraca', 'Use no mínimo 6 caracteres', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });
        
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        showToast('Cadastro realizado', 'Bem-vindo!', 'success');
    } catch (error) {
        const errorCode = error.code;
        const friendlyMessage = FIREBASE_ERROR_MAP[errorCode] || FIREBASE_ERROR_MAP['default'];
        showToast('Erro', friendlyMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== HANDLE LOGOUT ====================
window.handleLogout = function() {
    auth.signOut().then(() => {
        showToast('Logout realizado', 'Você saiu da sua conta', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    });
}

// ==================== RENDERIZAR RESUMO ====================
function renderSummary() {
    const fragment = document.createDocumentFragment();
    CheckoutState.subtotal = 0;
    
    const cartItems = CartManager ? CartManager.cart : [];
    
    cartItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        CheckoutState.subtotal += itemTotal;
        
        let imageSrc = 'https://via.placeholder.com/60x60/667eea/ffffff?text=SV';
        if (item.image ) {
            if (item.image.startsWith('http://' ) || item.image.startsWith('https://' ) || item.image.startsWith('data:image')) {
                imageSrc = item.image;
            } else if (item.image.includes('gradient')) {
                imageSrc = 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + encodeURIComponent(item.name.substring(0, 2 ));
            }
        }
        
        const itemElement = document.createElement('div');
        itemElement.className = 'summary-item';
        itemElement.innerHTML = `
            <img src="${imageSrc}" 
                 alt="${escapeHtml(item.name)}" 
                 class="summary-item-image"
                 loading="lazy"
                 onerror="this.src='https://via.placeholder.com/60x60/667eea/ffffff?text=SV'">
            <div class="summary-item-info">
                <div class="summary-item-name">${escapeHtml(item.name )}</div>
                <div class="summary-item-details">
                    Tamanho: ${escapeHtml(item.size || 'M')} | Cor: ${escapeHtml(item.color || 'Padrão')}
                </div>
                <div class="summary-item-price">
                    <span class="summary-item-qty">Qtd: ${item.quantity}</span>
                    <span class="summary-item-total">R$ ${formatCurrency(itemTotal)}</span>
                </div>
            </div>
        `;
        fragment.appendChild(itemElement);
    });
    
    if (CheckoutDOM.summaryItems) {
        CheckoutDOM.summaryItems.innerHTML = '';
        CheckoutDOM.summaryItems.appendChild(fragment);
    }
    
    updateTotals();
}

// ==================== ATUALIZAR TOTAIS ====================
function updateTotals() {
    // Subtotal
    if (CheckoutDOM.summarySubtotal) {
        CheckoutDOM.summarySubtotal.textContent = `R$ ${formatCurrency(CheckoutState.subtotal)}`;
    }
    
    // Desconto de cupom
    if (CartManager && CartManager.couponDiscount > 0) {
        CheckoutState.couponDiscount = CartManager.couponDiscount;
        if (CheckoutDOM.summaryDiscountRow) CheckoutDOM.summaryDiscountRow.style.display = 'flex';
        if (CheckoutDOM.summaryDiscount) CheckoutDOM.summaryDiscount.textContent = `-R$ ${formatCurrency(CheckoutState.couponDiscount)}`;
    } else {
        CheckoutState.couponDiscount = 0;
        if (CheckoutDOM.summaryDiscountRow) CheckoutDOM.summaryDiscountRow.style.display = 'none';
    }
    
    // Total com desconto
    const totalComDesconto = CheckoutState.subtotal - CheckoutState.couponDiscount;
    
    // Desconto PIX (10%)
    if (CheckoutState.paymentData.method === 'pix') {
        CheckoutState.pixDiscount = totalComDesconto * CHECKOUT_CONFIG.PIX_DISCOUNT;
        if (CheckoutDOM.summaryPixRow) CheckoutDOM.summaryPixRow.style.display = 'flex';
        if (CheckoutDOM.summaryPixDiscount) CheckoutDOM.summaryPixDiscount.textContent = `-R$ ${formatCurrency(CheckoutState.pixDiscount)}`;
    } else {
        CheckoutState.pixDiscount = 0;
        if (CheckoutDOM.summaryPixRow) CheckoutDOM.summaryPixRow.style.display = 'none';
    }
    
    // Total final
    CheckoutState.total = Math.max(0, totalComDesconto - CheckoutState.pixDiscount);
    
    // Parcelamento
if (CheckoutState.paymentData.method === 'credito-parcelado') {
    const installments = parseInt(CheckoutState.paymentData.installments) || 1;
    
    if (installments > 1) {
        const installmentValue = CheckoutState.total / installments;
        if (CheckoutDOM.summaryInstallmentValue) {
            CheckoutDOM.summaryInstallmentValue.textContent = `${installments}x de R$ ${formatCurrency(installmentValue)}`;
        }
        if (CheckoutDOM.summaryInstallmentDetail) {
            CheckoutDOM.summaryInstallmentDetail.textContent = `TOTAL: R$ ${formatCurrency(CheckoutState.total)}`;
        }
        if (CheckoutDOM.summaryInstallmentRow) CheckoutDOM.summaryInstallmentRow.style.display = 'flex';
    } else {
        if (CheckoutDOM.summaryInstallmentRow) CheckoutDOM.summaryInstallmentRow.style.display = 'none';
    }
} else {
    if (CheckoutDOM.summaryInstallmentRow) CheckoutDOM.summaryInstallmentRow.style.display = 'none';
}
    
    // Total final
    if (CheckoutDOM.summaryTotal) {
        CheckoutDOM.summaryTotal.textContent = `R$ ${formatCurrency(CheckoutState.total)}`;
    }
}


// ==================== ATUALIZAR UI DO PAGAMENTO ====================
function updatePaymentUI() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (!selectedMethod) return;
    
    CheckoutState.paymentData.method = selectedMethod.value;
    
    // ✅ Mostrar/ocultar APENAS o box de parcelas
    if (CheckoutState.paymentData.method === 'credito-parcelado') {
        if (CheckoutDOM.installmentsBox) CheckoutDOM.installmentsBox.style.display = 'block';
    } else {
        if (CheckoutDOM.installmentsBox) CheckoutDOM.installmentsBox.style.display = 'none';
    }
    if (CheckoutDOM.installmentsSelect) {
    const selectedInstallments = parseInt(CheckoutDOM.installmentsSelect.value) || 1;
    CheckoutState.paymentData.installments = selectedInstallments;
}
    // ✅ REMOVIDO: Lógica do cardDetailsBox (não existe mais)
    
    updateTotals();
}

// ==================== DESBLOQUEAR/BLOQUEAR COLUNAS ====================
function unlockColumn(columnNumber) {
    const columnMap = {
        1: 'column1Identity',
        2: 'column2Delivery',
        3: 'column3Payment',
        4: 'column4Summary'
    };
    
    const columnId = columnMap[columnNumber];
    const column = document.getElementById(columnId);
    
    if (!column) {
        console.error(`❌ Coluna ${columnNumber} (${columnId}) não encontrada`);
        return;
    }
    
    const content = column.querySelector('.column-content');
    if (!content) {
        console.error(`❌ .column-content não encontrado na coluna ${columnNumber}`);
        return;
    }
    
    // ✅ Remover lock visual
    content.classList.remove('column-locked');
    
    // ✅ Mostrar formulário
    const form = content.querySelector('form');
    if (form) {
        form.style.display = 'block';
    }
    
    // ✅ Esconder mensagem de bloqueio
    const lockMessage = content.querySelector('.lock-message');
    if (lockMessage) {
        lockMessage.style.display = 'none';
    }
    
    console.log(`✅ Coluna ${columnNumber} desbloqueada`);
}

function lockColumn(columnNumber) {
    const columnId = `column${columnNumber}${['', 'Identity', 'Delivery', 'Payment', 'Summary'][columnNumber]}`;
    const column = document.getElementById(columnId);
    if (!column) return;
    
    const content = column.querySelector('.column-content');
    if (!content) return;
    
    content.classList.add('column-locked');
    
    const form = content.querySelector('form');
    if (form) form.style.display = 'none';
    
    const lockMessage = content.querySelector('.lock-message');
    if (lockMessage) lockMessage.style.display = 'flex';
}

function updateColumnStatus(columnNumber, status, type = 'default') {
    const statusElement = document.getElementById(`col${columnNumber}Status`);
    if (!statusElement) return;
    
    statusElement.textContent = status;
    statusElement.className = `column-status status-${type}`;
}

// ==================== VALIDAÇÃO ETAPA 1: DADOS PESSOAIS ====================
function validateDadosStep() {
    // ✅ Single source of truth: window.currentUser (managed by auth.js)
    const nome = window.currentUser?.name || '';
    const email = document.getElementById('inputEmail')?.value.trim() || window.currentUser?.email || '';
    const telefone = document.getElementById('inputTelefone')?.value.trim();
    const cpf = document.getElementById('inputCPF')?.value.trim();
    
    // Validation
    if (!nome || nome.length < 3) {
        showToast('Nome inválido', 'Faça login ou cadastro primeiro', 'warning');
        return false;
    }
    
    // Validação de email (inline para não depender de função externa)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showToast('E-mail inválido', 'Digite um e-mail válido', 'error');
        return false;
    }
    
    const telefoneLimpo = telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10) {
        showToast('Telefone inválido', 'Digite um telefone válido com DDD', 'warning');
        return false;
    }
    
    if (!cpf || !isValidCPF(cpf)) {
        showToast('CPF inválido', 'Digite um CPF válido', 'error');
        return false;
    }
    
    // ✅ Save to Firestore for next time (if logged in) - COLEÇÃO CORRETA
    if (window.currentUser?.uid && typeof db !== 'undefined') {
        db.collection('users').doc(window.currentUser.uid).set({
            phone: telefoneLimpo,
            cpf: cpf,
            atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(err => console.warn('⚠️ Erro ao salvar dados:', err));
    }
    
    // ✅ Salvar no CheckoutState
    CheckoutState.userData.nome = nome;
    CheckoutState.userData.email = email;
    CheckoutState.userData.telefone = telefoneLimpo;
    CheckoutState.userData.cpf = cpf;
    
    // ✅ Mark step as valid
    CheckoutState.step1Valid = true;
    updateColumnStatus(1, 'Completo', 'success');
    unlockColumn(2);
    
    showToast('Dados validados', 'Prossiga para o endereço', 'success');
    return true;
}

// ==================== VALIDAÇÃO ETAPA 2: ENDEREÇO ====================
function validateEnderecoStep() {
    // ✅ CORREÇÃO 1: Proteção contra crash ao usar .trim()
    // Se o elemento não existir, retorna string vazia ''
    const cep = CheckoutDOM.inputCEP?.value?.trim() || '';
    const rua = CheckoutDOM.inputRua?.value?.trim() || '';
    const numero = CheckoutDOM.inputNumero?.value?.trim() || '';
    const bairro = CheckoutDOM.inputBairro?.value?.trim() || '';
    const cidade = CheckoutDOM.inputCidade?.value?.trim() || '';
    const uf = CheckoutDOM.inputUF?.value || ''; // Selects geralmente não precisam de trim
    
    // ✅ Validação: CEP obrigatório (8 dígitos)
    const cepLimpo = cep.replace(/\D/g, '');
    if (!cep || cepLimpo.length !== CHECKOUT_CONFIG.CEP_LENGTH) {
        showToast('CEP inválido', 'Digite um CEP válido (8 dígitos)', 'warning');
        CheckoutDOM.inputCEP?.focus();
        return false;
    }
    
    // ✅ Validação: Rua obrigatória
    if (!rua || rua.length < 3) {
        showToast('Rua inválida', 'Digite o nome da rua', 'warning');
        CheckoutDOM.inputRua?.focus();
        return false;
    }
    
    // ✅ Validação: Número obrigatório
    if (!numero) {
        showToast('Número obrigatório', 'Digite o número do endereço', 'warning');
        CheckoutDOM.inputNumero?.focus();
        return false;
    }
    
    // ✅ Validação: Bairro obrigatório
    if (!bairro || bairro.length < 3) {
        showToast('Bairro inválido', 'Digite o bairro', 'warning');
        CheckoutDOM.inputBairro?.focus();
        return false;
    }
    
    // ✅ Validação: Cidade obrigatória
    if (!cidade || cidade.length < 3) {
        showToast('Cidade inválida', 'Digite a cidade', 'warning');
        CheckoutDOM.inputCidade?.focus();
        return false;
    }
    
    // ✅ Validação: UF obrigatório
    if (!uf || uf === '') {
        showToast('UF obrigatório', 'Selecione o estado', 'warning');
        CheckoutDOM.inputUF?.focus();
        return false;
    }
    
    // Salvar dados no Estado Global
    CheckoutState.addressData.cep = cep;
    CheckoutState.addressData.rua = rua;
    CheckoutState.addressData.numero = numero;
    CheckoutState.addressData.complemento = CheckoutDOM.inputComplemento?.value?.trim() || '';
    CheckoutState.addressData.bairro = bairro;
    CheckoutState.addressData.cidade = cidade;
    CheckoutState.addressData.uf = uf;
    
    CheckoutState.step2Valid = true;
    updateColumnStatus(2, 'Completo', 'success');
    unlockColumn(3);

   // ✅ Salvar endereço no Firestore com segurança (Merge)
const user = auth.currentUser;
if (user?.uid && typeof db !== 'undefined') {
    const addressData = {
        endereco: {
            cep: cep,
            rua: rua,
            numero: numero,
            complemento: CheckoutState.addressData.complemento,
            bairro: bairro,
            cidade: cidade,
            uf: uf
        },
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Usa set com merge para criar o doc se não existir, ou atualizar se existir
    db.collection('users').doc(user.uid).set(addressData, { merge: true })
        .catch(err => console.warn('⚠️ Erro ao salvar endereço (backup):', err));
}
    
    showToast('Endereço validado', 'Prossiga para o pagamento', 'success');
    return true;
}

// ==================== VALIDAÇÃO ETAPA 3: PAGAMENTO ====================
function validatePagamentoStep() {
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked');
    
    // ✅ Validação: Método de pagamento obrigatório
    if (!paymentMethod) {
        showToast('Selecione o pagamento', 'Escolha uma forma de pagamento', 'warning');
        return false;
    }
    
    CheckoutState.paymentData.method = paymentMethod.value;
    
    // ✅ Validação: Se for parcelado, número de parcelas obrigatório
    if (CheckoutState.paymentData.method === 'credito-parcelado') {
        const installments = CheckoutDOM.installmentsSelect?.value;
        if (!installments || installments === '') {
            showToast('Selecione as parcelas', 'Escolha o número de parcelas', 'warning');
            CheckoutDOM.installmentsSelect?.focus();
            return false;
        }
        CheckoutState.paymentData.installments = parseInt(installments);
    } else {
        CheckoutState.paymentData.installments = 1;
    }
    
    CheckoutState.step3Valid = true;
    updateColumnStatus(3, 'Completo', 'success');
    
    if (CheckoutDOM.btnFinalizarCompra) CheckoutDOM.btnFinalizarCompra.disabled = false;
    
    showToast('Pagamento validado', 'Pronto para finalizar', 'success');
    return true;
}

// ==================== INICIALIZAR MÁSCARAS ====================
function initMasks() {
    if (CheckoutDOM.inputCPF) {
        CheckoutDOM.inputCPF.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            e.target.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        });
    }
    
    if (CheckoutDOM.inputTelefone) {
        CheckoutDOM.inputTelefone.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            e.target.value = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        });
    }
    
    if (CheckoutDOM.inputCEP) {
        CheckoutDOM.inputCEP.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            e.target.value = v.replace(/(\d{5})(\d{3})/, '$1-$2');
            
            if (v.length === 8) {
                loadAddressFromViaCEP(v);
            }
        });
    }
}

// ==================== CARREGAR ENDEREÇO DO VIACEP ====================
async function loadAddressFromViaCEP(cep) {
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/` );
        const data = await response.json();
        
        if (data.erro) {
            showToast('CEP não encontrado', 'Verifique o CEP digitado', 'warning');
            return;
        }
        
        if (CheckoutDOM.inputRua) CheckoutDOM.inputRua.value = data.logradouro || '';
        if (CheckoutDOM.inputBairro) CheckoutDOM.inputBairro.value = data.bairro || '';
        if (CheckoutDOM.inputCidade) CheckoutDOM.inputCidade.value = data.localidade || '';
        if (CheckoutDOM.inputUF) CheckoutDOM.inputUF.value = data.uf || '';
        
        showToast('Endereço carregado', 'Verifique os dados', 'success');
    } catch (error) {
        console.error('❌ Erro ao carregar CEP:', error);
        showToast('Erro ao buscar CEP', 'Tente novamente', 'error');
    }
}

// ==================== INICIALIZAR EVENTOS ====================
function initEvents() {
    // Formulário de dados pessoais
    if (CheckoutDOM.formDadosPessoais) {
        CheckoutDOM.formDadosPessoais.addEventListener('submit', (e) => {
            e.preventDefault();
            validateDadosStep();
        });
    }
    
    // Formulário de endereço
    if (CheckoutDOM.formEndereco) {
        CheckoutDOM.formEndereco.addEventListener('submit', (e) => {
            e.preventDefault();
            validateEnderecoStep();
        });
    }
    
    // Formulário de pagamento
    if (CheckoutDOM.formPagamento) {
        CheckoutDOM.formPagamento.addEventListener('submit', (e) => {
            e.preventDefault();
            validatePagamentoStep();
        });
    }
    
    // Mudança de método de pagamento
    CheckoutDOM.paymentOptions.forEach(option => {
        option.addEventListener('change', updatePaymentUI);
    });
    
    // Mudança de parcelas
if (CheckoutDOM.installmentsSelect) {
    CheckoutDOM.installmentsSelect.addEventListener('change', () => {
        const selectedValue = parseInt(CheckoutDOM.installmentsSelect.value) || 1;
        CheckoutState.paymentData.installments = selectedValue;
        updateTotals(); // ✅ Atualiza o resumo imediatamente
    });
}
    
    // Botão Finalizar Compra
    if (CheckoutDOM.btnFinalizarCompra) {
        CheckoutDOM.btnFinalizarCompra.addEventListener('click', processCheckout);
    }
}

// ==================== CONSTRUIR OBJETO DO PEDIDO ====================
function buildOrderData() {
    const paymentMap = {
        'pix': 'PIX à Vista (10% OFF)',
        'boleto': 'Boleto Bancário',
        'credito-avista': 'Cartão de Crédito à Vista',
        'credito-parcelado': `Cartão ${CheckoutState.paymentData.installments || 1}x sem juros`
    };
    
    const cartItems = CartManager ? CartManager.cart : [];
    
    // ✅ SANITIZE: Remove undefined/null values
    const cleanData = (obj) => {
        return Object.fromEntries(
            Object.entries(obj).filter(([_, v]) => v != null)
        );
    };
    
    return {
        codigo: CheckoutState.cartCode || generateCartCode(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        
        cliente: cleanData({
            nome: CheckoutState.userData.nome || '',
            email: CheckoutState.userData.email || '',
            telefone: CheckoutState.userData.telefone || '',
            cpf: CheckoutState.userData.cpf || '',
            uid: window.currentUser?.uid || null
        }),
        
        endereco: cleanData({
            cep: CheckoutState.addressData.cep || '',
            rua: CheckoutState.addressData.rua || '',
            numero: CheckoutState.addressData.numero || '',
            complemento: CheckoutState.addressData.complemento || '',
            bairro: CheckoutState.addressData.bairro || '',
            cidade: CheckoutState.addressData.cidade || '',
            uf: CheckoutState.addressData.uf || ''
        }),
        
        items: cartItems.map(item => cleanData({
            id: item.id || item.productId || 'unknown',
            name: item.name || 'Produto sem nome',
            size: item.selectedSize || item.size || 'M',
            color: item.selectedColor || item.color || 'Padrão',
            price: parseFloat(item.price) || 0,
            quantity: parseInt(item.quantity) || 1,
            subtotal: (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1)
        })),
        
        pagamento: cleanData({
            metodo: CheckoutState.paymentData.method || 'pix',
            metodoNome: paymentMap[CheckoutState.paymentData.method] || 'PIX',
            parcelas: parseInt(CheckoutState.paymentData.installments) || 1
        }),
        
        valores: cleanData({
            subtotal: parseFloat(CheckoutState.subtotal?.toFixed(2)) || 0,
            desconto: parseFloat(CheckoutState.couponDiscount?.toFixed(2)) || 0,
            pixDesconto: parseFloat(CheckoutState.pixDiscount?.toFixed(2)) || 0,
            total: parseFloat(CheckoutState.total?.toFixed(2)) || 0
        }),
        
        status: 'pendente_whatsapp'
    };
}

// ==================== FINALIZAR COMPRA - WHATSAPP DIRETO ====================
async function processCheckout() {
    if (!CheckoutState.step1Valid || !CheckoutState.step2Valid || !CheckoutState.step3Valid) {
        showToast('Validação incompleta', 'Complete todas as etapas', 'error');
        return;
    }

    // ✅ Validação final: Verificar se TODAS as etapas estão válidas
if (!CheckoutState.step1Valid) {
    showToast('Dados incompletos', 'Complete seus dados pessoais', 'error');
    document.getElementById('column1Identity')?.scrollIntoView({ behavior: 'smooth' });
    return;
}

if (!CheckoutState.step2Valid) {
    showToast('Endereço incompleto', 'Complete o endereço de entrega', 'error');
    document.getElementById('column2Delivery')?.scrollIntoView({ behavior: 'smooth' });
    return;
}

if (!CheckoutState.step3Valid) {
    showToast('Pagamento não selecionado', 'Confirme a forma de pagamento', 'error');
    document.getElementById('column3Payment')?.scrollIntoView({ behavior: 'smooth' });
    return;
}
    
    if (CheckoutDOM.btnFinalizarCompra.disabled) return;
    
    try {
        CheckoutDOM.btnFinalizarCompra.disabled = true;
        showLoading(true);
        
        // 1. Build sanitized order
        const order = buildOrderData();
        
        // 2. Log order before Firestore write
        console.log('📦 Order object:', JSON.stringify(order, null, 2));
        
        // 3. Save to Firestore (non-blocking)
        db.collection('pedidos').add(order)
            .then(docRef => console.log('✅ Firestore saved:', docRef.id))
            .catch(err => {
                console.warn('⚠️ Firestore write failed:', err.message);
                console.error('Problematic order data:', order);
            });
        
        // 4. Construct WhatsApp message
        const message = buildWhatsAppMessage(order);
        
        // 5. Clear cart BEFORE redirect
        if (CartManager) {
            CartManager.cart = [];
            CartManager.appliedCoupon = null;
            CartManager.couponDiscount = 0;
            CartManager.save();
        }
        
        // ✅ 6. UPDATE UI: Show "Finalizado" and disable button
        if (CheckoutDOM.btnFinalizarCompra) {
            CheckoutDOM.btnFinalizarCompra.textContent = 'FINALIZADO';
            CheckoutDOM.btnFinalizarCompra.style.backgroundColor = '#6c757d';
            CheckoutDOM.btnFinalizarCompra.style.cursor = 'not-allowed';
        }
        
        // ✅ 7. Redirect to WhatsApp (NO HOME REDIRECT)
        const phone = '5571991427103';
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        
        showToast('Pedido enviado!', 'Abrindo WhatsApp...', 'success');
        
        // ✅ CRITICAL: Use setTimeout to ensure state updates before redirect
        setTimeout(() => {
            window.open(url, '_blank'); // ✅ REPLACE window.open with location.href
        }, 1500);
        
    } catch (error) {
        console.error('❌ Checkout error:', error);
        showToast('Erro ao processar', 'Tente novamente', 'error');
        CheckoutDOM.btnFinalizarCompra.disabled = false;
    } finally {
        showLoading(false);
    }
}

// ==================== CONSTRUIR MENSAGEM WHATSAPP ====================
function buildWhatsAppMessage(order) {
    let msg = `*🛍️ NOVO PEDIDO - ${order.codigo}*\n\n`;
    
    // Cliente
    msg += `*👤 CLIENTE*\n`;
    msg += `Nome: ${order.cliente.nome}\n`;
    msg += `Email: ${order.cliente.email}\n`;
    msg += `Telefone: ${order.cliente.telefone}\n`;
    msg += `CPF: ${order.cliente.cpf}\n\n`;
    
    // Endereço
    msg += `*📍 ENDEREÇO DE ENTREGA*\n`;
    msg += `${order.endereco.rua}, ${order.endereco.numero}`;
    if (order.endereco.complemento) {
        msg += ` - ${order.endereco.complemento}`;
    }
    msg += `\n${order.endereco.bairro} - ${order.endereco.cidade}/${order.endereco.uf}\n`;
    msg += `CEP: ${order.endereco.cep}\n\n`;
    
    // Produtos
    msg += `*🛒 PRODUTOS*\n`;
    order.items.forEach(item => {
        msg += `- ${item.name} (${item.size}/${item.color})\n`;
        msg += `  ${item.quantity}x R$ ${formatCurrency(item.price)} = R$ ${formatCurrency(item.subtotal)}\n`;
    });
    
    // Pagamento
    msg += `\n*💳 PAGAMENTO*\n`;
    msg += `Método: ${order.pagamento.metodoNome}\n`;
    
    // Valores
    msg += `\n*💰 VALORES*\n`;
    msg += `Subtotal: R$ ${formatCurrency(order.valores.subtotal)}\n`;
    
    if (order.valores.desconto > 0) {
        msg += `Desconto (Cupom): -R$ ${formatCurrency(order.valores.desconto)}\n`;
    }
    
    if (order.valores.pixDesconto > 0) {
        msg += `Desconto (PIX 10%): -R$ ${formatCurrency(order.valores.pixDesconto)}\n`;
    }
    
    msg += `*TOTAL: R$ ${formatCurrency(order.valores.total)}*`;
    
    return msg;
}

// ==================== FUNÇÕES UTILITÁRIAS ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(value) {
    return value.toFixed(2).replace('.', ',');
}

function generateCartCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function isValidEmail(email) {
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return re.test(email) && email.length <= 254;
}

function isValidCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }
    
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
}

function showLoading(show) {
    if (CheckoutDOM.loadingOverlay) {
        if (show) {
            CheckoutDOM.loadingOverlay.classList.add('active');
        } else {
            CheckoutDOM.loadingOverlay.classList.remove('active');
        }
    }
}

// ==================== TOAST NOTIFICATIONS ====================
const toastQueue = [];
let isShowingToast = false;

function showToast(title, message, type = 'success') {
    toastQueue.push({ title, message, type });
    
    if (!isShowingToast) {
        processToastQueue();
    }
}

function processToastQueue() {
    if (toastQueue.length === 0) {
        isShowingToast = false;
        return;
    }
    
    isShowingToast = true;
    const { title, message, type } = toastQueue.shift();
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠'
    };
    
    const toast = document.createElement('div');
    toast.className = `checkout-toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
    `;
    
    if (CheckoutDOM.toastContainer) {
        CheckoutDOM.toastContainer.appendChild(toast);
    }
    
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => {
            if (CheckoutDOM.toastContainer && CheckoutDOM.toastContainer.contains(toast)) {
                CheckoutDOM.toastContainer.removeChild(toast);
            }
            processToastQueue();
        }, 300);
    }, CHECKOUT_CONFIG.TOAST_DURATION);
}

// ==================== EXPORT GLOBAL FUNCTIONS ====================
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.validateDadosStep = validateDadosStep;
window.validateEnderecoStep = validateEnderecoStep;
window.validatePagamentoStep = validatePagamentoStep;
window.processCheckout = processCheckout; // ✅ NOW TRIGGERS WHATSAPP
window.updatePaymentUI = updatePaymentUI;
window.buildOrderData = buildOrderData;
window.buildWhatsAppMessage = buildWhatsAppMessage;


console.log('✅ Checkout functions exported to global scope');
}
