document.addEventListener('DOMContentLoaded', () => {
    // Mapeamento dos elementos da interface
    const glpiUrlEl = document.getElementById('glpiUrl');
    const appTokenEl = document.getElementById('appToken');
    const userTokenEl = document.getElementById('userToken');
    const toggleAppTokenEl = document.getElementById('toggleAppToken');
    const toggleUserTokenEl = document.getElementById('toggleUserToken');
    const intervalUnitEl = document.getElementById('intervalUnit');
    const predefinedTimeEl = document.getElementById('predefinedTime');
    const customTimeEl = document.getElementById('customTime');
    const showNotificationsEl = document.getElementById('showNotifications');
    const saveButton = document.getElementById('save');
    const statusEl = document.getElementById('status');

    // Opções de tempo pré-definidas
    const timeOptions = {
        seconds: [
            { value: 30, text: '30 segundos' }, { value: 35, text: '35 segundos' },
            { value: 40, text: '40 segundos' }, { value: 45, text: '45 segundos' },
            { value: 50, text: '50 segundos' }, { value: 55, text: '55 segundos' },
            { value: 'custom', text: 'Personalizado' }
        ],
        minutes: [
            { value: 1, text: '1 minuto' }, { value: 5, text: '5 minutos' },
            { value: 10, text: '10 minutos' }, { value: 30, text: '30 minutos' },
            { value: 'custom', text: 'Personalizado' }
        ]
    };

    // Atualiza as opções pré-definidas quando a unidade (s/m) muda
    function updatePredefinedTimeOptions() {
        const unit = intervalUnitEl.value;
        predefinedTimeEl.innerHTML = '';
        timeOptions[unit].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            predefinedTimeEl.appendChild(option);
        });
        updateCustomTimeLimits();
    }

    // Define os atributos min/max do campo de tempo personalizado
    function updateCustomTimeLimits() {
        const unit = intervalUnitEl.value;
        if (unit === 'seconds') {
            customTimeEl.min = 30;
            customTimeEl.max = 59; // CORRIGIDO: Adiciona o atributo max
        } else { // minutes
            customTimeEl.min = 1;
            customTimeEl.max = 30;
        }
    }

    // Valida o campo de tempo personalizado
    function validateCustomTime() {
        const unit = intervalUnitEl.value;
        let value = parseFloat(customTimeEl.value);

        if (isNaN(value)) value = (unit === 'seconds') ? 30 : 1;

        let message = '';
        if (unit === 'seconds') {
            if (value < 30) {
                value = 30;
                message = 'Mínimo de 30 segundos.';
            }
            // CORRIGIDO: Adiciona a validação do valor máximo para segundos
            if (value > 59) {
                value = 59;
                message = 'Máximo de 59 segundos.';
            }
        } else { // minutes
            if (value < 1) {
                value = 1;
                message = 'Mínimo de 1 minuto.';
            }
            if (value > 30) {
                value = 30;
                message = 'Máximo de 30 minutos.';
            }
        }

        if (message) {
            statusEl.textContent = message;
            setTimeout(() => { statusEl.textContent = ''; }, 2000);
        }
        customTimeEl.value = value;
    }

    // Salva todas as configurações
    function saveOptions() {
        validateCustomTime(); // Garante que o valor está válido antes de salvar
        let intervalValue = parseFloat(customTimeEl.value);
        const unit = intervalUnitEl.value;

        if (unit === 'seconds') {
            intervalValue = intervalValue / 60; // Salva como fração de minuto
        }

        chrome.storage.local.set({
            glpiUrl: glpiUrlEl.value,
            appToken: appTokenEl.value,
            userToken: userTokenEl.value,
            checkInterval: intervalValue,
            showNotifications: showNotificationsEl.checked
        }, () => {
            statusEl.textContent = 'Configurações salvas!';
            setTimeout(() => { statusEl.textContent = ''; }, 1500);
        });
    }

    // Carrega as configurações salvas quando a página abre
    function restoreOptions() {
        chrome.storage.local.get(['glpiUrl', 'appToken', 'userToken', 'checkInterval', 'showNotifications'], (items) => {
            glpiUrlEl.value = items.glpiUrl || '';
            appTokenEl.value = items.appToken || '';
            userTokenEl.value = items.userToken || '';
            showNotificationsEl.checked = items.showNotifications !== false;

            const interval = items.checkInterval || 0.5;
            let unit, displayValue;

            if (interval < 1) {
                unit = 'seconds';
                displayValue = Math.round(interval * 60);
                if (displayValue > 59) displayValue = 59; // Garante que valor salvo antigo seja corrigido na exibição
            } else {
                unit = 'minutes';
                displayValue = interval;
            }

            intervalUnitEl.value = unit;
            updatePredefinedTimeOptions();
            customTimeEl.value = displayValue;

            const isPredefined = timeOptions[unit].some(opt => opt.value == displayValue);
            predefinedTimeEl.value = isPredefined ? displayValue : 'custom';
        });
    }

    // --- Event Listeners ---
    toggleAppTokenEl.addEventListener('click', () => {
        appTokenEl.type = appTokenEl.type === 'password' ? 'text' : 'password';
    });
    toggleUserTokenEl.addEventListener('click', () => {
        userTokenEl.type = userTokenEl.type === 'password' ? 'text' : 'password';
    });
    intervalUnitEl.addEventListener('change', () => {
        updatePredefinedTimeOptions();
        const firstOption = timeOptions[intervalUnitEl.value][0].value;
        customTimeEl.value = firstOption;
        predefinedTimeEl.value = firstOption;
    });
    predefinedTimeEl.addEventListener('change', () => {
        if (predefinedTimeEl.value !== 'custom') {
            customTimeEl.value = predefinedTimeEl.value;
        }
        customTimeEl.focus();
    });
    customTimeEl.addEventListener('input', () => {
        const unit = intervalUnitEl.value;
        const isPredefined = timeOptions[unit].some(opt => opt.value == customTimeEl.value);
        predefinedTimeEl.value = isPredefined ? customTimeEl.value : 'custom';
    });
    
    customTimeEl.addEventListener('blur', validateCustomTime);
    saveButton.addEventListener('click', saveOptions);
    
    // Inicialização
    restoreOptions();
});