// ============================================================================
// CHECKOUT-REFACTORED.JS - SEJA VERSÁTIL
// Sistema Completo de Checkout com Firebase, LocalStorage e Desbloqueio Progressivo
// ============================================================================

// === CONFIGURAÇÕES CENTRALIZADAS ===
const CONFIG = {
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

// === ESTADO CENTRALIZADO ===
const CheckoutState = {
  // Carrinho
  cartItems: [],
  subtotal: 0,
  couponDiscount: 0,
  total: 0,
  cartCode: generateCartCode(),

  // Autenticação
  currentUser: null,
  isAuthenticated: false,

  // Validação de Etapas
  step1Valid: false,  // Dados Pessoais
  step2Valid: false,  // Endereço
  step3Valid: false,  // Pagamento

  // Método de Pagamento
  paymentMethod: 'pix',
  installments: 1,

  // Dados do Pedido
  orderData: {
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: ''
  }
};

// === CACHE DE ELEMENTOS DOM ===
const DOM = {
  // Coluna 1: Dados Pessoais
  authStateGuest: null,
  authStateLogged: null,
  authTabs: null,
  tabLogin: null,
  tabCadastro: null,
  formDadosPessoais: null,
  inputNome: null,
  inputEmail: null,
  inputTelefone: null,
  inputCPF: null,
  loggedUserName: null,
  loggedUserEmail: null,

  // Coluna 2: Endereço
  col2Content: null,
  formEndereco: null,
  inputCEP: null,
  inputRua: null,
  inputNumero: null,
  inputComplemento: null,
  inputBairro: null,
  inputCidade: null,
  inputUF: null,

  // Coluna 3: Pagamento
  col3Content: null,
  formPagamento: null,
  paymentOptions: null,
  installmentsBox: null,
  installmentsSelect: null,
  cardDetailsBox: null,

  // Coluna 4: Resumo
  summaryItems: null,
  summaryCartCode: null,
  summarySubtotal: null,
  summaryDiscount: null,
  summaryDiscountRow: null,
  summaryPixDiscount: null,
  summaryPixRow: null,
  summaryInstallmentValue: null,
  summaryInstallmentDetail: null,
  summaryInstallmentRow: null,
  summaryTotal: null,
  btnFinalizarCompra: null,

  // Utilitários
  loadingOverlay: null,
  toastContainer: null,

  // Status das Colunas
  col1Status: null,
  col2Status: null,
  col3Status: null
};

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', () => {
  cacheDOMElements();
  initCheckout();
});

