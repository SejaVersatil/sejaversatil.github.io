// ============================================================================
// CHECKOUT.JS - SEJA VERSÁTIL
// Sistema Completo de Checkout com Firebase e LocalStorage
// ============================================================================

// === CONFIGURAÇÕES ===
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

// === VARIÁVEIS GLOBAIS ===
let cartItems = [];
let currentUser = null;
let subtotal = 0;
let discount = 0;
let total = 0;
const cartCode = generateCartCode();

// === CACHE DE ELEMENTOS DOM ===
const DOM = {
  authTabs: null,
  loggedInfo: null,
  loggedUserName: null,
  formDados: null,
  formEndereco: null,
  formPagamento: null,
  summaryItems: null,
  summaryCartCode: null,
  summarySubtotal: null,
  summaryPixDiscount: null,
  summaryInstallmentRow: null,
  summaryInstallmentValue: null,
  summaryInstallmentDetail: null,
  installmentsBox: null,
  installmentsSelect: null,
  btnFinalizarCompra: null,
  loadingOverlay: null,
  toastContainer: null
};

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', () => {
  cacheDOMElements();
  initCheckout();
});

// === CACHE DE ELEMENTOS DOM (PERFORMANCE) ===
function cacheDOMElements() {
  DOM.authTabs = document.getElementById('authTabs');
  DOM.loggedInfo = document.getElementById('loggedInfo');
  DOM.loggedUserName = document.getElementById('loggedUserName');
  DOM.formDados = document.getElementById('checkoutFormDados');
  DOM.formEndereco = document.getElementById('checkoutFormEndereco');
  DOM.formPagamento = document.getElementById('checkoutFormPagamento');
  DOM.summaryItems = document.getElementById('summaryItems');
  DOM.summaryCartCode = document.getElementById('summaryCartCode');
  DOM.summarySubtotal = document.getElementById('summarySubtotal');
  DOM.summaryPixDiscount = document.getElementById('summaryPixDiscount');
  DOM.summaryInstallmentRow = document.getElementById('summaryInstallmentRow');
  DOM.summaryInstallmentValue = document.getElementById('summaryInstallmentValue');
  DOM.summaryInstallmentDetail = document.getElementById('summaryInstallmentDetail');
  DOM.installmentsBox = document.getElementById('installmentsBox');
  DOM.installmentsSelect = document.getElementById('installmentsSelect');
  DOM.btnFinalizarCompra = document.getElementById('btnFinalizarCompra');
  DOM.loadingOverlay = document.getElementById('checkoutLoadingOverlay');
  DOM.toastContainer = document.getElementById('checkoutToastContainer');
}

// === FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO ===
// === FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO ===
async function initCheckout() {
  try {
    // 1. Aguardar Auth State
    // O auth.js já gerencia isso globalmente, mas aqui garantimos a UI local
    auth.onAuthStateChanged((user) => {
        currentUser = user; // Atualiza a variável global local
        
        if (user) {
            // Usuário logado
            if (DOM.authTabs) DOM.authTabs.style.display = 'none';
            if (DOM.loggedInfo) DOM.loggedInfo.style.display = 'block';
            if (DOM.loggedUserName) DOM.loggedUserName.textContent = user.displayName || user.email;
            
            // Preencher formulário se os campos existirem
            const inputNome = document.getElementById('inputNome');
            const inputEmail = document.getElementById('inputEmail');
            
            if (inputNome) inputNome.value = user.displayName || '';
            if (inputEmail) {
                inputEmail.value = user.email || '';
                inputEmail.disabled = true;
            }
        } else {
            // Usuário não logado
            if (DOM.authTabs) DOM.authTabs.style.display = 'flex';
            if (DOM.loggedInfo) DOM.loggedInfo.style.display = 'none';
        }
    });
    
    // Carregar carrinho
    loadCart();
    
    // Se carrinho vazio, redirecionar
    if (!cartItems || cartItems.length === 0) {
      showToast('Carrinho vazio', 'Adicione produtos antes de finalizar a compra', 'warning');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, CONFIG.REDIRECT_DELAY - 1000);
      return;
    }
    
    // Renderizar resumo
    renderSummary();
    
    // Inicializar máscaras
    initMasks();
    
    // Inicializar eventos
    initEvents();
    
    // Atualizar código do carrinho
    if (DOM.summaryCartCode) DOM.summaryCartCode.textContent = `(${cartCode})`;
    
  } catch (error) {
    console.error('Erro na inicialização:', error);
    showToast('Erro ao carregar', 'Tente recarregar a página', 'error');
  }
}

