document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const updateBtn = document.getElementById('updateBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const blockingToggle = document.getElementById('blockingToggle');
    const maxServicesInput = document.getElementById('maxServices');
    const lastUpdateSpan = document.getElementById('lastUpdate');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const servicesList = document.getElementById('servicesList');
    const activeServicesList = document.getElementById('activeServicesList');
    const activeCountSpan = document.getElementById('activeCount');
    const maxActiveSpan = document.getElementById('maxActive');
    const statusMessage = document.getElementById('statusMessage');
    const blockingIndicator = document.getElementById('blockingIndicator');
    const blockingText = document.getElementById('blockingText');

    let config = {};
    let services = [];

    // Funciones de utilidad
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        setTimeout(() => {
            statusMessage.textContent = 'Listo';
            statusMessage.className = 'status-message';
        }, 3000);
    }

    function formatDate(isoString) {
        if (!isoString) return 'Nunca';
        const date = new Date(isoString);
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function updateBlockingStatus(enabled) {
        blockingIndicator.className = enabled ? 'indicator active' : 'indicator inactive';
        blockingText.textContent = enabled ? 'Bloqueo activo' : 'Bloqueo inactivo';
    }

    // Cargar configuración
    async function loadConfig() {
        try {
            config = await window.electronAPI.getConfig();
            blockingToggle.checked = config.blockingEnabled;
            maxServicesInput.value = config.maxActiveServices;
            lastUpdateSpan.textContent = formatDate(config.lastUpdate);
            maxActiveSpan.textContent = config.maxActiveServices;
            updateBlockingStatus(config.blockingEnabled);
            renderActiveServices();
        } catch (error) {
            showStatus('Error al cargar configuración', 'error');
        }
    }

    // Cargar servicios
    async function loadServices() {
        try {
            const servicesData = await window.electronAPI.getServices();
            if (servicesData && servicesData.ai_services) {
                services = servicesData.ai_services;
                renderServices();
            } else {
                servicesList.innerHTML = '<p class="no-services">No hay servicios. Actualiza la lista.</p>';
            }
        } catch (error) {
            showStatus('Error al cargar servicios', 'error');
        }
    }

    // Renderizar servicios
    function renderServices() {
        servicesList.innerHTML = '';

        if (!services || services.length === 0) {
            servicesList.innerHTML = '<p class="no-services">No hay servicios disponibles. Actualiza la lista.</p>';
            return;
        }

        services.forEach(service => {
            const [name, url, type, privacy, color] = service;
            const serviceId = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

            const serviceCard = document.createElement('div');
            serviceCard.className = 'service-card';
            serviceCard.dataset.id = serviceId;

            const bgColor = color ? `#${color}` : '#4285f4';

            serviceCard.innerHTML = `
            <div class="service-header" style="background-color: ${bgColor}">
            <h3>${name}</h3>
            </div>
            <div class="service-body">
            <p class="service-type">${type || 'Servicio de IA'}</p>
            <p class="service-privacy ${privacy && privacy.includes('privacy') ? 'privacy-focused' : ''}">
            ${privacy || 'Sin información de privacidad'}
            </p>
            </div>
            <div class="service-footer">
            <button class="btn-open-service" data-id="${serviceId}" data-url="${url}" data-name="${name}">
            Abrir
            </button>
            ${config.activeServices.includes(serviceId) ?
                '<span class="status-badge active">Activo</span>' : ''}
                </div>
                `;

                servicesList.appendChild(serviceCard);
        });

        // Event listeners para abrir servicios
        document.querySelectorAll('.btn-open-service').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const serviceId = e.target.dataset.id;
                const serviceUrl = e.target.dataset.url;
                const serviceName = e.target.dataset.name;
                openService(serviceId, serviceUrl, serviceName);
            });
        });
    }

    // Renderizar servicios activos
    function renderActiveServices() {
        activeServicesList.innerHTML = '';
        activeCountSpan.textContent = config.activeServices.length;

        if (config.activeServices.length === 0) {
            activeServicesList.innerHTML = '<p class="no-active">Ningún servicio activo</p>';
            return;
        }

        const activeList = document.createElement('div');
        activeList.className = 'active-services-list';

        config.activeServices.forEach(serviceId => {
            const serviceInfo = services.find(s => {
                const id = s[0].toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                return id === serviceId;
            });

            if (serviceInfo) {
                const [name, url] = serviceInfo;
                const item = document.createElement('div');
                item.className = 'active-service-item';
                item.innerHTML = `
                <span class="service-name">${name}</span>
                <button class="btn-close-service" data-id="${serviceId}">✕</button>
                `;
                activeList.appendChild(item);
            }
        });

        activeServicesList.appendChild(activeList);

        // Event listeners para cerrar servicios
        document.querySelectorAll('.btn-close-service').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const serviceId = e.target.dataset.id;
                closeService(serviceId);
            });
        });
    }

    // Acciones del usuario
    async function updateRemoteData() {
        showStatus('Actualizando lista de servicios...', 'info');
        updateBtn.disabled = true;

        try {
            const result = await window.electronAPI.updateRemoteData();
            if (result.success) {
                showStatus('Lista actualizada correctamente', 'success');
                await loadConfig();
                await loadServices();
            } else {
                showStatus(`Error al actualizar: ${result.error}`, 'error');
            }
        } catch (error) {
            showStatus('Error al actualizar datos', 'error');
        } finally {
            updateBtn.disabled = false;
        }
    }

    async function openService(serviceId, serviceUrl, serviceName) {
        try {
            if (config.activeServices.includes(serviceId)) {
                showStatus('El servicio ya está activo', 'warning');
                return;
            }

            if (config.activeServices.length >= config.maxActiveServices) {
                showStatus(`Máximo de ${config.maxActiveServices} servicios activos`, 'warning');
                return;
            }

            showStatus(`Abriendo ${serviceName}...`, 'info');
            await window.electronAPI.openService(serviceId, serviceUrl, serviceName);
            showStatus(`${serviceName} abierto`, 'success');
            await loadConfig();
            renderServices();
            renderActiveServices();
        } catch (error) {
            showStatus('Error al abrir servicio', 'error');
        }
    }

    async function closeService(serviceId) {
        try {
            await window.electronAPI.closeService(serviceId);
            showStatus('Servicio cerrado', 'success');
            await loadConfig();
            renderServices();
            renderActiveServices();
        } catch (error) {
            showStatus('Error al cerrar servicio', 'error');
        }
    }

    async function saveSettings() {
        const newConfig = {
            blockingEnabled: blockingToggle.checked,
            maxActiveServices: parseInt(maxServicesInput.value) || 3
        };

        try {
            config = await window.electronAPI.updateConfig(newConfig);
            showStatus('Configuración guardada', 'success');
            updateBlockingStatus(config.blockingEnabled);
            maxActiveSpan.textContent = config.maxActiveServices;
            settingsPanel.classList.add('hidden');
            renderServices();
            renderActiveServices();
        } catch (error) {
            showStatus('Error al guardar configuración', 'error');
        }
    }

    // Event listeners
    updateBtn.addEventListener('click', updateRemoteData);

    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

    closeSettingsBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });

    blockingToggle.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        try {
            await window.electronAPI.toggleBlocking(enabled);
            updateBlockingStatus(enabled);
            showStatus(`Bloqueo ${enabled ? 'activado' : 'desactivado'}`, 'success');
        } catch (error) {
            e.target.checked = !enabled;
        }
    });

    window.electronAPI.onMaxServicesReached((maxServices) => {
        showStatus(`Límite de ${maxServices} servicios alcanzado`, 'warning');
    });

    window.electronAPI.onServiceClosed((serviceId) => {
        showStatus('Servicio cerrado', 'info');
        loadConfig().then(() => {
            renderServices();
            renderActiveServices();
        });
    });

    // Inicialización
    async function init() {
        await loadConfig();
        await loadServices();
    }

    init();
});
