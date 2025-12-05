/* ============================================================================
   MINHA CONTA - SEJA VERSÁTIL
   Sistema de Gerenciamento de Conta do Cliente
   ============================================================================ */

'use strict';

// ==================== VARIÁVEIS GLOBAIS ====================
let userOrders = [];

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando Minha Conta...');
  
  // Mostrar loading
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.classList.add('active');

  try {
    // Aguardar autenticação estar pronta
    await waitForAuth();
    
    // Verificar se usuário está logado
    if (!auth.currentUser) {
      console.warn('⚠️ Usuário não autenticado. Redirecionando...');
      showToast('Você precisa fazer login primeiro', 'error');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
      return;
    }

    currentUser = auth.currentUser;
    console.log('✅ Usuário autenticado:', currentUser.email);

    // Inicializar página
    await loadUserData();
    await loadUserOrders();
    initEventListeners();
    initMasks();

  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    showToast('Erro ao carregar página', 'error');
  } finally {
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }
});

// ==================== AUTH GUARD ====================
function waitForAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        unsubscribe();
        resolve(user);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}

// ==================== CARREGAR DADOS DO USUÁRIO ====================
async function loadUserData() {
  try {
    console.log('📥 Carregando dados do usuário...');

    // Atualizar header
    const accountUserName = document.getElementById('accountUserName');
    const accountUserEmail = document.getElementById('accountUserEmail');
    
    if (accountUserName) accountUserName.textContent = currentUser.displayName || 'Usuário';
    if (accountUserEmail) accountUserEmail.textContent = currentUser.email;

    // Buscar dados completos no Firestore
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    
    if (!userDoc.exists) {
      console.warn('⚠️ Documento do usuário não existe no Firestore');
      
      // Preencher apenas com dados do Auth
      document.getElementById('inputNomeCompleto').value = currentUser.displayName || '';
      document.getElementById('inputEmailPerfil').value = currentUser.email;
      
      return;
    }

    const userData = userDoc.data();
    console.log('✅ Dados carregados:', userData);

    // Preencher formulário - Informações Pessoais
    document.getElementById('inputNomeCompleto').value = userData.name || currentUser.displayName || '';
    document.getElementById('inputEmailPerfil').value = currentUser.email;
    document.getElementById('inputTelefonePerfil').value = userData.phone || '';
    document.getElementById('inputCPFPerfil').value = userData.cpf || '';

    // Preencher formulário - Endereço
    if (userData.endereco) {
      document.getElementById('inputCEPPerfil').value = userData.endereco.cep || '';
      document.getElementById('inputRuaPerfil').value = userData.endereco.rua || '';
      document.getElementById('inputNumeroPerfil').value = userData.endereco.numero || '';
      document.getElementById('inputComplementoPerfil').value = userData.endereco.complemento || '';
      document.getElementById('inputBairroPerfil').value = userData.endereco.bairro || '';
      document.getElementById('inputCidadePerfil').value = userData.endereco.cidade || '';
      document.getElementById('inputUFPerfil').value = userData.endereco.uf || '';
    }

    // Atualizar nome no header também
    if (accountUserName) accountUserName.textContent = userData.name || currentUser.displayName || 'Usuário';

  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
    showToast('Erro ao carregar seus dados', 'error');
  }
}

