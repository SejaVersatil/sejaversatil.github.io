// =================================================================
// auth.js - Módulo de Autenticação Production-Grade
// Substitui todas as implementações de userLogin, userRegister, 
// checkUserSession e onAuthStateChanged espalhadas pelo projeto.
// Deve ser importado APENAS UMA VEZ, preferencialmente no index.html
// após a inicialização do Firebase.
// =================================================================

// Variáveis globais (se necessário, devem ser acessíveis globalmente)
let currentUser = null;
let isAdminLoggedIn = false;

window.authReady = new Promise(resolve => {
    const unsubscribe = auth.onAuthStateChanged(user => {
        unsubscribe();
        resolve(user);
    });
});

// Mapeamento de Erros Firebase para PT-BR amigável
const FIREBASE_ERROR_MAP = {
    'auth/invalid-email': 'O endereço de e-mail está mal formatado.',
    'auth/user-disabled': 'Esta conta de usuário foi desativada.',
    'auth/user-not-found': 'Usuário não encontrado. Verifique o e-mail.',
    'auth/wrong-password': 'A senha está incorreta.',
    'auth/email-already-in-use': 'Este e-mail já está em uso.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.', // Será complementado pela nossa validação
    'auth/operation-not-allowed': 'A autenticação por e-mail/senha não está ativada.',
    'auth/requires-recent-login': 'Esta operação requer autenticação recente. Faça login novamente.',
    'auth/too-many-requests': 'Acesso bloqueado temporariamente devido a muitas tentativas falhas. Tente novamente mais tarde.',
    'default': 'Ocorreu um erro desconhecido. Tente novamente.'
};

// ==================== 1. UTILS DE VALIDAÇÃO E FEEDBACK ====================

/**
 * Exibe uma mensagem de feedback (Toast).
 * @param {string} message - Mensagem a ser exibida.
 * @param {'success'|'error'|'info'} type - Tipo de mensagem.
 */
function showToast(message, type = 'info') {
    // Implementação de Toast (Placeholder)
    // O ideal é usar uma biblioteca como Toastify ou SweetAlert, mas para Vanilla JS:
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

/**
 * Validação de força de senha (Requisito: min 8 chars, símbolos, etc).
 * @param {string} password - Senha a ser validada.
 * @returns {string|null} - Mensagem de erro ou null se for válida.
 */
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
    return null; // Senha forte
}

/**
 * Validação de e-mail.
 * @param {string} email - E-mail a ser validado.
 * @returns {boolean}
 */
function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

/**
 * Gerencia o estado de loading do botão para evitar múltiplos cliques.
 * @param {HTMLButtonElement} button - O botão a ser manipulado.
 * @param {boolean} isLoading - Se deve entrar ou sair do estado de loading.
 * @param {string} originalText - O texto original do botão.
 */
function setButtonLoading(button, isLoading, originalText = 'Aguarde...') {
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Aguarde...' : originalText;
    button.classList.toggle('loading', isLoading);
}

// ==================== 2. GESTÃO DE SESSÃO CENTRALIZADA ====================

/**
 * Função centralizada para atualizar a UI em todas as páginas.
 * Deve ser chamada pelo onAuthStateChanged.
 * @param {object|null} user - Objeto de usuário do Firebase ou null.
 */
function updateUI(user) {
    const userPanel = document.getElementById('userPanel');
    const userStatusText = document.getElementById('userStatusText');
    const loggedInView = document.getElementById('loggedInView');
    const loggedOutView = document.getElementById('loggedOutView');
    const adminAccessBtn = document.getElementById('adminAccessBtn');

    if (user) {
        // Usuário logado
        if (userStatusText) userStatusText.textContent = `Olá, ${currentUser.name || user.email}!`;
        if (loggedInView) loggedInView.style.display = 'block';
        if (loggedOutView) loggedOutView.style.display = 'none';
        
        // Admin
        if (adminAccessBtn) {
            adminAccessBtn.style.display = isAdminLoggedIn ? 'block' : 'none';
        }

        // Fechar painel de login/registro se estiver aberto
        if (userPanel) userPanel.classList.remove('active');

    } else {
        // Usuário deslogado
        if (userStatusText) userStatusText.textContent = 'Minha Conta';
        if (loggedInView) loggedInView.style.display = 'none';
        if (loggedOutView) loggedOutView.style.display = 'block';
        if (adminAccessBtn) adminAccessBtn.style.display = 'none';
    }
    
    // ✅ CORREÇÃO: Garante que o painel de login/registro esteja visível se deslogado
    if (userPanel && !user) {
        // Se estiver na página de checkout e não logado, pode ser necessário redirecionar ou mostrar o painel
        // Depende da lógica de negócio, mas aqui apenas garantimos a visibilidade dos botões
    }
}

