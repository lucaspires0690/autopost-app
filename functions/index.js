const { onCall, HttpsError } = require("firebase-functions/v2/https" );
const { logger } = require("firebase-functions");
const { google } = require("googleapis");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

exports.exchangeAuthCode = onCall(
    // Voltando a usar a sintaxe de 'secrets'
    {
        secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
        region: "us-central1",
        cors: ["https://autopost-app.vercel.app"]
    },
    async (request ) => {
    
    logger.info("✅ [exchangeAuthCode] Gen 2 - Tentativa com sintaxe de secrets simplificada.");

    try {
        const code = request.data.code;
        if (!code) {
            throw new HttpsError("invalid-argument", "O código de autorização é obrigatório.");
        }

        // Lendo os segredos via process.env, como no início
        const clientId = process.env.YOUTUBE_CLIENT_ID;
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            logger.error("ERRO CRÍTICO: Segredos YOUTUBE_CLIENT_ID ou YOUTUBE_CLIENT_SECRET não foram injetados.");
            throw new HttpsError("internal", "Configuração de segredos do servidor falhou.");
        }

        const redirectUri = "https://autopost-app.vercel.app/authCallback.html";

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri );
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const youtube = google.youtube({ version: "v3", auth: oauth2Client });
        const channelResponse = await youtube.channels.list({
            part: "snippet,contentDetails",
            mine: true,
        });

        if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
            throw new HttpsError("not-found", "Nenhum canal do YouTube foi encontrado.");
        }

        const channel = channelResponse.data.items[0];
        logger.info(`✅ Sucesso! Canal encontrado: ${channel.snippet.title}`);

        return {
            status: "success",
            oauth: tokens,
            channelInfo: {
                id: channel.id,
                title: channel.snippet.title,
                customUrl: channel.snippet.customUrl || "N/A",
            },
        };

    } catch (error) {
        logger.error("❌ [exchangeAuthCode] ERRO com sintaxe de secrets simplificada:", error);
        throw new HttpsError("internal", "Erro no servidor com sintaxe de secrets.", error.message);
    }
});
