// public/auth.js
document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "SUA_API_KEY",
        authDomain: "SEU_AUTH_DOMAIN",
        projectId: "SEU_PROJECT_ID",
        // ...resto da config
    };
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // --- SUAS VARIÁVEIS DE PRODUÇÃO ---
    const CLIENT_ID = "SEU_CLIENT_ID.apps.googleusercontent.com"; // O mesmo do Google Cloud
    const REDIRECT_URI = "https://SEU_DOMINIO.vercel.app/authCallback.html"; // O URI de callback

    const btnAuthorize = document.getElementById('btn-authorize' );
    btnAuthorize.addEventListener('click', () => {
        handleAuthorization();
    });

    function handleAuthorization() {
        const scopes = [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube',
            'https://www.googleapis.com/auth/youtube.readonly'
        ].join(' ' );

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${encodeURIComponent(CLIENT_ID )}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&access_type=offline` +
            `&prompt=consent`;

        // Abre a autorização em um popup
        const popup = window.open(authUrl, 'authPopup', 'width=600,height=700');

        // Escuta quando o código de autorização estiver pronto
        const interval = setInterval(() => {
            try {
                // Se o popup foi fechado pelo usuário
                if (popup.closed) {
                    clearInterval(interval);
                    return;
                }
                // Verifica se o código foi salvo no localStorage pela página de callback
                const code = localStorage.getItem('authorization_code');
                if (code) {
                    clearInterval(interval);
                    localStorage.removeItem('authorization_code'); // Limpa o código
                    popup.close(); // Fecha o popup
                    processAuthCode(code); // Processa o código
                }
            } catch (error) {
                // Ignora erros de cross-origin que acontecem antes do redirecionamento
            }
        }, 500); // Verifica a cada meio segundo
    }

    async function processAuthCode(code) {
        showLoading(true);
        displayError(''); // Limpa erros antigos

        try {
            // Chama a Cloud Function que você já tem!
            const exchangeAuthCode = firebase.functions().httpsCallable('exchangeAuthCode' );
            const result = await exchangeAuthCode({ code: code }); // Envia apenas o código

            const finalData = {
                id: result.data.channelInfo.id,
                title: result.data.channelInfo.title,
                customUrl: result.data.channelInfo.customUrl,
                refresh_token: result.data.oauth.refresh_token
            };

            document.getElementById('result').textContent = JSON.stringify(finalData, null, 2);
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step2').style.display = 'block';
            feather.replace();

        } catch (error) {
            console.error("❌ Erro ao processar código:", error);
            displayError(error.message || "Ocorreu um erro desconhecido.");
        } finally {
            showLoading(false);
        }
    }

    // Funções auxiliares (showLoading, displayError, copy-button)
    // ... (mantenha as funções que você já tem para UI)
});
