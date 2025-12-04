// ==================== VARIÁVEIS GLOBAIS DE ESTADO ====================
let currentUser = null;
let isAdminLoggedIn = false;

// ==================== PROMISE DE SINCRONIZAÇÃO ====================
// Garante que outros scripts possam aguardar a verificação inicial do auth.
window.authReady = new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe(); // Executa apenas uma vez na carga inicial
        resolve(user);
    });
});

// ==================== MAPA DE ERROS CENTRALIZADO (PT-BR) ====================
const FIREBASE_ERROR_MAP = {
    'auth/invalid-email': 'O formato do e-mail é inválido.',
    'auth/user-disabled': 'Esta conta de usuário foi desativada.',
    'auth/user-not-found': 'Nenhum usuário encontrado com este e-mail.',
    'auth/wrong-password': 'A senha está incorreta. Tente novamente.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado. Tente fazer login.',
    'auth/weak-password': 'A senha é muito fraca. Use pelo menos 8 caracteres com letras, números e símbolos.',
    'auth/requires-recent-login': 'Esta operação requer autenticação recente. Faça login novamente.',
    'auth/too-many-requests': 'Acesso bloqueado temporariamente devido a muitas tentativas. Tente mais tarde.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    'auth/popup-blocked': 'O popup de login foi bloqueado pelo navegador.',
    'auth/popup-closed-by-user': 'A janela de login foi fechada por você.',
    'auth/account-exists-with-different-credential': 'Uma conta já existe com este e-mail, mas com um método de login diferente.',
    'default': 'Ocorreu um erro inesperado. Por favor, tente novamente.'
};

// ==================== FUNÇÕES DE VALIDAÇÃO (HELPERS) ====================

/**
 * Valida um endereço de e-mail usando regex e uma blacklist de domínios temporários.
 * @param {string} email - O e-mail a ser validado.
 * @returns {boolean} - True se o e-mail for válido, false caso contrário.
 */
function validateEmail(email) {
    if (!email) return false;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!re.test(String(email).toLowerCase())) return false;

    const suspiciousDomains = ['tempmail', '10minutemail', 'mailinator'];
    const domain = email.split('@')[1];
    return !suspiciousDomains.some(d => domain.includes(d));
}

/**
 * Valida a força de uma senha com base em múltiplos critérios. [1, 3, 6]
 * @param {string} password - A senha a ser validada.
 * @returns {string|null} - Uma mensagem de erro se a senha for fraca, ou null se for forte.
 */
function validatePasswordStrength(password) {
    if (!password || password.length < 8) return 'A senha deve ter no mínimo 8 caracteres.';
    if (!/[A-Z]/.test(password)) return 'Deve conter pelo menos uma letra maiúscula.';
    if (!/[a-z]/.test(password)) return 'Deve conter pelo menos uma letra minúscula.';
    if (!/\d/.test(password)) return 'Deve conter pelo menos um número.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Deve conter pelo menos um símbolo (ex: !@#$).';
    return null; // Senha forte
}

// ==================== CONTROLE DE UI (FEEDBACK VISUAL) ====================

/**
 * Exibe uma notificação toast na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success'|'error'|'info'} type - O tipo de notificação.
 */
function showToast(message, type = 'info') {
    // Esta função já existe em script2.js e é bem implementada.
    // Apenas garantimos que ela seja chamada corretamente.
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.warn(`[Toast Fallback - ${type}]: ${message}`);
        alert(message);
    }
}

/**
 * Controla o estado de carregamento de um botão.
 * @param {HTMLButtonElement} button - O elemento do botão.
 * @param {boolean} isLoading - Define se o estado é de carregamento.
 * @param {string} originalText - O texto original do botão para restaurar.
 */
function setButtonLoading(button, isLoading, originalText) {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
        button.innerHTML = '<span class="btn-spinner"></span> Carregando...';
        button.classList.add('loading');
    } else {
        button.innerHTML = originalText;
        button.classList.remove('loading');
    }
}

/**
 * Exibe uma mensagem de erro ou sucesso em um formulário. [9, 10]
 * @param {string} formType - 'login' ou 'register'.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'error'|'success'} type - O tipo de mensagem.
 */
function showFormMessage(formType, message, type) {
    const errorEl = document.getElementById(`${formType}Error`);
    const successEl = document.getElementById(`${formType}Success`);

    if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
    if (successEl) {
        successEl.textContent = '';
        successEl.style.display = 'none';
    }

    if (type === 'error' && errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    } else if (type === 'success' && successEl) {
        successEl.innerHTML = message; // Usa innerHTML para permitir links
        successEl.style.display = 'block';
    }
}

