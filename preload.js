const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
                                saveConfig: (config) => ipcRenderer.invoke('save-config', config),
                                getServices: () => ipcRenderer.invoke('get-services'),
                                getRules: () => ipcRenderer.invoke('get-rules'),
                                updateRemoteData: () => ipcRenderer.invoke('update-remote-data'),
                                toggleService: (serviceId) => ipcRenderer.invoke('toggle-service', serviceId),
                                setActiveService: (serviceId) => ipcRenderer.send('set-active-service', serviceId),
                                clearServiceData: (serviceId) => ipcRenderer.invoke('clear-service-data', serviceId)
});
