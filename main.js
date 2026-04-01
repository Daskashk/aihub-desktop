// main.js - Proceso principal de Electron
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Rutas a archivos locales
const configPath = path.join(app.getPath('userData'), 'config.json');
const dataDir = path.join(app.getPath('userData'), 'data');
const servicesPath = path.join(dataDir, 'remote_services.json');
const rulesPath = path.join(dataDir, 'remote_rules.json');

// Variables globales
let mainWindow = null;
let serviceWindows = new Map(); // Ventanas de cada servicio
let allowedDomains = new Set(); // Dominios permitidos para el servicio actual
let currentServiceId = null;    // ID del servicio actualmente activo

// Configuración por defecto
let config = {
    lastUpdate: null,
    blockingEnabled: true,
    maxActiveServices: 3,
    activeServices: [],
    remoteUrls: {
        services: "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/ai_services_list.json",
        rules: "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/domain_filtering_rules.json"
    }
};

// ==========================================
// GESTIÓN DE CONFIGURACIÓN
// ==========================================

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error guardando configuración:', error);
    }
}

// ==========================================
// DESCARGA DE DATOS REMOTOS
// ==========================================

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        console.log(`Descargando: ${url}`);

        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(destPath);

        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                const redirectUrl = response.headers.location;
                downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Descarga completada: ${destPath}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function updateRemoteData() {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        await downloadFile(config.remoteUrls.services, servicesPath);
        await downloadFile(config.remoteUrls.rules, rulesPath);

        config.lastUpdate = new Date().toISOString();
        saveConfig();
        return { success: true };
    } catch (error) {
        console.error('Error actualizando datos:', error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// CARGA DE DATOS LOCALES
// ==========================================

function loadServicesData() {
    try {
        if (fs.existsSync(servicesPath)) {
            const data = fs.readFileSync(servicesPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error cargando servicios:', error);
    }
    return null;
}

function loadRulesData() {
    try {
        if (fs.existsSync(rulesPath)) {
            const data = fs.readFileSync(rulesPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error cargando reglas:', error);
    }
    return null;
}

// ==========================================
// LÓGICA DE BLOQUEO DE DOMINIOS
// ==========================================

function updateAllowedDomains(serviceId) {
    const rulesData = loadRulesData();
    allowedDomains.clear();

    if (rulesData && rulesData.service_domains && rulesData.service_domains[serviceId]) {
        rulesData.service_domains[serviceId].forEach(domain => {
            allowedDomains.add(domain);
        });
        console.log(`Dominios permitidos para ${serviceId}:`, Array.from(allowedDomains));
    } else {
        console.warn(`No hay dominios permitidos para ${serviceId}`);
    }
}

function isDomainAllowed(hostname) {
    if (!config.blockingEnabled) return true;

    for (const allowed of allowedDomains) {
        if (hostname === allowed || hostname.endsWith('.' + allowed)) {
            return true;
        }
    }
    return false;
}

function setupWebRequestBlocking() {
    const ses = session.defaultSession;

    ses.webRequest.onBeforeRequest(
        { urls: ['*://*/*'] },
        (details, callback) => {
            try {
                const url = new URL(details.url);
                const hostname = url.hostname;

                // Permitir recursos locales de Electron
                if (details.url.startsWith('devtools://') ||
                    details.url.startsWith('chrome-extension://') ||
                    details.url.startsWith('file://')) {
                    callback({});
                return;
                    }

                    // Verificar si el dominio está permitido
                    if (isDomainAllowed(hostname)) {
                        callback({}); // Permitir
                    } else {
                        console.log(`🚫 Bloqueado: ${hostname}`);
                        callback({ cancel: true }); // Bloquear
                    }
            } catch (e) {
                callback({}); // Si hay error, permitir por defecto
            }
        }
    );
}

// ==========================================
// GESTIÓN DE VENTANAS
// ==========================================

function createServiceWindow(serviceId, serviceUrl, serviceName) {
    if (serviceWindows.has(serviceId)) {
        serviceWindows.get(serviceId).focus();
        return;
    }

    if (config.activeServices.length >= config.maxActiveServices) {
        mainWindow.webContents.send('max-services-reached', config.maxActiveServices);
        return;
    }

    const serviceWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: `${serviceName} - AI Hub Desktop`,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webviewTag: true,
            sandbox: true
        }
    });

    // Actualizar dominios permitidos para este servicio
    currentServiceId = serviceId;
    updateAllowedDomains(serviceId);

    // Cargar el servicio
    serviceWindow.loadURL(serviceUrl);

    serviceWindow.on('closed', () => {
        serviceWindows.delete(serviceId);
        config.activeServices = config.activeServices.filter(id => id !== serviceId);
        saveConfig();
        mainWindow.webContents.send('service-closed', serviceId);
    });

    serviceWindows.set(serviceId, serviceWindow);

    if (!config.activeServices.includes(serviceId)) {
        config.activeServices.push(serviceId);
        saveConfig();
    }
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ==========================================
// MANEJO DE EVENTOS IPC
// ==========================================

ipcMain.handle('get-config', () => config);
ipcMain.handle('update-remote-data', async () => await updateRemoteData());
ipcMain.handle('get-services', () => loadServicesData());
ipcMain.handle('get-rules', () => loadRulesData());

ipcMain.handle('update-config', (event, newConfig) => {
    config = { ...config, ...newConfig };
    saveConfig();
    return config;
});

ipcMain.handle('open-service', (event, serviceId, serviceUrl, serviceName) => {
    createServiceWindow(serviceId, serviceUrl, serviceName);
    return true;
});

ipcMain.handle('close-service', (event, serviceId) => {
    if (serviceWindows.has(serviceId)) {
        serviceWindows.get(serviceId).close();
        return true;
    }
    return false;
});

ipcMain.handle('toggle-blocking', (event, enabled) => {
    config.blockingEnabled = enabled;
    saveConfig();
    return config.blockingEnabled;
});

// ==========================================
// INICIALIZACIÓN
// ==========================================

app.whenReady().then(() => {
    loadConfig();
    setupWebRequestBlocking();
    createMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    session.defaultSession.webRequest.onBeforeRequest(null);
});
