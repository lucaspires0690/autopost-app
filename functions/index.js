// functions/index.js - VERSÃO FINAL CORRIGIDA PARA LER CONFIG DA NUVEM

// Importa o 'functions' para usar o functions.config()
const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https" );
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");

// Função para inicializar o app apenas uma vez (Lazy Initialization)
const ensureFirebaseApp = () => {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
};

// ===================================================================
// FUNÇÃO: exchangeAuthCode (CORRIGIDA)
// ===================================================================
exports.exchangeAuthCode = onCall(async (request) => {
  ensureFirebaseApp();
  
  const { code } = request.data;
  
  // CORREÇÃO APLICADA AQUI:
  // Lendo as credenciais do "cofre" do Firebase que configuramos no terminal.
  const clientId = functions.config().youtube.client_id;
  const clientSecret = functions.config().youtube.client_secret;
  
  // URL de produção final
  const redirectUri = "https://autopost-app.vercel.app/authCallback.html";

  if (!code ) {
    logger.error("Tentativa de chamada sem código de autorização.");
    throw new HttpsError('invalid-argument', 'O código de autorização é obrigatório.');
  }

  // Verificação para garantir que as configurações foram carregadas
  if (!clientId || !clientSecret) {
    logger.error("ERRO CRÍTICO: Client ID ou Client Secret não foram carregados da configuração do Firebase. Verifique se 'firebase functions:config:set' foi executado corretamente.");
    throw new HttpsError('internal', 'Erro de configuração no servidor. Contate o suporte.');
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
    // Tratamento específico para o erro que vimos nos logs
    if (error.message.includes('invalid_client')) {
        throw new HttpsError('internal', 'Erro de autenticação do servidor (invalid_client). Verifique as credenciais no Firebase config.');
    }
    if (error.message.includes('invalid_grant')) {
      throw new HttpsError('invalid-argument', 'Código de autorização inválido ou expirado.');
    }
    throw new HttpsError('internal', 'Ocorreu um erro inesperado no servidor.');
  }
});

// ===================================================================
// FUNÇÃO: checkScheduledPosts (Sem alterações necessárias)
// ===================================================================
exports.checkScheduledPosts = onSchedule("every 5 minutes", async (event) => {
  ensureFirebaseApp();
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
  // Sua lógica de processamento de posts continua aqui
  // const tasks = snapshot.docs.map(doc => processScheduledPost(doc, db, bucket));
  // await Promise.allSettled(tasks);
  
  logger.info("=== Verificação de agendamentos concluída ===");
  return null;
});