// ==================== LÓGICA DE AUTENTICAÇÃO PRINCIPAL ====================

/**
 * Listener central que reage a mudanças no estado de autenticação do Firebase.
 * É o coração do sistema, sincronizando o estado da UI e das variáveis globais.
 */
auth.onAuthStateChanged(async (user) => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.remove('active');

    if (user && user.emailVerified) {
        // Usuário logado E verificado
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        let userData;

        if (adminDoc.exists && adminDoc.data().role === 'admin') {
            isAdminLoggedIn = true;
            userData = {
                uid: user.uid,
                name: adminDoc.data().name || user.displayName,
                email: user.email,
                isAdmin: true,
            };
        } else {
            isAdminLoggedIn = false;
            const userDoc = await db.collection('users').doc(user.uid).get();
            userData = {
                uid: user.uid,
                name: userDoc.exists() ? userDoc.data().name : user.displayName,
                email: user.email,
                isAdmin: false,
            };
        }
        currentUser = userData;
        localStorage.setItem('sejaVersatilCurrentUser', JSON.stringify(currentUser));

    } else {
        // Usuário não logado ou não verificado
        if (user && !user.emailVerified) {
            // Se o usuário existe mas não verificou o e-mail, força o logout para evitar estado inconsistente.
            await auth.signOut();
        }
        currentUser = null;
        isAdminLoggedIn = false;
        localStorage.removeItem('sejaVersatilCurrentUser');
    }

    // Sincroniza o estado com o escopo global para outros scripts
    window.currentUser = currentUser;
    window.isAdminLoggedIn = isAdminLoggedIn;

    // Dispara um evento customizado para que outros scripts (como script2.js) possam reagir
    document.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: currentUser } }));
    
    // Atualiza a UI do painel de usuário
    updateUserPanelUI(currentUser);
});

/**
 * Atualiza a interface do painel de usuário (Minha Conta).
 * @param {object|null} user - O objeto do usuário logado ou null.
 */
function updateUserPanelUI(user) {
    const userPanelTabs = document.getElementById('userPanelTabs');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loggedTab = document.getElementById('userLoggedTab');

    if (user) {
        // Usuário LOGADO
        if (userPanelTabs) userPanelTabs.style.display = 'none';
        if (loginTab) loginTab.classList.remove('active');
        if (registerTab) registerTab.classList.remove('active');

        if (loggedTab) {
            loggedTab.classList.add('active');
            document.getElementById('userName').textContent = user.name || 'Usuário';
            document.getElementById('userEmail').textContent = user.email;
            document.getElementById('adminAccessBtn').style.display = user.isAdmin ? 'block' : 'none';
            document.getElementById('userStatus').innerHTML = user.isAdmin ? 'Administrador <span class="admin-badge">ADMIN</span>' : 'Cliente';
        }
    } else {
        // Usuário DESLOGADO
        if (userPanelTabs) userPanelTabs.style.display = 'flex';
        if (loggedTab) loggedTab.classList.remove('active');
        // Garante que a aba de login seja a padrão ao abrir
        if (typeof switchUserTab === 'function') {
            switchUserTab('login');
        }
    }
}

/**
 * Processa a tentativa de login com e-mail and senha.
 */
async function userLogin(event) {
    event.preventDefault();
    const loginBtn = event.submitter;
    const originalText = loginBtn.textContent;
    setButtonLoading(loginBtn, true, originalText);

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        await userCredential.user.reload(); // Recarrega dados do usuário para pegar o status de verificação

        if (!userCredential.user.emailVerified) {
            await auth.signOut(); // Força logout
            const message = 'E-mail não verificado. <a href="#" onclick="resendVerificationEmail(\'' + email + '\')">Reenviar e-mail de verificação?</a>';
            showFormMessage('login', message, 'error');
            showToast('Verifique seu e-mail para ativar a conta.', 'error');
        } else {
            showToast('Login realizado com sucesso!', 'success');
            if (typeof closeUserPanel === 'function') closeUserPanel();
        }
    } catch (error) {
        const friendlyMessage = FIREBASE_ERROR_MAP[error.code] || FIREBASE_ERROR_MAP['default'];
        showFormMessage('login', friendlyMessage, 'error');
    } finally {
        setButtonLoading(loginBtn, false, originalText);
    }
}

/**
 * Processa o registro de um novo usuário. [2, 7, 12]
 */