// === CACHE DE ELEMENTOS DOM (PERFORMANCE) ===
function cacheDOMElements() {
  // Coluna 1
  DOM.authStateGuest = document.getElementById('authStateGuest');
  DOM.authStateLogged = document.getElementById('authStateLogged');
  DOM.authTabs = document.querySelector('.auth-tabs');
  DOM.tabLogin = document.getElementById('tabLogin');
  DOM.tabCadastro = document.getElementById('tabCadastro');
  DOM.formDadosPessoais = document.getElementById('formDadosPessoais');
  DOM.inputNome = document.getElementById('inputNome');
  DOM.inputEmail = document.getElementById('inputEmail');
  DOM.inputTelefone = document.getElementById('inputTelefone');
  DOM.inputCPF = document.getElementById('inputCPF');
  DOM.loggedUserName = document.getElementById('loggedUserName');
  DOM.loggedUserEmail = document.getElementById('loggedUserEmail');

  // Coluna 2
  DOM.col2Content = document.getElementById('col2Content');
  DOM.formEndereco = document.getElementById('formEndereco');
  DOM.inputCEP = document.getElementById('inputCEP');
  DOM.inputRua = document.getElementById('inputRua');
  DOM.inputNumero = document.getElementById('inputNumero');
  DOM.inputComplemento = document.getElementById('inputComplemento');
  DOM.inputBairro = document.getElementById('inputBairro');
  DOM.inputCidade = document.getElementById('inputCidade');
  DOM.inputUF = document.getElementById('inputUF');

  // Coluna 3
  DOM.col3Content = document.getElementById('col3Content');
  DOM.formPagamento = document.getElementById('formPagamento');
  DOM.paymentOptions = document.querySelectorAll('input[name="paymentMethod"]');
  DOM.installmentsBox = document.getElementById('installmentsBox');
  DOM.installmentsSelect = document.getElementById('installmentsSelect');
  DOM.cardDetailsBox = document.getElementById('cardDetailsBox');

  // Coluna 4
  DOM.summaryItems = document.getElementById('summaryItems');
  DOM.summaryCartCode = document.getElementById('summaryCartCode');
  DOM.summarySubtotal = document.getElementById('summarySubtotal');
  DOM.summaryDiscount = document.getElementById('summaryDiscount');
  DOM.summaryDiscountRow = document.getElementById('summaryDiscountRow');
  DOM.summaryPixDiscount = document.getElementById('summaryPixDiscount');
  DOM.summaryPixRow = document.getElementById('summaryPixRow');
  DOM.summaryInstallmentValue = document.getElementById('summaryInstallmentValue');
  DOM.summaryInstallmentDetail = document.getElementById('summaryInstallmentDetail');
  DOM.summaryInstallmentRow = document.getElementById('summaryInstallmentRow');
  DOM.summaryTotal = document.getElementById('summaryTotal');
  DOM.btnFinalizarCompra = document.getElementById('btnFinalizarCompra');

  // Utilitários
  DOM.loadingOverlay = document.getElementById('checkoutLoadingOverlay');
  DOM.toastContainer = document.getElementById('checkoutToastContainer');

  // Status
  DOM.col1Status = document.getElementById('col1Status');
  DOM.col2Status = document.getElementById('col2Status');
  DOM.col3Status = document.getElementById('col3Status');
}

// === INICIALIZAÇÃO PRINCIPAL ===
async function initCheckout() {
  try {
    // 1. Monitorar autenticação
    auth.onAuthStateChanged((user) => {
      CheckoutState.currentUser = user;
      CheckoutState.isAuthenticated = !!user;
      updateAuthUI();
    });

    // 2. Carregar carrinho
    loadCart();

    // 3. Verificar se carrinho está vazio
    if (!CheckoutState.cartItems || CheckoutState.cartItems.length === 0) {
      showToast('Carrinho vazio', 'Adicione produtos antes de finalizar a compra', 'warning');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, CONFIG.REDIRECT_DELAY - 1000);
      return;
    }

    // 4. Renderizar resumo
    renderSummary();

    // 5. Inicializar máscaras
    initMasks();

    // 6. Inicializar eventos
    initEvents();

    // 7. Atualizar código do carrinho
    if (DOM.summaryCartCode) DOM.summaryCartCode.textContent = `(${CheckoutState.cartCode})`;

  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    showToast('Erro ao carregar', 'Tente recarregar a página', 'error');
  }
}

// === ATUALIZAR UI DE AUTENTICAÇÃO ===
function updateAuthUI() {
  if (CheckoutState.isAuthenticated && CheckoutState.currentUser) {
    // Mostrar estado logado
    if (DOM.authStateGuest) DOM.authStateGuest.style.display = 'none';
    if (DOM.authStateLogged) DOM.authStateLogged.style.display = 'block';

    // Preencher dados do usuário
    if (DOM.loggedUserName) DOM.loggedUserName.textContent = CheckoutState.currentUser.displayName || 'Usuário';
    if (DOM.loggedUserEmail) DOM.loggedUserEmail.textContent = CheckoutState.currentUser.email || '';

    // Preencher formulário
    if (DOM.inputNome) DOM.inputNome.value = CheckoutState.currentUser.displayName || '';
    if (DOM.inputEmail) {
      DOM.inputEmail.value = CheckoutState.currentUser.email || '';
      DOM.inputEmail.disabled = true;
    }

    // Desbloquear Coluna 2
    CheckoutState.step1Valid = true;
    updateColumnStatus(1, 'Completo', 'success');
    unlockColumn(2);

  } else {
    // Mostrar estado guest
    if (DOM.authStateGuest) DOM.authStateGuest.style.display = 'block';
    if (DOM.authStateLogged) DOM.authStateLogged.style.display = 'none';

    // Limpar formulário
    if (DOM.inputEmail) DOM.inputEmail.disabled = false;

    // Bloquear Coluna 2
    CheckoutState.step1Valid = false;
    updateColumnStatus(1, 'Obrigatório', 'default');
    lockColumn(2);
  }
}

