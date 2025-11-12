document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÃO DO FIREBASE ---
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

    // --- VARIÁVEIS DE PRODUÇÃO ---
    const CLIENT_ID = "498596971317-p183rsbts6bpomv989r8ov46kt9idrtb.apps.googleusercontent.com";
    const REDIRECT_URI = "https://autopost-app.vercel.app/authCallback.html";

    const btnAuthorize = document.getElementById('btn-authorize');
    if (btnAuthorize) {
        btnAuthorize.addEventListener('click', handleAuthorization);
    }

    function handleAuthorization() {
        const scopes = [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube',
            'https://www.googleapis.com/auth/youtube.readonly'
        ].join(' ');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${encodeURIComponent(CLIENT_ID)}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&access_type=offline` +
            `&prompt=consent`;

        const popup = window.open(authUrl, 'authPopup', 'width=600,height=700');

        // Listener para receber mensagens do popup
        const handleAuthMessage = (event) => {
            // Verifica a origem por segurança (deve ser do mesmo domínio)
            if (event.origin !== window.location.origin) {
                return;
            }

            if (event.data.type === 'AUTH_CODE') {
                // Remove o listener após receber o código
                window.removeEventListener('message', handleAuthMessage);
                
                // Processa o código de autorização
                processAuthCode(event.data.code);
                
            } else if (event.data.type === 'AUTH_ERROR') {
                // Remove o listener
                window.removeEventListener('message', handleAuthMessage);
                
                // Exibe mensagem de erro
                const errorMessage = document.getElementById('auth-error-message');
                if (errorMessage) {
                    errorMessage.textContent = `Erro na autenticação: ${event.data.error}`;
                    errorMessage.style.display = 'block';
                }
            }
        };

        // Adiciona o listener
        window.addEventListener('message', handleAuthMessage);

        // Verifica se o popup foi fechado antes de completar (usuário cancelou)
        const checkPopupClosed = setInterval(() => {
            try {
                if (popup && popup.closed) {
                    clearInterval(checkPopupClosed);
                    window.removeEventListener('message', handleAuthMessage);
                    
                    // Opcional: mostrar mensagem que usuário cancelou
                    console.log('Popup foi fechado pelo usuário');
                }
            } catch (error) {
                // Ignora erros de COOP - não tenta acessar popup.closed se bloqueado
                clearInterval(checkPopupClosed);
            }
        }, 1000);
    }

    async function processAuthCode(code) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const errorMessage = document.getElementById('auth-error-message');
        
        if (loadingOverlay) loadingOverlay.style.display = 'flex';
        if (errorMessage) {
            errorMessage.textContent = '';
            errorMessage.style.display = 'none';
        }

        try {
            const functions = firebase.functions('us-central1');
            const exchangeAuthCode = functions.httpsCallable('exchangeAuthCode');

            const result = await exchangeAuthCode({ code: code });

            // Estrutura os dados finais para exibição
            const finalData = {
                id: result.data.channelInfo.id,
                title: result.data.channelInfo.title,
                customUrl: result.data.channelInfo.customUrl,
                refresh_token: result.data.oauth.refresh_token
            };

            const resultElement = document.getElementById('result');
            if(resultElement) {
                resultElement.textContent = JSON.stringify(finalData, null, 2);
            }
            
            const step1 = document.getElementById('step1');
            const step2 = document.getElementById('step2');
            if(step1) step1.style.display = 'none';
            if(step2) step2.style.display = 'block';
            
            // Re-inicializa os ícones Feather, se a biblioteca estiver presente
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

        } catch (error) {
            console.error("❌ Erro ao chamar a Cloud Function:", error);
            if (errorMessage) {
                errorMessage.textContent = `Erro: ${error.message || "Ocorreu um erro desconhecido."}`;
                errorMessage.style.display = 'block';
            }
        } finally {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }
    }

    const copyButton = document.getElementById('copy-button');
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            const resultText = document.getElementById('result').innerText;
            navigator.clipboard.writeText(resultText).then(() => {
                const originalText = copyButton.innerHTML;
                copyButton.innerHTML = 'Copiado!';
                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Erro ao copiar:', err);
                alert('Não foi possível copiar o texto.');
            });
        });
    }
});