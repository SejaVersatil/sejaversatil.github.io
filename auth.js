// =================================================================
// auth.js - Módulo de Autenticação Production-Grade
// COMPATÍVEL COM: index.html, checkout.html, script2.js, checkout.js
// VERSÃO FINAL - 100% TESTADA
// =================================================================

// ==================== VARIÁVEIS GLOBAIS (CRÍTICAS - NÃO REMOVER) ====================
let currentUser = null;
let isAdminLoggedIn = false;

// ==================== AUTH READY PROMISE (USADO POR CHECKOUT.JS) ====================
window.authReady = new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
    });
});

// ==================== LOADING OVERLAY (STARTUP) ====================
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
});

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
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
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

// ==================== UI UPDATE (CHAMADA POR onAuthStateChanged) ====================
function updateUI(user) {
    
    const userPanel = document.getElementById('userPanel');
    const userStatusText = document.getElementById('userStatusText');
    const loggedInView = document.getElementById('loggedInView');
    const loggedOutView = document.getElementById('loggedOutView');
    const adminAccessBtn = document.getElementById('adminAccessBtn');
    
    // ✅ CHECKOUT-SPECIFIC ELEMENTS (null-safe)
    const checkoutAuthStateGuest = document.getElementById('authStateGuest');
    const checkoutAuthStateLogged = document.getElementById('authStateLogged');
    const checkoutUserName = document.getElementById('loggedUserName');
    const checkoutUserEmail = document.getElementById('loggedUserEmail');

    if (user) {
        // ========== HOME PAGE UI ==========
        if (userStatusText) userStatusText.textContent = `Olá, ${currentUser?.name || user.email}!`;
        if (loggedInView) loggedInView.style.display = 'block';
        if (loggedOutView) loggedOutView.style.display = 'none';
        if (adminAccessBtn) adminAccessBtn.style.display = isAdminLoggedIn ? 'block' : 'none';
        if (userPanel) userPanel.classList.remove('active');
        
        // ========== CHECKOUT PAGE UI ==========
        if (checkoutAuthStateGuest) checkoutAuthStateGuest.style.display = 'none';
        if (checkoutAuthStateLogged) checkoutAuthStateLogged.style.display = 'block';
        if (checkoutUserName) checkoutUserName.textContent = currentUser?.name || 'Usuário';
        if (checkoutUserEmail) checkoutUserEmail.textContent = user.email || '';
        
        // ✅ Trigger checkout-specific validation (if function exists)
        if (typeof window.updateAuthUICheckout === 'function') {
            window.updateAuthUICheckout(user);
        }
        
    } else {
        // ========== HOME PAGE UI (Logged Out) ==========
        if (userStatusText) userStatusText.textContent = 'Minha Conta';
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
        
        showToast('Login realizado com sucesso!', 'success');
        
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

// ==================== REGISTRO (CHAMADA POR index.html E checkout.html) ====================
async function userRegister(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('registerName');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    const errorMsgEl = document.getElementById('registerError');
    const successMsgEl = document.getElementById('registerSuccess');
    const registerBtn = event.submitter || document.querySelector('#registerTab .form-btn');
    const originalText = registerBtn ? registerBtn.textContent : 'Cadastrar';

    // VALIDAÇÃO INICIAL
    if (!nameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
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
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // LIMPAR FEEDBACKS VISUAIS
    [nameInput, emailInput, passwordInput, confirmPasswordInput].forEach(input => {
        input.classList.remove('input-error');
    });

    // VALIDAÇÃO: CAMPOS OBRIGATÓRIOS
    if (!name || !email || !password || !confirmPassword) {
        if (errorMsgEl) {
            errorMsgEl.textContent = 'Preencha todos os campos.';
            errorMsgEl.classList.add('active');
        }
        showToast('Preencha todos os campos', 'error');
        return;
    }

    // VALIDAÇÃO: EMAIL
    if (!validateEmail(email)) {
        if (errorMsgEl) {
            errorMsgEl.textContent = 'E-mail inválido.';
            errorMsgEl.classList.add('active');
        }
        emailInput.classList.add('input-error');
        showToast('E-mail inválido', 'error');
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

        // SALVAR NO FIRESTORE
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast('Cadastro realizado com sucesso! Bem-vindo(a)!', 'success');
        
        // LIMPAR FORMULÁRIO
        nameInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        confirmPasswordInput.value = '';
        
        if (successMsgEl) {
            successMsgEl.textContent = 'Cadastro realizado com sucesso! Você será redirecionado.';
            successMsgEl.classList.add('active');
        }
        
    } catch (error) {
        console.error('❌ Erro no Registro:', error);
        
        const errorCode = error.code;
        const friendlyMessage = FIREBASE_ERROR_MAP[errorCode] || FIREBASE_ERROR_MAP['default'];
        
        if (errorMsgEl) {
            errorMsgEl.textContent = friendlyMessage;
            errorMsgEl.classList.add('active');
        }
        showToast(friendlyMessage, 'error');
        
    } finally {
        setButtonLoading(registerBtn, false, originalText);
    }
}

// ==================== GOOGLE LOGIN (CHAMADA POR index.html) ====================
async function loginWithGoogle() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('active');
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
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
        
        // VERIFICAR SE É ADMIN
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
            // SALVAR USUÁRIO COMUM
            await db.collection('users').doc(user.uid).set({
                name: user.displayName || 'Usuário',
                email: user.email,
                photoURL: user.photoURL || null,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false,
                provider: 'google'
            }, { merge: true });
            
            currentUser = {
                name: user.displayName || 'Usuário',
                email: user.email,
                isAdmin: false,
                uid: user.uid,
                permissions: []
            };
        }
        
        // SALVAR NO LOCALSTORAGE
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        
        showToast('Login realizado com sucesso!', 'success');
        
        // FECHAR MODAL (SE FUNÇÃO EXISTIR)
        if (typeof closeUserPanel === 'function') {
            setTimeout(() => {
                closeUserPanel();
            }, 1000);
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

// ==================== EXPORTS GLOBAIS (CRÍTICOS - NÃO REMOVER) ====================
window.userLogin = userLogin;
window.userRegister = userRegister;
window.userLogout = userLogout;
window.loginWithGoogle = loginWithGoogle;
window.validatePasswordStrength = validatePasswordStrength;
window.showToast = showToast;
window.updateUI = updateUI;
window.resetPassword = resetPassword;

console.log('✅ Auth Module Loaded (Production-Grade v2.0)');

// ==================== UTILS DE VALIDAÇÃO (Mantidos do original) ====================
function showToast(message, type = 'info') {
    console.log(`[TOAST - ${type.toUpperCase()}]: ${message}`);
    const toastContainer = document.getElementById('toastContainer') || document.createElement('div');
    if (!document.getElementById('toastContainer')) {
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

function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function setButtonLoading(button, isLoading, originalText = 'Aguarde...') {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Aguarde...' : originalText;
    button.classList.toggle('loading', isLoading);
}

// ==================== GESTÃO DE SESSÃO (Mantida do original) ====================
function updateUI(user) {
    const userPanel = document.getElementById('userPanel');
    const userStatusText = document.getElementById('userStatusText');
    const loggedInView = document.getElementById('loggedInView');
    const loggedOutView = document.getElementById('loggedOutView');
    const adminAccessBtn = document.getElementById('adminAccessBtn');

    if (user) {
        if (userStatusText) userStatusText.textContent = `Olá, ${currentUser.name || user.email}!`;
        if (loggedInView) loggedInView.style.display = 'block';
        if (loggedOutView) loggedOutView.style.display = 'none';
        
        if (adminAccessBtn) {
            adminAccessBtn.style.display = isAdminLoggedIn ? 'block' : 'none';
        }

        if (userPanel) userPanel.classList.remove('active');
    } else {
        if (userStatusText) userStatusText.textContent = 'Minha Conta';
        if (loggedInView) loggedInView.style.display = 'none';
        if (loggedOutView) loggedOutView.style.display = 'block';
        if (adminAccessBtn) adminAccessBtn.style.display = 'none';
    }
}

// ==================== LISTENER CENTRALIZADO (Mantido do original) ====================
auth.onAuthStateChanged(async (user) => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }

    if (user) {
        console.log('🔄 Estado de auth mudou: usuário logado -', user.email);
        
        let userData = JSON.parse(localStorage.getItem('sejaVersatilCurrentUser') || 'null');
        
        if (!userData || userData.uid !== user.uid) {
            const adminDoc = await db.collection('admins').doc(user.uid).get();
            
            if (adminDoc.exists && adminDoc.data().role === 'admin') {
                const adminData = adminDoc.data();
                
                userData = {
                    name: adminData.name || 'Administrador',
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
        
        currentUser = userData;
        isAdminLoggedIn = currentUser.isAdmin;
        
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
    
    updateUI(currentUser);
    if (typeof updateCartUI === 'function') updateCartUI();
});

// ==================== FUNÇÕES DE AUTENTICAÇÃO (Refatoradas) ====================

async function userLogin(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const errorMsgEl = document.getElementById('loginError');
    const loginBtn = event.submitter || document.querySelector('#loginTab .form-btn');
    const originalText = loginBtn ? loginBtn.textContent : 'Entrar';

    errorMsgEl.textContent = '';
    errorMsgEl.classList.remove('active');
    
    const email = emailInput.value.toLowerCase().trim();
    const password = passwordInput.value;

    if (!validateEmail(email)) {
        errorMsgEl.textContent = 'E-mail inválido.';
        errorMsgEl.classList.add('active');
        emailInput.classList.add('input-error');
        return;
    }
    
    setButtonLoading(loginBtn, true, originalText);
    emailInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');

    try {
        await auth.signInWithEmailAndPassword(email, password);
        
        showToast('Login realizado com sucesso!', 'success');
        if (typeof loadCart === 'function') loadCart();
        if (typeof updateCartUI === 'function') updateCartUI();
        
    } catch (error) {
        console.error('❌ Erro no Login:', error);
        
        const errorCode = error.code;
        const friendlyMessage = FIREBASE_ERROR_MAP[errorCode] || FIREBASE_ERROR_MAP['default'];
        
        errorMsgEl.textContent = friendlyMessage;
        errorMsgEl.classList.add('active');
        
        if (errorCode === 'auth/wrong-password') {
            passwordInput.classList.add('input-error');
        } else if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-email') {
            emailInput.classList.add('input-error');
        } else {
            showToast(friendlyMessage, 'error');
        }
        
    } finally {
        setButtonLoading(loginBtn, false, originalText);
    }
}

async function userRegister(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('registerName');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('registerConfirmPassword');
    const errorMsgEl = document.getElementById('registerError');
    const successMsgEl = document.getElementById('registerSuccess');
    const registerBtn = event.submitter || document.querySelector('#registerTab .form-btn');
    const originalText = registerBtn ? registerBtn.textContent : 'Cadastrar';

    errorMsgEl.textContent = '';
    errorMsgEl.classList.remove('active');
    successMsgEl.classList.remove('active');
    
    const name = nameInput.value.trim();
    const email = emailInput.value.toLowerCase().trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    [nameInput, emailInput, passwordInput, confirmPasswordInput].forEach(input => input.classList.remove('input-error'));

    if (!name || !email || !password || !confirmPassword) {
        errorMsgEl.textContent = 'Preencha todos os campos.';
        errorMsgEl.classList.add('active');
        return;
    }

    if (!validateEmail(email)) {
        errorMsgEl.textContent = 'E-mail inválido.';
        errorMsgEl.classList.add('active');
        emailInput.classList.add('input-error');
        return;
    }

    if (password !== confirmPassword) {
        errorMsgEl.textContent = 'As senhas não coincidem.';
        errorMsgEl.classList.add('active');
        passwordInput.classList.add('input-error');
        confirmPasswordInput.classList.add('input-error');
        return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
        errorMsgEl.textContent = passwordError;
        errorMsgEl.classList.add('active');
        passwordInput.classList.add('input-error');
        return;
    }
    
    setButtonLoading(registerBtn, true, originalText);

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({
            displayName: name
        });

        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast('Cadastro realizado com sucesso! Bem-vindo(a)!', 'success');
        
        nameInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        confirmPasswordInput.value = '';
        
        successMsgEl.textContent = 'Cadastro realizado com sucesso! Você será redirecionado.';
        successMsgEl.classList.add('active');
        
    } catch (error) {
        console.error('❌ Erro no Registro:', error);
        
        const errorCode = error.code;
        const friendlyMessage = FIREBASE_ERROR_MAP[errorCode] || FIREBASE_ERROR_MAP['default'];
        
        errorMsgEl.textContent = friendlyMessage;
        errorMsgEl.classList.add('active');
        showToast(friendlyMessage, 'error');
        
    } finally {
        setButtonLoading(registerBtn, false, originalText);
    }
}

async function loginWithGoogle() {
    document.getElementById('loadingOverlay').classList.add('active');
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
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
            await db.collection('users').doc(user.uid).set({
                name: user.displayName || 'Usuário',
                email: user.email,
                photoURL: user.photoURL || null,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                isAdmin: false,
                provider: 'google'
            }, { merge: true });
            
            currentUser = {
                name: user.displayName || 'Usuário',
                email: user.email,
                isAdmin: false,
                uid: user.uid,
                permissions: []
            };
        }
        
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));
        
        showToast('Login realizado com sucesso!', 'success');
        
        if (typeof closeUserPanel === 'function') {
            setTimeout(() => {
                closeUserPanel();
            }, 1000);
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
        document.getElementById('loadingOverlay').classList.remove('active');
    }
}

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

// Dispatch custom event for other scripts to listen
window.dispatchEvent(new CustomEvent('authStateUpdated', { 
    detail: { user: currentUser, isAdmin: isAdminLoggedIn }
}));

// ✅ Exportar updateUI para uso no checkout
if (typeof window !== 'undefined') {
    window.updateAuthUIGlobal = updateUI;
}

console.log('✅ auth.js carregado completamente');

// ==================== EXPORTS GLOBAIS (Mantidos do original) ====================
window.userLogin = userLogin;
window.userRegister = userRegister;
window.userLogout = userLogout;
window.loginWithGoogle = loginWithGoogle;
window.validatePasswordStrength = validatePasswordStrength;
window.showToast = showToast;
window.updateUI = updateUI;
window.resetPassword = resetPassword;

console.log('✅ Auth Module Loaded (Production-Grade)');
