// ============================================
// AGUARDA FIREBASE ESTAR PRONTO
// ============================================

// ✅ Aguarda Firebase antes de usar auth
window.firebaseReady.then(() => {
  console.log('✅ Firebase pronto - auth.js pode executar');

// ==================== VARIÁVEIS GLOBAIS (CRÍTICAS - NÃO REMOVER) ====================
let currentUser = null;
let isAdminLoggedIn = false;

// ==================== AUTH READY PROMISE (USADO POR CHECKOUT.JS) ====================
const unsubscribe = auth.onAuthStateChanged((user) => {
    if (window._resolveAuth) {
        window._resolveAuth(user);
        window._resolveAuth = null;
    }
    unsubscribe();
});

// ==================== LOADING OVERLAY (STARTUP) ====================
// NOTA: O overlay é gerenciado pelo script2.js no DOMContentLoaded principal
// Aqui apenas garantimos que será removido quando auth estiver pronto

// ==================== ERROR MAPPING (PT-BR) ====================
const FIREBASE_ERROR_MAP = {
    'auth/invalid-email': 'O endereço de e-mail está mal formatado.',
    'auth/user-disabled': 'Esta conta de usuário foi desativada.',
    'auth/user-not-found': 'Usuário não encontrado. Verifique o e-mail.',
    'auth/wrong-password': 'A senha está incorreta.',
    'auth/email-already-in-use': 'Este e-mail já está em uso.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/operation-not-allowed': 'A autenticação por e-mail/senha não está ativada.',
    'auth/requires-recent-login': 'Esta operação requer autenticação recente. Faça login novamente.',
    'auth/too-many-requests': 'Acesso bloqueado temporariamente devido a muitas tentativas falhas. Tente novamente mais tarde.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    'auth/popup-blocked': 'Popup bloqueado pelo navegador. Permitir popups.',
    'auth/popup-closed-by-user': 'Login cancelado pelo usuário.',
    'auth/cancelled-popup-request': 'Login cancelado.',
    'auth/account-exists-with-different-credential': 'Este email já está cadastrado com outro método de login.',
    'auth/internal-error': 'Erro interno. Tente novamente em alguns segundos.',
    'default': 'Ocorreu um erro desconhecido. Tente novamente.'
};

// ==================== VALIDATION HELPERS ====================
function validateEmail(email) {
    // REGEX mais restritivo - requer pelo menos 2 caracteres antes do @
    const re = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,}@[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    const isValid = re.test(String(email).toLowerCase());
    if (!isValid) return false;
    
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    
    // Lista de domínios confiáveis e comuns
    const trustedDomains = [
        'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'live.com',
        'icloud.com', 'protonmail.com', 'aol.com', 'zoho.com', 'mail.com',
        'gmx.com', 'yandex.com', 'fastmail.com', 'tutanota.com'
    ];
    
    // Lista de domínios suspeitos/temporários
    const suspiciousDomains = [
        'tempmail', 'throwaway', 'guerrillamail', '10minutemail', 
        'mailinator', 'trashmail', 'maildrop', 'sharklasers',
        'grr.la', 'guerrillamail', 'spam4.me', 'mintemail',
        'fakeinbox', 'getnada', 'yopmail', 'mohmal', 'emailondeck'
    ];
    
    // Se for domínio confiável, aceita
    if (trustedDomains.includes(domain)) {
        return true;
    }
    
    // Verifica se contém palavras suspeitas
    const isSuspicious = suspiciousDomains.some(sus => domain.includes(sus));
    if (isSuspicious) {
        return false;
    }
    
    // Validação adicional: domínio deve ter pelo menos 4 caracteres antes do TLD
    const domainParts = domain.split('.');
    if (domainParts.length < 2) return false;
    
    const domainName = domainParts[domainParts.length - 2];
    if (domainName.length < 4) {
        return false; // Bloqueia domínios muito curtos como "aa.com"
    }
    
    // Bloqueia domínios com padrões suspeitos (números aleatórios, etc)
    if (/^\d+$/.test(domainName)) {
        return false; // Bloqueia domínios como "123456.com"
    }
    
    return true;
}

function validatePasswordStrength(password) {
    if (password.length < 8) {
        return 'A senha deve ter no mínimo 8 caracteres.';
    }
    if (!/[A-Z]/.test(password)) {
        return 'A senha deve conter pelo menos uma letra maiúscula.';
    }
    if (!/[a-z]/.test(password)) {
        return 'A senha deve conter pelo menos uma letra minúscula.';
    }
    if (!/[0-9]/.test(password)) {
        return 'A senha deve conter pelo menos um número.';
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        return 'A senha deve conter pelo menos um símbolo ou caractere especial.';
    }
    return null;
}

// ==================== TOAST SYSTEM (USADO EM TODA APLICAÇÃO) ====================
function showToast(message, type = 'info') {
    console.log(`[TOAST - ${type.toUpperCase()}]: ${message}`);
    
    let toastContainer = document.getElementById('toastContainer');
    
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 9999;
            display: flex; flex-direction: column-reverse; gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        padding: 10px 20px; border-radius: 5px; color: white;
        background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
        box-shadow: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);
        opacity: 0; transition: opacity 0.5s, transform 0.5s;
        transform: translateY(100%);
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(100%)';
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
}

// ==================== BUTTON LOADING STATE ====================
function setButtonLoading(button, isLoading, originalText = 'Aguarde...') {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Aguarde...' : originalText;
    button.classList.toggle('loading', isLoading);
}

// ==================== SWITCH USER TAB (CRÍTICO - ESTAVA FALTANDO) ====================
function switchUserTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginBtn = document.querySelector('.user-panel-tab:first-child');
    const registerBtn = document.querySelector('.user-panel-tab:last-child');
    
    if (tab === 'login') {
        if (loginTab) loginTab.classList.add('active');
        if (registerTab) registerTab.classList.remove('active');
        if (loginBtn) loginBtn.classList.add('active');
        if (registerBtn) registerBtn.classList.remove('active');
    } else if (tab === 'register') {
        if (loginTab) loginTab.classList.remove('active');
        if (registerTab) registerTab.classList.add('active');
        if (loginBtn) loginBtn.classList.remove('active');
        if (registerBtn) registerBtn.classList.add('active');
    }
}