// ==================== CARREGAR PEDIDOS DO USUÁRIO ====================
async function loadUserOrders() {
  const ordersLoading = document.getElementById('ordersLoading');
  const ordersEmpty = document.getElementById('ordersEmpty');
  const ordersList = document.getElementById('ordersList');
  const ordersBadge = document.getElementById('ordersBadge');

  try {
    console.log('📦 Carregando pedidos do usuário...');

    // Mostrar loading
    if (ordersLoading) ordersLoading.style.display = 'flex';
    if (ordersEmpty) ordersEmpty.style.display = 'none';
    if (ordersList) ordersList.style.display = 'none';

    // Buscar pedidos no Firestore
    let orders = [];

    try {
      // TENTATIVA 1: Buscar por cliente.uid (formato novo)
      const query1 = db.collection('pedidos')
        .where('cliente.uid', '==', currentUser.uid)
        .limit(50);

      const snapshot1 = await query1.get();
      
      snapshot1.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });

      console.log(`✅ Encontrados ${orders.length} pedidos com cliente.uid`);
    } catch (error) {
      console.warn('⚠️ Erro na query cliente.uid:', error);
    }

    // TENTATIVA 2: Se não encontrou, buscar por userId (formato antigo)
    if (orders.length === 0) {
      try {
        console.log('🔍 Tentando busca alternativa com userId...');
        
        const query2 = db.collection('pedidos')
          .where('userId', '==', currentUser.uid)
          .limit(50);
        
        const snapshot2 = await query2.get();
        
        snapshot2.forEach((doc) => {
          orders.push({ id: doc.id, ...doc.data() });
        });

        console.log(`✅ Encontrados ${orders.length} pedidos com userId`);
      } catch (error) {
        console.warn('⚠️ Erro na query userId:', error);
      }
    }

    // Ordenar manualmente por data (já que não podemos usar orderBy com where em campos diferentes)
    orders.sort((a, b) => {
      const dateA = a.timestamp || a.createdAt;
      const dateB = b.timestamp || b.createdAt;
      
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      const timeA = dateA.toMillis ? dateA.toMillis() : dateA;
      const timeB = dateB.toMillis ? dateB.toMillis() : dateB;
      
      return timeB - timeA; // Mais recente primeiro
    });

    userOrders = orders;
    console.log(`✅ ${orders.length} pedidos encontrados`);

    // Esconder loading
    if (ordersLoading) ordersLoading.style.display = 'none';

    // Atualizar badge
    if (ordersBadge) {
      if (orders.length > 0) {
        ordersBadge.textContent = orders.length;
        ordersBadge.style.display = 'inline-block';
      } else {
        ordersBadge.style.display = 'none';
      }
    }

    // Renderizar pedidos
    if (orders.length === 0) {
      if (ordersEmpty) ordersEmpty.style.display = 'flex';
    } else {
      if (ordersList) {
        ordersList.style.display = 'flex';
        renderOrders(orders);
      }
    }

  } catch (error) {
    console.error('❌ Erro ao carregar pedidos:', error);
    
    // Esconder loading e mostrar empty
    if (ordersLoading) ordersLoading.style.display = 'none';
    if (ordersEmpty) {
      ordersEmpty.style.display = 'flex';
      ordersEmpty.innerHTML = `
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
        <h3>Erro ao carregar pedidos</h3>
        <p>Tente recarregar a página</p>
        <button onclick="location.reload()" class="btn-primary">
          Recarregar
        </button>
      `;
    }
  }
}

