chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'play') {
    // Adicionamos este log para confirmar que a mensagem foi recebida.
    console.log("Mensagem 'play' recebida! Tentando tocar o som...");
    
    const audioPlayer = document.getElementById('notification-sound');
    audioPlayer.play().catch(error => {
      console.error("Erro ao tentar tocar o áudio:", error);
    });
  }
});