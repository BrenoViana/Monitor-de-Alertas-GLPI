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

  if (!config.glpiUrl || !config.appToken || !config.userToken) { return; }

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

    // Pedimos agora o ID (2) e o Título (1) do chamado
    const searchQuery = new URLSearchParams({
      'is_deleted': '0',
      'criteria[0][field]': '12', 'criteria[0][searchtype]': 'equals', 'criteria[0][value]': '1',
      'forcedisplay[0]': '2', // ID
      'forcedisplay[1]': '1', // Título (name)
      'range': '0-24'
    });

    const searchUrl = `${apiUrl}/search/Ticket?${searchQuery.toString()}`;
    const ticketResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Session-Token': sessionToken, 'App-Token': config.appToken }
    });
    if (!ticketResponse.ok) throw new Error(`Falha ao buscar chamados: ${ticketResponse.status} ${ticketResponse.statusText}`);
    
    const responseData = await ticketResponse.json();
    let tickets = responseData.data || [];
    
    if (tickets.length > 0) {
        tickets.sort((a, b) => b[2] - a[2]);
        const latestTicket = tickets[0];
        
        if (latestTicket[2] > lastTicketId) {
            console.log(`NOVO CHAMADO DETECTADO! ID: ${latestTicket[2]}`);
            playNotificationSound();
            chrome.storage.local.set({ lastTicketId: latestTicket[2] });
            chrome.action.setBadgeText({ text: '!' });
            chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });

            // LÓGICA DA NOTIFICAÇÃO
            if (config.showNotifications !== false) {
                const ticketId = latestTicket[2];
                const ticketTitle = latestTicket[1];
                const notificationId = `glpi-ticket-${ticketId}`; // ID único para a notificação
                
                chrome.notifications.create(notificationId, {
                    type: 'basic',
                    iconUrl: 'images/icon128.png',
                    title: `Novo Chamado: #${ticketId}`,
                    message: ticketTitle,
                    priority: 2
                });
            }
        }
    }
  } catch (error) {
    console.error("Ocorreu um erro durante a comunicação com o GLPI:", error);
  }
}

// ADICIONAR ESTE NOVO LISTENER NO FINAL DO ARQUIVO
// Ele cuida do que acontece quando o usuário clica na notificação
chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (notificationId.startsWith('glpi-ticket-')) {
    const ticketId = notificationId.split('-')[2];
    const config = await getStoredConfig();
    if (config.glpiUrl) {
      const ticketUrl = `${config.glpiUrl}/front/ticket.form.php?id=${ticketId}`;
      chrome.tabs.create({ url: ticketUrl });
      chrome.notifications.clear(notificationId); // Limpa a notificação após o clique
    }
  }
});

// ---- LÓGICA DE ALARME DINÂMICO ----

// Função para criar ou atualizar o alarme com base nas configurações salvas
async function createOrUpdateAlarm() {
  const config = await getStoredConfig();
  const intervalInMinutes = config.checkInterval || 0.5;

  // --- LÓGICA DE EXIBIÇÃO DA MENSAGEM ---
  let logMessage;
  if (intervalInMinutes < 1) {
    // Se o intervalo for menor que 1 minuto, converte para segundos para o log
    const intervalInSeconds = Math.round(intervalInMinutes * 60);
    logMessage = `Configurando alarme para rodar a cada ${intervalInSeconds} segundo(s).`;
  } else {
    // Se for 1 minuto ou mais, exibe em minutos
    logMessage = `Configurando alarme para rodar a cada ${intervalInMinutes} minuto(s).`;
  }
  console.log(logMessage);
  // --- FIM DA LÓGICA DE EXIBIÇÃO ---
  
  // A API do Chrome continua recebendo o valor em minutos, como esperado.
  chrome.alarms.create('checkTicketsAlarm', {
    delayInMinutes: 1,
    periodInMinutes: intervalInMinutes
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkTicketsAlarm') {
    checkNewTickets();
  }
});

  chrome.storage.onChanged.addListener((changes, namespace) => {
  // Apenas reconfigura o alarme se o valor do intervalo REALMENTE mudou
  if (changes.checkInterval && changes.checkInterval.newValue !== changes.checkInterval.oldValue) {
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