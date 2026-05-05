// main.js - Main Process for AI Hub Desktop
const { app, BrowserWindow, ipcMain, session, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');

// --- PATHS ---
const configPath = path.join(app.getPath('userData'), 'config.json');
const dataDir = path.join(app.getPath('userData'), 'data');
const servicesPath = path.join(dataDir, 'remote_services.json');
const rulesPath = path.join(dataDir, 'remote_rules.json');

// --- DEFAULT CONFIG ---
const defaultConfig = {
  lastUpdate: null,
  blockingEnabled: true,
  maxActiveServices: 3,
  darkMode: true,
  enabledServices: ['chatgpt', 'claude', 'gemini'],
  lastActiveService: null,
  remoteUrls: {
    services: "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/ai_services_list.json",
    rules: "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/domain_filtering_rules.json"
  }
};

let config = { ...defaultConfig };
let commonAuthDomains = new Set();
let alwaysBlockedDomains = {};
let trackingParams = [];
let rulesCache = null;
const initializedSessions = new Set();
let mainWindow = null;

// --- CONFIG LOAD / SAVE ---
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const savedConfig = JSON.parse(data);
      config = {
        ...defaultConfig,
        ...savedConfig,
        enabledServices: savedConfig.enabledServices || defaultConfig.enabledServices
      };
    }
    saveConfig();
  } catch (error) {
    console.error('[Config] Error loading:', error);
    config = { ...defaultConfig };
    saveConfig();
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('[Config] Error saving:', error);
  }
}

// --- REMOTE DATA FETCHING (using Electron net module for better proxy/system cert support) ---
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    let data = '';
    request.on('response', (response) => {
      const statusCode = response.statusCode;
      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        return fetchUrl(response.headers.location).then(resolve).catch(reject);
      }
      if (statusCode !== 200) {
        return reject(new Error(`HTTP Status ${statusCode}`));
      }
      response.on('data', (chunk) => { data += chunk.toString(); });
      response.on('end', () => resolve(data));
    });
    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.abort();
      reject(new Error('Request timeout'));
    });
    request.end();
  });
}

async function updateRemoteData() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    let updated = false;

    const remoteServicesData = await fetchUrl(config.remoteUrls.services);
    const localServicesData = fs.existsSync(servicesPath) ? fs.readFileSync(servicesPath, 'utf8') : null;
    if (remoteServicesData !== localServicesData) {
      fs.writeFileSync(servicesPath, remoteServicesData);
      updated = true;
    }

    const remoteRulesData = await fetchUrl(config.remoteUrls.rules);
    const localRulesData = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : null;
    if (remoteRulesData !== localRulesData) {
      fs.writeFileSync(rulesPath, remoteRulesData);
      rulesCache = null;
      initializedSessions.clear();
      updated = true;
    }

    if (updated) {
      config.lastUpdate = new Date().toISOString();
      saveConfig();
      loadRules();
    }
    return { success: true, updated };
  } catch (error) {
    console.error('[Update] Error:', error);
    return { success: false, error: error.message, updated: false };
  }
}

// --- SERVICE & RULE LOADING ---
function loadServices() {
  try {
    if (fs.existsSync(servicesPath)) {
      const data = fs.readFileSync(servicesPath, 'utf8');
      if (!data) return null;
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Services] Error loading:', error);
  }
  return null;
}

function loadRules() {
  try {
    if (rulesCache) return rulesCache;
    if (fs.existsSync(rulesPath)) {
      const data = fs.readFileSync(rulesPath, 'utf8');
      if (!data) return null;
      const rules = JSON.parse(data);
      rulesCache = rules;
      if (rules.common_auth_domains) {
        commonAuthDomains = new Set(rules.common_auth_domains);
      }
      if (rules.always_blocked_domains) {
        alwaysBlockedDomains = rules.always_blocked_domains;
      }
      if (rules.tracking_params) {
        trackingParams = rules.tracking_params;
      }
      return rules;
    }
  } catch (error) {
    console.error('[Rules] Error loading:', error);
  }
  return null;
}