async function userRegister(event) {
    event.preventDefault();
    const registerBtn = event.submitter;
    const originalText = registerBtn.textContent;

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    // Validações Front-end
    if (password !== confirmPassword) {
        return showFormMessage('register', 'As senhas não coincidem.', 'error');
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
        return showFormMessage('register', passwordError, 'error');
    }
    if (!validateEmail(email)) {
        return showFormMessage('register', 'O formato do e-mail é inválido.', 'error');
    }

    setButtonLoading(registerBtn, true, originalText);

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Salva dados no Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Atualiza o perfil do Firebase Auth
        await user.updateProfile({ displayName: name });

        // Envia e-mail de verificação
        await user.sendEmailVerification();

        // Força o logout para obrigar a verificação
        await auth.signOut();

        const successMessage = 'Conta criada! Um e-mail de verificação foi enviado. Por favor, verifique sua caixa de entrada (e spam) para ativar sua conta.';
        showFormMessage('register', successMessage, 'success');
        showToast('Verifique seu e-mail para concluir o cadastro!', 'success');
        
        // Desabilita o formulário para prevenir reenvio
        event.target.querySelectorAll('input, button').forEach(el => el.disabled = true);

    } catch (error) {
        const friendlyMessage = FIREBASE_ERROR_MAP[error.code] || FIREBASE_ERROR_MAP['default'];
        showFormMessage('register', friendlyMessage, 'error');
    } finally {
        // Não reativa o botão em caso de sucesso para evitar múltiplos cadastros
        if (!document.getElementById('registerSuccess').textContent) {
            setButtonLoading(registerBtn, false, originalText);
        }
    }
}

/**
 * Processa o login via Google.
 */
async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const isNewUser = result.additionalUserInfo.isNewUser;

        if (isNewUser) {
            // Se é um novo usuário, cria o documento no Firestore
            await db.collection('users').doc(user.uid).set({
                name: user.displayName,
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                provider: 'google'
            }, { merge: true });
        }
        
        showToast(`Bem-vindo(a), ${user.displayName}!`, 'success');
        if (typeof closeUserPanel === 'function') closeUserPanel();

    } catch (error) {
        // Trata o caso de popup bloqueado com redirecionamento
        if (error.code === 'auth/popup-blocked') {
            auth.signInWithRedirect(provider);
        } else {
            const friendlyMessage = FIREBASE_ERROR_MAP[error.code] || FIREBASE_ERROR_MAP['default'];
            showToast(friendlyMessage, 'error');
        }
    }
}

/**
 * Processa o logout do usuário.
 */
async function userLogout() {
    try {
        await auth.signOut();
        showToast('Você saiu da sua conta.', 'info');
    } catch (error) {
        showToast('Erro ao tentar sair da conta.', 'error');
    }
}

/**
 * Envia um e-mail de redefinição de senha.
 */
async function resetPassword() {
    const email = prompt("Digite o e-mail da sua conta para enviarmos o link de recuperação:");
    if (!validateEmail(email)) {
        if (email) showToast('E-mail inválido.', 'error'); // Só mostra toast se o usuário digitou algo
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        alert('Link de recuperação enviado! Verifique sua caixa de entrada e pasta de spam.');
    } catch (error) {
        const friendlyMessage = FIREBASE_ERROR_MAP[error.code] || FIREBASE_ERROR_MAP['default'];
        showToast(friendlyMessage, 'error');
    }
}

/**
 * Reenvia o e-mail de verificação para um usuário que tentou logar sem estar verificado.
 * @param {string} email - O e-mail do usuário.
 */
async function resendVerificationEmail(email) {
    const password = prompt("Para reenviar, por favor, confirme sua senha:");
    if (!password) return;

    try {
        // Tenta logar temporariamente para obter o objeto do usuário
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        await userCredential.user.sendEmailVerification();
        await auth.signOut(); // Desloga imediatamente após o envio
        alert('E-mail de verificação reenviado com sucesso! Verifique sua caixa de entrada.');
    } catch (error) {
        showToast('Senha incorreta ou erro ao reenviar. Tente novamente.', 'error');
    }
}


// ==================== EXPORTS GLOBAIS PARA O HTML ====================
window.userLogin = userLogin;
window.userRegister = userRegister;
window.userLogout = userLogout;
window.loginWithGoogle = loginWithGoogle;
window.resetPassword = resetPassword;
window.resendVerificationEmail = resendVerificationEmail;

console.log('✅ Auth Module v2.0 (by Manus) carregado com sucesso.');
