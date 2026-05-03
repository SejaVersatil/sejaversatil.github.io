/* ============================================================================
   MINHA CONTA - SEJA VERSÁTIL
   Sistema de Gerenciamento de Conta do Cliente
   ============================================================================ */

'use strict';

// ==================== VARIÁVEIS GLOBAIS ====================
let userOrders = [];
let orderSnapshots = new Map();
let orderSourceSnapshots = new Map();
let orderUnsubscribers = [];
let ordersListenerStarted = false;
let ordersSuccessfulSources = 0;

const ORDER_STATUS_FLOW = [
  {
    key: 'pendente_whatsapp',
    label: 'Pedido recebido',
    description: 'Aguardando confirmação pelo WhatsApp',
    className: 'status-pendente'
  },
  {
    key: 'confirmado',
    label: 'Confirmado',
    description: 'Pedido confirmado pela equipe',
    className: 'status-confirmado'
  },
  {
    key: 'em_separacao',
    label: 'Em separação',
    description: 'Produtos sendo preparados',
    className: 'status-separacao'
  },
  {
    key: 'enviado',
    label: 'Enviado',
    description: 'Pedido saiu para entrega',
    className: 'status-enviado'
  },
  {
    key: 'entregue',
    label: 'Entregue',
    description: 'Entrega concluída',
    className: 'status-entregue'
  }
];

const STATUS_ALIASES = {
  pendente: 'pendente_whatsapp',
  pendente_whatsapp: 'pendente_whatsapp',
  aguardando_whatsapp: 'pendente_whatsapp',
  aguardando_confirmacao: 'pendente_whatsapp',
  aguardando_pagamento: 'pendente_whatsapp',
  pedido_recebido: 'pendente_whatsapp',
  'pendente whatsapp': 'pendente_whatsapp',
  'pendente_whatsapp': 'pendente_whatsapp',
  'Pendente WhatsApp': 'pendente_whatsapp',
  confirmado: 'confirmado',
  confirmada: 'confirmado',
  aprovado: 'confirmado',
  pagamento_aprovado: 'confirmado',
  em_separacao: 'em_separacao',
  separacao: 'em_separacao',
  preparando: 'em_separacao',
  enviado: 'enviado',
  postado: 'enviado',
  em_transporte: 'enviado',
  saiu_para_entrega: 'enviado',
  entregue: 'entregue',
  finalizado: 'entregue',
  cancelado: 'cancelado',
  cancelada: 'cancelado'
};

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
    initEventListeners();
    initMasks();
    setInitialSectionFromURL();
    startOrdersRealtime();

  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    showToast('Erro ao carregar página', 'error');
  } finally {
    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }
});

window.addEventListener('beforeunload', stopOrdersRealtime);

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
function startOrdersRealtime() {
  const ordersLoading = document.getElementById('ordersLoading');
  const ordersEmpty = document.getElementById('ordersEmpty');
  const ordersList = document.getElementById('ordersList');

  if (ordersListenerStarted) return;
  if (!auth.currentUser) return;

  console.log('📦 Iniciando acompanhamento em tempo real dos pedidos...');
  ordersListenerStarted = true;
  ordersSuccessfulSources = 0;
  orderSnapshots = new Map();
  orderSourceSnapshots = new Map();

  if (ordersLoading) ordersLoading.style.display = 'flex';
  if (ordersEmpty) ordersEmpty.style.display = 'none';
  if (ordersList) ordersList.style.display = 'none';
  updateOrdersLiveStatus('syncing', 'Sincronizando pedidos');

  const sourceQueries = [
    {
      name: 'cliente.uid',
      query: db.collection('pedidos').where('cliente.uid', '==', auth.currentUser.uid).limit(50)
    },
    {
      name: 'userId',
      query: db.collection('pedidos').where('userId', '==', auth.currentUser.uid).limit(50)
    }
  ];

  if (auth.currentUser.email) {
    sourceQueries.push({
      name: 'cliente.email',
      query: db.collection('pedidos').where('cliente.email', '==', auth.currentUser.email).limit(50)
    });
    sourceQueries.push({
      name: 'customer.email',
      query: db.collection('pedidos').where('customer.email', '==', auth.currentUser.email).limit(50)
    });
  }

  sourceQueries.forEach((source) => {
    try {
      const unsubscribe = source.query.onSnapshot(
        (snapshot) => {
          ordersSuccessfulSources += 1;
          const sourceSnapshot = new Map();
          snapshot.forEach((doc) => {
            sourceSnapshot.set(doc.id, {
              id: doc.id,
              ...doc.data()
            });
          });

          orderSourceSnapshots.set(source.name, sourceSnapshot);
          mergeOrderSources();
          applyOrdersSnapshot();
        },
        (error) => {
          console.warn(`⚠️ Erro no listener de pedidos (${source.name}):`, error);
          if (ordersSuccessfulSources === 0) {
            renderOrdersError();
          }
        }
      );

      orderUnsubscribers.push(unsubscribe);
    } catch (error) {
      console.warn(`⚠️ Falha ao iniciar listener de pedidos (${source.name}):`, error);
    }
  });
}