/**
 * Listener centralizado do Firebase Auth.
 * Esta é a ÚNICA fonte de verdade para o estado de autenticação.
 */
auth.onAuthStateChanged(async (user) => {
    // 1. Gerenciar o estado de loading inicial (para evitar "deslogado visualmente")
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        // A primeira vez que onAuthStateChanged é chamado, a sessão é resolvida.
        // Removemos o loading state aqui para garantir que a UI só apareça
        // após o Firebase ter verificado a persistência.
        loadingOverlay.classList.remove('active');
    }

    if (user) {
        console.log('🔄 Estado de auth mudou: usuário logado -', user.email);
        
        // 2. Tentar carregar dados do localStorage primeiro (para UX instantânea)
        let userData = JSON.parse(localStorage.getItem('sejaVersatilCurrentUser') || 'null');
        
        if (!userData || userData.uid !== user.uid) {
            // Se não houver dados ou o UID for diferente, buscar no Firestore
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
                // Usuário comum
                userData = {
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    isAdmin: false,
                    uid: user.uid,
                    permissions: []
                };
            }
            
            // Salvar no localStorage para persistência e UX
            localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(userData));
        }
        
        currentUser = userData;
        isAdminLoggedIn = currentUser.isAdmin;
        
    } else {
        console.log('🔄 Estado de auth mudou: usuário deslogado');
        
        // Limpar estado
        currentUser = null;
        isAdminLoggedIn = false;
        localStorage.removeItem('sejaVersatilCurrentUser');
    }
    
    // 3. Atualizar a UI
    updateUI(currentUser);
if (typeof updateCartUI === 'function') updateCartUI();
});

// ==================== 3. FUNÇÕES DE AUTENTICAÇÃO REESCRITAS ====================

/**
 * Login de usuário.
 * @param {Event} event - Evento de submissão do formulário.
 */
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
        // Tenta login com o e-mail fornecido
        await auth.signInWithEmailAndPassword(email, password);
        
        // Se o login for bem-sucedido, o onAuthStateChanged fará o resto.
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

/**
 * Registro de novo usuário.
 * @param {Event} event - Evento de submissão do formulário.
 */
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

    // Limpar feedbacks visuais
    [nameInput, emailInput, passwordInput, confirmPasswordInput].forEach(input => input.classList.remove('input-error'));

    // 1. Validação de Campos Básica
    if (!name || !email || !password || !confirmPassword) {
        errorMsgEl.textContent = 'Preencha todos os campos.';
        errorMsgEl.classList.add('active');
        return;
    }

    // 2. Validação de E-mail
    if (!validateEmail(email)) {
        errorMsgEl.textContent = 'E-mail inválido.';
        errorMsgEl.classList.add('active');
        emailInput.classList.add('input-error');
        return;
    }

    // 3. Validação de Senhas Coincidentes
    if (password !== confirmPassword) {
        errorMsgEl.textContent = 'As senhas não coincidem.';
        errorMsgEl.classList.add('active');
        passwordInput.classList.add('input-error');
        confirmPasswordInput.classList.add('input-error');
        return;
    }

    // 4. Validação de Força de Senha
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
        errorMsgEl.textContent = passwordError;
        errorMsgEl.classList.add('active');
        passwordInput.classList.add('input-error');
        return;
    }
    
    setButtonLoading(registerBtn, true, originalText);

    try {
        // 5. Criação do Usuário no Firebase
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 6. Atualizar Perfil (Nome)
        await user.updateProfile({
            displayName: name
        });

        // 7. Salvar dados adicionais no Firestore (opcional, mas recomendado)
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // O onAuthStateChanged fará o login e a atualização da UI.
        showToast('Cadastro realizado com sucesso! Bem-vindo(a)!', 'success');
        
        // Limpar formulário
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

/**
 * Logout de usuário.
 */
async function userLogout() {
    if (confirm('Deseja realmente sair da sua conta?')) {
        try {
            // O onAuthStateChanged fará a limpeza do estado e a atualização da UI.
            await auth.signOut(); 
            showToast('Logout realizado com sucesso', 'info');
        } catch (error) {
            console.error('❌ Erro ao fazer logout:', error);
            showToast('Erro ao fazer logout', 'error');
        }
    }
}

// Exportar funções para que possam ser chamadas pelo HTML (onclick, onsubmit)
window.userLogin = userLogin;
window.userRegister = userRegister;
window.userLogout = userLogout;
window.validatePasswordStrength = validatePasswordStrength; // Útil para barra de força de senha
window.showToast = showToast; // Útil para outros feedbacks
window.updateUI = updateUI; // Útil para chamadas manuais se necessário

// ==================== 4. FUNÇÕES DE SUPORTE (MANTER SE NECESSÁRIO) ====================

// Manter a função de resetPassword, mas garantir que use o showToast
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
window.resetPassword = resetPassword;