// --- DOMAIN BLOCKING ENGINE (IMPROVED with always_blocked support) ---
function isDomainBlocked(hostname, serviceId) {
  if (alwaysBlockedDomains[serviceId]) {
    for (const blocked of alwaysBlockedDomains[serviceId]) {
      if (hostname === blocked || hostname.endsWith('.' + blocked)) {
        return true;
      }
    }
  }
  return false;
}

function isDomainAllowed(hostname, serviceDomains, serviceId) {
  if (!config.blockingEnabled) return true;

  // Check always-blocked list first (takes precedence over allowlists)
  if (isDomainBlocked(hostname, serviceId)) return false;

  // Check common auth domains
  for (const domain of commonAuthDomains) {
    if (hostname === domain || hostname.endsWith('.' + domain)) return true;
  }

  // Check service-specific allowed domains
  if (serviceDomains && serviceDomains.length > 0) {
    for (const domain of serviceDomains) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return true;
    }
  }

  return false;
}

function setupSessionBlocking(serviceId) {
  if (!serviceId) return;
  const partitionName = `persist:${serviceId}`;
  if (initializedSessions.has(partitionName)) return;
  const ses = session.fromPartition(partitionName);
  initializedSessions.add(partitionName);

  ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    try {
      const url = new URL(details.url);

      // Always allow safe internal schemes
      if (details.url.startsWith('devtools://') ||
        details.url.startsWith('file://') ||
        details.url.startsWith('chrome-extension://')) {
        return callback({});
        }

        const rules = loadRules();
      let serviceDomains = [];
      if (rules && rules.service_domains && rules.service_domains[serviceId]) {
        serviceDomains = rules.service_domains[serviceId];
      }

      if (config.blockingEnabled && !rules) return callback({});

      if (isDomainAllowed(url.hostname, serviceDomains, serviceId)) {
        // Strip tracking parameters from allowed URLs
        if (trackingParams.length > 0) {
          let modified = false;
          for (const param of trackingParams) {
            if (url.searchParams.has(param)) {
              url.searchParams.delete(param);
              modified = true;
            }
          }
          if (modified) {
            return callback({ redirectURL: url.toString() });
          }
        }
        callback({});
      } else {
        callback({ cancel: true });
      }
    } catch (e) {
      callback({});
    }
  });
}

// --- SESSION WARMUP ---
function warmupSessions() {
  if (!config.enabledServices) return;
  config.enabledServices.forEach(serviceId => {
    const ses = session.fromPartition(`persist:${serviceId}`);
    ses.cookies.get({}).catch(() => {});
  });
}

// --- MAIN WINDOW CREATION ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AI Hub Desktop',
    backgroundColor: '#1a1b1e',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
    });
  }

  // Prevent main window navigation away from app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
        shell.openExternal(url);
      }
    } catch (e) {}
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// --- IPC HANDLERS ---

ipcMain.handle('get-config', () => config);
ipcMain.handle('get-services', () => loadServices());
ipcMain.handle('get-rules', () => loadRules());
ipcMain.handle('update-remote-data', async () => await updateRemoteData());

ipcMain.handle('save-config', (event, newConfig) => {
  const allowedKeys = ['blockingEnabled', 'maxActiveServices', 'darkMode'];
  if (newConfig && newConfig.enabledServices) {
    config.enabledServices = [...new Set(newConfig.enabledServices)];
  }
  for (const key of allowedKeys) {
    if (key in newConfig) config[key] = newConfig[key];
  }
  saveConfig();
  return config;
});

ipcMain.handle('toggle-service', (event, serviceId) => {
  // Allow hyphens in service IDs (e.g., "sea-lion")
  if (typeof serviceId !== 'string' || !/^[a-z0-9-]+$/.test(serviceId)) return config.enabledServices;
  const index = config.enabledServices.indexOf(serviceId);
  if (index === -1) config.enabledServices.push(serviceId);
  else config.enabledServices.splice(index, 1);
  saveConfig();
  return config.enabledServices;
});

ipcMain.on('set-active-service', (event, serviceId) => {
  config.lastActiveService = serviceId;
  setupSessionBlocking(serviceId);
});

