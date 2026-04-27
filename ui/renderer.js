document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        sidebar: document.getElementById('sidebar'),
                          toggleSidebarBtn: document.getElementById('btn-toggle-sidebar'),
                          servicesList: document.getElementById('services-list'),
                          allServicesList: document.getElementById('all-services-list'),
                          webviewsContainer: document.getElementById('webviews-container'),
                          welcomeScreen: document.getElementById('welcome-screen'),
                          settingsPanel: document.getElementById('settings-panel'),
                          btnSettings: document.getElementById('btn-settings'),
                          btnUpdate: document.getElementById('btn-update'),
                          toggleBlocking: document.getElementById('toggle-blocking'),
                          maxServicesInput: document.getElementById('max-services'),
                          toggleDarkMode: document.getElementById('toggle-dark-mode'),
                          lastUpdate: document.getElementById('last-update'),
                          btnSaveSettings: document.getElementById('btn-save-settings'),
                          btnCloseSettings: document.getElementById('btn-close-settings'),
                          modalTabs: document.querySelectorAll('.modal-tab'),
                          tabContents: document.querySelectorAll('.tab-content'),
                          btnZoomIn: document.getElementById('btn-zoom-in'),
                          btnZoomOut: document.getElementById('btn-zoom-out'),
                          blockingIndicator: document.getElementById('blocking-indicator'),
                          blockingText: document.getElementById('blocking-text'),
                          btnClearData: document.getElementById('btn-clear-data'),
                          clearDataModal: document.getElementById('clear-data-modal'),
                          btnCancelClear: document.getElementById('btn-cancel-clear'),
                          btnConfirmClear: document.getElementById('btn-confirm-clear')
    };

    let config = { enabledServices: [], blockingEnabled: true, maxActiveServices: 3, darkMode: true, lastUpdate: null };
    let allServices = [];
    let activeTabs = [];
    let currentTabId = null;

    const CHROME_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    const formatDate = (isoString) => { if (!isoString) return 'Never'; return new Date(isoString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); };
    const generateId = (name) => name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

    const escapeHtml = (unsafe) => {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    const sanitizeColor = (color) => {
        if (!color) return '#4285f4';
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color) ? `#${color}` : '#4285f4';
    };

    const updateBlockingUI = (enabled) => {
        elements.blockingIndicator.className = enabled ? 'indicator active' : 'indicator inactive';
        elements.blockingText.textContent = enabled ? 'Blocking Active' : 'Blocking Inactive';
    };

    const applyDarkMode = (enabled) => { document.body.classList.toggle('dark-mode', enabled); };

    const loadConfig = async () => {
        try {
            config = await window.electronAPI.getConfig();
            elements.toggleBlocking.checked = config.blockingEnabled;
            elements.maxServicesInput.value = config.maxActiveServices;
            elements.toggleDarkMode.checked = config.darkMode;
            elements.lastUpdate.textContent = formatDate(config.lastUpdate);
            updateBlockingUI(config.blockingEnabled);
            applyDarkMode(config.darkMode);
            renderSidebarServices();
            renderSettingsServices();
        } catch (error) { console.error(error); }
    };

    const loadServices = async () => {
        try {
            const data = await window.electronAPI.getServices();
            if (data && data.ai_services) {
                allServices = data.ai_services;
                renderSidebarServices();
                renderSettingsServices();
            }
        } catch (error) { console.error(error); }
    };

    const renderSidebarServices = () => {
        const enabledServices = allServices.filter(s => { const id = s[5] || generateId(s[0]); return config.enabledServices.includes(id); });
        if (enabledServices.length === 0) { elements.servicesList.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 10px;">No active services.<br>Go to Settings.</div>`; return; }

        const currentItems = elements.servicesList.querySelectorAll('.service-launcher');
        if (currentItems.length !== enabledServices.length || elements.servicesList.querySelector('div[style]')) {
            elements.servicesList.innerHTML = '';
            enabledServices.forEach(service => {
                const [name, url, type, privacy, color, explicitId] = service;
                const id = explicitId || generateId(name);
                const bgColor = sanitizeColor(color);
                const isOpen = activeTabs.some(t => t.id === id);
                const isActive = id === currentTabId;

                const item = document.createElement('div');
                item.className = `service-launcher ${isActive ? 'active' : ''} ${isOpen ? 'is-open' : ''}`;
                item.dataset.id = id;
                item.innerHTML = `
                <div class="launcher-info"><div class="service-dot" style="background-color: ${bgColor}"></div><div class="service-name">${escapeHtml(name)}</div></div>
                <div class="launcher-actions"><button class="btn-xs btn-reload" title="Reload">↻</button><button class="btn-xs btn-close" title="Close">✕</button></div>
                `;
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-close')) closeTab(id);
                    else if (e.target.closest('.btn-reload')) reloadTab(id);
                    else { if (isOpen) switchToTab(id); else createTab(id, url, name); }
                });
                elements.servicesList.appendChild(item);
            });
        } else {
            currentItems.forEach(item => { const id = item.dataset.id; const isOpen = activeTabs.some(t => t.id === id); const isActive = id === currentTabId; item.className = `service-launcher ${isActive ? 'active' : ''} ${isOpen ? 'is-open' : ''}`; });
        }
    };

    const renderSettingsServices = () => {
        elements.allServicesList.innerHTML = '';
        allServices.forEach(service => {
            const [name, url, type, privacy, color, explicitId] = service;
            const id = explicitId || generateId(name);
            const bgColor = sanitizeColor(color);
            const isEnabled = config.enabledServices.includes(id);
            const item = document.createElement('div');
            item.className = 'service-setting-item';
            item.innerHTML = `<div class="service-info"><div class="service-dot" style="background-color: ${bgColor}"></div><div class="service-info-name">${escapeHtml(name)}</div></div><label class="toggle-switch"><input type="checkbox" ${isEnabled ? 'checked' : ''} data-service-id="${id}"><span class="toggle-slider"></span></label>`;
            item.querySelector('input').addEventListener('change', async (e) => {
                const serviceId = e.target.dataset.serviceId;
                try { config.enabledServices = await window.electronAPI.toggleService(serviceId); renderSidebarServices(); } catch (error) { e.target.checked = !e.target.checked; }
            });
            elements.allServicesList.appendChild(item);
        });
    };

    const createTab = (serviceId, url, title) => {
        if (activeTabs.length >= config.maxActiveServices) { alert(`Limit reached (${config.maxActiveServices}). Close a tab first.`); return; }
        const webview = document.createElement('webview');
        webview.dataset.id = serviceId;
        webview.src = url;
        webview.partition = `persist:${serviceId}`;
        webview.setAttribute('useragent', CHROME_UA);
        webview.webpreferences = { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowPopups: true, darkTheme: config.darkMode };
        webview.style.display = 'none';
        elements.webviewsContainer.appendChild(webview);
        activeTabs.push({ id: serviceId, url, title, webview, zoomLevel: 0 });
        switchToTab(serviceId); window.electronAPI.setActiveService(serviceId); renderSidebarServices();
    };

    const switchToTab = (id) => { currentTabId = id; activeTabs.forEach(t => { t.webview.style.display = (t.id === id) ? 'flex' : 'none'; }); elements.welcomeScreen.style.display = 'none'; window.electronAPI.setActiveService(id); renderSidebarServices(); };

    const closeTab = (id) => {
        const index = activeTabs.findIndex(t => t.id === id); if (index === -1) return;
        const tab = activeTabs[index];
        try {
            tab.webview.stop();
            tab.webview.src = 'about:blank';
        } catch (e) {}
        tab.webview.remove();

        activeTabs.splice(index, 1);
        if (activeTabs.length > 0) { switchToTab(activeTabs[Math.min(index, activeTabs.length - 1)].id); }
        else { currentTabId = null; elements.welcomeScreen.style.display = 'flex'; }
        renderSidebarServices();
    };

    const reloadTab = (id) => { const tab = activeTabs.find(t => t.id === id); if (tab) tab.webview.reload(); };

    const applyZoom = (id, level) => { const tab = activeTabs.find(t => t.id === id); if (tab) { tab.zoomLevel = level; tab.webview.setZoomLevel(level); } };
    const zoomIn = () => { if (!currentTabId) return; const tab = activeTabs.find(t => t.id === currentTabId); if (tab) applyZoom(currentTabId, Math.min(tab.zoomLevel + 0.5, 5)); };
    const zoomOut = () => { if (!currentTabId) return; const tab = activeTabs.find(t => t.id === currentTabId); if (tab) applyZoom(currentTabId, Math.max(tab.zoomLevel - 0.5, -5)); };

    elements.toggleSidebarBtn.addEventListener('click', () => elements.sidebar.classList.toggle('hidden'));
    elements.btnSettings.addEventListener('click', () => { renderSettingsServices(); elements.settingsPanel.classList.remove('hidden'); });
    elements.btnCloseSettings.addEventListener('click', () => elements.settingsPanel.classList.add('hidden'));
    elements.btnSaveSettings.addEventListener('click', async () => {
        const newConfig = { blockingEnabled: elements.toggleBlocking.checked, maxActiveServices: parseInt(elements.maxServicesInput.value) || 3, darkMode: elements.toggleDarkMode.checked };
        try { config = await window.electronAPI.saveConfig(newConfig); updateBlockingUI(config.blockingEnabled); applyDarkMode(config.darkMode); elements.settingsPanel.classList.add('hidden'); } catch (error) {}
    });

    elements.btnZoomIn.addEventListener('click', zoomIn);
    elements.btnZoomOut.addEventListener('click', zoomOut);

    elements.btnUpdate.addEventListener('click', async () => {
        elements.blockingIndicator.className = 'indicator';
        elements.blockingText.textContent = 'Updating...';
        try {
            const result = await window.electronAPI.updateRemoteData();
            if (result.success) {
                if (result.updated) { await loadServices(); config.lastUpdate = new Date().toISOString(); elements.lastUpdate.textContent = formatDate(config.lastUpdate); elements.blockingText.textContent = 'Updated!'; }
                else { elements.blockingText.textContent = 'Up to date'; }
            } else { elements.blockingText.textContent = 'Update Failed'; }
            setTimeout(() => updateBlockingUI(config.blockingEnabled), 2500);
        } catch (error) { elements.blockingText.textContent = 'Update Error'; setTimeout(() => updateBlockingUI(config.blockingEnabled), 2500); }
    });

    elements.btnClearData.addEventListener('click', () => { if (!currentTabId) return; elements.clearDataModal.classList.remove('hidden'); });
    elements.btnCancelClear.addEventListener('click', () => elements.clearDataModal.classList.add('hidden'));
    elements.btnConfirmClear.addEventListener('click', async () => {
        elements.clearDataModal.classList.add('hidden');
        if (currentTabId) {
            try {
                const result = await window.electronAPI.clearServiceData(currentTabId);
                if (result.success) {
                    reloadTab(currentTabId);
                } else {
                    alert('Failed to clear data: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Error clearing data');
            }
        }
    });

    elements.modalTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            elements.modalTabs.forEach(t => t.classList.remove('active')); elements.tabContents.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active'); document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');
        });
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { elements.settingsPanel.classList.add('hidden'); elements.clearDataModal.classList.add('hidden'); } if (e.ctrlKey && e.key === '=') { e.preventDefault(); zoomIn(); } if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomOut(); } });

    const init = async () => { await loadConfig(); await loadServices(); };
    init();
});
