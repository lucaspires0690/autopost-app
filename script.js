// ===================================================================
// ARQUIVO: public/script.js
// VERSÃO 7 - LÓGICA DE CADASTRO MANUAL DE CANAL APRIMORADA
// ===================================================================

// ===================================================================
// CONFIGURAÇÕES E ESTADO GLOBAL
// ===================================================================

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

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const AppState = {
  currentUser: null,
  canalAtual: null,
  channelListenerUnsubscribe: null,
};

// ===================================================================
// FUNÇÕES UTILITÁRIAS E DE UI
// ===================================================================

function showLoading(show) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  console.error("❌ Erro:", message);
  alert(`Erro: ${message}`);
}

function showSuccess(message) {
  console.log("✅ Sucesso:", message);
  alert(`Sucesso: ${message}`);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

// ===================================================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Aplicação inicializando...");
  
  auth.onAuthStateChanged(user => {
    if (AppState.channelListenerUnsubscribe) {
      AppState.channelListenerUnsubscribe();
      AppState.channelListenerUnsubscribe = null;
    }

    const loginPage = document.getElementById('login-page');
    const appContainer = document.querySelector('.container');

    if (user) {
      AppState.currentUser = user;
      loginPage.style.display = 'none';
      appContainer.style.display = 'flex';
      if (typeof feather !== 'undefined') feather.replace();
      setupChannelListener(user.uid);
    } else {
      AppState.currentUser = null;
      loginPage.style.display = 'flex';
      appContainer.style.display = 'none';
    }
  });

  setupEventListeners();
  console.log("✅ Script carregado e pronto!");
});

function setupEventListeners() {
  // Autenticação
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  
  // Botão para abrir o modal de adicionar canal
  document.getElementById('btn-add-channel')?.addEventListener('click', () => {
    openModal('add-channel-modal');
  });

  // Formulário de adição de canal
  document.getElementById('add-channel-form')?.addEventListener('submit', handleSaveChannel);

  // Navegação
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarPagina(item.dataset.page);
    });
  });

  // Fechar Modais
  document.querySelectorAll('.modal .close-button').forEach(button => {
    button.addEventListener('click', () => closeModal(button.closest('.modal').id));
  });
  window.addEventListener('click', (event) => {
    document.querySelectorAll('.modal').forEach(modal => {
      if (event.target === modal) closeModal(modal.id);
    });
  });
}

// ===================================================================
// LÓGICA DE AUTENTICAÇÃO E CADASTRO DE CANAL
// ===================================================================

async function handleLogin(e) {
  e.preventDefault();
  showLoading(true);
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    document.getElementById('login-error-message').textContent = "E-mail ou senha inválidos.";
  } finally {
    showLoading(false);
  }
}

async function handleLogout() {
  try {
    await auth.signOut();
  } catch (error) {
    showError("Ocorreu um erro ao tentar sair.");
  }
}

async function handleSaveChannel(e) {
    e.preventDefault();
    if (!AppState.currentUser) {
        showError("Sessão expirada. Por favor, faça login novamente.");
        return;
    }

    // 1. Pega os dados do formulário
    const channelId = document.getElementById('channel-id').value.trim();
    const channelTitle = document.getElementById('channel-title').value.trim();
    const customUrl = document.getElementById('channel-custom-url').value.trim();
    const refreshToken = document.getElementById('channel-refresh-token').value.trim();

    // 2. Validações
    if (!channelId || !channelTitle || !refreshToken) {
        showError("Os campos ID do Canal, Nome do Canal e Refresh Token são obrigatórios.");
        return;
    }

    if (!channelId.startsWith('UC')) {
        showError("ID do Canal inválido. Deve começar com 'UC'");
        return;
    }

    if (refreshToken.length < 20) {
        showError("Refresh Token parece inválido. Verifique se copiou corretamente.");
        return;
    }

    showLoading(true);

    // 3. Monta o objeto completo para o Firestore
    const channelData = {
        channelInfo: {
            id: channelId,
            title: channelTitle,
            customUrl: customUrl,
            description: ""
        },
        oauth: {
            refresh_token: refreshToken,
            access_token: null,
            expiry_date: null,
            scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube",
            token_type: "Bearer"
        },
        status: "active",
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp( )
    };

    try {
        // 4. Salva no Firestore
        const userId = AppState.currentUser.uid;
        const channelRef = db.collection('usuarios').doc(userId).collection('canais').doc(channelId);
        
        await channelRef.set(channelData, { merge: true });

        showSuccess("✅ Canal salvo com sucesso!");
        closeModal('add-channel-modal');
        document.getElementById('add-channel-form').reset();

    } catch (error) {
        console.error("Erro ao salvar canal:", error);
        showError("Ocorreu um erro ao salvar o canal no banco de dados.");
    } finally {
        showLoading(false);
    }
}

// ===================================================================
// SINCRONIZAÇÃO E EXIBIÇÃO DE CANAIS
// ===================================================================

function setupChannelListener(userId) {
  const tableBody = document.getElementById('channels-table')?.querySelector('tbody');
  if (!tableBody) return;

  const channelsRef = db.collection('usuarios').doc(userId).collection('canais');
  console.log(`👂 Configurando listener para o caminho: usuarios/${userId}/canais`);

  AppState.channelListenerUnsubscribe = channelsRef.onSnapshot(snapshot => {
    tableBody.innerHTML = '';
    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="4">Nenhum canal encontrado. Clique em "Adicionar Canal" para começar.</td></tr>';
      return;
    }

    snapshot.forEach(doc => {
      const channel = doc.data();
      const channelId = doc.id;
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${escapeHtml(channel.channelInfo?.title || 'Nome Indisponível')}</td>
        <td>${escapeHtml(channel.channelInfo?.customUrl || 'N/A')}</td>
        <td><span class="status-badge status-${escapeHtml(channel.status || 'unknown')}">${escapeHtml(channel.status || 'unknown')}</span></td>
        <td class="actions">
          <button class="btn-icon" onclick="manageChannel('${escapeHtml(channelId)}')" title="Gerenciar Canal">
            <i data-feather="arrow-right-circle"></i>
          </button>
          <button class="btn-icon btn-danger" onclick="excluirCanal('${escapeHtml(userId)}', '${escapeHtml(channelId)}')" title="Excluir Canal">
            <i data-feather="trash-2"></i>
          </button>
        </td>
      `;
    });

    if (typeof feather !== 'undefined') feather.replace();
  }, error => {
    console.error("🔥 Erro ao sincronizar canais:", error);
    tableBody.innerHTML = `<tr><td colspan="4">Erro ao sincronizar: ${error.message}</td></tr>`;
  });
}

window.excluirCanal = async function(userId, channelId) {
  if (!confirm(`Tem certeza que deseja excluir este canal?`)) return;
  try {
    showLoading(true);
    await db.collection('usuarios').doc(userId).collection('canais').doc(channelId).delete();
    showSuccess("Canal excluído com sucesso.");
  } catch (error) {
    showError("Ocorreu um erro ao excluir o canal.");
  } finally {
    showLoading(false);
  }
};

// ===================================================================
// FUNÇÕES DE NAVEGAÇÃO
// ===================================================================

function mostrarPagina(pageId) {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  
  document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');
  document.getElementById(`${pageId}-page`)?.classList.add('active');
}

function manageChannel(channelId) {
    alert(`Funcionalidade "Gerenciar Canal" para ${channelId} será implementada em breve.`);
    // Aqui você pode redirecionar para a página de gerenciamento do canal
    // AppState.canalAtual = channelId;
    // mostrarPagina('channel-management');
}