// === TROCAR ABA DE AUTENTICAÇÃO ===
function switchAuthTab(tab) {
  // Atualizar botões
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Mostrar/ocultar conteúdo
  if (DOM.tabLogin) DOM.tabLogin.style.display = tab === 'login' ? 'block' : 'none';
  if (DOM.tabCadastro) DOM.tabCadastro.style.display = tab === 'cadastro' ? 'block' : 'none';
}

// === HANDLE LOGIN ===
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showToast('Campos obrigatórios', 'Preencha e-mail e senha', 'warning');
    return;
  }

  try {
    showLoading(true);
    await auth.signInWithEmailAndPassword(email, password);
    showToast('Login realizado', 'Bem-vindo de volta!', 'success');
  } catch (error) {
    console.error('❌ Erro no login:', error);
    let message = 'Erro ao fazer login';
    if (error.code === 'auth/user-not-found') message = 'Usuário não encontrado';
    if (error.code === 'auth/wrong-password') message = 'Senha incorreta';
    showToast('Erro', message, 'error');
  } finally {
    showLoading(false);
  }
}

// === HANDLE CADASTRO ===
async function handleRegister() {
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

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

  try {
    showLoading(true);
    const result = await auth.createUserWithEmailAndPassword(email, password);
    
    // Atualizar displayName
    await result.user.updateProfile({ displayName: name });

    // Salvar dados no Firestore
    await db.collection('usuarios').doc(result.user.uid).set({
      nome: name,
      email: email,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('Cadastro realizado', 'Bem-vindo!', 'success');
  } catch (error) {
    console.error('❌ Erro no cadastro:', error);
    let message = 'Erro ao cadastrar';
    if (error.code === 'auth/email-already-in-use') message = 'E-mail já cadastrado';
    if (error.code === 'auth/weak-password') message = 'Senha muito fraca';
    showToast('Erro', message, 'error');
  } finally {
    showLoading(false);
  }
}

// === HANDLE LOGOUT ===
function handleLogout() {
  auth.signOut().then(() => {
    showToast('Logout realizado', 'Você saiu da sua conta', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  });
}

// === CARREGAR CARRINHO ===
function loadCart() {
  const saved = localStorage.getItem(CONFIG.CART_STORAGE_KEY);
  if (!saved) {
    CheckoutState.cartItems = [];
    CheckoutState.couponDiscount = 0;
    return;
  }

  try {
    const parsed = JSON.parse(saved);

    // Suportar formato novo {items, appliedCoupon, couponDiscount}
    if (parsed.items && Array.isArray(parsed.items)) {
      CheckoutState.cartItems = parsed.items.map(item => ({
        ...item,
        quantity: item.quantity || 1,
        price: item.price || 0,
        size: item.selectedSize || item.size || 'M',
        color: item.selectedColor || item.color || 'Padrão'
      }));

      CheckoutState.couponDiscount = parsed.couponDiscount || 0;
      console.log('✅ Carrinho carregado (formato novo):', CheckoutState.cartItems.length, 'itens');
    } else if (Array.isArray(parsed)) {
      // Suportar formato antigo [...]
      CheckoutState.cartItems = parsed.map(item => ({
        ...item,
        quantity: item.quantity || 1,
        price: item.price || 0,
        size: item.selectedSize || item.size || 'M',
        color: item.selectedColor || item.color || 'Padrão'
      }));
      console.log('✅ Carrinho carregado (formato antigo):', CheckoutState.cartItems.length, 'itens');
    } else {
      CheckoutState.cartItems = [];
    }
  } catch (error) {
    console.error('❌ Erro ao carregar carrinho:', error);
    CheckoutState.cartItems = [];
    CheckoutState.couponDiscount = 0;
  }
}

// === RENDERIZAR RESUMO ===
function renderSummary() {
  const fragment = document.createDocumentFragment();
  CheckoutState.subtotal = 0;

  CheckoutState.cartItems.forEach(item => {
    const itemTotal = item.price * item.quantity;
    CheckoutState.subtotal += itemTotal;

    // Validar imagem
    let imageSrc = 'https://via.placeholder.com/60x60/667eea/ffffff?text=SV';
    if (item.image) {
      if (item.image.startsWith('http://') || item.image.startsWith('https://') || item.image.startsWith('data:image')) {
        imageSrc = item.image;
      } else if (item.image.includes('gradient')) {
        imageSrc = 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + encodeURIComponent(item.name.substring(0, 2));
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
        <div class="summary-item-name">${escapeHtml(item.name)}</div>
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

  if (DOM.summaryItems) {
    DOM.summaryItems.innerHTML = '';
    DOM.summaryItems.appendChild(fragment);
  }

  updateTotals();
}

// === ATUALIZAR TOTAIS ===
function updateTotals() {
  // Subtotal
  if (DOM.summarySubtotal) DOM.summarySubtotal.textContent = `R$ ${formatCurrency(CheckoutState.subtotal)}`;

  // Desconto de cupom
  if (CheckoutState.couponDiscount > 0) {
    if (DOM.summaryDiscountRow) DOM.summaryDiscountRow.style.display = 'flex';
    if (DOM.summaryDiscount) DOM.summaryDiscount.textContent = `-R$ ${formatCurrency(CheckoutState.couponDiscount)}`;
  } else {
    if (DOM.summaryDiscountRow) DOM.summaryDiscountRow.style.display = 'none';
  }

  // Calcular total com desconto
  const totalComDesconto = CheckoutState.subtotal - CheckoutState.couponDiscount;

  // Desconto PIX (10%)
  let pixDiscount = 0;
  if (CheckoutState.paymentMethod === 'pix') {
    pixDiscount = totalComDesconto * CONFIG.PIX_DISCOUNT;
    if (DOM.summaryPixRow) DOM.summaryPixRow.style.display = 'flex';
    if (DOM.summaryPixDiscount) DOM.summaryPixDiscount.textContent = `-R$ ${formatCurrency(pixDiscount)}`;
  } else {
    if (DOM.summaryPixRow) DOM.summaryPixRow.style.display = 'none';
  }

  // Total final
  CheckoutState.total = Math.max(0, totalComDesconto - pixDiscount);

  // Parcelamento
  if (CheckoutState.paymentMethod === 'credito-parcelado' && CheckoutState.installments > 1) {
    const installmentValue = CheckoutState.total / CheckoutState.installments;
    if (DOM.summaryInstallmentValue) DOM.summaryInstallmentValue.textContent = `R$ ${formatCurrency(installmentValue)}`;
    if (DOM.summaryInstallmentDetail) DOM.summaryInstallmentDetail.textContent = `EM ${CheckoutState.installments}X SEM JUROS`;
    if (DOM.summaryInstallmentRow) DOM.summaryInstallmentRow.style.display = 'flex';
  } else {
    if (DOM.summaryInstallmentRow) DOM.summaryInstallmentRow.style.display = 'none';
  }

  // Total final
  if (DOM.summaryTotal) DOM.summaryTotal.textContent = `R$ ${formatCurrency(CheckoutState.total)}`;
}

// === ATUALIZAR UI DO PAGAMENTO ===
function updatePaymentUI() {
  const selectedMethod = document.
(Content truncated due to size limit. Use page ranges or line ranges to read remaining content)
