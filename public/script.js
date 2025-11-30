// ARQUIVO: public/script.js (VERSÃO COMPLETA E FINALMENTE CORRIGIDA)

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

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const AppState = {
  currentUser: null,
  canalAtual: null,
  channelListenerUnsubscribe: null,
  agendamentoListenerUnsubscribe: null,
  activeMediaTab: 'videos',
  idAgendamentoEmEdicao: null
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

// ===================================================================
// INICIALIZAÇÃO E EVENT LISTENERS
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Aplicação inicializando...");
  
  auth.onAuthStateChanged(user => {
    const loginPage = document.getElementById('login-page');
    const appContainer = document.querySelector('.container');

    if (user) {
      AppState.currentUser = user;
      console.log("✅ Usuário autenticado:", user.uid);
      
      if (AppState.channelListenerUnsubscribe) AppState.channelListenerUnsubscribe();
      if (AppState.agendamentoListenerUnsubscribe) AppState.agendamentoListenerUnsubscribe();

      loginPage.style.display = 'none';
      appContainer.style.display = 'flex';
      if (typeof feather !== 'undefined') feather.replace();
      
      setupChannelListener(user.uid);

      const addChannelButton = document.getElementById('btn-add-channel');
      if (addChannelButton) {
        addChannelButton.href = `auth.html?uid=${user.uid}`;
      }
      
      const ultimaPagina = localStorage.getItem('ultimaPagina') || 'dashboard';
      const ultimoCanal = localStorage.getItem('ultimoCanal');
      
      if (ultimaPagina === 'channel-management' && ultimoCanal) {
        manageChannel(ultimoCanal);
      } else {
        mostrarPagina(ultimaPagina);
      }

    } else {
      AppState.currentUser = null;
      console.log("👤 Nenhum usuário logado.");
      loginPage.style.display = 'flex';
      appContainer.style.display = 'none';
      localStorage.removeItem('ultimaPagina');
      localStorage.removeItem('ultimoCanal');
    }
  });

  setupEventListeners();
  console.log("✅ Script carregado e pronto!");
});

function setupEventListeners() {
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarPagina(item.dataset.page);
    });
  });

  const btnBack = document.getElementById('btn-back-to-dashboard');
  if (btnBack) {
      btnBack.addEventListener('click', (e) => {
          e.preventDefault();
          mostrarPagina('dashboard');
      });
  }

  document.querySelectorAll('.channel-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const subpage = item.dataset.subpage;
        localStorage.setItem('ultimaSubPagina', subpage);
        document.querySelectorAll('.channel-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.channel-page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${subpage}-subpage`).classList.add('active');
    });
  });

  const videoUploadInput = document.getElementById('video-upload');
  if (videoUploadInput) {
    videoUploadInput.addEventListener('change', (e) => handleMediaUpload(e.target.files, 'videos'));
  }

  const thumbnailUploadInput = document.getElementById('thumbnail-upload');
  if (thumbnailUploadInput) {
    thumbnailUploadInput.addEventListener('change', (e) => handleMediaUpload(e.target.files, 'thumbnails'));
  }

  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      if (!AppState.canalAtual) return;
      const mediaType = button.dataset.mediaType;
      AppState.activeMediaTab = mediaType;
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      displayStoredMedia(AppState.canalAtual, mediaType);
    });
  });

  document.getElementById('btn-download-modelo')?.addEventListener('click', gerarModeloCSV);
  document.getElementById('upload-planilha')?.addEventListener('change', handlePlanilhaUpload);
  document.getElementById('form-agendamento-individual')?.addEventListener('submit', handleAgendamentoIndividual);
  
  document.getElementById('btn-toggle-form-individual')?.addEventListener('click', () => toggleFormIndividual(true));
  document.getElementById('btn-close-form-individual')?.addEventListener('click', () => toggleFormIndividual(false));
  document.getElementById('btn-limpar-agenda')?.addEventListener('click', limparAgenda);
}

// ===================================================================
// LÓGICA DE AUTENTICAÇÃO E NAVEGAÇÃO
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

// ===================================================================
// ✅ FUNÇÃO PRINCIPAL CORRIGIDA
// ===================================================================

