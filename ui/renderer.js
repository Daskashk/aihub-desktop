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
                          btnZoomReset: document.getElementById('btn-zoom-reset'),
                          btnOpenBrowser: document.getElementById('btn-open-browser'),
                          blockingIndicator: document.getElementById('blocking-indicator'),
                          blockingText: document.getElementById('blocking-text'),
                          btnClearData: document.getElementById('btn-clear-data'),
                          clearDataModal: document.getElementById('clear-data-modal'),
                          btnCancelClear: document.getElementById('btn-cancel-clear'),
                          btnConfirmClear: document.getElementById('btn-confirm-clear'),
                          btnReloadPage: document.getElementById('btn-reload-page'),
                          serviceSearch: document.getElementById('service-search'),
                          categoryFilter: document.getElementById('category-filter')
    };

    let config = { enabledServices: [], blockingEnabled: true, maxActiveServices: 3, darkMode: true, lastUpdate: null };
    let allServices = [];
    let activeTabs = [];
    let currentTabId = null;
    let appVersion = '0.5.1-beta';
    let currentFilter = 'all';
    let searchQuery = '';

    // --- UTILITY FUNCTIONS ---
    const formatDate = (isoString) => {
        if (!isoString) return 'Never';
        return new Date(isoString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    };

    const generateId = (name) => name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');

    const escapeHtml = (unsafe) => {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    const sanitizeColor = (color) => {
        if (!color) return '#4285f4';
        const hex = color.replace(/^#/, '');
        return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{4}$|^[0-9A-Fa-f]{6}$|^[0-9A-Fa-f]{8}$/.test(hex) ? `#${hex}` : '#4285f4';
    };

    // --- BADGE GENERATORS ---

    const getPrivacyBadge = (privacy) => {
        if (!privacy) return '';
        const normalized = privacy.toLowerCase().trim();
        if (normalized === 'privacy focused') {
            return `<span class="privacy-badge privacy-focused">Privacy Focused</span>`;
        } else if (normalized === 'privacy friendly') {
            return `<span class="privacy-badge privacy-friendly">Privacy Friendly</span>`;
        } else if (normalized === 'not for privacy') {
            return `<span class="privacy-badge not-for-privacy">Not for Privacy</span>`;
        }
        return '';
    };

    // NEW: Pricing badge based on type (Free/Freemium/Paid)
    const getPricingBadge = (type) => {
        if (!type) return '';
        const normalized = type.toLowerCase().trim();
        if (normalized === 'free') {
            return `<span class="pricing-badge pricing-free">Free</span>`;
        } else if (normalized === 'freemium') {
            return `<span class="pricing-badge pricing-freemium">Freemium</span>`;
        } else if (normalized === 'paid') {
            return `<span class="pricing-badge pricing-paid">Paid</span>`;
        }
        return '';
    };

    // --- UI UPDATE FUNCTIONS ---
    const updateBlockingUI = (enabled) => {
        elements.blockingIndicator.className = enabled ? 'indicator active' : 'indicator inactive';
        elements.blockingText.textContent = enabled ? 'Blocking Active' : 'Blocking Inactive';
    };

    const applyDarkMode = (enabled) => {
        document.body.classList.toggle('dark-mode', enabled);
    };

    // --- LOAD CONFIG & SERVICES ---
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
                populateCategoryFilter();
                renderSidebarServices();
                renderSettingsServices();
            }
        } catch (error) { console.error(error); }
    };

    const loadAppVersion = async () => {
        try {
            appVersion = await window.electronAPI.getAppVersion();
            const versionEl = document.getElementById('about-version');
            if (versionEl) versionEl.textContent = `v${appVersion}`;
        } catch (e) {}
    };

    // --- CATEGORY FILTER ---
    const populateCategoryFilter = () => {
        if (!elements.categoryFilter) return;
        const categories = new Set();
        allServices.forEach(s => { if (s[2]) categories.add(s[2]); });

        elements.categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        [...categories].sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.toLowerCase();
            option.textContent = cat;
            elements.categoryFilter.appendChild(option);
        });
    };

    // --- SIDEBAR RENDERING ---
    const renderSidebarServices = () => {
        const enabledServices = allServices.filter(s => {
            const id = s[5] || generateId(s[0]);
            return config.enabledServices.includes(id);
        });

        if (enabledServices.length === 0) {
            elements.servicesList.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 10px;">No active services.<br>Go to Settings.</div>`;
            return;
        }

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
                <div class="launcher-info">
                <div class="service-dot" style="background-color: ${bgColor}"></div>
                <div class="service-name" style="color: ${bgColor}">${escapeHtml(name)}</div>
                </div>
                <div class="launcher-actions">
                <button class="btn-xs btn-reload" title="Reload">&#8635;</button>
                <button class="btn-xs btn-close" title="Close">&#10005;</button>
                </div>`;
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-close')) closeTab(id);
                    else if (e.target.closest('.btn-reload')) reloadTab(id);
                    else { if (isOpen) switchToTab(id); else createTab(id, url, name); }
                });
                elements.servicesList.appendChild(item);
            });
        } else {
            currentItems.forEach(item => {
                const id = item.dataset.id;
                const isOpen = activeTabs.some(t => t.id === id);
                const isActive = id === currentTabId;
                item.className = `service-launcher ${isActive ? 'active' : ''} ${isOpen ? 'is-open' : ''}`;
            });
        }
    };

    // --- SETTINGS SERVICES RENDERING (IMPROVED UI) ---
    const renderSettingsServices = () => {
        elements.allServicesList.innerHTML = '';

        // Filter and search
        let filteredServices = allServices;
        if (currentFilter !== 'all') {
            filteredServices = filteredServices.filter(s => s[2] && s[2].toLowerCase() === currentFilter);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredServices = filteredServices.filter(s => s[0] && s[0].toLowerCase().includes(q));
        }

        if (filteredServices.length === 0) {
            elements.allServicesList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 12px;">No services match your filter.</div>';
            return;
        }

        filteredServices.forEach(service => {
            const [name, url, type, privacy, color, explicitId] = service;
            const id = explicitId || generateId(name);
            const bgColor = sanitizeColor(color);
            const isEnabled = config.enabledServices.includes(id);
            const privacyBadgeHtml = getPrivacyBadge(privacy);
            const pricingBadgeHtml = getPricingBadge(type);

            const item = document.createElement('div');
            item.className = 'service-setting-item';
            item.innerHTML = `
            <div class="service-info">
            <div class="service-info-details">
            <div class="service-info-name" style="color: ${bgColor}">${escapeHtml(name)}</div>
            <div class="service-info-badges">
            ${pricingBadgeHtml}
            ${privacyBadgeHtml}
            </div>
            </div>
            </div>
            <label class="toggle-switch material-toggle">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} data-service-id="${id}">
            <span class="toggle-slider"></span>
            </label>`;

            item.querySelector('input').addEventListener('change', async (e) => {
                const serviceId = e.target.dataset.serviceId;
                try {
                    config.enabledServices = await window.electronAPI.toggleService(serviceId);
                    renderSidebarServices();
                } catch (error) {
                    e.target.checked = !e.target.checked;
                }
            });
            elements.allServicesList.appendChild(item);
        });
    };

    // --- WEBVIEW LISTENERS ---
    const setupWebviewListeners = (webview) => {
        // Handle new-window events for external links
        webview.addEventListener('new-window', async (e) => {
            e.preventDefault();
            if (e.url && (e.url.startsWith('http://') || e.url.startsWith('https://'))) {
                try {
                    await window.electronAPI.openInBrowser(e.url);
                } catch (error) {
                    console.error('[Webview] Failed to open URL in browser:', error);
                }
            }
        });

        // NEW: Context menu for right-click on webview
        webview.addEventListener('context-menu', async (e) => {
            e.preventDefault();
            const menuItems = [];

            // If there's a link URL, add link options
            if (e.linkURL && (e.linkURL.startsWith('http://') || e.linkURL.startsWith('https://'))) {
                menuItems.push({
                    label: 'Open Link in Browser',
                    action: () => window.electronAPI.openInBrowser(e.linkURL)
                });
                menuItems.push({
                    label: 'Copy Link Address',
                    action: async () => {
                        try {
                            const result = await window.electronAPI.cleanUrlTracking(e.linkURL);
                            await navigator.clipboard.writeText(result.cleanedUrl);
                        } catch (err) {
                            await navigator.clipboard.writeText(e.linkURL);
                        }
                    }
                });
                menuItems.push({ type: 'separator' });
            }

            // Navigation options
            menuItems.push({
                label: 'Go Back',
                action: () => { try { webview.goBack(); } catch (err) {} },
                           enabled: webview.canGoBack()
            });
            menuItems.push({
                label: 'Go Forward',
                action: () => { try { webview.goForward(); } catch (err) {} },
                           enabled: webview.canGoForward()
            });
            menuItems.push({
                label: 'Reload',
                action: () => webview.reload()
            });
            menuItems.push({ type: 'separator' });

            // Copy current page URL
            menuItems.push({
                label: 'Copy Page URL',
                action: async () => {
                    try {
                        const currentUrl = webview.getURL();
                        await navigator.clipboard.writeText(currentUrl);
                    } catch (err) {}
                }
            });
            menuItems.push({
                label: 'Open Page in Browser',
                action: async () => {
                    try {
                        const currentUrl = webview.getURL();
                        if (currentUrl && currentUrl !== 'about:blank') {
                            await window.electronAPI.openInBrowser(currentUrl);
                        }
                    } catch (err) {}
                }
            });

            showContextMenu(menuItems, e);
        });
    };

    // --- CUSTOM CONTEXT MENU ---
    const showContextMenu = (items, event) => {
        // Remove any existing context menu
        const existingMenu = document.getElementById('custom-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'custom-context-menu';
        menu.className = 'context-menu';

        items.forEach(item => {
            if (item.type === 'separator') {
                const sep = document.createElement('div');
                sep.className = 'context-menu-separator';
                menu.appendChild(sep);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                if (item.enabled === false) menuItem.classList.add('disabled');
                menuItem.textContent = item.label;
                menuItem.addEventListener('click', () => {
                    menu.remove();
                    if (item.enabled !== false && item.action) item.action();
                });
                    menu.appendChild(menuItem);
            }
        });

        // Position the menu
        const x = event.clientX || (event.event && event.event.clientX) || 0;
        const y = event.clientY || (event.event && event.event.clientY) || 0;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        document.body.appendChild(menu);

        // Adjust position if menu goes off-screen
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 5}px`;
            if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 5}px`;
        });

        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);

        // Close on Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                menu.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    };

    // --- TAB MANAGEMENT ---
    const createTab = (serviceId, url, title) => {
        if (activeTabs.length >= config.maxActiveServices) {
            alert(`Limit reached (${config.maxActiveServices}). Close a tab first.`);
            return;
        }
        const webview = document.createElement('webview');
        webview.dataset.id = serviceId;
        webview.src = url;
        webview.partition = `persist:${serviceId}`;
        webview.webpreferences = {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
            allowPopups: false,
            darkTheme: config.darkMode
        };
        webview.style.display = 'none';
        elements.webviewsContainer.appendChild(webview);

        setupWebviewListeners(webview);

        activeTabs.push({ id: serviceId, url, title, webview, zoomLevel: 0 });
        switchToTab(serviceId);
        window.electronAPI.setActiveService(serviceId);
        renderSidebarServices();
    };

    const switchToTab = (id) => {
        currentTabId = id;
        activeTabs.forEach(t => {
            t.webview.style.display = (t.id === id) ? 'flex' : 'none';
        });
        elements.welcomeScreen.style.display = 'none';
        window.electronAPI.setActiveService(id);
        renderSidebarServices();
    };

    const closeTab = (id) => {
        const index = activeTabs.findIndex(t => t.id === id);
        if (index === -1) return;
        const tab = activeTabs[index];
        try {
            tab.webview.stop();
        } catch (e) {}
        tab.webview.remove();

        activeTabs.splice(index, 1);
        if (activeTabs.length > 0) {
            switchToTab(activeTabs[Math.min(index, activeTabs.length - 1)].id);
        } else {
            currentTabId = null;
            elements.welcomeScreen.style.display = 'flex';
        }
        renderSidebarServices();
    };

    const reloadTab = (id) => {
        const tab = activeTabs.find(t => t.id === id);
        if (tab) tab.webview.reload();
    };

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
            if (tab) applyZoom(currentTabId, Math.min(tab.zoomLevel + 0.5, 5));
        };

            const zoomOut = () => {
                if (!currentTabId) return;
                const tab = activeTabs.find(t => t.id === currentTabId);
                if (tab) applyZoom(currentTabId, Math.max(tab.zoomLevel - 0.5, -5));
            };

                const zoomReset = () => {
                    if (!currentTabId) return;
                    applyZoom(currentTabId, 0);
                };

                // Open current service in default browser
                const openInBrowser = async () => {
                    if (!currentTabId) return;
                    const tab = activeTabs.find(t => t.id === currentTabId);
                    if (tab) {
                        try {
                            const currentUrl = tab.webview.src || tab.url;
                            if (currentUrl && currentUrl !== 'about:blank') {
                                await window.electronAPI.openInBrowser(currentUrl);
                            }
                        } catch (error) {
                            console.error('[OpenInBrowser] Failed:', error);
                        }
                    }
                };

                // --- EVENT LISTENERS ---

                elements.toggleSidebarBtn.addEventListener('click', () => elements.sidebar.classList.toggle('hidden'));

                elements.btnSettings.addEventListener('click', () => {
                    renderSettingsServices();
                    elements.settingsPanel.classList.remove('hidden');
                });

                elements.btnCloseSettings.addEventListener('click', () => elements.settingsPanel.classList.add('hidden'));

                elements.btnSaveSettings.addEventListener('click', async () => {
                    const newConfig = {
                        blockingEnabled: elements.toggleBlocking.checked,
                        maxActiveServices: parseInt(elements.maxServicesInput.value) || 3,
                                                          darkMode: elements.toggleDarkMode.checked
                    };
                    try {
                        config = await window.electronAPI.saveConfig(newConfig);
                        updateBlockingUI(config.blockingEnabled);
                        applyDarkMode(config.darkMode);
                        elements.settingsPanel.classList.add('hidden');
                    } catch (error) {}
                });

                elements.btnZoomIn.addEventListener('click', zoomIn);
                elements.btnZoomOut.addEventListener('click', zoomOut);
                if (elements.btnZoomReset) elements.btnZoomReset.addEventListener('click', zoomReset);
                elements.btnOpenBrowser.addEventListener('click', openInBrowser);
    elements.btnReloadPage.addEventListener('click', () => { if (currentTabId) reloadTab(currentTabId); });

    elements.btnUpdate.addEventListener('click', async () => {
        elements.blockingIndicator.className = 'indicator';
        elements.blockingText.textContent = 'Updating...';
        try {
            const result = await window.electronAPI.updateRemoteData();
            if (result.success) {
                if (result.updated) {
                    await loadServices();
                    config.lastUpdate = new Date().toISOString();
                    elements.lastUpdate.textContent = formatDate(config.lastUpdate);
                    elements.blockingText.textContent = 'Updated!';
                } else {
                    elements.blockingText.textContent = 'Up to date';
                }
            } else {
                elements.blockingText.textContent = 'Update Failed';
            }
            setTimeout(() => updateBlockingUI(config.blockingEnabled), 2500);
        } catch (error) {
            elements.blockingText.textContent = 'Update Error';
            setTimeout(() => updateBlockingUI(config.blockingEnabled), 2500);
        }
    });

    elements.btnClearData.addEventListener('click', () => {
        if (!currentTabId) return;
        elements.clearDataModal.classList.remove('hidden');
    });

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
            elements.modalTabs.forEach(t => t.classList.remove('active'));
            elements.tabContents.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');
        });
    });

    // Handle About tab link clicks
    document.querySelectorAll('.about-link-btn').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const url = e.target.dataset.url;
            if (url) {
                try {
                    await window.electronAPI.openInBrowser(url);
                } catch (error) {
                    console.error('[About] Failed to open link:', error);
                }
            }
        });
    });

    // NEW: Service search and category filter in settings
    if (elements.serviceSearch) {
        elements.serviceSearch.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderSettingsServices();
        });
    }

    if (elements.categoryFilter) {
        elements.categoryFilter.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            renderSettingsServices();
        });
    }

    // NEW: Listen for login window close events
    window.electronAPI.onLoginWindowClosed((serviceId) => {
        // Reload the service tab if it's open
        const tab = activeTabs.find(t => t.id === serviceId);
        if (tab) {
            tab.webview.reload();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.settingsPanel.classList.add('hidden');
            elements.clearDataModal.classList.add('hidden');
        }
        if (e.ctrlKey && e.key === '=') { e.preventDefault(); zoomIn(); }
        if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomOut(); }
        if (e.ctrlKey && e.key === '0') { e.preventDefault(); zoomReset(); }
        if (e.ctrlKey && e.key === 'r') { e.preventDefault(); if (currentTabId) reloadTab(currentTabId); }
    });

    // --- INITIALIZATION ---
    const init = async () => {
        await loadConfig();
        await loadServices();
        await loadAppVersion();
    };
    init();
});
