// ARQUIVO: public/auth.js (COMPLETO, CORRIGIDO E LIMPO PARA A JANELA PRINCIPAL)

document.addEventListener('DOMContentLoaded', () => {
    // 1. CONFIGURAÇÃO DO FIREBASE
    const firebaseConfig = {
      apiKey: "AIzaSyCJyUdfldom5yTcaDkk4W1r8IGYxeO2epI",
      authDomain: "autopost-v2.firebaseapp.com",
      projectId: "autopost-v2",
      storageBucket: "autopost-v2.firebasestorage.app",
      messagingSenderId: "498596971317",
      appId: "1:498596971317:web:3e2536fe8e4fd28e0d427c"
    };
    
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const functions = firebase.functions();
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('uid');

    // 2. VERIFICAÇÃO INICIAL DE UID
    if (!userId) {
        document.body.innerHTML = `
            <div class="login-container">
                <div class="login-box">
                    <h1>❌ Erro de Sessão</h1>
                    <p>UID do usuário não encontrado. Por favor, acesse esta página através do dashboard.</p>
                </div>
            </div>`;
        return;
    }

    console.log('UID do usuário:', userId);

    const btnAuthorize = document.getElementById('btn-authorize');
    if (btnAuthorize) {
        btnAuthorize.addEventListener('click', startAuthFlow);
    }

    // ===================================================================
    // FUNÇÕES PRINCIPAIS
    // ===================================================================

    function startAuthFlow() {
        showLoading(true);
        // Scopes necessários
        const SCOPE = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl';
        
        // 🔥 CORREÇÃO CRÍTICA: REDIRECT_URI agora aponta para o Firebase (mesmo domínio da janela principal)
        const REDIRECT_URI = "https://autopost-v2.web.app/authCallback.html"; 
        
        // CLIENT_ID (do seu projeto Firebase/Google)
        const CLIENT_ID = '498596971317-hat8dm8k1ok204omfadfqnej9bsnpc69.apps.googleusercontent.com';
        
        // Gera um estado único para prevenção de CSRF
        const STATE = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('oauth_state', STATE);
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${CLIENT_ID}` +
            `&redirect_uri=${REDIRECT_URI}` +
            `&response_type=code` +
            `&scope=${SCOPE}` +
            `&access_type=offline` + // Necessário para obter refresh_token
            `&prompt=consent` +
            `&state=${STATE}|${userId}`; // Inclui o UID no estado

        console.log('Abrindo popup de autenticação...');
        window.open(authUrl, 'authPopup', 'width=600,height=700');
    }

    async function processAuthCode(code, state) {
        showLoading(true);
        
        const [stateToken, uid] = state.split('|');
        const expectedState = localStorage.getItem('oauth_state');

        if (stateToken !== expectedState) {
            showError('Erro de segurança: Estado OAuth inválido.');
            return;
        }

        try {
            const exchangeAuthCode = functions.httpsCallable('exchangeAuthCode');
            const result = await exchangeAuthCode({ code, state: stateToken, uid });
            
            console.log('Resultado da função do Firebase:', result.data);

            const step1 = document.getElementById('step1');
            const step2 = document.getElementById('step2');
            step1.style.display = 'none';
            step2.innerHTML = `
                <h2>✅ Canal Adicionado com Sucesso!</h2>
                <p>O canal "<strong>${escapeHtml(result.data.channelInfo.title)}</strong>" foi adicionado à sua conta.</p>
                <p>Você já pode fechar esta janela ou voltar para o dashboard.</p>
                <a href="index.html" class="btn btn-primary" style="text-decoration: none;">Voltar para o Dashboard</a>
            `;
            step2.style.display = 'block';

        } catch (error) {
            console.error('Erro ao processar código:', error);
            showError(`Erro no servidor: ${error.message}`);
        } finally {
            showLoading(false);
            localStorage.removeItem('oauth_state');
        }
    }


    // ===================================================================
    // 🔒 OUVINTE DE MENSAGENS (COM VALIDAÇÃO DE SEGURANÇA)
    // ===================================================================
    window.addEventListener('message', async (event) => {
        
        // 🚨 LOGS DE DIAGNÓSTICO: ESTAS MENSAGENS DEVEM AGORA APARECER NO CONSOLE
        console.log('*** EVENTO DE MENSAGEM RECEBIDO ***');
        console.log('Origem do Popup (event.origin):', event.origin); 
        console.log('Dados recebidos:', event.data); 
        // ---------------------------------------------

        // Lista de origens permitidas (Segurança: deve incluir o Firebase - mesmo domínio)
        const allowedOrigins = [
            'https://autopost-v2.web.app',     // Firebase Hosting (janela principal E popup)
            'https://autopost-v2.firebaseapp.com', // Firebase alternativo
            'http://localhost:5000'            // Desenvolvimento local
        ];

        // O popup envia a mensagem com '*', mas o auth.js a valida por segurança.
        if (!allowedOrigins.includes(event.origin)) {
            console.error('❌ ORIGEM NÃO PERMITIDA. URL rejeitada:', event.origin);
            return;
        }

        if (event.data.type === 'AUTH_CODE') {
            console.log('Código de autorização recebido!');
            await processAuthCode(event.data.code, event.data.state);
        } else if (event.data.type === 'AUTH_ERROR') {
            showLoading(false);
            showError(`Erro de autorização: ${event.data.error}`);
        }
    });


    // ===================================================================
    // FUNÇÕES UTILITÁRIAS
    // ===================================================================

    function showError(message) {
        const errorMessage = document.getElementById('auth-error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    }

    function showLoading(show) {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

}); // Fim do DOMContentLoaded