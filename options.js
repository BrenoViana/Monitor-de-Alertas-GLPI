// Função para salvar as opções
function save_options() {
  const glpiUrl = document.getElementById('glpiUrl').value;
  const appToken = document.getElementById('appToken').value;
  const userToken = document.getElementById('userToken').value;
  const checkInterval = document.getElementById('checkInterval').value;

  chrome.storage.local.set({
    glpiUrl: glpiUrl,
    appToken: appToken,
    userToken: userToken,
    checkInterval: parseFloat(checkInterval) >= 0.5 ? parseFloat(checkInterval) : 0.5
  }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Configurações salvas!';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
}

// Função para carregar as opções salvas
function restore_options() {
  chrome.storage.local.get(['glpiUrl', 'appToken', 'userToken', 'checkInterval'], (items) => {
    document.getElementById('glpiUrl').value = items.glpiUrl || '';
    document.getElementById('appToken').value = items.appToken || '';
    document.getElementById('userToken').value = items.userToken || '';
    document.getElementById('checkInterval').value = items.checkInterval || 0.5;
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);