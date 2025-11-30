// ARQUIVO: functions/index.js (VERSÃO COM LIMPEZA AUTOMÁTICA APÓS 24H)

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { google } = require("googleapis");

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();

// ✅ FUNÇÃO DE POSTAGEM COM AGENDAMENTO DE 30 MINUTOS APÓS O UPLOAD
exports.verificarEPostarVideos = onSchedule({
    schedule: "every 5 minutes",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
}, async (event) => {
    logger.info("Robo de postagem v2 iniciado...");
    
    const CLIENT_ID = "498596971317-hat8dm8k1ok204omfadfqnej9bsnpc69.apps.googleusercontent.com";
    const CLIENT_SECRET = "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";
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    
    const agora = Timestamp.now();
    const agendamentosPendentes = await db.collectionGroup("agendamentos")
        .where("status", "==", "agendado")
        .where("dataPostagem", "<=", agora)
        .get();
    
    if (agendamentosPendentes.empty) {
        logger.info("Nenhum agendamento pendente. Robo vai dormir.");
        return;
    }

    logger.info(`Encontrados ${agendamentosPendentes.size} agendamentos para processar.`);
    
    const promessas = agendamentosPendentes.docs.map(async (doc) => {
        const agendamento = doc.data();
        const docRef = doc.ref;
        const channelDocRef = docRef.parent.parent;
        
        try {
            await docRef.update({ status: "processando" });
            
            const channelDoc = await channelDocRef.get();
            const refreshToken = channelDoc.data()["oauth.refresh_token"];
            if (!refreshToken) {
                throw new Error(`Refresh token nao encontrado para o canal ${channelDoc.id}.`);
            }
            
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });
            
            const userId = channelDocRef.parent.parent.id;
            const channelId = channelDocRef.id;
            const videoPath = `canais/${userId}/${channelId}/videos/${agendamento.nome_video}`;
            const videoStream = bucket.file(videoPath).createReadStream();

            // ETAPA 1: Upload do vídeo como PRIVADO
            logger.info(`Iniciando upload do video "${agendamento.titulo}" como privado...`);
            const response = await youtube.videos.insert({
                part: "snippet,status",
                requestBody: {
                    snippet: { 
                        title: agendamento.titulo, 
                        description: agendamento.descricao, 
                        tags: agendamento.tags 
                    },
                    status: { 
                        privacyStatus: "private" 
                    }
                },
                media: { body: videoStream }
            });

            const videoId = response.data.id;
            logger.info(`Upload concluido! Video ID: ${videoId}`);

            // ETAPA 2: Enviar thumbnail ANTES de agendar
            logger.info(`Verificando thumbnail. Campo nome_thumbnail: ${agendamento.nome_thumbnail}`);
            
            if (agendamento.nome_thumbnail) {
                try {
                    const thumbPath = `canais/${userId}/${channelId}/thumbnails/${agendamento.nome_thumbnail}`;
                    logger.info(`Tentando enviar thumbnail do caminho: ${thumbPath}`);
                    
                    const thumbFile = bucket.file(thumbPath);
                    
                    const [exists] = await thumbFile.exists();
                    if (!exists) {
                        logger.error(`ERRO: Thumbnail nao encontrada no caminho: ${thumbPath}`);
                    } else {
                        logger.info(`Thumbnail encontrada! Verificando propriedades...`);
                        
                        const [metadata] = await thumbFile.getMetadata();
                        logger.info(`Tamanho do arquivo: ${metadata.size} bytes`);
                        logger.info(`Content-Type: ${metadata.contentType}`);
                        
                        const [thumbBuffer] = await thumbFile.download();
                        
                        const Readable = require('stream').Readable;
                        const thumbStream = new Readable();
                        thumbStream.push(thumbBuffer);
                        thumbStream.push(null);
                        
                        await youtube.thumbnails.set({ 
                            videoId: videoId, 
                            media: { 
                                body: thumbStream,
                                mimeType: metadata.contentType || 'image/png'
                            } 
                        });
                        
                        logger.info(`✅ THUMBNAIL ENVIADA COM SUCESSO para o video ${videoId}`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (thumbError) {
                    logger.error(`ERRO ao enviar thumbnail: ${thumbError.message}`);
                    logger.error(`Stack do erro: ${thumbError.stack}`);
                    if (thumbError.response?.data) {
                        logger.error(`Resposta da API: ${JSON.stringify(thumbError.response.data)}`);
                    }
                }
            } else {
                logger.warn(`Nenhuma thumbnail especificada para o video ${videoId}`);
            }

            // ETAPA 3: Agendar para 30 MINUTOS APÓS o upload
            const agoraAposUpload = new Date();
            const dataDePublicacao = new Date(agoraAposUpload.getTime() + 30 * 60 * 1000);

            await youtube.videos.update({
                part: "status",
                requestBody: {
                    id: videoId,
                    status: {
                        privacyStatus: "private",
                        publishAt: dataDePublicacao.toISOString()
                    }
                }
            });
            
            logger.info(`Video ${videoId} agendado para publicacao as ${dataDePublicacao.toISOString()}`);

            // ETAPA 4: Marcar como postado e registrar timestamp para limpeza futura
            await docRef.update({ 
                status: "postado", 
                youtubeVideoId: videoId,
                dataPostagemCompleta: Timestamp.now() // ⭐ NOVO: registra quando foi postado
            });
            
            logger.info(`Agendamento "${agendamento.titulo}" finalizado com sucesso!`);

        } catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message || "Erro desconhecido";
            logger.error(`FALHA ao postar "${agendamento.titulo}". Erro: ${errorMessage}`);
            await docRef.update({ 
                status: "erro", 
                mensagemErro: errorMessage 
            });
        }
    });

    await Promise.all(promessas);
    logger.info("Rodada de processamento finalizada.");
});