function setupChannelListener(userId) {
  const tableBody = document.getElementById('channels-table-body');
  if (!tableBody) {
    console.error("❌ FATAL: Elemento com ID 'channels-table-body' não foi encontrado no HTML! Verifique seu index.html.");
    return;
  }

  console.log(`📄 Configurando listener para canais do usuário: ${userId}`);

  const channelsRef = db.collection('usuarios').doc(userId).collection('canais');

  AppState.channelListenerUnsubscribe = channelsRef.onSnapshot(snapshot => {
    console.log(`📊 Canais recebidos do Firestore: ${snapshot.size}`);
    
    tableBody.innerHTML = '';
    
    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="5">Nenhum canal encontrado. Clique em "Adicionar Canal".</td></tr>';
      return;
    }

    const channels = snapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    channels.sort((a, b) => {
      const titleA = a.data["channelInfo.title"] || '';
      const titleB = b.data["channelInfo.title"] || '';
      return titleA.localeCompare(titleB);
    });

    channels.forEach((channel, index) => {
      const channelId = channel.id;
      const channelData = channel.data;
      
      const title = channelData["channelInfo.title"] || 'N/A';
      const customUrl = channelData["channelInfo.customUrl"] || 'N/A';
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(title)}</td>
        <td>${escapeHtml(customUrl)}</td>
        <td><span class="status-badge status-${escapeHtml(channelData.status || 'unknown')}">${escapeHtml(channelData.status || 'unknown')}</span></td>
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
    console.log('✅ Tabela de canais renderizada com sucesso!');

  }, error => {
    console.error("🔥 Erro ao sincronizar canais:", error);
    tableBody.innerHTML = `<tr><td colspan="5">Erro ao sincronizar: ${error.message}</td></tr>`;
  });
}


// ===================================================================
// FUNÇÕES DE GERENCIAMENTO DE CANAIS
// ===================================================================

window.excluirCanal = async function(userId, channelId) {
  if (!confirm(`Tem certeza que deseja excluir este canal?`)) return;
  showLoading(true);
  try {
    await db.collection('usuarios').doc(userId).collection('canais').doc(channelId).delete();
    showSuccess("Canal excluído com sucesso!");
  } catch (error) {
    showError("Ocorreu um erro ao excluir o canal.");
  } finally {
    showLoading(false);
  }
};

function mostrarPagina(pageId) {
  if (pageId !== 'channel-management') {
    AppState.canalAtual = null;
    localStorage.removeItem('ultimoCanal');
    if (AppState.agendamentoListenerUnsubscribe) {
      AppState.agendamentoListenerUnsubscribe();
      AppState.agendamentoListenerUnsubscribe = null;
    }
  }
  
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));
  
  const pageToShow = document.getElementById(`${pageId}-page`);
  if (pageToShow) {
    pageToShow.classList.add('active');
    localStorage.setItem('ultimaPagina', pageId);
  }
  
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');
}

async function manageChannel(channelId) {
  if (!AppState.currentUser) {
    showError("Sessão de usuário inválida. Por favor, faça login novamente.");
    return;
  }
  
  AppState.canalAtual = channelId;
  localStorage.setItem('ultimoCanal', channelId);
  console.log(`Gerenciando o canal: ${channelId}`);

  try {
    const userId = AppState.currentUser.uid;
    const channelRef = db.collection('usuarios').doc(userId).collection('canais').doc(channelId);
    const doc = await channelRef.get();

    if (doc.exists) {
      const channelData = doc.data();
      const channelTitle = channelData["channelInfo.title"] || 'Canal sem nome';
      const titleElement = document.getElementById('channel-management-title');
      if (titleElement) {
        titleElement.textContent = `Gerenciando: ${channelTitle}`;
      }
    }
    
    mostrarPagina('channel-management');

    const ultimaSubPagina = localStorage.getItem('ultimaSubPagina') || 'biblioteca';
    
    document.querySelectorAll('.channel-nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.channel-page').forEach(p => p.classList.remove('active'));

    document.querySelector(`.channel-nav-item[data-subpage="${ultimaSubPagina}"]`)?.classList.add('active');
    document.getElementById(`${ultimaSubPagina}-subpage`)?.classList.add('active');
    
    await displayStoredMedia(channelId, 'videos');
    setupAgendamentoListener(userId, channelId);

  } catch (error) {
    showError("Erro ao carregar dados do canal.");
    console.error(error);
  }
}