// ==================== UPDATE USER PANEL TABS ====================
function updateUserPanelTabs(user) {
    const userPanelTabs = document.getElementById('userPanelTabs');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loggedTab = document.getElementById('userLoggedTab');
    
    if (user) {
        // Esconder abas de login/cadastro
        if (userPanelTabs) userPanelTabs.style.display = 'none';
        if (loginTab) loginTab.classList.remove('active');
        if (registerTab) registerTab.classList.remove('active');
        
        // Mostrar aba logada
        if (loggedTab) {
            loggedTab.classList.add('active');
            
            // Preencher dados
            const userName = document.getElementById('userName');
            const userEmail = document.getElementById('userEmail');
            const userStatus = document.getElementById('userStatus');
            const adminBtn = document.getElementById('adminAccessBtn');
            
            if (userName) userName.textContent = user.name || user.email;
            if (userEmail) userEmail.textContent = user.email;
            
            if (user.isAdmin) {
                if (userStatus) userStatus.innerHTML = 'Administrador <span class="admin-badge">ADMIN</span>';
                if (adminBtn) adminBtn.style.display = 'block';
            } else {
                if (userStatus) userStatus.textContent = 'Cliente';
                if (adminBtn) adminBtn.style.display = 'none';
            }
        }
    } else {
        // Mostrar abas de login
        if (userPanelTabs) userPanelTabs.style.display = 'flex';
        if (loggedTab) loggedTab.classList.remove('active');
        if (loginTab) loginTab.classList.add('active');
    }
}


// ==================== LOGGED IN VIEW (UI APÓS LOGIN) ====================
async function showLoggedInView() {
    // ✅ DETECTAR CONTEXTO
    const isCheckoutPage = window.location.pathname.includes('checkout.html');
    
    // ========================================
    // 1. ATUALIZAR UI DO PAINEL LATERAL (HOME)
    // ========================================
    const tabs = document.getElementById('userPanelTabs');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loggedTab = document.getElementById('userLoggedTab');

    if(tabs) tabs.style.display = 'none';
    if(loginTab) loginTab.classList.remove('active');
    if(registerTab) registerTab.classList.remove('active');
    if(loggedTab) loggedTab.classList.add('active');
    
    // Atualiza nome e email no painel
    if(document.getElementById('userName')) {
        document.getElementById('userName').textContent = currentUser.name || currentUser.email;
    }
    if(document.getElementById('userEmail')) {
        document.getElementById('userEmail').textContent = currentUser.email;
    }
    
    // Verifica Admin
    if (currentUser.isAdmin) {
        const userStatus = document.getElementById('userStatus');
        const adminBtn = document.getElementById('adminAccessBtn');
        
        if(userStatus) userStatus.innerHTML = 'Administrador <span class="admin-badge">ADMIN</span>';
        if(adminBtn) adminBtn.style.display = 'block';
        isAdminLoggedIn = true;
    } else {
        const userStatus = document.getElementById('userStatus');
        const adminBtn = document.getElementById('adminAccessBtn');
        
        if(userStatus) userStatus.textContent = 'Cliente';
        if(adminBtn) adminBtn.style.display = 'none';
    }

    // ========================================
    // 2. LÓGICA ESPECÍFICA PARA CHECKOUT
    // ========================================
    if (isCheckoutPage) {
        console.log('🛒 Checkout: Configurando UI e buscando dados...');
        
        // Atualizar elementos do checkout
        const authStateGuest = document.getElementById('authStateGuest');
        const authStateLogged = document.getElementById('authStateLogged');
        const authTabsContainer = document.querySelector('.auth-tabs');
        const formDadosPessoais = document.getElementById('formDadosPessoais');
        
        // Esconder estado de visitante
        if (authStateGuest) authStateGuest.style.display = 'none';
        if (authTabsContainer) authTabsContainer.style.display = 'none';
        
        // Mostrar estado logado
        if (authStateLogged) {
            authStateLogged.style.display = 'block';
            
            const loggedUserName = document.getElementById('loggedUserName');
            const loggedUserEmail = document.getElementById('loggedUserEmail');
            
            if (loggedUserName) loggedUserName.textContent = currentUser.name;
            if (loggedUserEmail) loggedUserEmail.textContent = currentUser.email;
        }
        
        // Mostrar formulário de dados pessoais
        if (formDadosPessoais) {
            formDadosPessoais.style.display = 'block';
            
            // Preencher email
            const inputEmail = document.getElementById('inputEmail');
            if (inputEmail) {
                inputEmail.value = currentUser.email;
                inputEmail.disabled = true;
            }
        }
        
        // ✅ BUSCAR DADOS COMPLEMENTARES DO FIRESTORE
        if (currentUser.uid && typeof db !== 'undefined') {
            try {
                const doc = await db.collection('users').doc(currentUser.uid).get();
                
                if (doc.exists) {
                    const userData = doc.data();
                    
                    // Atualizar variável global
                    currentUser.phone = userData.phone || "";
                    currentUser.cpf = userData.cpf || "";
                    
                    console.log('✅ Dados recuperados:', currentUser.phone, currentUser.cpf);

                    // Preencher inputs
                    const inputTelefone = document.getElementById('inputTelefone');
                    const inputCPF = document.getElementById('inputCPF');

                    if (inputTelefone && userData.phone) {
                        inputTelefone.value = userData.phone;
                        inputTelefone.dispatchEvent(new Event('input'));
                    }

                    if (inputCPF && userData.cpf) {
                        inputCPF.value = userData.cpf;
                        inputCPF.dispatchEvent(new Event('input'));
                    }

                    // Solicitar dados faltantes APENAS SE NECESSÁRIO
                    if (!currentUser.phone || !currentUser.cpf) {
                        console.warn('⚠️ Dados incompletos. Solicitando...');
                        
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Solicitar Telefone
                        if (!currentUser.phone && typeof getUserPhone === 'function') {
                            const phone = await getUserPhone();
                            if (phone) {
                                currentUser.phone = phone;
                                if (inputTelefone) {
                                    inputTelefone.value = phone;
                                    inputTelefone.dispatchEvent(new Event('input'));
                                }
                            }
                        }
                        
                        // Solicitar CPF
                        if (!currentUser.cpf && typeof getUserCPF === 'function') {
                            const cpf = await getUserCPF();
                            if (cpf) {
                                currentUser.cpf = cpf;
                                if (inputCPF) {
                                    inputCPF.value = cpf;
                                    inputCPF.dispatchEvent(new Event('input'));
                                }
                            }
                        }
                        
                        // Validação final
                        if (!currentUser.phone || !currentUser.cpf) {
                            showToast('⚠️ Complete seus dados para continuar', 'error');
                        } else {
                            showToast('✅ Dados completos!', 'success');
                            
                            if (typeof validateDadosStep === 'function') {
                                setTimeout(() => validateDadosStep(), 1000);
                            }
                        }
                    }
                } else {
                    console.warn('⚠️ Documento do usuário não encontrado');
                }
            } catch (error) {
                console.error("❌ Erro ao buscar dados:", error);
                showToast('Erro ao carregar dados', 'error');
            }
        }
    }
}


