// preload.js - Secure bridge between frontend and backend
const { contextBridge, ipcRenderer } = require('electron');

// Expose safe functions to the frontend
contextBridge.exposeInMainWorld('electronAPI', {
    // Get current application configuration
    getConfig: () => ipcRenderer.invoke('get-config'),

    // Update remote services and rules data
    updateRemoteData: () => ipcRenderer.invoke('update-remote-data'),

    // Set the currently active service for domain blocking context
    setActiveService: (serviceId) => ipcRenderer.invoke('set-active-service', serviceId),

    // Get the list of available AI services
    getServices: () => ipcRenderer.invoke('get-services'),

    // Get domain filtering rules
    getRules: () => ipcRenderer.invoke('get-rules'),

    // Update configuration settings
    updateConfig: (newConfig) => ipcRenderer.invoke('update-config', newConfig),

    // Open a service in a new tab
    openService: (serviceId, serviceUrl, serviceName) =>
        ipcRenderer.invoke('open-service', serviceId, serviceUrl, serviceName),

    // Close an open service tab
    closeService: (serviceId) => ipcRenderer.invoke('close-service', serviceId),

    // Enable/disable domain blocking
    toggleBlocking: (enabled) => ipcRenderer.invoke('toggle-blocking', enabled),

    // Listen for max services limit reached event
    onMaxServicesReached: (callback) =>
        ipcRenderer.on('max-services-reached', (event, maxServices) => callback(maxServices)),

    // Listen for service closed event
    onServiceClosed: (callback) =>
        ipcRenderer.on('service-closed', (event, serviceId) => callback(serviceId))
});