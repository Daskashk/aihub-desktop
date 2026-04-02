// renderer.js - Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const elements = {
    tabsList: document.getElementById('tabs-list'),
    addTabBtn: document.getElementById('btn-add-tab'),
    sidebar: document.getElementById('sidebar'),
    closeSidebarBtn: document.getElementById('btn-close-sidebar'),
    servicesList: document.getElementById('services-list'),
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
    blockingText: document.getElementById('blocking-text')
  };

  // --- State ---
  let config = {};
  let services = [];
  let activeTabs = []; 
  let currentTabId = null;

  // --- Utility Functions ---
  const showStatus = (message, type = 'info') => {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
    setTimeout(() => { elements.statusMessage.textContent = 'Ready'; }, 3000);
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Never';
    return new Date(isoString).toLocaleString('en-US');
  };

  // --- Core Logic ---

  const loadConfig = async () => {
    config = await window.electronAPI.getConfig();
    elements.toggleBlocking.checked = config.blockingEnabled;
    elements.maxServicesInput.value = config.maxActiveServices;
    elements.toggleDarkMode.checked = config.darkMode;
    elements.lastUpdate.textContent = formatDate(config.lastUpdate);
    updateBlockingUI(config.blockingEnabled);
    applyDarkMode(config.darkMode);
  };

  const loadServices = async () => {
    const data = await window.electronAPI.getServices();
    if (data && data.ai_services) {
      services = data.ai_services;
      renderServicesSidebar();
    } else {
      elements.servicesList.innerHTML = '<div class="error-message">No services found.<br>Click Update.</div>';
    }
  };

  const updateBlockingUI = (enabled) => {
    elements.blockingIndicator.className = enabled ? 'indicator active' : 'indicator inactive';
    elements.blockingText.textContent = enabled ? 'Blocking Active' : 'Blocking Disabled';
  };

  const applyDarkMode = (enabled) => {
    document.body.classList.toggle('dark-mode', enabled);
  };

  // --- Tab Management ---

  const createTab = (serviceId, url, title) => {
    if (activeTabs.length >= config.maxActiveServices) {
      showStatus(`Memory limit reached: Close a tab to open ${title}.`, 'warning');
      return;
    }

    // Check if already open
    const existing = activeTabs.find(t => t.id === serviceId);
    if (existing) {
      switchToTab(serviceId);
      return;
    }

    // 1. Notify Main Process FIRST (Fix for race condition)
    window.electronAPI.setActiveService(serviceId);

    // 2. Create Tab Button
    const tab = document.createElement('div');
    tab.className = 'tab-item active';
    tab.dataset.id = serviceId;
    tab.innerHTML = `
      <span class="tab-title">${title}</span>
      <button class="btn-close-tab">✕</button>
    `;
    
    // 3. Create Webview
    const webview = document.createElement('webview');
    webview.dataset.id = serviceId;
    webview.style.display = 'flex';
    
    // 4. Add Listeners
    tab.querySelector('.btn-close-tab').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(serviceId);
    });

    tab.addEventListener('click', () => switchToTab(serviceId));

    // 5. Append to DOM
    elements.tabsList.appendChild(tab);
    elements.webviewsContainer.appendChild(webview);
    
    // 6. Update State
    activeTabs.push({ id: serviceId, url, title, webview });
    switchToTab(serviceId); // Ensure correct display states
    
    // 7. Load URL (After context is set)
    webview.src = url;

    // Handle Loading Errors
    webview.addEventListener('did-fail-load', (e) => {
      console.error('Load failed:', e.errorDescription);
      if (e.errorCode !== -3) { // Ignore aborts
         showStatus(`Error loading: ${e.errorDescription}`, 'error');
      }
    });

    elements.welcomeScreen.style.display = 'none';
  };

  const switchToTab = (id) => {
    // Update UI
    document.querySelectorAll('.tab-item').forEach(t => {
      t.classList.toggle('active', t.dataset.id === id);
    });
    
    document.querySelectorAll('webview').forEach(wv => {
      wv.style.display = (wv.dataset.id === id) ? 'flex' : 'none';
    });

    currentTabId = id;
    window.electronAPI.setActiveService(id); // Update blocking context
  };

  const closeTab = (id) => {
    const tabIndex = activeTabs.findIndex(t => t.id === id);
    if (tabIndex === -1) return;

    // Remove from DOM
    const tabEl = document.querySelector(`.tab-item[data-id="${id}"]`);
    const wvEl = document.querySelector(`webview[data-id="${id}"]`);
    if (tabEl) tabEl.remove();
    if (wvEl) wvEl.remove();

    // Remove from State
    activeTabs.splice(tabIndex, 1);

    // Switch to another tab or show welcome
    if (activeTabs.length > 0) {
      const newIndex = Math.min(tabIndex, activeTabs.length - 1);
      switchToTab(activeTabs[newIndex].id);
    } else {
      elements.welcomeScreen.style.display = 'flex';
      currentTabId = null;
    }
  };

  // --- Sidebar Logic ---

  const renderServicesSidebar = () => {
    elements.servicesList.innerHTML = '';
    
    if (!services || services.length === 0) {
       elements.servicesList.innerHTML = '<div class="error-message">No services loaded.</div>';
       return;
    }

    services.forEach(service => {
      const [name, url, type, privacy, color] = service;
      const id = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      const bgColor = color ? `#${color}` : '#4285f4';

      const card = document.createElement('div');
      card.className = 'service-card';
      card.innerHTML = `
        <div class="service-header" style="background-color: ${bgColor}">
          <h3>${name}</h3>
        </div>
        <div class="service-body">
          <p class="service-type">${type || 'AI Service'}</p>
          <p class="service-privacy">${privacy || ''}</p>
        </div>
      `;
      
      card.addEventListener('click', () => {
        createTab(id, url, name);
        elements.sidebar.classList.add('hidden');
      });

      elements.servicesList.appendChild(card);
    });
  };

  // --- Settings ---

  const saveSettings = async () => {
    const newConfig = {
      blockingEnabled: elements.toggleBlocking.checked,
      maxActiveServices: parseInt(elements.maxServicesInput.value) || 3,
      darkMode: elements.toggleDarkMode.checked
    };

    config = await window.electronAPI.saveConfig(newConfig);
    showStatus('Settings saved', 'success');
    updateBlockingUI(config.blockingEnabled);
    applyDarkMode(config.darkMode);
    elements.settingsPanel.classList.add('hidden');
  };

  // --- Event Listeners ---

  elements.addTabBtn.addEventListener('click', () => {
    elements.sidebar.classList.remove('hidden');
  });

  elements.closeSidebarBtn.addEventListener('click', () => {
    elements.sidebar.classList.add('hidden');
  });

  elements.btnSettings.addEventListener('click', () => {
    elements.settingsPanel.classList.remove('hidden');
  });

  elements.btnCloseSettings.addEventListener('click', () => {
    elements.settingsPanel.classList.add('hidden');
  });

  elements.btnSaveSettings.addEventListener('click', saveSettings);

  elements.btnUpdate.addEventListener('click', async () => {
    showStatus('Updating services...', 'info');
    const result = await window.electronAPI.updateRemoteData();
    if (result.success) {
      await loadConfig();
      await loadServices();
      showStatus('Update successful', 'success');
    } else {
      showStatus('Update failed: ' + result.error, 'error');
    }
  });

  // --- Initialization ---
  const init = async () => {
    await loadConfig();
    await loadServices();
  };

  init();
});