// ==================== UI UPDATE (CHAMADA POR onAuthStateChanged) ====================
async function updateUI(user) {
    const userPanel = document.getElementById('userPanel');
    const loggedInView = document.getElementById('loggedInView');
    const loggedOutView = document.getElementById('loggedOutView');
    const adminAccessBtn = document.getElementById('adminAccessBtn');
    
    // ✅ CHECKOUT-SPECIFIC ELEMENTS (null-safe)
    const checkoutAuthStateGuest = document.getElementById('authStateGuest');
    const checkoutAuthStateLogged = document.getElementById('authStateLogged');
    const checkoutUserName = document.getElementById('loggedUserName');
    const checkoutUserEmail = document.getElementById('loggedUserEmail');

    if (user) {
    // ✅ VERIFICAR SE E-MAIL FOI CONFIRMADO
    if (!user.emailVerified) {
        // Tentar recarregar dados do Firebase (se disponível)
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
            try {
                await firebaseUser.reload();
                
                // Se após reload ainda não verificou, bloqueia
                if (!firebaseUser.emailVerified) {
                    showToast('⚠️ Por favor, verifique seu e-mail antes de continuar', 'error');
                    
                    localStorage.removeItem('sejaVersatilCurrentUser');
                    currentUser = null;
                    window.currentUser = null;
                    return;
                }
                // Se verificou após reload, atualiza e continua
                user.emailVerified = true;
            } catch (error) {
                console.warn('Erro ao recarregar usuário:', error);
            }
        }
    }

        // Garantir que currentUser está sincronizado
        if (typeof currentUser === 'undefined' || !currentUser) {
            currentUser = {
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                uid: user.uid,
                isAdmin: isAdminLoggedIn || false
            };
        }
        
        // ========== HOME PAGE UI ==========
        if (loggedInView) loggedInView.style.display = 'block';
        if (loggedOutView) loggedOutView.style.display = 'none';
        if (adminAccessBtn) adminAccessBtn.style.display = isAdminLoggedIn ? 'block' : 'none';
        if (userPanel) userPanel.classList.remove('active');
        
        // ========== CHECKOUT PAGE UI ==========
        if (checkoutAuthStateGuest) checkoutAuthStateGuest.style.display = 'none';
        if (checkoutAuthStateLogged) checkoutAuthStateLogged.style.display = 'block';
        if (checkoutUserName) checkoutUserName.textContent = currentUser.name || 'Usuário';
        if (checkoutUserEmail) checkoutUserEmail.textContent = user.email || '';
        
        // ✅ Trigger checkout-specific validation (if function exists)
        if (typeof window.updateAuthUICheckout === 'function') {
            window.updateAuthUICheckout(user);
        }
        
    } else {
        // ========== HOME PAGE UI (Logged Out) ==========
        if (loggedInView) loggedInView.style.display = 'none';
        if (loggedOutView) loggedOutView.style.display = 'block';
        if (adminAccessBtn) adminAccessBtn.style.display = 'none';
        
        // ========== CHECKOUT PAGE UI (Logged Out) ==========
        if (checkoutAuthStateGuest) checkoutAuthStateGuest.style.display = 'block';
        if (checkoutAuthStateLogged) checkoutAuthStateLogged.style.display = 'none';
    }
    
    // ✅ CROSS-PAGE: Update cart UI (if function exists)
    if (typeof window.updateCartUIAfterAuth === 'function') {
        window.updateCartUIAfterAuth();
    }
    
    console.log('✅ UI updated universally:', user ? user.email : 'Guest');
}

