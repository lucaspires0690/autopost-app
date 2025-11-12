// checkTokens.js - Verificar e Renovar Tokens Expirados
const admin = require('firebase-admin');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// --- CREDENCIAIS DO APP ---
const CLIENT_ID = "191333777971-3n75ask9vnemgvpah5taf61fl2hk2757.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "http://localhost";

// Inicializar Firebase
function initializeFirebase() {
  try {
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      return true;
    } else {
      admin.initializeApp();
      return true;
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error.message);
    return false;
  }
}

async function checkToken(userId, canalId, tokenData) {
  try {
    const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    oAuth2Client.setCredentials(tokenData);

    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    const response = await youtube.channels.list({
      part: 'snippet',
      mine: true
    });

    if (response.data.items && response.data.items.length > 0) {
      return {
        valid: true,
        channelName: response.data.items[0].snippet.title
      };
    }
    
    return { valid: false, error: 'Canal não encontrado' };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      needsReauth: error.code === 401 || error.message.includes('invalid_grant')
    };
  }
}

async function getAllChannels() {
  const db = admin.firestore();
  const usuarios = await db.collection('usuarios').get();
  
  const channels = [];
  
  for (const userDoc of usuarios.docs) {
    const userId = userDoc.id;
    const canais = await userDoc.ref.collection('canais').get();
    
    for (const canalDoc of canais.docs) {
      const canalId = canalDoc.id;
      const data = canalDoc.data();
      
      if (data.oauth) {
        channels.push({
          userId,
          canalId,
          oauth: data.oauth,
          channelInfo: data.channelInfo || {},
          path: `usuarios/${userId}/canais/${canalId}`
        });
      }
    }
  }
  
  return channels;
}

async function findProblematicSchedules() {
  const db = admin.firestore();
  const schedules = await db.collectionGroup('agendamentos')
    .where('status', '==', 'Erro')
    .where('errorType', '==', 'auth_required')
    .get();
  
  return schedules.docs.map(doc => ({
    id: doc.id,
    path: doc.ref.path,
    data: doc.data()
  }));
}

async function main() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       🔍 VERIFICADOR DE TOKENS DO YOUTUBE                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!initializeFirebase()) {
    console.error('❌ Não foi possível inicializar o Firebase');
    console.log('\nColoque o arquivo serviceAccountKey.json nesta pasta.\n');
    return;
  }

  console.log('⏳ Buscando canais cadastrados...\n');

  const channels = await getAllChannels();
  
  if (channels.length === 0) {
    console.log('⚠️  Nenhum canal encontrado com tokens OAuth.\n');
    return;
  }

  console.log(`✓ Encontrados ${channels.length} canal(is)\n`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = {
    valid: [],
    invalid: [],
    needsReauth: []
  };

  for (let i = 0; i < channels.length; i++) {
    const channel = channels[i];
    const num = (i + 1).toString().padStart(2, '0');
    
    process.stdout.write(`[${num}/${channels.length}] Verificando ${channel.canalId}... `);
    
    const result = await checkToken(channel.userId, channel.canalId, channel.oauth);
    
    if (result.valid) {
      console.log(`✅ OK - ${result.channelName}`);
      results.valid.push({ ...channel, channelName: result.channelName });
    } else if (result.needsReauth) {
      console.log(`🔐 REQUER REAUTORIZAÇÃO`);
      results.needsReauth.push({ ...channel, error: result.error });
    } else {
      console.log(`❌ INVÁLIDO - ${result.error}`);
      results.invalid.push({ ...channel, error: result.error });
    }
  }

  // Buscar agendamentos com problemas
  console.log('\n⏳ Verificando agendamentos com erro...\n');
  const problematicSchedules = await findProblematicSchedules();

  // Resumo
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                        📊 RESUMO');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`✅ Tokens Válidos:           ${results.valid.length}`);
  console.log(`🔐 Requerem Reautorização:   ${results.needsReauth.length}`);
  console.log(`❌ Tokens Inválidos:         ${results.invalid.length}`);
  console.log(`⚠️  Agendamentos com Erro:   ${problematicSchedules.length}`);
  
  // Detalhes dos problemas
  if (results.needsReauth.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────');
    console.log('🔐 CANAIS QUE PRECISAM DE REAUTORIZAÇÃO:');
    console.log('───────────────────────────────────────────────────────────\n');
    
    results.needsReauth.forEach((channel, index) => {
      console.log(`${index + 1}. Canal ID: ${channel.canalId}`);
      console.log(`   User ID:  ${channel.userId}`);
      console.log(`   Caminho:  ${channel.path}`);
      console.log(`   Erro:     ${channel.error}`);
      console.log('');
    });
    
    console.log('💡 Para reautorizar, execute:');
    console.log('   node autoAuth.js');
    console.log('');
  }

  if (problematicSchedules.length > 0) {
    console.log('───────────────────────────────────────────────────────────');
    console.log('⚠️  AGENDAMENTOS COM PROBLEMAS DE AUTENTICAÇÃO:');
    console.log('───────────────────────────────────────────────────────────\n');
    
    problematicSchedules.forEach((schedule, index) => {
      console.log(`${index + 1}. Agendamento: ${schedule.id}`);
      console.log(`   Canal:     ${schedule.data.canalId}`);
      console.log(`   Vídeo:     ${schedule.data.titulo || 'Sem título'}`);
      console.log(`   Status:    ${schedule.data.status}`);
      console.log('');
    });
  }

  if (results.valid.length > 0) {
    console.log('───────────────────────────────────────────────────────────');
    console.log('✅ CANAIS COM TOKENS VÁLIDOS:');
    console.log('───────────────────────────────────────────────────────────\n');
    
    results.valid.forEach((channel, index) => {
      console.log(`${index + 1}. ${channel.channelName || 'Nome não disponível'}`);
      console.log(`   Canal ID: ${channel.canalId}`);
      console.log(`   User ID:  ${channel.userId}`);
      console.log('');
    });
  }

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('✅ Verificação concluída!\n');
}

main().catch(console.error);