function stopOrdersRealtime() {
  orderUnsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn('Erro ao encerrar listener de pedidos:', error);
    }
  });

  orderUnsubscribers = [];
  ordersListenerStarted = false;
}

function loadUserOrders() {
  stopOrdersRealtime();
  startOrdersRealtime();
}

function mergeOrderSources() {
  orderSnapshots = new Map();

  orderSourceSnapshots.forEach((sourceSnapshot) => {
    sourceSnapshot.forEach((order, orderId) => {
      orderSnapshots.set(orderId, order);
    });
  });
}

function applyOrdersSnapshot() {
  const ordersLoading = document.getElementById('ordersLoading');
  const ordersEmpty = document.getElementById('ordersEmpty');
  const ordersList = document.getElementById('ordersList');
  const ordersBadge = document.getElementById('ordersBadge');

  const orders = Array.from(orderSnapshots.values()).sort((a, b) => {
    const timeA = getTimestampMillis(a.timestamp || a.createdAt || a.updatedAt || a.atualizadoEm);
    const timeB = getTimestampMillis(b.timestamp || b.createdAt || b.updatedAt || b.atualizadoEm);
    return timeB - timeA;
  });

  userOrders = orders;

  if (ordersLoading) ordersLoading.style.display = 'none';

  if (ordersBadge) {
    if (orders.length > 0) {
      ordersBadge.textContent = orders.length;
      ordersBadge.style.display = 'inline-flex';
    } else {
      ordersBadge.style.display = 'none';
    }
  }

  if (orders.length === 0) {
    if (ordersList) ordersList.style.display = 'none';
    renderOrdersEmptyState();
    updateOrdersLiveStatus('ready', 'Nenhum pedido encontrado');
    return;
  }

  if (ordersEmpty) ordersEmpty.style.display = 'none';
  if (ordersList) {
    ordersList.style.display = 'flex';
    renderOrders(orders);
  }

  updateOrdersLiveStatus('ready', `Atualizado agora • ${orders.length} pedido${orders.length > 1 ? 's' : ''}`);
}

function renderOrdersEmptyState() {
  const ordersEmpty = document.getElementById('ordersEmpty');
  if (!ordersEmpty) return;

  ordersEmpty.style.display = 'flex';
  ordersEmpty.innerHTML = `
    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <path d="M16 10a4 4 0 0 1-8 0"></path>
    </svg>
    <h3>Nenhum pedido ainda</h3>
    <p>Seus pedidos aparecerão aqui após a finalização</p>
    <button type="button" data-action="go-shop" class="btn-primary">
      Ir às Compras
    </button>
  `;
}