ipcMain.handle('clear-service-data', async (event, serviceId) => {
  if (typeof serviceId !== 'string' || !/^[a-z0-9-]+$/.test(serviceId)) {
    return { success: false, error: 'Invalid service ID' };
  }
  try {
    const partitionName = `persist:${serviceId}`;
    const ses = session.fromPartition(partitionName);
    await ses.clearStorageData();
    await ses.clearCache();
    initializedSessions.delete(partitionName);
    setupSessionBlocking(serviceId);
    return { success: true };
  } catch (error) {
    console.error('[ClearData] Error:', error);
    return { success: false, error: 'Failed to clear service data' };
  }
});

ipcMain.handle('clear-all-data', async () => {
  try {
    const allServices = loadServices();
    const serviceIds = allServices?.ai_services?.map(s => {
      const name = s[0];
      const explicitId = s[5];
      return explicitId || name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    }) || [];

    for (const serviceId of serviceIds) {
      try {
        const partitionName = `persist:${serviceId}`;
        const ses = session.fromPartition(partitionName);
        await ses.clearStorageData();
        await ses.clearCache();
        initializedSessions.delete(partitionName);
      } catch (e) {
        // Continue even if one fails
      }
    }
    return { success: true };
  } catch (error) {
    console.error('[ClearAllData] Error:', error);
    return { success: false, error: 'Failed to clear all data' };
  }
});

ipcMain.handle('open-in-browser', async (event, url) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return { success: false, error: 'Only http and https URLs are allowed' };
    }
    // Security: block disguised schemes
    const decodedUrl = decodeURIComponent(url);
    if (decodedUrl.includes('javascript:') || decodedUrl.includes('data:')) {
      return { success: false, error: 'Invalid URL scheme' };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('[OpenInBrowser] Error:', error);
    return { success: false, error: 'Failed to open URL in browser' };
  }
});

// Open a login window for services that need OAuth/login in a separate window
ipcMain.handle('open-login-window', async (event, url, serviceId) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return { success: false, error: 'Only http and https URLs are allowed' };
    }
    if (typeof serviceId !== 'string' || !/^[a-z0-9-]+$/.test(serviceId)) {
      return { success: false, error: 'Invalid service ID' };
    }

    const loginWindow = new BrowserWindow({
      width: 900,
      height: 700,
      minWidth: 600,
      minHeight: 500,
      title: `Login - ${serviceId}`,
      backgroundColor: '#1a1b1e',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: `persist:${serviceId}`
      }
    });

    loginWindow.loadURL(url);

    loginWindow.webContents.setWindowOpenHandler(({ url: newUrl }) => {
      try {
        const parsed = new URL(newUrl);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
          shell.openExternal(newUrl);
        }
      } catch (e) {}
      return { action: 'deny' };
    });

    // When login window closes, notify the renderer to reload the service
    loginWindow.on('closed', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('login-window-closed', serviceId);
      }
    });

    return { success: true };
  } catch (error) {
    console.error('[LoginWindow] Error:', error);
    return { success: false, error: 'Failed to open login window' };
  }
});

ipcMain.handle('get-app-version', () => {
  try {
    const pkg = require('./package.json');
    return pkg.version || '0.4.0-beta';
  } catch (e) {
    return '0.4.0-beta';
  }
});

ipcMain.handle('clean-url-tracking', async (event, url) => {
  try {
    const parsedUrl = new URL(url);
    let modified = false;
    for (const param of trackingParams) {
      if (parsedUrl.searchParams.has(param)) {
        parsedUrl.searchParams.delete(param);
        modified = true;
      }
    }
    return { cleanedUrl: modified ? parsedUrl.toString() : url, wasModified: modified };
  } catch (e) {
    return { cleanedUrl: url, wasModified: false };
  }
});

// --- APP LIFECYCLE ---
app.whenReady().then(() => {
  loadConfig();
  loadRules();
  warmupSessions();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  for (const p of initializedSessions) {
    const s = session.fromPartition(p);
    if (s) s.webRequest.onBeforeRequest(null);
  }
  initializedSessions.clear();
});

// Prevent main window from navigating away
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.protocol !== 'file:') {
        if (contents === mainWindow?.webContents) {
          event.preventDefault();
        }
      }
    } catch (e) {}
  });
});
