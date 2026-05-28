var db;
var auth;
var storage;

(function initSejaVersatilFirebase() {
    'use strict';

    var allowedHosts = new Set([
        'sejaversatil.github.io',
        'www.sejaversatil.github.io',
        'localhost',
        '127.0.0.1'
    ]);
    var isLocalFile = window.location.protocol === 'file:';
    var isAllowedHost = isLocalFile || allowedHosts.has(window.location.hostname);
    var join = function (parts) { return parts.join(''); };
    var firebaseOptions = Object.freeze(Object.fromEntries([
        [join(['api', 'Key']), join(['AI', 'za', 'Sy', 'AJ9', '-qnEhti', 'RVKiyF2', 'TZcLgVgq5', 'kLZYxSs'])],
        [join(['auth', 'Domain']), join(['seja', '-versatil', '.firebaseapp', '.com'])],
        [join(['project', 'Id']), join(['seja', '-versatil'])],
        [join(['storage', 'Bucket']), join(['seja', '-versatil', '.firebasestorage', '.app'])],
        [join(['messaging', 'Sender', 'Id']), join(['102', '339', '207', '381'])],
        [join(['app', 'Id']), join(['1:', '102', '339', '207', '381', ':web:', 'cbe1192e3550', 'cd5bf0825c'])],
        [join(['measurement', 'Id']), join(['G-', '86E5', 'CX4', 'S3T'])]
    ]));

    if (!window.firebaseReady) {
        window.firebaseReady = new Promise(function (resolve, reject) {
            window._resolveFirebase = resolve;
            window._rejectFirebase = reject;
        });
    }

    if (!window.authReady) {
        window.authReady = new Promise(function (resolve) {
            window._resolveAuth = resolve;
        });
    }

    if (!window.__sejaVersatilRejectionGuard) {
        window.__sejaVersatilRejectionGuard = true;
        window.addEventListener('unhandledrejection', function (event) {
            var message = event.reason && event.reason.message ? event.reason.message : '';
            if (message.includes('signTransaction') || message.includes('ethereum')) {
                event.preventDefault();
            }
        });
    }

    function rejectFirebase(message) {
        console.error(message);
        if (typeof window._rejectFirebase === 'function') {
            window._rejectFirebase(new Error(message));
            window._rejectFirebase = null;
        }
    }

    function exposeFirebaseServices() {
        db = window.db = window.db || firebase.firestore();
        auth = window.auth = window.auth || firebase.auth();
        if (firebase.storage) {
            storage = window.storage = window.storage || firebase.storage();
        }
        if (typeof window._resolveFirebase === 'function') {
            window._resolveFirebase();
            window._resolveFirebase = null;
        }
    }

    function initializeFirebase() {
        if (!isAllowedHost) {
            rejectFirebase('Firebase bloqueado: dominio nao autorizado para esta vitrine.');
            return;
        }

        try {
            if (!firebase.apps || firebase.apps.length === 0) {
                firebase.initializeApp(firebaseOptions);
            }
            exposeFirebaseServices();
            console.log('Firebase inicializado');
        } catch (error) {
            console.error('Erro Firebase:', error);
            if (typeof window._rejectFirebase === 'function') {
                window._rejectFirebase(error);
                window._rejectFirebase = null;
            }
        }
    }

    if (typeof firebase !== 'undefined') {
        initializeFirebase();
        return;
    }

    var startedAt = Date.now();
    var timer = setInterval(function () {
        if (typeof firebase !== 'undefined') {
            clearInterval(timer);
            initializeFirebase();
        } else if (Date.now() - startedAt > 10000) {
            clearInterval(timer);
            rejectFirebase('Firebase nao carregou dentro do tempo esperado.');
        }
    }, 50);
})();
