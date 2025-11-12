const { onCall, HttpsError } = require("firebase-functions/v2/https" );
const { logger } = require("firebase-functions");
const { google } = require("googleapis");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

exports.exchangeAuthCode = onCall({
    region: "us-central1",
    secrets: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    cors: ["https://autopost-app.vercel.app"],
}, async (request ) => {
    
    logger.info("✅ [exchangeAuthCode] Gen 2 - Função invocada.");

    try {
        const code = request.data.code;
        if (!code) {
            throw new HttpsError("invalid-argument", "O código de autorização é obrigatório.");
        }

        const clientId = process.env.YOUTUBE_CLIENT_ID;
        const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
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
        logger.error("❌ [exchangeAuthCode] ERRO:", error);
        throw new HttpsError("internal", "Erro no servidor.", error.message);
    }
});
