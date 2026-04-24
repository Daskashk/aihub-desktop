document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const elements = {
        tabsList: document.getElementById('tabs-list'),
        addTabBtn: document.getElementById('btn-add-tab'),
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
        tabContents: document.querySelectorAll('.tab-content')
    };

    // --- State ---
    let config = {
        enabledServices: [],
        blockingEnabled: true,
        maxActiveServices: 3,
        darkMode: true,
        lastUpdate: null
    };
    let allServices = [];
    let activeTabs = [];
    let currentTabId = null;

    // --- Utilities ---
    const showStatus = (message, type = 'info') => {
        elements.statusMessage.textContent = message;
        elements.statusMessage.className = `status-message ${type}`;
        setTimeout(() => {
            elements.statusMessage.textContent = 'Ready';
            elements.statusMessage.className = 'status-message';
        }, 3000);
    };

    const formatDate = (isoString) => {
        if (!isoString) return 'Never';
        return new Date(isoString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    };

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
            renderActiveServicesSidebar();
            renderAllServicesSettings();
        } catch (error) {
            console.error('Error loading config:', error);
            showStatus('Error loading configuration', 'error');
        }
    };

    const loadServices = async () => {
        try {
            const data = await window.electronAPI.getServices();
            if (data && data.ai_services) {
                allServices = data.ai_services;
                renderActiveServicesSidebar();
                renderAllServicesSettings();
            } else {
                elements.servicesList.innerHTML = '<div class="info-message" style="padding:16px; color:var(--text-secondary)">No services found.</div>';
                elements.allServicesList.innerHTML = '<div class="info-message" style="padding:16px; color:var(--text-secondary)">No services found.</div>';
            }
        } catch (error) {
            console.error('Error loading services:', error);
            showStatus('Error loading services', 'error');
        }
    };

    const updateBlockingUI = (enabled) => {
        elements.blockingIndicator.className = enabled ? 'indicator active' : 'indicator inactive';
        elements.blockingText.textContent = enabled ? 'Blocking Active' : 'Blocking Disabled';
    };

    const applyDarkMode = (enabled) => {
        document.body.classList.toggle('dark-mode', enabled);
    };

    // --- Rendering: Sidebar (Only Enabled Services) ---
    const renderActiveServicesSidebar = () => {
        elements.servicesList.innerHTML = '';
        
        const enabledServices = allServices.filter(service => {
            const serviceId = generateId(service[0]);
            return config.enabledServices.includes(serviceId);
        });

        if (enabledServices.length === 0) {
            elements.servicesList.innerHTML = `
                <div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 12px;">
                    No active services.<br>Go to Settings to enable some.
                </div>
            `;
            return;
        }

        enabledServices.forEach(service => {
            const [name, url, type, privacy, color] = service;
            const id = generateId(name);
            const bgColor = color ? `#${color}` : '#4285f4';

            const item = document.createElement('div');
            item.className = 'service-launcher';
            item.dataset.id = id;
            
            item.innerHTML = `
                <div class="service-dot" style="background-color: ${bgColor}"></div>
                <div class="service-name">${name}</div>
            `;

            item.addEventListener('click', () => {
                createTab(id, url, name);
            });

            elements.servicesList.appendChild(item);
        });
    };

    // --- Rendering: Settings (All Services with Toggles) ---
    const renderAllServicesSettings = () => {
        elements.allServicesList.innerHTML = '';

        if (allServices.length === 0) {
            elements.allServicesList.innerHTML = '<div style="padding:16px; color:var(--text-secondary)">Click 🔄 to load services.</div>';
            return;
        }

        allServices.forEach(service => {
            const [name, url, type, privacy, color] = service;
            const id = generateId(name);
            const bgColor = color ? `#${color}` : '#4285f4';
            const isEnabled = config.enabledServices.includes(id);

            const item = document.createElement('div');
            item.className = 'service-setting-item';
            
            item.innerHTML = `
                <div class="service-info">
                    <div class="service-dot" style="background-color: ${bgColor}"></div>
                    <div class="service-info-name">${name}</div>
                </div>
                <label class="toggle-switch">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} data-service-id="${id}">
                    <span class="toggle-slider"></span>
                </label>
            `;

            // Event: Toggle Service
            item.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
                const serviceId = e.target.dataset.serviceId;
                try {
                    config.enabledServices = await window.electronAPI.toggleService(serviceId);
                    renderActiveServicesSidebar(); // Update sidebar immediately!
                    showStatus(`Service ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
                } catch (error) {
                    console.error('Error toggling service:', error);
                    showStatus('Error updating service', 'error');
                    e.target.checked = !e.target.checked; // Revert
                }
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

        const existingTab = activeTabs.find(t => t.id === serviceId);
        if (existingTab) {
            switchToTab(serviceId);
            return;
        }

        const tab = document.createElement('div');
        tab.className = 'tab-item active';
        tab.dataset.id = serviceId;
        tab.innerHTML = `
            <span class="tab-title">${title}</span>
            <button class="btn-close-tab">✕</button>
        `;

        const webview = document.createElement('webview');
        webview.dataset.id = serviceId;
        webview.src = url;

        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn-close-tab')) switchToTab(serviceId);
        });
        tab.querySelector('.btn-close-tab').addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(serviceId);
        });

        elements.tabsList.appendChild(tab);
        elements.webviewsContainer.appendChild(webview);

        activeTabs.push({ id: serviceId, url, title, webview });
        switchToTab(serviceId);
        elements.welcomeScreen.style.display = 'none';

        window.electronAPI.setActiveService(serviceId);
    };

    const switchToTab = (id) => {
        document.querySelectorAll('.tab-item').forEach(tab => tab.classList.toggle('active', tab.dataset.id === id));
        document.querySelectorAll('webview').forEach(wv => {
            wv.style.display = (wv.dataset.id === id) ? 'flex' : 'none';
        });
        currentTabId = id;
        window.electronAPI.setActiveService(id);
    };

    const closeTab = (id) => {
        const tab = document.querySelector(`.tab-item[data-id="${id}"]`);
        const webview = document.querySelector(`webview[data-id="${id}"]`);
        
        if (tab) tab.remove();
        if (webview) webview.remove(); // Frees RAM

        const index = activeTabs.findIndex(t => t.id === id);
        if (index !== -1) activeTabs.splice(index, 1);

        if (activeTabs.length > 0) {
            const newIndex = Math.min(index, activeTabs.length - 1);
            switchToTab(activeTabs[newIndex].id);
        } else {
            elements.welcomeScreen.style.display = 'flex';
            currentTabId = null;
        }
    };

    // --- Settings Management ---
    const saveSettings = async () => {
        const newConfig = {
            blockingEnabled: elements.toggleBlocking.checked,
            maxActiveServices: parseInt(elements.maxServicesInput.value) || 3,
            darkMode: elements.toggleDarkMode.checked
        };
        try {
            config = await window.electronAPI.saveConfig(newConfig);
            showStatus('Settings saved', 'success');
            updateBlockingUI(config.blockingEnabled);
            applyDarkMode(config.darkMode);
            elements.settingsPanel.classList.add('hidden');
        } catch (error) {
            showStatus('Error saving settings', 'error');
        }
    };

    // --- Event Listeners ---
    elements.addTabBtn.addEventListener('click', () => elements.sidebar.classList.toggle('hidden'));
    elements.toggleSidebarBtn.addEventListener('click', () => elements.sidebar.classList.toggle('hidden'));

    elements.btnSettings.addEventListener('click', () => {
        renderAllServicesSettings(); // Refresh list when opening
        elements.settingsPanel.classList.remove('hidden');
    });

    elements.btnCloseSettings.addEventListener('click', () => elements.settingsPanel.classList.add('hidden'));
    elements.btnSaveSettings.addEventListener('click', saveSettings);

    elements.btnUpdate.addEventListener('click', async () => {
        showStatus('Updating services...', 'info');
        try {
            const result = await window.electronAPI.updateRemoteData();
            if (result.success) {
                await loadServices();
                config.lastUpdate = new Date().toISOString();
                elements.lastUpdate.textContent = formatDate(config.lastUpdate);
                showStatus('Update successful', 'success');
            } else {
                showStatus('Update failed: ' + result.error, 'error');
            }
        } catch (error) {
            showStatus('Update failed', 'error');
        }
    });

    // Settings Tabs Navigation
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
    });

    // --- Initialization ---
    const init = async () => {
        await loadConfig();
        await loadServices();
    };

    init();
});
