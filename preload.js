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
                                openInBrowser: (url) => ipcRenderer.invoke('open-in-browser', url),
                                openLoginWindow: (url, serviceId) => ipcRenderer.invoke('open-login-window', url, serviceId),
                                getAppVersion: () => ipcRenderer.invoke('get-app-version'),
                                cleanUrlTracking: (url) => ipcRenderer.invoke('clean-url-tracking', url),
                                onLoginWindowClosed: (callback) => ipcRenderer.on('login-window-closed', (event, serviceId) => callback(serviceId))
});
