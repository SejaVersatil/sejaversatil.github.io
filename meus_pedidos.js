// =================================================================
// meus_pedidos.js - Lógica para a página Meus Pedidos
// CRIADO POR: MANUS - ENGENHEIRO DE SOFTWARE SÊNIOR
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Aguarda a verificação inicial do auth.js estar completa
    window.authReady.then(() => {
        if (window.currentUser) {
            loadUserOrders(window.currentUser.uid);
        } else {
            displayAuthRequiredMessage();
        }
    });
});

/**
 * Exibe uma mensagem solicitando que o usuário faça login para ver seus pedidos.
 */
function displayAuthRequiredMessage() {
    const ordersContent = document.getElementById('ordersContent');
    ordersContent.innerHTML = `
        <div class="auth-required-message">
            <h2>Acesso Restrito</h2>
            <p>Você precisa fazer login para visualizar seus pedidos.</p>
            <a href="#" class="btn-login" onclick="openUserPanel()">Fazer Login ou Cadastrar</a>
        </div>
    `;
}

/**
 * Busca e exibe os pedidos do usuário a partir do Firestore.
 * @param {string} userId - O UID do usuário logado.
 */
async function loadUserOrders(userId) {
    const ordersContent = document.getElementById('ordersContent');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if(loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const ordersQuery = await db.collection('orders')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();

        if (ordersQuery.empty) {
            ordersContent.innerHTML = `
                <div class="no-orders-message">
                    <h2>Nenhum Pedido Encontrado</h2>
                    <p>Você ainda não fez nenhuma compra. Explore nossos produtos!</p>
                    <a href="index.html" class="btn-shop">Começar a Comprar</a>
                </div>
            `;
            return;
        }

        // Limpa o skeleton loading
        ordersContent.innerHTML = '';

        ordersQuery.forEach(doc => {
            const order = { id: doc.id, ...doc.data() };
            const orderCard = createOrderCard(order);
            ordersContent.appendChild(orderCard);
        });

    } catch (error) {
        console.error("Erro ao carregar pedidos:", error);
        ordersContent.innerHTML = `
            <div class="no-orders-message">
                <h2>Ocorreu um Erro</h2>
                <p>Não foi possível carregar seus pedidos no momento. Por favor, tente novamente mais tarde.</p>
            </div>
        `;
    } finally {
        if(loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

/**
 * Cria o elemento HTML para um único card de pedido.
 * @param {object} order - O objeto do pedido vindo do Firestore.
 * @returns {HTMLElement} - O elemento div do card do pedido.
 */
function createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card';

    const statusMap = {
        'Pendente WhatsApp': { text: 'Pendente', class: 'status-pending' },
        'Pagamento Confirmado': { text: 'Confirmado', class: 'status-pending' },
        'Em Separação': { text: 'Em Separação', class: 'status-pending' },
        'Enviado': { text: 'Enviado', class: 'status-shipped' },
        'Entregue': { text: 'Entregue', class: 'status-delivered' },
        'Cancelado': { text: 'Cancelado', class: 'status-canceled' }
    };
    const currentStatus = statusMap[order.status] || { text: order.status, class: '' };

    const orderDate = order.createdAt.toDate().toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    card.innerHTML = `
        <div class="order-card-header">
            <div class="order-info">
                <strong>PEDIDO #${order.id.substring(0, 8).toUpperCase()}</strong>
                <span>Realizado em ${orderDate}</span>
            </div>
            <div class="order-status ${currentStatus.class}">${currentStatus.text}</div>
        </div>
        <div class="order-card-body">
            ${order.items.map(item => `
                <div class="order-item">
                    <div class="item-image" style="background-image: url('${item.image || 'https://via.placeholder.com/150'}' )"></div>
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        <p>${item.quantity}x R$ ${item.price.toFixed(2)} | Tam: ${item.size || 'N/A'} | Cor: ${item.color || 'N/A'}</p>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="order-card-footer">
            <div class="order-total">
                <span>Total:</span> R$ ${order.totals.total.toFixed(2)}
            </div>
            <div class="order-actions">
                <button class="btn-details" onclick="alert('Detalhes do pedido #${order.id}')">Ver Detalhes</button>
            </div>
        </div>
    `;
    return card;
}

/**
 * Conecta o botão "Meus Pedidos" no painel do usuário à nova página.
 */
function openMyOrders() {
    window.location.href = 'meus-pedidos.html';
}
