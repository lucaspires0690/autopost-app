// public/auth.js

document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÃO DO FIREBASE ---
    // Substitua pelos dados do seu projeto Firebase
    const firebaseConfig = {
      apiKey: "AIzaSyCJyUdfldom5yTcaDkk4W1r8IGYxeO2epI",
      authDomain: "autopost-v2.firebaseapp.com",
      projectId: "autopost-v2",
      storageBucket: "autopost-v2.appspot.com",
      messagingSenderId: "498596971317",
      appId: "1:498596971317:web:3e2536fe8e4fd28e0d427c"
    };
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // --- VARIÁVEIS DE PRODUÇÃO ---
    // Substitua pelo seu Client ID do Google Cloud
    const CLIENT_ID = "498596971317-p183rsbts6bpomv989r8ov46kt9idrtb.apps.googleusercontent.com";
    // URL de produção final
    const REDIRECT_URI = "https://autopost-app.vercel.app/authCallback.html";

    const btnAuthorize = document.getElementById('btn-authorize' );
    if (btnAuthorize) {
        btnAuthorize.addEventListener('click', handleAuthorization);
    }

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

        const popup = window.open(authUrl, 'authPopup', 'width=600,height=700');

        const interval = setInterval(() => {
            try {
                if (popup.closed) {
                    clearInterval(interval);
                    return;
                }
                const code = localStorage.getItem('authorization_code');
                if (code) {
                    clearInterval(interval);
                    localStorage.removeItem('authorization_code');
                    popup.close();
                    processAuthCode(code);
                }
            } catch (error) {
                // Ignora erros de cross-origin
            }
        }, 500);
    }

    async function processAuthCode(code) {
        showLoading(true);
        displayError('');

        try {
            const exchangeAuthCode = firebase.functions().httpsCallable('exchangeAuthCode' );
            const result = await exchangeAuthCode({ code: code });

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
            
            if (typeof feather !== 'undefined') feather.replace();

        } catch (error) {
            console.error("❌ Erro ao processar código:", error);
            displayError(error.message || "Ocorreu um erro desconhecido.");
        } finally {
            showLoading(false);
        }
    }

    // --- Funções Auxiliares de UI ---
    function showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = show ? 'flex' : 'none';
    }

    function displayError(message) {
        const errorElement = document.getElementById('auth-error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = message ? 'block' : 'none';
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
                alert('Erro ao copiar.');
            });
        });
    }
});