// ==================== AUTH STATE LISTENER (CORAÇÃO DO SISTEMA) ====================
auth.onAuthStateChanged(async (user) => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }

    if (user) {
        console.log('🔄 Estado de auth mudou: usuário logado -', user.email);
        
        let userData = JSON.parse(localStorage.getItem('sejaVersatilCurrentUser') || 'null');
        
        // REVALIDAR SE UID MUDOU OU DADOS NÃO EXISTEM
        if (!userData || userData.uid !== user.uid) {
            const adminDoc = await db.collection('admins').doc(user.uid).get();
            
            if (adminDoc.exists && adminDoc.data().role === 'admin') {
                const adminData = adminDoc.data();
                
                userData = {
                    name: adminData.name || user.displayName || 'Administrador',
                    email: user.email,
                    isAdmin: true,
                    uid: user.uid,
                    permissions: adminData.permissions || []
                };
            } else {
                userData = {
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    isAdmin: false,
                    uid: user.uid,
                    permissions: []
                };
            }
            
            localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(userData));
        }
        
        // ATUALIZAR VARIÁVEIS GLOBAIS
        currentUser = userData;
        isAdminLoggedIn = currentUser.isAdmin;
        
        // EXPORTAR PARA ESCOPO GLOBAL (USADO POR SCRIPT2.JS E CHECKOUT.JS)
        window.currentUser = currentUser;
        window.isAdminLoggedIn = isAdminLoggedIn;
        
    } else {
        console.log('🔄 Estado de auth mudou: usuário deslogado');
        
        currentUser = null;
        isAdminLoggedIn = false;
        localStorage.removeItem('sejaVersatilCurrentUser');
        
        window.currentUser = null;
        window.isAdminLoggedIn = false;
    }
    
    // CHAMAR FUNÇÕES DE UI (SE EXISTIREM)
    updateUI(currentUser);
    updateUserPanelTabs(currentUser);
    
    // COMPATIBILIDADE COM CHECKOUT.JS
    if (typeof updateAuthUI === 'function') {
        updateAuthUI(user);
    }
    
    // ATUALIZAR CARRINHO (SE FUNÇÃO EXISTIR)
    if (typeof updateCartUI === 'function') {
        updateCartUI();
    }
});

// ==================== LOGIN (CHAMADA POR index.html E checkout.html) ====================
async function userLogin(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const errorMsgEl = document.getElementById('loginError');
    const loginBtn = event.submitter || document.querySelector('#loginTab .form-btn');
    const originalText = loginBtn ? loginBtn.textContent : 'Entrar';

    // VALIDAÇÃO INICIAL
    if (!emailInput || !passwordInput) {
        console.error('❌ Elementos de login não encontrados no DOM');
        showToast('Erro ao carregar formulário', 'error');
        return;
    }

    if (errorMsgEl) {
        errorMsgEl.textContent = '';
        errorMsgEl.classList.remove('active');
    }
    
    const email = emailInput.value.toLowerCase().trim();
    const password = passwordInput.value;

    // VALIDAÇÃO DE EMAIL
    if (!validateEmail(email)) {
        if (errorMsgEl) {
            errorMsgEl.textContent = 'E-mail inválido.';
            errorMsgEl.classList.add('active');
        }
        emailInput.classList.add('input-error');
        showToast('E-mail inválido', 'error');
        return;
    }
    
    // LOADING STATE
    setButtonLoading(loginBtn, true, originalText);
    emailInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');

    try {
        // CHAMADA FIREBASE AUTH
        await auth.signInWithEmailAndPassword(email, password);
        await auth.currentUser.reload();

        const user = auth.currentUser;
        
        if (user && !user.emailVerified) {
            // Forçar logout
            await auth.signOut();
            
            if (errorMsgEl) {
                errorMsgEl.innerHTML = '⚠️ E-mail não verificado. <a href="#" onclick="resendVerificationFromLogin(\'' + email + '\'); return false;" style="color: var(--primary); text-decoration: underline;">Clique aqui para reenviar</a>';
                errorMsgEl.classList.add('active');
            }
            
            showToast('Por favor, verifique seu e-mail antes de fazer login', 'error');
            
            return;
        }
        
        showToast('Login realizado com sucesso!', 'success');
        updateUserPanelTabs(currentUser);
        
        // CARREGAR CARRINHO (SE FUNÇÃO EXISTIR)
        if (typeof loadCart === 'function') loadCart();
        if (typeof updateCartUI === 'function') updateCartUI();
        
    } catch (error) {
        console.error('❌ Erro no Login:', error);
        
        const errorCode = error.code;
        const friendlyMessage = FIREBASE_ERROR_MAP[errorCode] || FIREBASE_ERROR_MAP['default'];
        
        if (errorMsgEl) {
            errorMsgEl.textContent = friendlyMessage;
            errorMsgEl.classList.add('active');
        }
        
        // MARCAR INPUT ESPECÍFICO COM ERRO
        if (errorCode === 'auth/wrong-password') {
            passwordInput.classList.add('input-error');
        } else if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-email') {
            emailInput.classList.add('input-error');
        }
        
        showToast(friendlyMessage, 'error');
        
    } finally {
        setButtonLoading(loginBtn, false, originalText);
    }
}

