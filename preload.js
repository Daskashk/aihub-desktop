const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getServices: () => ipcRenderer.invoke('get-services'),
    getRules: () => ipcRenderer.invoke('get-rules'),
    updateRemoteData: () => ipcRenderer.invoke('update-remote-data'),
    toggleService: (serviceId) => ipcRenderer.invoke('toggle-service', serviceId),
    setActiveService: (serviceId) => ipcRenderer.send('set-active-service', serviceId),
    clearServiceData: (serviceId) => ipcRenderer.invoke('clear-service-data', serviceId),
    clearAllData: () => ipcRenderer.invoke('clear-all-data'),
    clearCache: () => ipcRenderer.invoke('clear-cache'),
    openInBrowser: (url) => ipcRenderer.invoke('open-in-browser', url),
    openLoginWindow: (url, serviceId) => ipcRenderer.invoke('open-login-window', url, serviceId),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    cleanUrlTracking: (url) => ipcRenderer.invoke('clean-url-tracking', url),
    onLoginWindowClosed: (callback) => ipcRenderer.on('login-window-closed', (event, serviceId) => callback(serviceId)),

    // New: Favorites
    toggleFavorite: (serviceId) => ipcRenderer.invoke('toggle-favorite', serviceId),

    // New: Service ordering
    setServiceOrder: (order) => ipcRenderer.invoke('set-service-order', order),

    // New: Custom JS/CSS injection
    saveCustomInjection: (js, css) => ipcRenderer.invoke('save-custom-injection', js, css),

    // New: Update details
    getUpdateDetails: () => ipcRenderer.invoke('get-update-details'),

    // New: Proxy
    setProxy: (proxyConfig) => ipcRenderer.invoke('set-proxy', proxyConfig),

    // New: Apply proxy to session
    applyProxyToSession: (serviceId) => ipcRenderer.invoke('apply-proxy-to-session', serviceId),

    // New: Third-party cookies
    setThirdPartyCookies: (enabled) => ipcRenderer.invoke('set-third-party-cookies', enabled),

    // New: Auto-update notification from main process
    onAutoUpdateAvailable: (callback) => ipcRenderer.on('auto-update-available', (event, details) => callback(details))
});
