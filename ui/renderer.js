document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
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
        statusMessage: document.getElementById('status-message'),
        blockingIndicator: document.getElementById('blocking-indicator'),
        blockingText: document.getElementById('blocking-text'),
        modalTabs: document.querySelectorAll('.modal-tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        btnZoomIn: document.getElementById('btn-zoom-in'),
        btnZoomOut: document.getElementById('btn-zoom-out')
    };

    // --- State ---
    let config = { enabledServices: [], blockingEnabled: true, maxActiveServices: 3, darkMode: true, lastUpdate: null };
    let allServices = [];
    let activeTabs = []; // Stores { id, url, title, webview, zoomLevel }
    let currentTabId = null;

    // --- Utilities ---
    const showStatus = (message, type = 'info') => {
        elements.statusMessage.textContent = message;
        elements.statusMessage.className = `status-message ${type}`;
        setTimeout(() => { elements.statusMessage.textContent = 'Ready'; elements.statusMessage.className = 'status-message'; }, 3000);
    };
    const formatDate = (isoString) => { if (!isoString) return 'Never'; return new Date(isoString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); };
    const generateId = (name) => name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

    // --- Core Logic ---
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
        } catch (error) { console.error(error); showStatus('Error loading configuration', 'error'); }
    };

    const loadServices = async () => {
        try {
            const data = await window.electronAPI.getServices();
            if (data && data.ai_services) {
                allServices = data.ai_services;
                renderSidebarServices();
                renderSettingsServices();
            }
        } catch (error) { console.error(error); showStatus('Error loading services', 'error'); }
    };

    const updateBlockingUI = (enabled) => { elements.blockingIndicator.className = enabled ? 'indicator active' : 'indicator inactive'; elements.blockingText.textContent = enabled ? 'Blocking Active' : 'Blocking Disabled'; };
    const applyDarkMode = (enabled) => { document.body.classList.toggle('dark-mode', enabled); };

    // --- Rendering: Sidebar (Launcher & Tabs Combined) ---
    const renderSidebarServices = () => {
        elements.servicesList.innerHTML = '';
        const enabledServices = allServices.filter(s => config.enabledServices.includes(generateId(s[0])));

        if (enabledServices.length === 0) {
            elements.servicesList.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 11px;">No active services.<br>Go to Settings to enable some.</div>`;
            return;
        }

        enabledServices.forEach(service => {
            const [name, url, type, privacy, color] = service;
            const id = generateId(name);
            const bgColor = color ? `#${color}` : '#4285f4';
            const isActive = id === currentTabId;
            const isOpen = activeTabs.some(t => t.id === id);

            const item = document.createElement('div');
            item.className = `service-launcher ${isActive ? 'active' : ''} ${isOpen ? 'open' : ''}`;
            item.dataset.id = id;
            
            item.innerHTML = `
                <div class="launcher-info">
                    <div class="service-dot" style="background-color: ${bgColor}"></div>
                    <div class="service-name">${name}</div>
                </div>
                ${isOpen ? `
                <div class="launcher-actions">
                    <button class="btn-icon-xs btn-reload" title="Reload">↻</button>
                    <button class="btn-icon-xs btn-close-tab" title="Close">✕</button>
                </div>
                ` : ''}
            `;

            // Click to Open/Switch
            item.querySelector('.launcher-info').addEventListener('click', () => {
                if (isOpen) {
                    switchToTab(id);
                } else {
                    createTab(id, url, name);
                }
            });

            // Actions
            if (isOpen) {
                item.querySelector('.btn-reload')?.addEventListener('click', (e) => { e.stopPropagation(); reloadTab(id); });
                item.querySelector('.btn-close-tab')?.addEventListener('click', (e) => { e.stopPropagation(); closeTab(id); });
            }

            elements.servicesList.appendChild(item);
        });
    };

    // --- Rendering: Settings (All Services with Toggles) ---
    const renderSettingsServices = () => {
        elements.allServicesList.innerHTML = '';
        allServices.forEach(service => {
            const [name, url, type, privacy, color] = service;
            const id = generateId(name);
            const bgColor = color ? `#${color}` : '#4285f4';
            const isEnabled = config.enabledServices.includes(id);

            const item = document.createElement('div');
            item.className = 'service-setting-item';
            item.innerHTML = `
                <div class="service-info"><div class="service-dot" style="background-color: ${bgColor}"></div><div class="service-info-name">${name}</div></div>
                <label class="toggle-switch"><input type="checkbox" ${isEnabled ? 'checked' : ''} data-service-id="${id}"><span class="toggle-slider"></span></label>
            `;
            item.querySelector('input').addEventListener('change', async (e) => {
                const serviceId = e.target.dataset.serviceId;
                try {
                    config.enabledServices = await window.electronAPI.toggleService(serviceId);
                    renderSidebarServices(); // Update sidebar
                    showStatus(`Service ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
                } catch (error) { e.target.checked = !e.target.checked; }
            });
            elements.allServicesList.appendChild(item);
        });
    };

    // --- Tab Management ---
    const createTab = (serviceId, url, title) => {
        if (activeTabs.length >= config.maxActiveServices) {
            showStatus(`Limit reached (${config.maxActiveServices}). Close a tab first.`, 'warning');
            return;
        }

        const webview = document.createElement('webview');
        webview.dataset.id = serviceId;
        webview.src = url;
        webview.partition = `persist:${serviceId}`;
        webview.webpreferences = { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true };

        elements.webviewsContainer.appendChild(webview);
        activeTabs.push({ id: serviceId, url, title, webview, zoomLevel: 0 });
        
        switchToTab(serviceId);
        elements.welcomeScreen.style.display = 'none';
        window.electronAPI.setActiveService(serviceId);
        renderSidebarServices(); // Update UI to show close/reload buttons
    };

    const switchToTab = (id) => {
        currentTabId = id;
        activeTabs.forEach(t => { t.webview.style.display = (t.id === id) ? 'flex' : 'none'; });
        window.electronAPI.setActiveService(id);
        renderSidebarServices(); // Update active state in sidebar
    };

    const closeTab = (id) => {
        const index = activeTabs.findIndex(t => t.id === id);
        if (index === -1) return;

        const tab = activeTabs[index];
        tab.webview.remove(); // Destroy webview to free RAM
        activeTabs.splice(index, 1);

        if (activeTabs.length > 0) {
            const newIndex = Math.min(index, activeTabs.length - 1);
            switchToTab(activeTabs[newIndex].id);
        } else {
            currentTabId = null;
            elements.welcomeScreen.style.display = 'flex';
        }
        renderSidebarServices(); // Update sidebar
    };

    const reloadTab = (id) => {
        const tab = activeTabs.find(t => t.id === id);
        if (tab) {
            tab.webview.reload();
            showStatus(`Reloading ${tab.title}...`, 'info');
        }
    };

    // --- Zoom Management ---
    const applyZoom = (id, level) => {
        const tab = activeTabs.find(t => t.id === id);
        if (tab) {
            tab.zoomLevel = level;
            tab.webview.setZoomLevel(level);
        }
    };

    const zoomIn = () => {
        if (!currentTabId) return;
        const tab = activeTabs.find(t => t.id === currentTabId);
        if (tab) applyZoom(currentTabId, Math.min(tab.zoomLevel + 0.5, 5)); // Max zoom limit
    };

    const zoomOut = () => {
        if (!currentTabId) return;
        const tab = activeTabs.find(t => t.id === currentTabId);
        if (tab) applyZoom(currentTabId, Math.max(tab.zoomLevel - 0.5, -5)); // Min zoom limit
    };

    // --- Settings Management ---
    const saveSettings = async () => {
        const newConfig = { blockingEnabled: elements.toggleBlocking.checked, maxActiveServices: parseInt(elements.maxServicesInput.value) || 3, darkMode: elements.toggleDarkMode.checked };
        try {
            config = await window.electronAPI.saveConfig(newConfig);
            showStatus('Settings saved', 'success');
            updateBlockingUI(config.blockingEnabled);
            applyDarkMode(config.darkMode);
            elements.settingsPanel.classList.add('hidden');
        } catch (error) { showStatus('Error saving settings', 'error'); }
    };

    // --- Event Listeners ---
    elements.toggleSidebarBtn.addEventListener('click', () => elements.sidebar.classList.toggle('hidden'));
    elements.btnSettings.addEventListener('click', () => { renderSettingsServices(); elements.settingsPanel.classList.remove('hidden'); });
    elements.btnCloseSettings.addEventListener('click', () => elements.settingsPanel.classList.add('hidden'));
    elements.btnSaveSettings.addEventListener('click', saveSettings);

    elements.btnZoomIn.addEventListener('click', zoomIn);
    elements.btnZoomOut.addEventListener('click', zoomOut);

    elements.btnUpdate.addEventListener('click', async () => {
        showStatus('Updating services...', 'info');
        try {
            const result = await window.electronAPI.updateRemoteData();
            if (result.success) {
                await loadServices();
                config.lastUpdate = new Date().toISOString();
                elements.lastUpdate.textContent = formatDate(config.lastUpdate);
                showStatus('Update successful', 'success');
            } else { showStatus('Update failed: ' + result.error, 'error'); }
        } catch (error) { showStatus('Update failed', 'error'); }
    });

    elements.modalTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            elements.modalTabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') elements.settingsPanel.classList.add('hidden');
        // Optional: Keyboard shortcuts for zoom
        if (e.ctrlKey && e.key === '=') { e.preventDefault(); zoomIn(); }
        if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomOut(); }
    });

    // --- Initialization ---
    const init = async () => { await loadConfig(); await loadServices(); };
    init();
});
