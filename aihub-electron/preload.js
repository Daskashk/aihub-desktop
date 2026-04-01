// preload.js - Puente seguro entre frontend y backend
const { contextBridge, ipcRenderer } = require('electron');

// Exponer funciones seguras al frontend
contextBridge.exposeInMainWorld('electronAPI', {
    // Obtener configuración actual
    getConfig: () => ipcRenderer.invoke('get-config'),

                                // Actualizar datos remotos
                                updateRemoteData: () => ipcRenderer.invoke('update-remote-data'),

                                // Obtener lista de servicios
                                getServices: () => ipcRenderer.invoke('get-services'),

                                // Obtener reglas de dominios
                                getRules: () => ipcRenderer.invoke('get-rules'),

                                // Actualizar configuración
                                updateConfig: (newConfig) => ipcRenderer.invoke('update-config', newConfig),

                                // Abrir servicio
                                openService: (serviceId, serviceUrl, serviceName) =>
                                ipcRenderer.invoke('open-service', serviceId, serviceUrl, serviceName),

                                // Cerrar servicio
                                closeService: (serviceId) => ipcRenderer.invoke('close-service', serviceId),

                                // Alternar bloqueo
                                toggleBlocking: (enabled) => ipcRenderer.invoke('toggle-blocking', enabled),

                                // Escuchar eventos desde el backend
                                onMaxServicesReached: (callback) =>
                                ipcRenderer.on('max-services-reached', (event, maxServices) => callback(maxServices)),

                                onServiceClosed: (callback) =>
                                ipcRenderer.on('service-closed', (event, serviceId) => callback(serviceId))
});
