// --- FUNÇÕES PRINCIPAIS ---

async function getStoredConfig() {
  const result = await chrome.storage.local.get(['glpiUrl', 'appToken', 'userToken', 'lastTicketId', 'checkInterval']);
  return result;
}

async function playNotificationSound() {
  // Garante que o documento offscreen exista. Se não existir, cria.
  let hasDoc = await chrome.offscreen.hasDocument();
  if (!hasDoc) {
    console.log("Documento offscreen não encontrado. Criando...");
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Tocar notificação de novo chamado',
    });
  }

  // Agora que garantimos que o documento existe, enviamos a mensagem para tocar.
  console.log("Enviando mensagem 'play' para o documento offscreen.");
  chrome.runtime.sendMessage({ type: 'play' });
}

async function checkNewTickets() {
  console.log("Iniciando verificação de chamados NOVOS (com ordenação manual)...");
  const config = await getStoredConfig();

  if (!config.glpiUrl || !config.appToken || !config.userToken) {
    console.error("Erro: Configurações do GLPI não encontradas.");
    return;
  }

  const apiUrl = `${config.glpiUrl}/apirest.php`;
  let sessionToken = null;
  const lastTicketId = config.lastTicketId || 0;

  try {
    const sessionResponse = await fetch(`${apiUrl}/initSession`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `user_token ${config.userToken}`, 'App-Token': config.appToken }
    });
    if (!sessionResponse.ok) throw new Error(`Falha ao iniciar sessão: ${sessionResponse.statusText}`);
    const sessionData = await sessionResponse.json();
    sessionToken = sessionData.session_token;

    const searchQuery = new URLSearchParams({
      'is_deleted': '0',
      'criteria[0][field]': '12',
      'criteria[0][searchtype]': 'equals',
      'criteria[0][value]': '1',
      'forcedisplay[0]': '2',
      'range': '0-24'
    });

    const searchUrl = `${apiUrl}/search/Ticket?${searchQuery.toString()}`;
    console.log("URL de busca (sem sort):", searchUrl);

    const ticketResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Session-Token': sessionToken, 'App-Token': config.appToken }
    });
    if (!ticketResponse.ok) throw new Error(`Falha ao buscar chamados: ${ticketResponse.status} ${ticketResponse.statusText}`);
    
    const responseData = await ticketResponse.json();
    let tickets = responseData.data || [];
    
    if (tickets.length > 0) {
        tickets.sort((a, b) => b[2] - a[2]);
        console.log("Chamados após ordenação manual:", tickets);

        const latestTicket = tickets[0];
        console.log(`Chamados encontrados. Último ID (após ordenar): ${latestTicket[2]}. Último ID salvo: ${lastTicketId}`);

        if (latestTicket[2] > lastTicketId) {
            console.log(`%cNOVO CHAMADO DETECTADO! ID: ${latestTicket[2]}`, 'font-weight: bold; font-size: 16px; color: red;');
            playNotificationSound();
            chrome.storage.local.set({ lastTicketId: latestTicket[2] });
            chrome.action.setBadgeText({ text: '!' });
            chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        } else {
            console.log("Nenhum chamado novo desde a última verificação.");
        }
    } else {
      console.log("Nenhum chamado com status 'Novo' encontrado.");
    }
  } catch (error) {
    console.error("Ocorreu um erro durante a comunicação com o GLPI:", error);
  }
}


// ---- LÓGICA DE ALARME DINÂMICO ----

async function createOrUpdateAlarm() {
  const config = await getStoredConfig();
  const interval = config.checkInterval || 0.5;
  
  console.log(`Configurando alarme para rodar a cada ${interval} minuto(s).`);
  
  chrome.alarms.create('checkTicketsAlarm', {
    delayInMinutes: 1,
    periodInMinutes: interval
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkTicketsAlarm') {
    checkNewTickets();
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.checkInterval) {
    console.log("Intervalo de verificação alterado. Reconfigurando o alarme.");
    createOrUpdateAlarm();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão instalada. Configurando alarme inicial.");
  createOrUpdateAlarm();
});

chrome.runtime.onStartup.addListener(() => {
    console.log("Navegador iniciado. Configurando alarme.");
    createOrUpdateAlarm();
});

chrome.action.onClicked.addListener(() => {
    chrome.action.setBadgeText({ text: '' });
});