function renderOrdersError() {
  const ordersLoading = document.getElementById('ordersLoading');
  const ordersEmpty = document.getElementById('ordersEmpty');
  const ordersList = document.getElementById('ordersList');

  if (ordersLoading) ordersLoading.style.display = 'none';
  if (ordersList) ordersList.style.display = 'none';
  updateOrdersLiveStatus('error', 'Não foi possível sincronizar');

  if (ordersEmpty) {
    ordersEmpty.style.display = 'flex';
    ordersEmpty.innerHTML = `
      <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
      <h3>Erro ao carregar pedidos</h3>
      <p>Tente atualizar novamente em alguns instantes</p>
      <button type="button" class="btn-primary" data-action="refresh-orders">
        Recarregar
      </button>
    `;
  }
}

function updateOrdersLiveStatus(state, text) {
  const liveStatus = document.getElementById('ordersLiveStatus');
  const liveText = document.getElementById('ordersLiveText');

  if (liveStatus) {
    liveStatus.classList.remove('is-syncing', 'is-ready', 'is-error');
    liveStatus.classList.add(`is-${state}`);
  }

  if (liveText) {
    liveText.textContent = text;
  }
}

function getTimestampMillis(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  if (timestamp instanceof Date) return timestamp.getTime();

  const parsed = new Date(timestamp).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

// ==================== RENDERIZAR PEDIDOS ====================
function renderOrders(orders) {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;

  ordersList.innerHTML = orders.map(order => {
    const view = normalizeOrder(order);

    return `
      <article class="order-card" data-order-id="${sanitizeHTML(view.id)}">
        <div class="order-header">
          <div class="order-info">
            <div class="order-kicker">Pedido</div>
            <div class="order-id">#${sanitizeHTML(view.code)}</div>
            <div class="order-date">${sanitizeHTML(view.dateLabel)}</div>
          </div>
          <div class="order-status ${sanitizeHTML(view.status.className)}">${sanitizeHTML(view.status.label)}</div>
        </div>

        <div class="order-body">
          ${renderOrderTimeline(view)}
          ${renderTrackingPanel(view)}

          <div class="order-items">
            ${view.items.slice(0, 3).map(item => `
              <div class="order-item">
                <img src="${sanitizeHTML(item.image)}"
                     alt="${sanitizeHTML(item.name)}"
                     class="order-item-image"
                     onerror="this.src='https://via.placeholder.com/60/667eea/ffffff?text=SV'">
                <div class="order-item-details">
                  <div class="order-item-name">${sanitizeHTML(item.name)}</div>
                  <div class="order-item-variant">
                    ${item.size ? `Tam: ${sanitizeHTML(item.size)}` : ''}
                    ${item.color ? ` • Cor: ${sanitizeHTML(item.color)}` : ''}
                    ${item.quantity ? ` • Qtd: ${sanitizeHTML(item.quantity)}` : ''}
                  </div>
                </div>
                <div class="order-item-price">R$ ${formatCurrency(item.subtotal)}</div>
              </div>
            `).join('')}

            ${view.items.length > 3 ? `
              <div class="order-more-items">
                + ${view.items.length - 3} item(ns)
              </div>
            ` : ''}
          </div>
        </div>

        <div class="order-footer">
          <div class="order-total">
            <div class="order-total-label">Total do Pedido</div>
            <div class="order-total-value">R$ ${formatCurrency(view.total)}</div>
            ${view.updatedLabel ? `<div class="order-updated">Atualizado ${sanitizeHTML(view.updatedLabel)}</div>` : ''}
          </div>
          <div class="order-actions">
            ${view.trackingUrl ? `
              <button class="btn-order" data-action="open-tracking" data-url="${sanitizeHTML(view.trackingUrl)}">
                Rastrear
              </button>
            ` : ''}
            <button class="btn-order btn-order-primary" data-action="contact-order" data-order-code="${sanitizeHTML(view.code)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Falar com Suporte
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function normalizeOrder(order) {
  const rawStatus = order.status || order.statusPedido || order.orderStatus || 'pendente_whatsapp';
  const statusKey = normalizeStatus(rawStatus);
  const status = getStatusMeta(statusKey);
  const rawItems = Array.isArray(order.items) ? order.items : [];
  const timestamp = order.timestamp || order.createdAt || order.dataCriacao;
  const updatedAt = order.statusUpdatedAt || order.updatedAt || order.atualizadoEm || timestamp;

  return {
    id: order.id || '',
    code: String(order.codigo || order.code || order.id || '').slice(0, 12).toUpperCase(),
    dateLabel: formatOrderDate(timestamp),
    updatedLabel: formatRelativeDate(updatedAt),
    statusKey,
    status,
    statusHistory: normalizeStatusHistory(order.statusHistory || order.historicoStatus || [], statusKey, updatedAt),
    total: order.valores?.total || order.totals?.total || order.total || 0,
    payment: order.pagamento?.metodoNome || order.paymentMethod || order.pagamento?.metodo || '',
    items: rawItems.map(normalizeOrderItem),
    trackingCode: order.rastreamento?.codigo || order.trackingCode || order.codigoRastreio || '',
    trackingUrl: safeURL(order.rastreamento?.url || order.trackingUrl || order.linkRastreio || ''),
    carrier: order.rastreamento?.transportadora || order.carrier || order.transportadora || '',
    estimatedDelivery: formatOrderDate(order.previsaoEntrega || order.estimatedDelivery || order.rastreamento?.previsaoEntrega)
  };
}

function normalizeOrderItem(item) {
  const quantity = parseInt(item.quantity || item.quantidade || 1, 10) || 1;
  const price = parseFloat(item.price || item.preco || 0) || 0;

  return {
    name: item.name || item.nome || 'Produto',
    size: item.size || item.selectedSize || item.tamanho || '',
    color: item.color || item.selectedColor || item.cor || '',
    quantity,
    price,
    subtotal: parseFloat(item.subtotal || (price * quantity)) || 0,
    image: safeURL(item.image || item.imagem || '') || 'https://via.placeholder.com/60/667eea/ffffff?text=SV'
  };
}

function normalizeStatusHistory(history, currentStatus, updatedAt) {
  const entries = Array.isArray(history) ? history : [];
  const normalized = entries.map(entry => ({
    status: normalizeStatus(entry.status || entry.key || entry.nome || ''),
    date: entry.date || entry.createdAt || entry.at || entry.updatedAt || null,
    note: entry.note || entry.observacao || ''
  })).filter(entry => entry.status);

  if (!normalized.some(entry => entry.status === currentStatus)) {
    normalized.push({ status: currentStatus, date: updatedAt || null, note: '' });
  }

  return normalized;
}

function renderOrderTimeline(order) {
  if (order.statusKey === 'cancelado') {
    return `
      <div class="order-timeline order-timeline-canceled">
        <div class="timeline-step is-current">
          <span class="timeline-dot"></span>
          <div>
            <strong>Pedido cancelado</strong>
            <small>${sanitizeHTML(order.updatedLabel || 'Status atualizado')}</small>
          </div>
        </div>
      </div>
    `;
  }

  const activeIndex = Math.max(0, ORDER_STATUS_FLOW.findIndex(step => step.key === order.statusKey));

  return `
    <div class="order-timeline" aria-label="Acompanhamento do pedido">
      ${ORDER_STATUS_FLOW.map((step, index) => {
        const stateClass = index < activeIndex ? 'is-done' : index === activeIndex ? 'is-current' : 'is-pending';
        const historyEntry = order.statusHistory.find(entry => entry.status === step.key);
        const dateLabel = historyEntry?.date ? formatShortDate(historyEntry.date) : step.description;

        return `
          <div class="timeline-step ${stateClass}">
            <span class="timeline-dot"></span>
            <div>
              <strong>${sanitizeHTML(step.label)}</strong>
              <small>${sanitizeHTML(dateLabel)}</small>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTrackingPanel(order) {
  if (!order.trackingCode && !order.carrier && !order.payment) return '';

  return `
    <div class="tracking-panel">
      ${order.payment ? `
        <div>
          <span>Pagamento</span>
          <strong>${sanitizeHTML(order.payment)}</strong>
        </div>
      ` : ''}
      ${order.carrier ? `
        <div>
          <span>Transportadora</span>
          <strong>${sanitizeHTML(order.carrier)}</strong>
        </div>
      ` : ''}
      ${order.trackingCode ? `
        <div>
          <span>Código de rastreio</span>
          <strong>${sanitizeHTML(order.trackingCode)}</strong>
        </div>
      ` : ''}
      ${order.estimatedDelivery && order.estimatedDelivery !== 'Data não disponível' ? `
        <div>
          <span>Previsão</span>
          <strong>${sanitizeHTML(order.estimatedDelivery)}</strong>
        </div>
      ` : ''}
    </div>
  `;
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

  const refreshOrdersBtn = document.getElementById('refreshOrdersBtn');
  if (refreshOrdersBtn) {
    refreshOrdersBtn.addEventListener('click', loadUserOrders);
  }

  document.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;

    if (action === 'refresh-orders') {
      loadUserOrders();
    }

    if (action === 'contact-order') {
      contactWhatsApp(actionButton.dataset.orderCode);
    }

    if (action === 'open-tracking' && actionButton.dataset.url) {
      window.open(actionButton.dataset.url, '_blank', 'noopener,noreferrer');
    }

    if (action === 'go-shop') {
      window.location.href = 'index.html';
    }
  });

  // Banner rotativo
  initBannerRotation();
}

// ==================== TROCAR SEÇÃO ====================
function switchSection(sectionName) {
  const safeSection = sectionName === 'pedidos' ? 'pedidos' : 'dados';

  // Atualizar menu
  document.querySelectorAll('.account-menu-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === safeSection);
  });

  // Atualizar conteúdo
  document.querySelectorAll('.account-section').forEach(section => {
    section.classList.toggle('active', section.id === `section${capitalizeFirst(safeSection)}`);
  });

  const url = new URL(window.location.href);
  url.searchParams.set('aba', safeSection);
  window.history.replaceState({}, '', url);

  if (safeSection === 'pedidos' && !ordersListenerStarted) {
    startOrdersRealtime();
  }
}

function setInitialSectionFromURL() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('aba') || params.get('tab');
  const hash = window.location.hash.replace('#', '');
  const initialSection = tab || hash || 'dados';

  switchSection(initialSection === 'pedidos' ? 'pedidos' : 'dados');
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
  const message = `Olá! Gostaria de tirar dúvidas sobre o pedido #${orderId || ''}`;
  const phone = '5571991427103';
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ==================== FUNÇÕES UTILITÁRIAS ====================
function formatOrderDate(timestamp) {
  if (!timestamp) return 'Data não disponível';

  const date = parseDate(timestamp);
  if (!date) return 'Data não disponível';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function formatShortDate(timestamp) {
  const date = parseDate(timestamp);
  if (!date) return '';

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });
}

function formatRelativeDate(timestamp) {
  const date = parseDate(timestamp);
  if (!date) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  return formatShortDate(date);
}

function parseDate(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCurrency(value) {
  return parseFloat(value || 0).toFixed(2).replace('.', ',');
}

function normalizeStatus(status) {
  const raw = String(status || 'pendente_whatsapp').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return STATUS_ALIASES[normalized] || normalized || 'pendente_whatsapp';
}

function getStatusMeta(status) {
  const statusKey = normalizeStatus(status);

  if (statusKey === 'cancelado') {
    return {
      key: 'cancelado',
      label: 'Cancelado',
      description: 'Pedido cancelado',
      className: 'status-cancelado'
    };
  }

  return ORDER_STATUS_FLOW.find(step => step.key === statusKey) || ORDER_STATUS_FLOW[0];
}

function getStatusClass(status) {
  return getStatusMeta(status).className;
}

function translateStatus(status) {
  return getStatusMeta(status).label;
}

function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function safeURL(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) return url.replace(/["'\\\r\n]/g, '');
  return '';
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

