// authServer.js
const express = require('express');
const { google } = require('googleapis');
const open = require('open');
const path =path.join(__dirname, 'public', 'auth.html');
const cors = require('cors');

const app = express();
const port = 3000; // A porta onde nosso servidor local vai rodar

// Middlewares para processar JSON e habilitar CORS
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve arquivos estáticos (CSS, etc.)

let oAuth2Client; // Variável global para armazenar o cliente OAuth
let server; // Variável para controlar o servidor

// ROTA 1: Servir a página principal de autorização
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// ROTA 2: Recebe as credenciais e inicia o fluxo de autorização
app.post('/start-auth', (req, res) => {
    const { clientId, clientSecret } = req.body;

    if (!clientId || !clientSecret) {
        return res.status(400).json({ error: 'Client ID e Client Secret são obrigatórios.' });
    }

    const redirectUri = `http://localhost:${port}/oauth2callback`;
    oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri );

    const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.readonly'
    ];

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    } );

    console.log('?? Abrindo navegador para autorização...');
    open(authUrl); // Abre a URL no navegador padrão

    res.json({ message: 'Autorização iniciada. Verifique seu navegador.' });
});

// ROTA 3: Callback do Google, onde o código de autorização é recebido
app.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('<h1>Erro: Código de autorização não encontrado.</h1>');
    }

    try {
        console.log('? Obtendo tokens...');
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        console.log('? Tokens obtidos com sucesso!');

        if (!tokens.refresh_token) {
             return res.send(`
                <div style="font-family: sans-serif; padding: 20px; background: #fff3f3; border-left: 5px solid #ff0000;">
                    <h1>❌ Erro Crítico</h1>
                    <p>O <strong>Refresh Token</strong> não foi retornado pelo Google.</p>
                    <p>Isso geralmente acontece se você já autorizou este aplicativo antes.</p>
                    <strong>Como resolver:</strong>
                    <ol>
                        <li>Vá para <a href="https://myaccount.google.com/permissions" target="_blank">permissões da sua Conta Google</a>.</li>
                        <li>Encontre o aplicativo que você criou e <strong>remova o acesso</strong> dele.</li>
                        <li>Feche esta aba e tente o processo de autorização novamente.</li>
                    </ol>
                </div>
            ` );
        }

        const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
        const channelResponse = await youtube.channels.list({ part: 'snippet', mine: true });
        const channel = channelResponse.data.items[0];

        console.log('? Canal encontrado!');
        const finalData = {
            id: channel.id,
            title: channel.snippet.title,
            customUrl: channel.snippet.customUrl || '',
            refresh_token: tokens.refresh_token
        };

        // Exibe uma página de sucesso com os dados para o usuário copiar
        res.send(`
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 600px; width: 90%; }
                h1 { color: #2ecc71; }
                pre { background: #1e293b; color: #f8fafc; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-break: break-all; font-family: 'Courier New', Courier, monospace; }
                p { color: #334155; }
            </style>
            <div class="container">
                <h1>✅ Autorização Concluída!</h1>
                <p>Copie os dados abaixo e use no formulário "Adicionar Canal" do seu dashboard.</p>
                <pre id="result">${JSON.stringify(finalData, null, 2)}</pre>
                <p>Você já pode fechar esta aba e o terminal.</p>
            </div>
        `);

        console.log('\n+------------------------------------------------------------+');
        console.log('|                    ? TOKENS GERADOS                       |');
        console.log('+------------------------------------------------------------+');
        console.log(JSON.stringify(finalData, null, 2));
        console.log('\n?? Processo concluído. Pode fechar o servidor (Ctrl+C).');

        // Opcional: Desligar o servidor após o sucesso
        // setTimeout(() => server.close(), 5000);

    } catch (error) {
        console.error('? Erro ao processar autorização:', error.message);
        res.status(500).send('<h1>Ocorreu um erro ao processar a autorização. Verifique o console do servidor.</h1>');
    }
});

// Inicia o servidor
server = app.listen(port, () => {
    console.log(`+------------------------------------------------------------+`);
    console.log(`|   ?? SERVIDOR DE AUTORIZAÇÃO INICIADO                    |`);
    console.log(`+------------------------------------------------------------+`);
    console.log(`|  Acesse http://localhost:${port} no seu navegador         |` );
    console.log(`+------------------------------------------------------------+`);
});
