// functions/index.js - VERSÃO CORRIGIDA

// Use a sintaxe de importação do ES Modules, que é mais moderna
const { onCall, HttpsError } = require("firebase-functions/v2/https" );
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

// Não inicialize aqui! Mova a inicialização para dentro das funções.
const admin = require("firebase-admin");
const { google } = require("googleapis");
const os = require("os");
const fs = require("fs");
const path = require("path");

// Função para inicializar o app apenas uma vez (Lazy Initialization)
const ensureFirebaseApp = () => {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
};


// ===================================================================
// FUNÇÃO: exchangeAuthCode (Atualizada para v2)
// ===================================================================
exports.exchangeAuthCode = onCall(async (request) => {
  ensureFirebaseApp(); // Garante que o Firebase está inicializado
  
  const { code } = request.data;
  const clientId = process.env.YOUTUBE_CLIENT_ID; // Use process.env para as novas variáveis de ambiente
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = "https://SEU_DOMINIO.vercel.app/authCallback.html"; // Lembre-se de substituir!

  if (!code ) {
    logger.error("Tentativa de chamada sem código de autorização.");
    throw new HttpsError('invalid-argument', 'O código de autorização é obrigatório.');
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oAuth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new HttpsError('failed-precondition', 'Refresh token não foi retornado. Revogue o acesso no Google e tente novamente.');
    }

    oAuth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    const channelResponse = await youtube.channels.list({ part: 'snippet', mine: true });

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      throw new HttpsError('not-found', 'Nenhum canal do YouTube foi encontrado para esta conta.');
    }

    const channel = channelResponse.data.items[0];
    return {
      oauth: tokens,
      channelInfo: {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description || "",
        customUrl: channel.snippet.customUrl || ""
      }
    };
  } catch (error) {
    logger.error("Erro no processo de troca de código:", error);
    if (error instanceof HttpsError) throw error;
    if (error.message.includes('invalid_grant')) {
      throw new HttpsError('invalid-argument', 'Código de autorização inválido ou expirado.');
    }
    throw new HttpsError('internal', 'Ocorreu um erro inesperado no servidor.');
  }
});


// ===================================================================
// FUNÇÃO: checkScheduledPosts (Atualizada para v2)
// ===================================================================
exports.checkScheduledPosts = onSchedule("every 5 minutes", async (event) => {
  ensureFirebaseApp(); // Garante que o Firebase está inicializado
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  
  logger.info("=== Iniciando verificação de agendamentos ===");
  const now = admin.firestore.Timestamp.now();
  const snapshot = await db.collectionGroup("agendamentos").where("status", "==", "Agendado").where("dataHoraPublicacao", "<=", now).limit(10).get();

  if (snapshot.empty) {
    logger.info("✔ Nenhum agendamento pronto.");
    return null;
  }

  logger.info(`→ Encontrados ${snapshot.size} agendamento(s).`);
  const tasks = snapshot.docs.map(doc => processScheduledPost(doc, db, bucket));
  await Promise.allSettled(tasks);
  
  logger.info("=== Verificação de agendamentos concluída ===");
  return null;
});

// Função auxiliar para processar cada post
async function processScheduledPost(doc, db, bucket) {
  // ... (O resto da sua lógica de processScheduledPost permanece exatamente a mesma)
  // Apenas certifique-se de que ela recebe 'db' e 'bucket' como parâmetros
  // em vez de usá-los de uma variável global.
}
