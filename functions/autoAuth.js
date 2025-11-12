// autoAuth.js - Script Automatizado para Autorização do YouTube
const { google } = require('googleapis');
const readline = require('readline');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CREDENCIAIS DO APP ---
const CLIENT_ID = "498596971317-p183rsbts6bpomv989r8ov46kt9idrtb.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "http://localhost";

// Escopos necessários
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly'
];

// Inicializar Firebase Admin
let firebaseInitialized = false;

function initializeFirebase() {
  if (!firebaseInitialized) {
    try {
      // Tenta carregar o service account do arquivo padrão
      const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('? Firebase inicializado com serviceAccountKey.json');
      } else {
        // Tenta inicializar com credenciais padrão (para ambiente local com gcloud)
        admin.initializeApp();
        console.log('? Firebase inicializado com credenciais padrão');
      }
      
      firebaseInitialized = true;
    } catch (error) {
      console.error('? Erro ao inicializar Firebase:', error.message);
      console.log('\n??  Para usar o salvamento automático, você precisa:');
      console.log('   1. Baixar o serviceAccountKey.json do Firebase Console');
      console.log('   2. Colocar na mesma pasta deste script');
      console.log('   3. Ou executar: gcloud auth application-default login\n');
    }
  }
  return firebaseInitialized;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function getChannelInfo(oAuth2Client) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: oAuth2Client });
    const response = await youtube.channels.list({
      part: 'snippet,contentDetails',
      mine: true
    });

    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      return {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl
      };
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar informações do canal:', error.message);
    return null;
  }
}

async function saveToFirestore(userId, channelId, tokenData, channelInfo) {
  try {
    const db = admin.firestore();
    const canalRef = db.collection('usuarios').doc(userId).collection('canais').doc(channelId);
    
    const dataToSave = {
      oauth: tokenData,
      channelInfo: channelInfo || {},
      lastUpdated: admin.firestore.Timestamp.now(),
      status: 'active'
    };

    await canalRef.set(dataToSave, { merge: true });
    console.log('? Token salvo no Firestore com sucesso!');
    console.log(`  Caminho: usuarios/${userId}/canais/${channelId}`);
    return true;
  } catch (error) {
    console.error('? Erro ao salvar no Firestore:', error.message);
    return false;
  }
}

async function main() {
  console.clear();
  console.log('+------------------------------------------------------------+');
  console.log('¦   ?? SCRIPT DE AUTORIZAÇÃO AUTOMÁTICA - YOUTUBE API       ¦');
  console.log('+------------------------------------------------------------+\n');

  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  // Gerar URL de autorização
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('?? PASSO 1: Autorização do Google\n');
  console.log('Abra esta URL no seu navegador:');
  console.log('-------------------------------------------------------------');
  console.log(authUrl);
  console.log('-------------------------------------------------------------\n');

  // Aguardar código de autorização
  const code = await question('?? Cole o código de autorização aqui: ');
  console.log('');

  try {
    // Obter tokens
    console.log('? Obtendo tokens...');
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    console.log('? Tokens obtidos com sucesso!\n');

    // Buscar informações do canal
    console.log('? Buscando informações do canal...');
    const channelInfo = await getChannelInfo(oAuth2Client);
    
    if (channelInfo) {
      console.log('? Canal encontrado!');
      console.log(`  • Nome: ${channelInfo.title}`);
      console.log(`  • ID: ${channelInfo.id}`);
      if (channelInfo.customUrl) {
        console.log(`  • URL: youtube.com/${channelInfo.customUrl}`);
      }
      console.log('');
    }

    // Preparar objeto para Firestore
    const firestoreObject = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expiry_date: tokens.expiry_date
    };

    console.log('+------------------------------------------------------------+');
    console.log('¦                    ? TOKENS GERADOS                       ¦');
    console.log('+------------------------------------------------------------+\n');

    // Perguntar se quer salvar automaticamente
    const autoSave = await question('?? Deseja salvar automaticamente no Firestore? (s/n): ');
    
    if (autoSave.toLowerCase() === 's' || autoSave.toLowerCase() === 'sim') {
      if (initializeFirebase()) {
        const userId = await question('?? Digite o ID do usuário (userId): ');
        const channelId = channelInfo ? channelInfo.id : await question('?? Digite o ID do canal (canalId): ');
        
        console.log('');
        const saved = await saveToFirestore(userId, channelId, firestoreObject, channelInfo);
        
        if (!saved) {
          console.log('\n??  Salvamento automático falhou. Use o JSON abaixo:\n');
          printJsonForManualSave(firestoreObject, channelInfo);
        }
      } else {
        console.log('\n??  Firebase não disponível. Use o JSON abaixo:\n');
        printJsonForManualSave(firestoreObject, channelInfo);
      }
    } else {
      console.log('');
      printJsonForManualSave(firestoreObject, channelInfo);
    }

    console.log('\n? PROCESSO CONCLUÍDO COM SUCESSO!\n');

  } catch (err) {
    console.error('\n? ERRO:', err.response ? err.response.data : err.message);
    console.log('\nPossíveis causas:');
    console.log('  • Código de autorização inválido ou expirado');
    console.log('  • Credenciais do OAuth incorretas');
    console.log('  • Problemas de conexão com a internet\n');
  } finally {
    rl.close();
  }
}

function printJsonForManualSave(tokenData, channelInfo) {
  console.log('?? COPIE O JSON ABAIXO E SALVE NO FIRESTORE:');
  console.log('-------------------------------------------------------------');
  
  const fullObject = {
    oauth: tokenData,
    channelInfo: channelInfo || {},
    lastUpdated: new Date().toISOString(),
    status: 'active'
  };
  
  console.log(JSON.stringify(fullObject, null, 2));
  console.log('-------------------------------------------------------------');
  console.log('\n?? Salve em: usuarios/{userId}/canais/{canalId}');
  if (channelInfo) {
    console.log(`   Exemplo: usuarios/SEU_USER_ID/canais/${channelInfo.id}`);
  }
}

// Executar
main().catch(console.error);