// ==================== RENDERIZAR PEDIDOS ====================
function renderOrders(orders) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  ordersList.innerHTML = orders.map(order => {
    const orderDate = formatOrderDate(order.timestamp || order.createdAt);
    const orderStatus = order.status || 'Pendente';
    const statusClass = getStatusClass(orderStatus);
    const orderTotal = order.valores?.total || order.totals?.total || 0;
    const orderItems = order.items || [];

    return `
      <div class="order-card">
        <div class="order-header">
          <div class="order-info">
            <div class="order-id">#${order.codigo || order.id.substring(0, 8).toUpperCase()}</div>
            <div class="order-date">${orderDate}</div>
          </div>
          <div class="order-status ${statusClass}">${translateStatus(orderStatus)}</div>
        </div>

        <div class="order-body">
          <div class="order-items">
            ${orderItems.slice(0, 3).map(item => `
              <div class="order-item">
                <img src="${item.image || 'https://via.placeholder.com/60'}" 
                     alt="${sanitizeHTML(item.name)}" 
                     class="order-item-image"
                     onerror="this.src='https://via.placeholder.com/60/667eea/ffffff?text=SV'">
                <div class="order-item-details">
                  <div class="order-item-name">${sanitizeHTML(item.name)}</div>
                  <div class="order-item-variant">
                    ${item.size ? `Tam: ${item.size}` : ''} 
                    ${item.color ? `| Cor: ${item.color}` : ''}
                    ${item.quantity ? `| Qtd: ${item.quantity}` : ''}
                  </div>
                </div>
                <div class="order-item-price">R$ ${formatCurrency(item.price * (item.quantity || 1))}</div>
              </div>
            `).join('')}
            
            ${orderItems.length > 3 ? `
              <div style="text-align: center; color: var(--text-light); font-size: 0.9rem;">
                + ${orderItems.length - 3} item(ns)
              </div>
            ` : ''}
          </div>
        </div>

        <div class="order-footer">
          <div class="order-total">
            <div class="order-total-label">Total do Pedido</div>
            <div class="order-total-value">R$ ${formatCurrency(orderTotal)}</div>
          </div>
          <div class="order-actions">
            <button class="btn-order btn-order-primary" onclick="contactWhatsApp('${order.codigo || order.id}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Falar com Suporte
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== SALVAR ALTERAÇÕES ====================
async function handleSaveChanges(event) {
  event.preventDefault();

  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.classList.add('active');

  try {
    // Coletar dados do formulário
    const userData = {
      name: document.getElementById('inputNomeCompleto').value.trim(),
      phone: document.getElementById('inputTelefonePerfil').value.replace(/\D/g, ''),
      cpf: document.getElementById('inputCPFPerfil').value.replace(/\D/g, ''),
      endereco: {
        cep: document.getElementById('inputCEPPerfil').value.replace(/\D/g, ''),
        rua: document.getElementById('inputRuaPerfil').value.trim(),
        numero: document.getElementById('inputNumeroPerfil').value.trim(),
        complemento: document.getElementById('inputComplementoPerfil').value.trim(),
        bairro: document.getElementById('inputBairroPerfil').value.trim(),
        cidade: document.getElementById('inputCidadePerfil').value.trim(),
        uf: document.getElementById('inputUFPerfil').value
      },
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Validações básicas
    if (userData.name.length < 3) {
      showToast('Nome deve ter pelo menos 3 caracteres', 'error');
      return;
    }

    if (userData.phone.length < 10) {
      showToast('Telefone inválido', 'error');
      return;
    }

    if (userData.cpf.length !== 11) {
      showToast('CPF inválido', 'error');
      return;
    }

    if (userData.endereco.cep.length !== 8) {
      showToast('CEP inválido', 'error');
      return;
    }

    // Salvar no Firestore
    await db.collection('users').doc(currentUser.uid).set(userData, { merge: true });

    // Atualizar displayName no Auth (se mudou)
    if (userData.name !== currentUser.displayName) {
      await currentUser.updateProfile({
        displayName: userData.name
      });
    }

    // Atualizar nome no header
    const accountUserName = document.getElementById('accountUserName');
    if (accountUserName) accountUserName.textContent = userData.name;

    showToast('✅ Dados atualizados com sucesso!', 'success');
    console.log('✅ Dados salvos no Firestore');

  } catch (error) {
    console.error('❌ Erro ao salvar:', error);
    showToast('Erro ao salvar alterações', 'error');
  } finally {
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }
}

// ==================== MÁSCARAS DE INPUT ====================
function initMasks() {
  // Máscara de Telefone
  const phoneInput = document.getElementById('inputTelefonePerfil');
  if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);
      
      if (value.length > 10) {
        e.target.value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
      } else if (value.length > 5) {
        e.target.value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
      } else if (value.length > 2) {
        e.target.value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
      } else {
        e.target.value = value;
      }
    });
  }

  // Máscara de CPF
  const cpfInput = document.getElementById('inputCPFPerfil');
  if (cpfInput) {
    cpfInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);
      
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      
      e.target.value = value;
    });
  }

  // Máscara de CEP
  const cepInput = document.getElementById('inputCEPPerfil');
  if (cepInput) {
    cepInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 8) value = value.slice(0, 8);
      
      e.target.value = value.replace(/(\d{5})(\d)/, '$1-$2');
    });

    // Buscar CEP automaticamente
    cepInput.addEventListener('blur', async function() {
      const cep = this.value.replace(/\D/g, '');
      if (cep.length === 8) {
        await searchCEP(cep);
      }
    });
  }
}

// ==================== BUSCAR CEP ====================
async function searchCEP(cep) {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      showToast('CEP não encontrado', 'warning');
      return;
    }

    // Preencher campos
    document.getElementById('inputRuaPerfil').value = data.logradouro || '';
    document.getElementById('inputBairroPerfil').value = data.bairro || '';
    document.getElementById('inputCidadePerfil').value = data.localidade || '';
    document.getElementById('inputUFPerfil').value = data.uf || '';

    // Focar no número
    document.getElementById('inputNumeroPerfil').focus();

    showToast('✅ Endereço preenchido automaticamente', 'success');

  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    showToast('Erro ao buscar CEP', 'error');
  }
}

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
  // Submit do formulário
  const formDadosPessoais = document.getElementById('formDadosPessoais');
  if (formDadosPessoais) {
    formDadosPessoais.addEventListener('submit', handleSaveChanges);
  }

  // Banner rotativo
  initBannerRotation();
}

// ==================== TROCAR SEÇÃO ====================
function switchSection(sectionName) {
  // Atualizar menu
  document.querySelectorAll('.account-menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionName);
  });

  // Atualizar conteúdo
  document.querySelectorAll('.account-section').forEach(section => {
    section.classList.toggle('active', section.id === `section${capitalizeFirst(sectionName)}`);
  });

  // Se for pedidos e ainda não carregou, recarregar
  if (sectionName === 'pedidos' && userOrders.length === 0) {
    loadUserOrders();
  }
}

// ==================== LOGOUT ====================
async function handleLogout() {
  if (!confirm('Deseja realmente sair da sua conta?')) return;

  try {
    await auth.signOut();
    showToast('Logout realizado com sucesso', 'info');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  } catch (error) {
    console.error('❌ Erro ao fazer logout:', error);
    showToast('Erro ao fazer logout', 'error');
  }
}

// ==================== CONTATO WHATSAPP ====================
function contactWhatsApp(orderId) {
  const message = `Olá! Gostaria de tirar dúvidas sobre o pedido #${orderId}`;
  const phone = '5571991427103';
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ==================== FUNÇÕES UTILITÁRIAS ====================
function formatOrderDate(timestamp) {
  if (!timestamp) return 'Data não disponível';
  
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function formatCurrency(value) {
  return parseFloat(value || 0).toFixed(2).replace('.', ',');
}

function getStatusClass(status) {
  const statusMap = {
    'pendente': 'status-pendente',
    'pendente_whatsapp': 'status-pendente',
    'enviado': 'status-enviado',
    'entregue': 'status-entregue',
    'cancelado': 'status-cancelado'
  };
  return statusMap[status.toLowerCase()] || 'status-pendente';
}

function translateStatus(status) {
  const statusMap = {
    'pendente': 'Pendente',
    'pendente_whatsapp': 'Aguardando WhatsApp',
    'enviado': 'Enviado',
    'entregue': 'Entregue',
    'cancelado': 'Cancelado'
  };
  return statusMap[status.toLowerCase()] || status;
}

function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    padding: 1rem 1.5rem;
    background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
    color: white;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideInRight 0.3s ease;
    font-weight: 600;
  `;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== BANNER ROTATIVO ====================
function initBannerRotation() {
  const messages = document.querySelectorAll('.banner-message');
  if (messages.length === 0) return;

  let currentIndex = 0;

  setInterval(() => {
    messages[currentIndex].classList.remove('active');
    currentIndex = (currentIndex + 1) % messages.length;
    messages[currentIndex].classList.add('active');
  }, 4000);
}

// ==================== CSS ANIMATIONS ====================
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  .banner-message {
    display: none;
  }

  .banner-message.active {
    display: block;
    animation: fadeIn 0.5s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;
document.head.appendChild(style);

// ==================== EXPORTAR FUNÇÕES GLOBAIS ====================
window.switchSection = switchSection;
window.handleLogout = handleLogout;
window.contactWhatsApp = contactWhatsApp;

console.log('✅ Minha Conta JS carregado com sucesso');