// ==================== REGISTRO PROFISSIONAL (REESCRITO DO ZERO) ====================
async function userRegister(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('registerName');
    const emailInput = document.getElementById('registerEmail');
    // ✅ NOVOS ELEMENTOS
    const phoneInput = document.getElementById('registerPhone');
    const cpfInput = document.getElementById('registerCPF');
    // ----------------
    const passwordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    const errorMsgEl = document.getElementById('registerError');
    const successMsgEl = document.getElementById('registerSuccess');
    const registerBtn = event.submitter || document.querySelector('#registerTab .form-btn');
    const originalText = registerBtn ? registerBtn.textContent : 'Cadastrar';

    // VALIDAÇÃO INICIAL
    if (!nameInput || !emailInput || !phoneInput || !cpfInput || !passwordInput || !confirmPasswordInput) {
        console.error('❌ Elementos de registro não encontrados no DOM');
        showToast('Erro ao carregar formulário', 'error');
        return;
    }

    if (errorMsgEl) {
        errorMsgEl.textContent = '';
        errorMsgEl.classList.remove('active');
    }
    if (successMsgEl) {
        successMsgEl.classList.remove('active');
    }
    
    const name = nameInput.value.trim();
    const email = emailInput.value.toLowerCase().trim();
    // ✅ NOVOS VALORES
    const phone = phoneInput.value.trim();
    const cpf = cpfInput.value.trim();
    // ----------------
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // LIMPAR FEEDBACKS VISUAIS (Incluindo novos campos)
    [nameInput, emailInput, phoneInput, cpfInput, passwordInput, confirmPasswordInput].forEach(input => {
        input.classList.remove('input-error');
    });

    // VALIDAÇÃO: CAMPOS OBRIGATÓRIOS (Incluindo novos campos)
    if (!name || !email || !phone || !cpf || !password || !confirmPassword) {
        if (errorMsgEl) {
            errorMsgEl.textContent = 'Preencha todos os campos.';
            errorMsgEl.classList.add('active');
        }
        showToast('Preencha todos os campos', 'error');
        return;
    }

    // VALIDAÇÃO: NOME COMPLETO (deve ter pelo menos nome e sobrenome)
    if (name.split(' ').filter(n => n.length > 0).length < 2) {
        if (errorMsgEl) {
            errorMsgEl.textContent = 'Digite seu nome completo (nome e sobrenome).';
            errorMsgEl.classList.add('active');
        }
        nameInput.classList.add('input-error');
        showToast('Digite seu nome completo', 'error');
        return;
    }

    // VALIDAÇÃO: EMAIL
    if (!validateEmail(email)) {
        if (errorMsgEl) {
            errorMsgEl.textContent = 'E-mail inválido ou domínio não permitido.';
            errorMsgEl.classList.add('active');
        }
        emailInput.classList.add('input-error');
        showToast('E-mail inválido ou domínio temporário', 'error');
        return;
    }

    // VALIDAÇÃO: SENHAS COINCIDEM
    if (password !== confirmPassword) {
        if (errorMsgEl) {
            errorMsgEl.textContent = 'As senhas não coincidem.';
            errorMsgEl.classList.add('active');
        }
        passwordInput.classList.add('input-error');
        confirmPasswordInput.classList.add('input-error');
        showToast('As senhas não coincidem', 'error');
        return;
    }

    // VALIDAÇÃO: FORÇA DA SENHA
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
        if (errorMsgEl) {
            errorMsgEl.textContent = passwordError;
            errorMsgEl.classList.add('active');
        }
        passwordInput.classList.add('input-error');
        showToast(passwordError, 'error');
        return;
    }
    
    // LOADING STATE
    setButtonLoading(registerBtn, true, originalText);

    try {
        // CRIAÇÃO DO USUÁRIO
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // ATUALIZAR PERFIL
        await user.updateProfile({
            displayName: name
        });

        // SALVAR NO FIRESTORE (Incluindo Phone e CPF)
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            phone: phone, // ✅ ADICIONADO
            cpf: cpf,     // ✅ ADICIONADO
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // ENVIAR E-MAIL DE VERIFICAÇÃO + LOGOUT FORÇADO
        try {
            await user.sendEmailVerification();
            
            // CRÍTICO: Força logout ANTES de qualquer atualização de UI
            await auth.signOut();
            
            showToast('✅ Conta criada! Verifique seu e-mail para ativar.', 'success');
            
            // Mostrar mensagem com link para login
            if (successMsgEl) {
                successMsgEl.innerHTML = '📧 E-mail de verificação enviado! Verifique sua caixa de entrada e spam. <a href="#" onclick="switchUserTab(\'login\'); return false;" style="color: var(--primary); text-decoration: underline; font-weight: 600;">Fazer Login</a>';
                successMsgEl.classList.add('active');
            }
            
            // Travar campos (não limpar para evitar reenvio acidental)
            nameInput.disabled = true;
            emailInput.disabled = true;
            phoneInput.disabled = true; // ✅ TRAVAR NOVO CAMPO
            cpfInput.disabled = true;   // ✅ TRAVAR NOVO CAMPO
            passwordInput.disabled = true;
            confirmPasswordInput.disabled = true;
            
            // Esconder botão de submit
            if (registerBtn) {
                registerBtn.style.display = 'none';
            }
            
            // Esconder indicadores visuais
            const strengthDiv = document.getElementById('passwordStrength');
            const matchFeedback = document.getElementById('passwordMatchFeedback');
            if (strengthDiv) strengthDiv.style.display = 'none';
            if (matchFeedback) matchFeedback.style.display = 'none';
            
            // Esconder mensagem de erro (se houver)
            if (errorMsgEl) {
                errorMsgEl.classList.remove('active');
            }
            
        } catch (emailError) {
            console.error('❌ Erro ao enviar e-mail:', emailError);
            
            // Mesmo com erro no e-mail, força logout
            await auth.signOut();
            
            showToast('Conta criada, mas erro ao enviar e-mail. Tente fazer login.', 'error');
            
            if (errorMsgEl) {
                errorMsgEl.innerHTML = 'Conta criada, mas não foi possível enviar o e-mail. <a href="#" onclick="switchUserTab(\'login\'); return false;" style="color: var(--primary);">Tente fazer login</a>';
                errorMsgEl.classList.add('active');
            }
        }

    } catch (error) {
        console.error('❌ Erro no Registro:', error);
        
        const errorCode = error.code;
        const friendlyMessage = FIREBASE_ERROR_MAP[errorCode] || FIREBASE_ERROR_MAP['default'];
        
        if (errorMsgEl) {
            errorMsgEl.textContent = friendlyMessage;
            errorMsgEl.classList.add('active');
        }
        
        // Marcar campo específico com erro
        if (errorCode === 'auth/email-already-in-use') {
            emailInput.classList.add('input-error');
        } else if (errorCode === 'auth/weak-password') {
            passwordInput.classList.add('input-error');
        }
        
        showToast(friendlyMessage, 'error');
        
    } finally {
        setButtonLoading(registerBtn, false, originalText);
    }
}