// === CARREGAR CARRINHO ===
function loadCart() {
    const saved = localStorage.getItem(CONFIG.CART_STORAGE_KEY);
    if (!saved) {
        cartItems = [];
        return;
    }
    
    try {
        const parsed = JSON.parse(saved);
        
        // ✅ COMPATIBILIDADE COM FORMATO NOVO E LEGADO
        if (parsed.items && Array.isArray(parsed.items)) {
            // Formato: {items: [], appliedCoupon: {}, couponDiscount: 0}
            cartItems = parsed.items.map(item => ({
                ...item,
                quantity: item.quantity || 1,
                price: item.price || 0,
                size: item.selectedSize || item.size || 'M',
                color: item.selectedColor || item.color || 'Padrão'
            }));
        } else if (Array.isArray(parsed)) {
            // Formato antigo: [{...}, {...}]
            cartItems = parsed.map(item => ({
                ...item,
                quantity: item.quantity || 1,
                price: item.price || 0,
                size: item.selectedSize || item.size || 'M',
                color: item.selectedColor || item.color || 'Padrão'
            }));
        } else {
            cartItems = [];
        }
        
        console.log('✅ Carrinho carregado:', cartItems.length, 'itens');
        
    } catch (error) {
        console.error('❌ Erro ao carregar carrinho:', error);
        cartItems = [];
    }
}

// === RENDERIZAR RESUMO (OTIMIZADO COM FRAGMENT) ===
function renderSummary() {
    const fragment = document.createDocumentFragment();
    subtotal = 0;
    
    cartItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        // ✅ VALIDAÇÃO ROBUSTA DE IMAGEM
        let imageSrc = 'https://via.placeholder.com/60x60/667eea/ffffff?text=SV';
        
        if (item.image) {
            // Verifica se é URL válida
            if (item.image.startsWith('http://') || item.image.startsWith('https://') || item.image.startsWith('data:image')) {
                imageSrc = item.image;
            }
            // Se for gradiente CSS, usa placeholder
            else if (item.image.includes('gradient')) {
                imageSrc = 'https://via.placeholder.com/60x60/667eea/ffffff?text=' + encodeURIComponent(item.name.substring(0, 2));
            }
        }
        
        const itemElement = document.createElement('div');
        itemElement.className = 'checkout-summary-item';
        itemElement.innerHTML = `
          <img src="${imageSrc}" 
               alt="${escapeHtml(item.name)}" 
               class="checkout-summary-item-image"
               loading="lazy"
               onerror="this.src='https://via.placeholder.com/60x60/667eea/ffffff?text=SV'">
          <div class="checkout-summary-item-info">
            <div class="checkout-summary-item-name">${escapeHtml(item.name)}</div>
            <div class="checkout-summary-item-details">
              Tamanho: ${escapeHtml(item.size || 'M')} | Cor: ${escapeHtml(item.color || 'Padrão')}
            </div>
            <div class="checkout-summary-item-price">
              <span class="checkout-summary-item-qty">Qtd: ${item.quantity}</span>
              <span class="checkout-summary-item-total">R$ ${formatCurrency(itemTotal)}</span>
            </div>
          </div>
        `;
        fragment.appendChild(itemElement);
    });
    
    DOM.summaryItems.innerHTML = '';
    DOM.summaryItems.appendChild(fragment);
    
    updateTotals();
}

// === FUNÇÃO AUXILIAR: ESCAPAR HTML (SEGURANÇA XSS) ===
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// === FUNÇÃO AUXILIAR: FORMATAR MOEDA ===
function formatCurrency(value) {
  return value.toFixed(2).replace('.', ',');
}

// === ATUALIZAR TOTAIS ===
function updateTotals() {
  // Subtotal
  DOM.summarySubtotal.textContent = `R$ ${formatCurrency(subtotal)}`;
  
  // Desconto PIX (10%)
  const pixDiscount = subtotal * CONFIG.PIX_DISCOUNT;
  DOM.summaryPixDiscount.textContent = `R$ ${formatCurrency(pixDiscount)}`;
  
  // Total
  total = subtotal;
  
  // Calcular parcelas
  const installmentValue = subtotal / 3;
  DOM.summaryInstallmentValue.textContent = `R$ ${formatCurrency(installmentValue)}`;
}

