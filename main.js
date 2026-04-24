// main.js - Main Process
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Paths
const configPath = path.join(app.getPath('userData'), 'config.json');
const dataDir = path.join(app.getPath('userData'), 'data');
const servicesPath = path.join(dataDir, 'remote_services.json');
const rulesPath = path.join(dataDir, 'remote_rules.json');

// Default Configuration
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

let config = {...defaultConfig};
let commonAuthDomains = new Set();
let rulesCache = null;
const initializedSessions = new Set();

// ==========================================
// CONFIGURATION MANAGEMENT
// ==========================================

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
    console.log('[Config] Loaded successfully');
  } catch (error) {
    console.error('[Config] Error loading:', error);
    config = {...defaultConfig};
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

// ==========================================
// DATA MANAGEMENT
// ==========================================

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) return fetchUrl(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) return reject(new Error(`HTTP Status ${response.statusCode}`));
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function updateRemoteData() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    console.log("[Update] Downloading services...");
    const servicesData = await fetchUrl(config.remoteUrls.services);
    fs.writeFileSync(servicesPath, servicesData);

    console.log("[Update] Downloading rules...");
    const rulesData = await fetchUrl(config.remoteUrls.rules);
    fs.writeFileSync(rulesPath, rulesData);

    rulesCache = null;
    config.lastUpdate = new Date().toISOString();
    saveConfig();

    loadRules();

    // Re-setup all sessions with new rules
    initializedSessions.clear();

    console.log("[Update] Completed successfully");
    return { success: true };
  } catch (error) {
    console.error('[Update] Error:', error);
    return { success: false, error: error.message };
  }
}

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
        console.log(`[Rules] Loaded ${commonAuthDomains.size} common auth domains`);
      }
      if (rules.service_domains) {
        const serviceCount = Object.keys(rules.service_domains).length;
        console.log(`[Rules] Loaded domains for ${serviceCount} services`);
      }
      return rules;
    }
  } catch (error) {
    console.error('[Rules] Error loading:', error);
  }
  return null;
}

// ==========================================
// DOMAIN BLOCKING LOGIC (STRICT - MATCHES JSON KEYS EXACTLY)
// ==========================================

function isDomainAllowed(hostname, serviceDomains) {
  if (!config.blockingEnabled) return true;

  // Always allow common auth domains
  for (const domain of commonAuthDomains) {
    if (hostname === domain || hostname.endsWith('.' + domain)) return true;
  }

  // Check service-specific whitelist
  if (serviceDomains && serviceDomains.length > 0) {
    for (const domain of serviceDomains) {
      if (hostname === domain || hostname.endsWith('.' + domain)) return true;
    }
  }

  // If blocking is on, and it's not in the lists -> BLOCK
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
      const hostname = url.hostname;

      // Allow local/electron resources
      if (details.url.startsWith('devtools://') || details.url.startsWith('file://') || details.url.startsWith('chrome-extension://')) {
        return callback({});
      }

      const rules = loadRules();
      let serviceDomains = [];

      // EXACT MATCH: The serviceId must exactly match the key in the JSON rules
      if (rules && rules.service_domains && rules.service_domains[serviceId]) {
        serviceDomains = rules.service_domains[serviceId];
      }

      // SAFEGUARD: If blocking is enabled but NO rules exist at all, allow everything
      if (config.blockingEnabled && !rules) {
        console.warn(`[Blocker] No rules loaded for ${serviceId}, allowing all requests. Run Update first!`);
        return callback({});
      }

      if (isDomainAllowed(hostname, serviceDomains)) {
        callback({}); // Allow
      } else {
        console.log(`[Blocker] Blocked: ${hostname} (Service: ${serviceId})`);
        callback({ cancel: true }); // Block
      }
    } catch (e) {
      console.error('[Blocker] Error:', e);
      callback({}); // On error, allow
    }
  });

  console.log(`[Blocker] Session setup for: ${partitionName}`);
}

// ==========================================
// WINDOW MANAGEMENT
// ==========================================

function createMainWindow() {
  const mainWindow = new BrowserWindow({
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

  // Open DevTools with F12
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow;
}

// ==========================================
// IPC HANDLERS
// ==========================================

ipcMain.handle('get-config', () => config);
ipcMain.handle('get-services', () => loadServices());
ipcMain.handle('get-rules', () => loadRules());
ipcMain.handle('update-remote-data', async () => await updateRemoteData());

ipcMain.handle('save-config', (event, newConfig) => {
  if (newConfig.enabledServices) {
    config.enabledServices = [...new Set(newConfig.enabledServices)];
  }
  config = { ...config, ...newConfig };
  saveConfig();
  return config;
});

ipcMain.handle('toggle-service', (event, serviceId) => {
  const index = config.enabledServices.indexOf(serviceId);
  if (index === -1) {
    config.enabledServices.push(serviceId);
  } else {
    config.enabledServices.splice(index, 1);
  }
  saveConfig();
  return config.enabledServices;
});

ipcMain.on('set-active-service', (event, serviceId) => {
  config.lastActiveService = serviceId;
  setupSessionBlocking(serviceId);
});

// ==========================================
// APP LIFECYCLE
// ==========================================

app.whenReady().then(() => {
  loadConfig();
  loadRules();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  for (const partitionName of initializedSessions) {
    const ses = session.fromPartition(partitionName);
    if (ses) ses.webRequest.onBeforeRequest(null);
  }
  initializedSessions.clear();
});