// ==================== GOOGLE LOGIN (CHAMADA POR index.html) ====================
async function loginWithGoogle() {
    // ✅ DETECTAR CONTEXTO: Home ou Checkout
    const isCheckoutPage = window.location.pathname.includes('checkout.html');
    const isHomePage = !isCheckoutPage;
    
    // ✅ LOADING OVERLAY (tenta ambos os IDs)
    const loadingOverlay = document.getElementById('loadingOverlay') || 
                           document.getElementById('checkoutLoadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        // Tentar popup primeiro
        let result;
        try {
            result = await auth.signInWithPopup(provider);
        } catch (popupError) {
            if (popupError.code === 'auth/popup-blocked') {
                await auth.signInWithRedirect(provider);
                return;
            }
            throw popupError;
        }
        
        const user = result.user;
        
        console.log('✅ Login Google bem-sucedido:', user.email);
        
        // ✅ VERIFICAR SE É ADMIN
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        
        if (adminDoc.exists && adminDoc.data().role === 'admin') {
            const adminData = adminDoc.data();
            
            currentUser = {
                name: adminData.name || user.displayName || 'Administrador',
                email: user.email,
                isAdmin: true,
                uid: user.uid,
                permissions: adminData.permissions || []
            };
            
            isAdminLoggedIn = true;
        } else {
            // ✅ SALVAR USUÁRIO COMUM COM MERGE
            await db.collection('users').doc(user.uid).set({
                name: user.displayName || 'Usuário',
                email: user.email,
                photoURL: user.photoURL || null,
                phone: '',
                cpf: '',
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false,
                provider: 'google'
            }, { merge: true });
            
            currentUser = {
                name: user.displayName || 'Usuário',
                email: user.email,
                isAdmin: false,
                uid: user.uid,
                phone: '',
                cpf: '',
                permissions: []
            };
        }
        
        // ✅ SALVAR NO LOCALSTORAGE
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        
        showToast('Login realizado com sucesso!', 'success');
        
        // ==========================================
        // ✅ LÓGICA ESPECÍFICA POR PÁGINA
        // ==========================================
        
        if (isCheckoutPage) {
            // ========== CHECKOUT.HTML ==========
            const authStateGuest = document.getElementById('authStateGuest');
            const authStateLogged = document.getElementById('authStateLogged');
            const authTabsContainer = document.querySelector('.auth-tabs');
            const formDadosPessoais = document.getElementById('formDadosPessoais');
            
            // Esconder estado de visitante
            if (authStateGuest) authStateGuest.style.display = 'none';
            if (authTabsContainer) authTabsContainer.style.display = 'none';
            
            // Mostrar estado logado
            if (authStateLogged) {
                authStateLogged.style.display = 'block';
                
                const loggedUserName = document.getElementById('loggedUserName');
                const loggedUserEmail = document.getElementById('loggedUserEmail');
                
                if (loggedUserName) loggedUserName.textContent = currentUser.name;
                if (loggedUserEmail) loggedUserEmail.textContent = currentUser.email;
            }
            
            // Mostrar formulário de dados pessoais
            if (formDadosPessoais) {
                formDadosPessoais.style.display = 'block';
                
                // Preencher email
                const inputEmail = document.getElementById('inputEmail');
                if (inputEmail) {
                    inputEmail.value = currentUser.email;
                    inputEmail.disabled = true;
                }
            }
            
            // ✅ BUSCAR DADOS COMPLEMENTARES DO FIRESTORE
            try {
                const doc = await db.collection('users').doc(user.uid).get();
                if (doc.exists) {
                    const userData = doc.data();
                    
                    const inputTelefone = document.getElementById('inputTelefone');
                    const inputCPF = document.getElementById('inputCPF');
                    
                    if (userData.phone && inputTelefone) {
                        inputTelefone.value = userData.phone;
                    }
                    
                    if (userData.cpf && inputCPF) {
                        inputCPF.value = userData.cpf;
                    }
                }
            } catch (err) {
                console.warn('⚠️ Erro ao buscar dados complementares:', err);
            }
            
        } else if (isHomePage) {
            // ========== INDEX.HTML ==========
            const userPanel = document.getElementById('userPanel');
            const loginTab = document.getElementById('loginTab');
            const registerTab = document.getElementById('registerTab');
            const loggedTab = document.getElementById('userLoggedTab');
            const userPanelTabs = document.getElementById('userPanelTabs');
            
            // Esconder abas de login/cadastro
            if (userPanelTabs) userPanelTabs.style.display = 'none';
            if (loginTab) loginTab.classList.remove('active');
            if (registerTab) registerTab.classList.remove('active');
            
            // Mostrar aba logada
            if (loggedTab) {
                loggedTab.classList.add('active');
                
                const userName = document.getElementById('userName');
                const userEmail = document.getElementById('userEmail');
                const userStatus = document.getElementById('userStatus');
                const adminBtn = document.getElementById('adminAccessBtn');
                
                if (userName) userName.textContent = currentUser.name;
                if (userEmail) userEmail.textContent = currentUser.email;
                
                if (currentUser.isAdmin) {
                    if (userStatus) userStatus.innerHTML = 'Administrador <span class="admin-badge">ADMIN</span>';
                    if (adminBtn) adminBtn.style.display = 'block';
                } else {
                    if (userStatus) userStatus.textContent = 'Cliente';
                    if (adminBtn) adminBtn.style.display = 'none';
                }
            }
            
            // ✅ FECHAR PAINEL APÓS 1 SEGUNDO
            if (typeof closeUserPanel === 'function') {
                setTimeout(() => {
                    closeUserPanel();
                }, 1000);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro no login Google:', error);
        
        let errorMessage = 'Erro ao fazer login com Google';
        
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Você fechou a janela de login';
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = 'Login cancelado';
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            errorMessage = 'Este email já está cadastrado com outro método de login';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Erro de conexão. Verifique sua internet';
        } else if (error.code === 'auth/internal-error') {
            errorMessage = 'Erro interno. Tente novamente em alguns segundos';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showToast(errorMessage, 'error');
        
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// ==================== LOGOUT (CHAMADA POR index.html E checkout.html) ====================
async function userLogout() {
    if (confirm('Deseja realmente sair da sua conta?')) {
        try {
            await auth.signOut();
            showToast('Logout realizado com sucesso', 'info');
        } catch (error) {
            console.error('❌ Erro ao fazer logout:', error);
            showToast('Erro ao fazer logout', 'error');
        }
    }
}

// ==================== RESET PASSWORD (CHAMADA POR index.html) ====================
async function resetPassword() {
    const email = prompt('Digite seu email para recuperar a senha:');
    
    if (!email || !validateEmail(email)) {
        showToast('Email inválido', 'error');
        return;
    }
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');
    
    try {
        await auth.sendPasswordResetEmail(email);
        showToast('✅ Email de recuperação enviado!', 'success');
        alert('Verifique sua caixa de entrada e spam.');
    } catch (error) {
        console.error('❌ Erro:', error);
        const errorCode = error.code;
        const friendlyMessage = FIREBASE_ERROR_MAP[errorCode] || FIREBASE_ERROR_MAP['default'];
        showToast(friendlyMessage, 'error');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// ==================== REENVIAR E-MAIL DE VERIFICAÇÃO ====================
async function resendVerificationEmail() {
    const user = auth.currentUser;
    
    if (!user) {
        showToast('Nenhum usuário logado', 'error');
        return;
    }
    
    if (user.emailVerified) {
        showToast('Seu e-mail já está verificado!', 'success');
        location.reload();
        return;
    }
    
    try {
        await user.sendEmailVerification();
        showToast('✅ E-mail de verificação reenviado!', 'success');
    } catch (error) {
        console.error('❌ Erro:', error);
        showToast('Erro ao reenviar e-mail. Tente novamente em 1 minuto.', 'error');
    }
}

// ==================== REENVIAR VERIFICAÇÃO NO LOGIN ====================
async function resendVerificationFromLogin(email) {
    const tempPassword = prompt('Digite sua senha para reenviar o e-mail de verificação:');
    
    if (!tempPassword) {
        showToast('Operação cancelada', 'info');
        return;
    }
    
    try {
        // Login temporário
        const userCredential = await auth.signInWithEmailAndPassword(email, tempPassword);
        const user = userCredential.user;
        
        if (user.emailVerified) {
            showToast('Seu e-mail já está verificado! Faça login novamente.', 'success');
            await auth.signOut();
            return;
        }
        
        // Reenviar verificação
        await user.sendEmailVerification();
        showToast('✅ E-mail de verificação reenviado!', 'success');
        
        // Logout automático
        await auth.signOut();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        showToast('Senha incorreta ou erro ao reenviar', 'error');
    }
}

// ==================== INIT PASSWORD STRENGTH INDICATOR ====================
function initPasswordStrengthIndicator() {
    const passwordInput = document.getElementById('registerPassword');
    const strengthDiv = document.getElementById('passwordStrength');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');

    if (!passwordInput || !strengthDiv || !strengthBar || !strengthText) {
        return; // Silenciosamente retorna se elementos não existirem
    }

    passwordInput.addEventListener('input', (e) => {
        const password = e.target.value.trim();

        if (!password) {
            strengthDiv.style.display = 'none';
            strengthBar.style.width = '0%';
            strengthText.textContent = '';
            return;
        }

        strengthDiv.style.display = 'block';
        strengthDiv.setAttribute('role', 'status');
        strengthDiv.setAttribute('aria-live', 'polite');

        // Regras de força (5 critérios)
        const rules = [
            password.length >= 6,
            password.length >= 8,
            /[a-z]/.test(password) && /[A-Z]/.test(password),
            /\d/.test(password),
            /[^A-Za-z0-9]/.test(password)
        ];

        const score = rules.filter(Boolean).length;

        const levels = [
            { text: '🔴 Senha muito fraca', color: '#e74c3c', width: '20%' },
            { text: '🟠 Senha fraca', color: '#e67e22', width: '40%' },
            { text: '🟡 Senha razoável', color: '#f39c12', width: '60%' },
            { text: '🟢 Senha boa', color: '#27ae60', width: '80%' },
            { text: '✅ Senha forte! Pode prosseguir.', color: '#27ae60', width: '100%' }
        ];

        const level = levels[Math.min(score, levels.length - 1)];

        strengthBar.style.width = level.width;
        strengthBar.style.backgroundColor = level.color;
        strengthText.textContent = level.text;
        strengthText.style.color = level.color;
    });
}

// ==================== INIT PASSWORD MATCH FEEDBACK ====================
function initPasswordMatchFeedback() {
    const passwordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    const matchFeedback = document.getElementById('passwordMatchFeedback');

    if (!passwordInput || !confirmPasswordInput || !matchFeedback) {
        return; // Silenciosamente retorna se elementos não existirem
    }

    const checkMatch = () => {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!confirmPassword) {
            matchFeedback.style.display = 'none';
            return;
        }

        matchFeedback.style.display = 'block';
        matchFeedback.setAttribute('role', 'status');
        matchFeedback.setAttribute('aria-live', 'polite');

        if (password === confirmPassword) {
            matchFeedback.textContent = '✅ As senhas coincidem';
            matchFeedback.style.color = '#27ae60';
            confirmPasswordInput.classList.remove('input-error');
        } else {
            matchFeedback.textContent = '❌ As senhas não coincidem';
            matchFeedback.style.color = '#e74c3c';
            confirmPasswordInput.classList.add('input-error');
        }
    };

    passwordInput.addEventListener('input', checkMatch);
    confirmPasswordInput.addEventListener('input', checkMatch);
}

// ==================== INIT ALL FEATURES (CHAMADO AUTOMATICAMENTE) ====================
document.addEventListener('DOMContentLoaded', () => {
    initPasswordStrengthIndicator();
    initPasswordMatchFeedback();
    
    console.log('✅ Auth Module Loaded (Production-Grade v3.0 - Complete)');
});

// ==================== EXPORTS GLOBAIS (CRÍTICOS - NÃO REMOVER) ====================
window.userLogin = userLogin;
window.userRegister = userRegister;
window.userLogout = userLogout;
window.loginWithGoogle = loginWithGoogle;
window.validatePasswordStrength = validatePasswordStrength;
window.showToast = showToast;
window.updateUI = updateUI;
window.resetPassword = resetPassword;
window.resendVerificationEmail = resendVerificationEmail;
window.resendVerificationFromLogin = resendVerificationFromLogin;
window.switchUserTab = switchUserTab;
window.showLoggedInView = showLoggedInView;

// Máscara de Telefone
function maskPhone(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 10) {
        // Formato (11) 91234-5678
        value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 5) {
        // Formato (11) 1234-5678
        value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
        value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    }
    input.value = value;
}

// Máscara de CPF
function maskCPF(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    
    input.value = value;
}

function checkUserSession() {
    const user = auth.currentUser;
    
    if (user) {
        // Usuário logado
        document.getElementById('loginTab').classList.remove('active');
        document.getElementById('registerTab').classList.remove('active');
        document.getElementById('userLoggedTab').classList.add('active');
        
        document.getElementById('userName').textContent = user.displayName || 'Usuário';
        document.getElementById('userEmail').textContent = user.email;
        
        // Mostrar botão admin se necessário
        if (currentUser && currentUser.isAdmin) {
            document.getElementById('adminAccessBtn').style.display = 'block';
        }
    } else {
        // Usuário não logado
        document.getElementById('loginTab').classList.add('active');
        document.getElementById('userLoggedTab').classList.remove('active');
    }
}

window.checkUserSession = checkUserSession;
window.maskPhone = maskPhone;
window.maskCPF = maskCPF;
});