// === INICIALIZAR MÁSCARAS (OTIMIZADO COM DEBOUNCE) ===
function initMasks() {
  // Máscara de Telefone
  const inputTelefone = document.getElementById('inputTelefone');
  inputTelefone.addEventListener('input', debounce((e) => {
    e.target.value = applyPhoneMask(e.target.value);
  }, 100));
  
  // Máscara de CPF
  const inputCPF = document.getElementById('inputCPF');
  inputCPF.addEventListener('input', debounce((e) => {
    e.target.value = applyCPFMask(e.target.value);
  }, 100));
  
  // Máscara de CEP
  const inputCEP = document.getElementById('inputCEP');
  inputCEP.addEventListener('input', debounce((e) => {
    e.target.value = applyCEPMask(e.target.value);
  }, 100));
  
  // Buscar CEP (com debounce maior)
  inputCEP.addEventListener('blur', debounce(async () => {
    const cep = inputCEP.value.replace(/\D/g, '');
    if (cep.length === CONFIG.CEP_LENGTH) {
      await buscarCEP(cep);
    }
  }, 300));
}

// === FUNÇÕES DE MÁSCARAS (EXTRAÍDAS PARA REUTILIZAÇÃO) ===
function applyPhoneMask(value) {
  value = value.replace(/\D/g, '');
  if (value.length <= 11) {
    value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    value = value.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
  }
  return value;
}

function applyCPFMask(value) {
  value = value.replace(/\D/g, '');
  if (value.length <= CONFIG.CPF_LENGTH) {
    value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})$/, '$1.$2.$3-$4');
    value = value.replace(/^(\d{3})(\d{3})(\d{0,3})$/, '$1.$2.$3');
    value = value.replace(/^(\d{3})(\d{0,3})$/, '$1.$2');
  }
  return value;
}

function applyCEPMask(value) {
  value = value.replace(/\D/g, '');
  if (value.length <= CONFIG.CEP_LENGTH) {
    value = value.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }
  return value;
}

// === DEBOUNCE (PERFORMANCE) ===
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// === BUSCAR CEP (ViaCEP API) COM CACHE ===
const cepCache = new Map();

async function buscarCEP(cep) {
  // Verificar cache primeiro
  if (cepCache.has(cep)) {
    const data = cepCache.get(cep);
    preencherEndereco(data);
    return;
  }
  
  try {
    showLoading(true);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error('Erro na resposta da API');
    }
    
    const data = await response.json();
    
    if (data.erro) {
      showToast('CEP não encontrado', 'Verifique o CEP digitado', 'error');
      return;
    }
    
    // Salvar no cache
    cepCache.set(cep, data);
    
    // Preencher campos
    preencherEndereco(data);
    
  } catch (error) {
    if (error.name === 'AbortError') {
      showToast('Timeout', 'A busca demorou muito. Tente novamente', 'warning');
    } else {
      console.error('Erro ao buscar CEP:', error);
      showToast('Erro ao buscar CEP', 'Tente novamente mais tarde', 'error');
    }
  } finally {
    showLoading(false);
  }
}

// === PREENCHER ENDEREÇO (EXTRAÍDO) ===
function preencherEndereco(data) {
  document.getElementById('inputRua').value = data.logradouro || '';
  document.getElementById('inputBairro').value = data.bairro || '';
  document.getElementById('inputCidade').value = data.localidade || '';
  document.getElementById('inputUF').value = data.uf || '';
  document.getElementById('inputComplemento').value = data.complemento || '';
  
  // Focar no número
  document.getElementById('inputNumero').focus();
  
  // Validar formulário após preencher
  validateForm();
}

// === INICIALIZAR EVENTOS ===
function initEvents() {
  // Tabs de Login/Cadastro
  const authTabs = document.querySelectorAll('.checkout-auth-tab');
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
  
  // Validação de formulários
  const formDados = document.getElementById('checkoutFormDados');
  formDados.addEventListener('submit', (e) => {
    e.preventDefault();
  });
  
  const formEndereco = document.getElementById('checkoutFormEndereco');
  formEndereco.addEventListener('submit', (e) => {
    e.preventDefault();
  });
  
  // Mudança de método de pagamento
  const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
  paymentMethods.forEach(method => {
    method.addEventListener('change', handlePaymentMethodChange);
  });
  
  // Mudança de parcelas
  const installmentsSelect = document.getElementById('installmentsSelect');
  installmentsSelect.addEventListener('change', updateInstallmentDisplay);
  
  // Validação em tempo real dos formulários
  const allInputs = document.querySelectorAll('.checkout-form input, .checkout-form select');
  allInputs.forEach(input => {
    input.addEventListener('blur', validateForm);
    input.addEventListener('input', validateForm);
  });
  
  // Botão Finalizar
  const btnFinalizarCompra = document.getElementById('btnFinalizarCompra');
  btnFinalizarCompra.addEventListener('click', finalizarCompra);
}