// ⭐ NOVA FUNÇÃO: LIMPAR VÍDEOS E THUMBNAILS APÓS 24 HORAS
exports.limparArquivosAntigos = onSchedule({
    schedule: "every 6 hours", // Roda 4x por dia
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
}, async (event) => {
    logger.info("🧹 Iniciando limpeza de arquivos antigos...");
    
    const agora = Timestamp.now();
    const limite24hAtras = Timestamp.fromMillis(agora.toMillis() - (24 * 60 * 60 * 1000));
    
    // Buscar todos os agendamentos postados há mais de 24 horas
    const agendamentosAntigos = await db.collectionGroup("agendamentos")
        .where("status", "==", "postado")
        .where("dataPostagemCompleta", "<=", limite24hAtras)
        .get();
    
    if (agendamentosAntigos.empty) {
        logger.info("✅ Nenhum arquivo antigo para limpar.");
        return;
    }

    logger.info(`📦 Encontrados ${agendamentosAntigos.size} agendamentos para limpar.`);
    
    const promessasLimpeza = agendamentosAntigos.docs.map(async (doc) => {
        const agendamento = doc.data();
        const docRef = doc.ref;
        const channelDocRef = docRef.parent.parent;
        
        try {
            const userId = channelDocRef.parent.parent.id;
            const channelId = channelDocRef.id;
            
            // 1️⃣ Excluir vídeo do Storage
            if (agendamento.nome_video) {
                const videoPath = `canais/${userId}/${channelId}/videos/${agendamento.nome_video}`;
                const videoFile = bucket.file(videoPath);
                
                const [videoExists] = await videoFile.exists();
                if (videoExists) {
                    await videoFile.delete();
                    logger.info(`🗑️ Vídeo deletado: ${videoPath}`);
                } else {
                    logger.warn(`⚠️ Vídeo já não existe: ${videoPath}`);
                }
            }
            
            // 2️⃣ Excluir thumbnail do Storage
            if (agendamento.nome_thumbnail) {
                const thumbPath = `canais/${userId}/${channelId}/thumbnails/${agendamento.nome_thumbnail}`;
                const thumbFile = bucket.file(thumbPath);
                
                const [thumbExists] = await thumbFile.exists();
                if (thumbExists) {
                    await thumbFile.delete();
                    logger.info(`🗑️ Thumbnail deletada: ${thumbPath}`);
                } else {
                    logger.warn(`⚠️ Thumbnail já não existe: ${thumbPath}`);
                }
            }
            
            // 3️⃣ Atualizar status no Firestore para "limpo"
            await docRef.update({ 
                status: "limpo",
                dataLimpeza: Timestamp.now()
            });
            
            logger.info(`✅ Agendamento "${agendamento.titulo}" limpo com sucesso!`);
            
        } catch (error) {
            logger.error(`❌ ERRO ao limpar agendamento "${agendamento.titulo}": ${error.message}`);
            
            // Registrar erro mas não parar o processo
            await docRef.update({ 
                status: "erro_limpeza",
                mensagemErroLimpeza: error.message 
            });
        }
    });

    await Promise.all(promessasLimpeza);
    logger.info("🧹 Limpeza finalizada!");
});


// ✅ FUNÇÃO DE AUTORIZAÇÃO (sem alterações)
exports.exchangeAuthCode = onCall(
    {
        region: "us-central1",
        cors: ["https://autopost-v2.web.app", "https://autopost-app.vercel.app"],
    },
    async (request) => {
        logger.info("[exchangeAuthCode] Iniciando execucao.");

        const uid = request.data.uid;
        const code = request.data.code;

        if (!uid || !code) {
            throw new HttpsError("invalid-argument", "UID e codigo de autorizacao sao obrigatorios.");
        }

        try {
            const CLIENT_ID = "498596971317-hat8dm8k1ok204omfadfqnej9bsnpc69.apps.googleusercontent.com";
            const CLIENT_SECRET = "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";
            const redirectUri = "https://autopost-v2.web.app/authCallback.html";

            const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                logger.warn("Nenhum refresh_token recebido. O usuario pode ja ter autorizado este app antes.");
            }

            oauth2Client.setCredentials(tokens);
            const youtube = google.youtube({ version: "v3", auth: oauth2Client });
            const channelResponse = await youtube.channels.list({ part: "snippet", mine: true });

            if (!channelResponse.data.items?.length) {
                throw new HttpsError("not-found", "Nenhum canal do YouTube encontrado.");
            }

            const channel = channelResponse.data.items[0];
            const canaisRef = db.collection("usuarios").doc(uid).collection("canais");

            const channelData = {
                "channelInfo.id": channel.id,
                "channelInfo.title": channel.snippet.title,
                "channelInfo.customUrl": channel.snippet.customUrl || "",
                "oauth.refresh_token": tokens.refresh_token,
                status: "active",
                lastUpdated: Timestamp.now(),
            };

            await canaisRef.doc(channel.id).set(channelData, { merge: true });
            logger.info(`Canal ${channel.snippet.title} salvo/atualizado com sucesso para usuario ${uid}.`);

            return { success: true, channelInfo: { title: channel.snippet.title } };
            
        } catch (error) {
            logger.error("[exchangeAuthCode] ERRO:", error);
            throw new HttpsError("internal", "Erro no servidor ao processar autorizacao.");
        }
    }
);