// ===================================================================
// LÓGICA DA BIBLIOTECA DE MÍDIA
// ===================================================================

async function handleMediaUpload(files, type) {
  if (!files.length || !AppState.canalAtual || !AppState.currentUser) {
    showError("Sessão inválida ou canal não selecionado.");
    return;
  }
  
  const progressContainer = document.getElementById('upload-progress-container');
  const progressList = document.getElementById('upload-progress-list');
  progressContainer.style.display = 'block';
  progressList.innerHTML = '';
  
  for (const file of Array.from(files)) {
    const filePath = `canais/${AppState.currentUser.uid}/${AppState.canalAtual}/${type}/${file.name}`;
    const storageRef = storage.ref(filePath);
    const uploadTask = storageRef.put(file);
    const progressId = `progress-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;
    
    const progressElement = document.createElement('div');
    progressElement.innerHTML = `<p>${escapeHtml(file.name)}: <span id="${progressId}">0%</span></p>`;
    progressList.appendChild(progressElement);
    
    const progressSpan = document.getElementById(progressId);
    
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (progressSpan) progressSpan.textContent = `${Math.round(progress)}%`;
      },
      (error) => {
        console.error(`Erro no upload de ${file.name}:`, error);
        if (progressSpan) progressSpan.textContent = `Erro!`;
        showError(`Falha no upload de ${file.name}. Verifique as regras de segurança do Storage.`);
      },
      () => {
        console.log(`✅ ${file.name} enviado com sucesso!`);
        if (progressSpan) progressSpan.textContent = `Concluído!`;
        displayStoredMedia(AppState.canalAtual, AppState.activeMediaTab);
        popularDropdownsAgendamento(AppState.currentUser.uid, AppState.canalAtual);
      }
    );
  }
}

async function displayStoredMedia(channelId, mediaType) {
  const tableBody = document.getElementById('media-table-body');
  if (!tableBody || !AppState.currentUser) return;
  
  tableBody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
  
  try {
    const storageRef = storage.ref(`canais/${AppState.currentUser.uid}/${channelId}/${mediaType}`);
    const result = await storageRef.listAll();
    
    if (result.items.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="3">Nenhum arquivo encontrado.</td></tr>`;
      return;
    }
    
    tableBody.innerHTML = '';
    result.items.forEach(itemRef => {
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${escapeHtml(itemRef.name)}</td>
        <td>Carregado</td>
        <td class="actions">
          <button class="btn-icon btn-danger" onclick="deleteMediaFile('${escapeHtml(itemRef.fullPath)}')">
            <i data-feather="trash-2"></i>
          </button>
        </td>
      `;
    });
    
    if (typeof feather !== 'undefined') feather.replace();
  } catch (error) {
    console.error(`Erro ao listar arquivos de ${mediaType}:`, error);
    tableBody.innerHTML = `<tr><td colspan="3">Ocorreu um erro ao carregar os arquivos. Verifique o console.</td></tr>`;
  }
}

window.deleteMediaFile = async function(fullPath) {
  if (!confirm(`Tem certeza que deseja excluir este arquivo permanentemente?`)) return;
  showLoading(true);
  try {
    const fileRef = storage.ref(fullPath);
    await fileRef.delete();
    showSuccess("Arquivo excluído com sucesso!");
    displayStoredMedia(AppState.canalAtual, AppState.activeMediaTab);
    popularDropdownsAgendamento(AppState.currentUser.uid, AppState.canalAtual);
  } catch (error) {
    showError("Ocorreu um erro ao tentar excluir o arquivo.");
  } finally {
    showLoading(false);
  }
};

// ===================================================================
// LÓGICA DE AGENDAMENTO
// ===================================================================

function toggleFormIndividual(show) {
  const container = document.getElementById('container-form-individual');
  if (!container) return;

  if (show) {
    container.style.display = 'block';
    if (AppState.currentUser && AppState.canalAtual) {
      popularDropdownsAgendamento(AppState.currentUser.uid, AppState.canalAtual);
    }
  } else {
    container.style.display = 'none';
    AppState.idAgendamentoEmEdicao = null;
  }
}

async function handleAgendamentoIndividual(e) {
  e.preventDefault();
  if (!AppState.currentUser || !AppState.canalAtual) {
    return showError("Sessão inválida. Por favor, recarregue a página.");
  }
  
  showLoading(true);
  try {
    const video = document.getElementById('select-video').value;
    const thumbnail = document.getElementById('select-thumbnail').value;
    const titulo = document.getElementById('input-titulo').value;
    const descricao = document.getElementById('textarea-descricao').value;
    const data = document.getElementById('input-data').value;
    const hora = document.getElementById('input-hora').value;

    if (!video || !thumbnail || !titulo || !data || !hora) {
      throw new Error("Todos os campos obrigatórios devem ser preenchidos.");
    }

    const dataHoraString = `${data}T${hora}`;
    const dataPostagem = firebase.firestore.Timestamp.fromDate(new Date(dataHoraString));

    const agendamentoData = {
      nome_video: video,
      nome_thumbnail: thumbnail,
      titulo: titulo,
      descricao: descricao,
      tags: [],
      dataPostagem: dataPostagem,
      status: 'agendado',
    };

    const agendamentosRef = db.collection('usuarios')
      .doc(AppState.currentUser.uid)
      .collection('canais')
      .doc(AppState.canalAtual)
      .collection('agendamentos');

    if (AppState.idAgendamentoEmEdicao) {
      await agendamentosRef.doc(AppState.idAgendamentoEmEdicao).update(agendamentoData);
      showSuccess("Agendamento atualizado com sucesso!");
    } else {
      agendamentoData.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await agendamentosRef.add(agendamentoData);
      showSuccess("Vídeo agendado com sucesso!");
    }
    
    toggleFormIndividual(false);

  } catch (error) {
    showError(error.message || "Ocorreu um erro ao salvar o agendamento.");
  } finally {
    showLoading(false);
  }
}

window.editarAgendamento = async function(agendamentoId) {
  if (!AppState.currentUser || !AppState.canalAtual) {
    return showError("Sessão inválida. Por favor, recarregue a página.");
  }
  showLoading(true);
  try {
    const agendamentoRef = db.collection('usuarios')
      .doc(AppState.currentUser.uid)
      .collection('canais')
      .doc(AppState.canalAtual)
      .collection('agendamentos')
      .doc(agendamentoId);
    const doc = await agendamentoRef.get();

    if (!doc.exists) {
      throw new Error("Agendamento não encontrado. Pode ter sido excluído.");
    }

    const agendamento = doc.data();
    AppState.idAgendamentoEmEdicao = agendamentoId;
    toggleFormIndividual(true);

    document.getElementById('form-individual-title').textContent = 'Editando Agendamento';
    document.getElementById('btn-submit-form-individual').textContent = 'Salvar Alterações';

    await popularDropdownsAgendamento(AppState.currentUser.uid, AppState.canalAtual);
    
    document.getElementById('select-video').value = agendamento.nome_video;
    document.getElementById('select-thumbnail').value = agendamento.nome_thumbnail;
    document.getElementById('input-titulo').value = agendamento.titulo;
    document.getElementById('textarea-descricao').value = agendamento.descricao;

    const dataHora = agendamento.dataPostagem.toDate();
    const data = dataHora.toISOString().split('T')[0];
    const hora = dataHora.toTimeString().split(' ')[0].substring(0, 5);
    document.getElementById('input-data').value = data;
    document.getElementById('input-hora').value = hora;

  } catch (error) {
    showError(error.message || "Ocorreu um erro ao tentar editar o agendamento.");
    toggleFormIndividual(false);
  } finally {
    showLoading(false);
  }
};

window.excluirAgendamento = async function(agendamentoId) {
  if (!confirm('Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.')) {
    return;
  }
  if (!AppState.currentUser || !AppState.canalAtual) {
    return showError("Sessão inválida. Por favor, recarregue a página.");
  }
  showLoading(true);
  try {
    const agendamentoRef = db.collection('usuarios')
      .doc(AppState.currentUser.uid)
      .collection('canais')
      .doc(AppState.canalAtual)
      .collection('agendamentos')
      .doc(agendamentoId);
    await agendamentoRef.delete();
    showSuccess("Agendamento excluído com sucesso!");
  } catch (error) {
    showError("Ocorreu um erro ao excluir o agendamento.");
    console.error("Erro ao excluir:", error);
  } finally {
    showLoading(false);
  }
};

// ===================================================================
// FUNÇÃO LIMPAR AGENDA (NOVA)
// ===================================================================

async function limparAgenda() {
  if (!AppState.currentUser || !AppState.canalAtual) {
    return showError("Sessão inválida. Por favor, recarregue a página.");
  }

  const confirmacao = confirm(
    '⚠️ ATENÇÃO: Esta ação irá excluir TODOS os agendamentos deste canal permanentemente.\n\n' +
    'Esta operação NÃO pode ser desfeita!\n\n' +
    'Deseja realmente continuar?'
  );

  if (!confirmacao) return;

  const confirmacaoFinal = confirm('Última confirmação: Tem CERTEZA ABSOLUTA que deseja excluir TODOS os agendamentos?');

  if (!confirmacaoFinal) return;

  showLoading(true);
  
  try {
    const agendamentosRef = db.collection('usuarios')
      .doc(AppState.currentUser.uid)
      .collection('canais')
      .doc(AppState.canalAtual)
      .collection('agendamentos');

    const snapshot = await agendamentosRef.get();
    
    if (snapshot.empty) {
      showSuccess("Não há agendamentos para excluir.");
      return;
    }

    const totalAgendamentos = snapshot.size;
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    showSuccess(`${totalAgendamentos} agendamento(s) excluído(s) com sucesso!`);
    console.log(`✅ ${totalAgendamentos} agendamentos removidos da agenda.`);

  } catch (error) {
    console.error("Erro ao limpar agenda:", error);
    showError("Ocorreu um erro ao tentar limpar a agenda. Tente novamente.");
  } finally {
    showLoading(false);
  }
}

function gerarModeloCSV() {
  console.log("Gerando modelo CSV...");
  const header = "nome_video,nome_thumbnail,titulo,descricao,tags,data_publicacao,hora_publicacao\n";
  const example = "meu-video-incrivel.mp4,minha-thumb-legal.png,Meu Primeiro Vídeo Agendado,Esta é a descrição do vídeo.,tag1;tag2;tag3,2025-12-25,14:30\n";
  const csvContent = header + example;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_agendamento.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function setupAgendamentoListener(userId, channelId) {
  const tableBody = document.getElementById('agendamentos-table-body');
  if (!tableBody) return;
  
  if (AppState.agendamentoListenerUnsubscribe) {
    AppState.agendamentoListenerUnsubscribe();
  }
  
  const agendamentosRef = db.collection('usuarios')
    .doc(userId)
    .collection('canais')
    .doc(channelId)
    .collection('agendamentos')
    .orderBy("dataPostagem", "asc");
  
  AppState.agendamentoListenerUnsubscribe = agendamentosRef.onSnapshot(snapshot => {
    tableBody.innerHTML = '';
    
    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="5">Nenhum agendamento encontrado.</td></tr>';
      return;
    }
    
    snapshot.forEach(doc => {
      const agendamento = doc.data();
      const agendamentoId = doc.id;
      const dataPostagem = agendamento.dataPostagem.toDate();
      const dataFormatada = dataPostagem.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const horaFormatada = dataPostagem.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const row = tableBody.insertRow();
      row.innerHTML = `
        <td>${escapeHtml(agendamento.titulo)}</td>
        <td>${dataFormatada} às ${horaFormatada}</td>
        <td>${escapeHtml(agendamento.nome_video)}</td>
        <td><span class="status-badge status-${escapeHtml(agendamento.status)}">${escapeHtml(agendamento.status)}</span></td>
        <td class="actions">
          <button class="btn-icon" onclick="editarAgendamento('${escapeHtml(agendamentoId)}')" title="Editar">
            <i data-feather="edit"></i>
          </button>
          <button class="btn-icon btn-danger" onclick="excluirAgendamento('${escapeHtml(agendamentoId)}')" title="Excluir">
            <i data-feather="trash-2"></i>
          </button>
        </td>
      `;
    });
    
    if (typeof feather !== 'undefined') feather.replace();
  }, error => {
    console.error("🔥 Erro ao sincronizar agendamentos:", error);
    tableBody.innerHTML = `<tr><td colspan="5">Erro ao carregar agendamentos.</td></tr>`;
  });
}

async function popularDropdownsAgendamento(userId, channelId) {
  const selectVideo = document.getElementById('select-video');
  const selectThumbnail = document.getElementById('select-thumbnail');
  if (!selectVideo || !selectThumbnail) return;
  
  selectVideo.innerHTML = '<option value="">Carregando vídeos...</option>';
  selectThumbnail.innerHTML = '<option value="">Carregando thumbnails...</option>';
  
  try {
    const videosRef = storage.ref(`canais/${userId}/${channelId}/videos`);
    const videosResult = await videosRef.listAll();
    selectVideo.innerHTML = '<option value="">Selecione um vídeo...</option>';
    videosResult.items.forEach(item => {
      selectVideo.innerHTML += `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`;
    });
    
    const thumbnailsRef = storage.ref(`canais/${userId}/${channelId}/thumbnails`);
    const thumbnailsResult = await thumbnailsRef.listAll();
    selectThumbnail.innerHTML = '<option value="">Selecione uma thumbnail...</option>';
    thumbnailsResult.items.forEach(item => {
      selectThumbnail.innerHTML += `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`;
    });
  } catch (error) {
    console.error("Erro ao popular dropdowns:", error);
    selectVideo.innerHTML = '<option value="">Erro ao carregar</option>';
    selectThumbnail.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}

function handlePlanilhaUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!AppState.currentUser || !AppState.canalAtual) {
    return showError("Sessão inválida. Por favor, recarregue a página.");
  }
  
  showLoading(true);
  const feedbackDiv = document.getElementById('massa-feedback');
  feedbackDiv.innerHTML = 'Processando planilha...';
  
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const linhas = results.data;
      const totalLinhas = linhas.length;
      let sucesso = 0;
      let falhas = 0;
      
      feedbackDiv.innerHTML = `Processando ${totalLinhas} agendamentos...`;
      
      const agendamentosRef = db.collection('usuarios')
        .doc(AppState.currentUser.uid)
        .collection('canais')
        .doc(AppState.canalAtual)
        .collection('agendamentos');
      
      for (const linha of linhas) {
        try {
          const { nome_video, nome_thumbnail, titulo, descricao, tags, data_publicacao, hora_publicacao } = linha;
          
          if (!nome_video || !titulo || !data_publicacao || !hora_publicacao) {
            throw new Error(`Linha inválida, campos obrigatórios faltando: ${JSON.stringify(linha)}`);
          }
          
          const dataHoraString = `${data_publicacao}T${hora_publicacao}`;
          const dataPostagem = firebase.firestore.Timestamp.fromDate(new Date(dataHoraString));
          
          const agendamentoData = {
            nome_video,
            nome_thumbnail: nome_thumbnail || '',
            titulo,
            descricao: descricao || '',
            tags: tags ? tags.split(';').map(t => t.trim()) : [],
            dataPostagem,
            status: 'agendado',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
          };
          
          await agendamentosRef.add(agendamentoData);
          sucesso++;
        } catch (error) {
          console.error("Erro ao processar linha da planilha:", error, linha);
          falhas++;
        }
      }
      
      feedbackDiv.innerHTML = `<strong>Processamento concluído!</strong><br>${sucesso} agendamentos criados com sucesso.<br>${falhas} falhas.`;
      showLoading(false);
      event.target.value = '';
    },
    error: (error) => {
      showError("Ocorreu um erro ao ler o arquivo CSV: " + error.message);
      feedbackDiv.innerHTML = `<span style="color: var(--cor-vermelho);">Falha ao ler a planilha.</span>`;
      showLoading(false);
      event.target.value = '';
    }
  });
}