// === VALIDAR FORMULÁRIO (OTIMIZADO COM VALIDAÇÕES VISUAIS) ===
function validateForm() {
  // Validar Dados Pessoais
  const nome = document.getElementById('inputNome');
  const email = document.getElementById('inputEmail');
  const telefone = document.getElementById('inputTelefone');
  const cpf = document.getElementById('inputCPF');
  
  const nomeValido = validateField(nome, nome.value.trim().length >= CONFIG.MIN_NAME_LENGTH);
  const emailValido = validateField(email, isValidEmail(email.value.trim()));
  const telefoneValido = validateField(telefone, telefone.value.replace(/\D/g, '').length >= CONFIG.MIN_PHONE_LENGTH);
  const cpfValido = validateField(cpf, isValidCPF(cpf.value));
  
  const dadosValidos = nomeValido && emailValido && telefoneValido && cpfValido;
  
  // Validar Endereço
  const cep = document.getElementById('inputCEP');
  const rua = document.getElementById('inputRua');
  const numero = document.getElementById('inputNumero');
  const bairro = document.getElementById('inputBairro');
  const cidade = document.getElementById('inputCidade');
  const uf = document.getElementById('inputUF');
  
  const cepValido = validateField(cep, cep.value.replace(/\D/g, '').length === CONFIG.CEP_LENGTH);
  const ruaValida = validateField(rua, rua.value.trim().length > 0);
  const numeroValido = validateField(numero, numero.value.trim().length > 0);
  const bairroValido = validateField(bairro, bairro.value.trim().length > 0);
  const cidadeValida = validateField(cidade, cidade.value.trim().length > 0);
  const ufValido = validateField(uf, uf.value.length > 0);
  
  const enderecoValido = cepValido && ruaValida && numeroValido && bairroValido && cidadeValida && ufValido;
  
  // Mostrar seção de pagamento se dados e endereço válidos
  if (dadosValidos && enderecoValido) {
    DOM.formPagamento.style.display = 'block';
    document.querySelector('#sectionPagamento .checkout-section-subtitle').style.display = 'none';
    
    // Habilitar botão de finalizar
    DOM.btnFinalizarCompra.disabled = false;
    DOM.btnFinalizarCompra.textContent = 'FINALIZAR COMPRA';
  } else {
    DOM.formPagamento.style.display = 'none';
    document.querySelector('#sectionPagamento .checkout-section-subtitle').style.display = 'block';
    
    // Desabilitar botão
    DOM.btnFinalizarCompra.disabled = true;
    DOM.btnFinalizarCompra.textContent = 'CONTINUAR COMPRANDO';
  }
}

// === VALIDAR CAMPO INDIVIDUAL (FEEDBACK VISUAL) ===
function validateField(element, isValid) {
  if (element.value.trim() === '') {
    element.classList.remove('error', 'success');
    return false;
  }
  
  if (isValid) {
    element.classList.remove('error');
    element.classList.add('success');
    return true;
  } else {
    element.classList.remove('success');
    element.classList.add('error');
    return false;
  }
}

// === MANIPULAR MUDANÇA DE MÉTODO DE PAGAMENTO ===
function handlePaymentMethodChange(e) {
  const method = e.target.value;
  
  if (method === 'credito-parcelado') {
    DOM.installmentsBox.style.display = 'block';
    DOM.summaryInstallmentRow.style.display = 'flex';
  } else {
    DOM.installmentsBox.style.display = 'none';
    DOM.summaryInstallmentRow.style.display = 'none';
  }
  
  updateTotals();
}

// === ATUALIZAR EXIBIÇÃO DE PARCELAS ===
function updateInstallmentDisplay() {
  const installments = DOM.installmentsSelect.value;
  if (installments) {
    const installmentValue = subtotal / parseInt(installments);
    DOM.summaryInstallmentValue.textContent = `R$ ${formatCurrency(installmentValue)}`;
    DOM.summaryInstallmentDetail.textContent = `EM ${installments}X SEM JUROS`;
  }
}

// === FINALIZAR COMPRA (OTIMIZADA COM VALIDAÇÃO RIGOROSA) ===
async function finalizarCompra() {
  // Prevenir múltiplos cliques
  if (DOM.btnFinalizarCompra.disabled) return;
  
  // Coletar e validar dados
  const orderData = collectOrderData();
  
  if (!orderData) {
    showToast('Dados inválidos', 'Verifique todos os campos', 'error');
    return;
  }
  
  try {
    DOM.btnFinalizarCompra.disabled = true;
    showLoading(true);
    
    // Criar objeto do pedido
    const order = createOrderObject(orderData);
    
    // Salvar no Firestore
    const docRef = await db.collection('pedidos').add(order);
    console.log('Pedido salvo:', docRef.id);
    
    // Enviar para WhatsApp
    enviarWhatsApp(order);
    
    // Limpar carrinho
    localStorage.removeItem(CONFIG.CART_STORAGE_KEY);
    
    showToast('Pedido realizado!', 'Você será redirecionado para o WhatsApp', 'success');
    
  } catch (error) {
    console.error('❌ Erro ao finalizar compra:', error);
    
    // ✅ MENSAGENS DE ERRO ESPECÍFICAS
    let errorMessage = 'Erro ao processar pedido';
    
    if (error.code === 'permission-denied') {
        errorMessage = 'Erro de permissão. Entre em contato com o suporte.';
        console.error('🔒 Regras do Firestore bloqueando a criação do pedido');
    } else if (error.code === 'unavailable') {
        errorMessage = 'Sem conexão com o servidor. Verifique sua internet.';
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    showToast('Erro ao finalizar', errorMessage, 'error');
    DOM.btnFinalizarCompra.disabled = false;
} finally {
    showLoading(false);
}

// === COLETAR DADOS DO PEDIDO ===
function collectOrderData() {
  const nome = document.getElementById('inputNome').value.trim();
  const email = document.getElementById('inputEmail').value.trim();
  const telefone = document.getElementById('inputTelefone').value;
  const cpf = document.getElementById('inputCPF').value;
  
  const cep = document.getElementById('inputCEP').value;
  const rua = document.getElementById('inputRua').value.trim();
  const numero = document.getElementById('inputNumero').value.trim();
  const complemento = document.getElementById('inputComplemento').value.trim();
  const bairro = document.getElementById('inputBairro').value.trim();
  const cidade = document.getElementById('inputCidade').value.trim();
  const uf = document.getElementById('inputUF').value;
  
  const paymentMethodElement = document.querySelector('input[name="paymentMethod"]:checked');
  if (!paymentMethodElement) {
    showToast('Selecione o pagamento', 'Escolha uma forma de pagamento', 'warning');
    return null;
  }
  
  const paymentMethod = paymentMethodElement.value;
  let installments = 1;
  
  if (paymentMethod === 'credito-parcelado') {
    installments = parseInt(DOM.installmentsSelect.value) || 0;
    if (installments === 0) {
      showToast('Selecione as parcelas', 'Escolha o número de parcelas', 'warning');
      return null;
    }
  }
  
  // Validações finais
  if (!isValidEmail(email)) {
    showToast('Email inválido', 'Verifique o email digitado', 'error');
    return null;
  }
  
  if (!isValidCPF(cpf)) {
    showToast('CPF inválido', 'Verifique o CPF digitado', 'error');
    return null;
  }
  
  return {
    nome, email, telefone, cpf,
    cep, rua, numero, complemento, bairro, cidade, uf,
    paymentMethod, installments
  };
}

// === CRIAR OBJETO DO PEDIDO ===
function createOrderObject(data) {
  let finalTotal = subtotal;
  let paymentMethodName = '';
  
  switch (data.paymentMethod) {
    case 'pix':
      finalTotal = subtotal * (1 - CONFIG.PIX_DISCOUNT);
      paymentMethodName = 'PIX à Vista (10% OFF)';
      break;
    case 'boleto':
      paymentMethodName = 'Boleto Bancário';
      break;
    case 'credito-avista':
      paymentMethodName = 'Cartão de Crédito à Vista';
      break;
    case 'credito-parcelado':
      paymentMethodName = `Cartão de Crédito ${data.installments}x sem juros`;
      break;
  }
  
  return {
    codigo: cartCode,
    data: new Date().toISOString(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    cliente: {
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      cpf: data.cpf,
      uid: currentUser ? currentUser.uid : null
    },
    endereco: {
      cep: data.cep,
      rua: data.rua,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      uf: data.uf
    },
    items: cartItems.map(item => ({
      ...item,
      subtotal: item.price * item.quantity
    })),
    pagamento: {
      metodo: data.paymentMethod,
      metodoNome: paymentMethodName,
      parcelas: data.installments
    },
    valores: {
      subtotal: parseFloat(subtotal.toFixed(2)),
      desconto: parseFloat((subtotal - finalTotal).toFixed(2)),
      total: parseFloat(finalTotal.toFixed(2))
    },
    status: 'pendente'
  };
}

// === ENVIAR PARA WHATSAPP (OTIMIZADA) ===
function enviarWhatsApp(order) {
  const message = buildWhatsAppMessage(order);
  const encodedMessage = encodeURIComponent(message);
  const whatsappURL = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodedMessage}`;
  
  // Abrir WhatsApp em nova aba
  window.open(whatsappURL, '_blank');
  
  // Redirecionar para home após delay
  setTimeout(() => {
    window.location.href = 'index.html';
  }, CONFIG.REDIRECT_DELAY);
}

// === CONSTRUIR MENSAGEM DO WHATSAPP ===
function buildWhatsAppMessage(order) {
  let msg = `*🛍️ NOVO PEDIDO - ${order.codigo}*\n\n`;
  
  msg += `*👤 CLIENTE*\n`;
  msg += `Nome: ${order.cliente.nome}\n`;
  msg += `Email: ${order.cliente.email}\n`;
  msg += `Telefone: ${order.cliente.telefone}\n`;
  msg += `CPF: ${order.cliente.cpf}\n\n`;
  
  msg += `*📍 ENDEREÇO DE ENTREGA*\n`;
  msg += `${order.endereco.rua}, ${order.endereco.numero}`;
  if (order.endereco.complemento) {
    msg += ` - ${order.endereco.complemento}`;
  }
  msg += `\n${order.endereco.bairro} - ${order.endereco.cidade}/${order.endereco.uf}\n`;
  msg += `CEP: ${order.endereco.cep}\n\n`;
  
  msg += `*🛒 PRODUTOS*\n`;
  order.items.forEach(item => {
    msg += `- ${item.name} (${item.size || 'M'}/${item.color || 'Laranja'})\n`;
    msg += `  Qtd: ${item.quantity} x R$ ${formatCurrency(item.price)} = R$ ${formatCurrency(item.price * item.quantity)}\n`;
  });
  
  msg += `\n*💳 PAGAMENTO*\n`;
  msg += `Método: ${order.pagamento.metodoNome}\n\n`;
  
  msg += `*💰 VALORES*\n`;
  msg += `Subtotal: R$ ${formatCurrency(order.valores.subtotal)}\n`;
  if (order.valores.desconto > 0) {
    msg += `Desconto: R$ ${formatCurrency(order.valores.desconto)}\n`;
  }
  msg += `*TOTAL: R$ ${formatCurrency(order.valores.total)}*\n`;
  
  return msg;
}

// === LOGOUT ===
function logoutCheckout() {
  auth.signOut().then(() => {
    showToast('Logout realizado', 'Você saiu da sua conta', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  });
}

// === GERAR CÓDIGO DO CARRINHO ===
function generateCartCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// === MOSTRAR/OCULTAR LOADING ===
function showLoading(show) {
  const overlay = document.getElementById('checkoutLoadingOverlay');
  if (show) {
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

// === MOSTRAR TOAST (OTIMIZADA COM QUEUE) ===
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
  
  DOM.toastContainer.appendChild(toast);
  
  // Remover após duração configurada
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
    setTimeout(() => {
      if (DOM.toastContainer.contains(toast)) {
        DOM.toastContainer.removeChild(toast);
      }
      processToastQueue();
    }, 300);
  }, CONFIG.TOAST_DURATION);
}

// === VALIDAÇÃO DE EMAIL (RFC 5322 SIMPLIFICADA) ===
function isValidEmail(email) {
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email) && email.length <= 254;
}

// === VALIDAÇÃO DE CPF ===
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


  // Vanilla JS Masks (No dependencies)
function applyMasks() {
    const cpfInput = document.getElementById('inputCPF');
    const telefoneInput = document.getElementById('inputTelefone');
    const cepInput = document.getElementById('inputCEP');
    
    if (cpfInput) {
        cpfInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            e.target.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        });
    }
    
    if (telefoneInput) {
        telefoneInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            e.target.value = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        });
    }
    
    if (cepInput) {
        cepInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            e.target.value = v.replace(/(\d{5})(\d{3})/, '$1-$2');
        });
    }
}

document.addEventListener('DOMContentLoaded', applyMasks);
}
