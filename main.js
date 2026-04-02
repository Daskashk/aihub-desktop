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

// Global State
let config = {
  lastUpdate: null,
  blockingEnabled: true,
  maxActiveServices: 3,
  darkMode: true,
  lastActiveService: null, // Fix for "Service: undefined"
  remoteUrls: {
    services: "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/ai_services_list.json",
    rules: "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/domain_filtering_rules.json"
  }
};

let commonAuthDomains = new Set();

// ==========================================
// CONFIGURATION MANAGEMENT
// ==========================================

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      // Merge with defaults to ensure all keys exist
      config = { ...config, ...JSON.parse(data) };
    }
    saveConfig(); // Ensure file exists
  } catch (error) {
    console.error('Error loading config, using defaults:', error);
    saveConfig();
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

// ==========================================
// DATA MANAGEMENT (Robust Download)
// ==========================================

// Helper to fetch data following redirects
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle Redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) {
          return fetchUrl(response.headers.location).then(resolve).catch(reject);
        }
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${response.statusCode}`));
      }

      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function updateRemoteData() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    console.log("Downloading services...");
    const servicesData = await fetchUrl(config.remoteUrls.services);
    fs.writeFileSync(servicesPath, servicesData);

    console.log("Downloading rules...");
    const rulesData = await fetchUrl(config.remoteUrls.rules);
    fs.writeFileSync(rulesPath, rulesData);

    config.lastUpdate = new Date().toISOString();
    saveConfig();

    loadRules(); // Reload rules in memory
    return { success: true };
  } catch (error) {
    console.error('Error updating data:', error);
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
    console.error('Error loading services:', error);
  }
  return null;
}

function loadRules() {
  try {
    if (fs.existsSync(rulesPath)) {
      const data = fs.readFileSync(rulesPath, 'utf8');
      if (!data) return null;

      const rules = JSON.parse(data);

      // Update common auth domains
      if (rules.common_auth_domains) {
        commonAuthDomains = new Set(rules.common_auth_domains);
        console.log('Common Auth Domains Updated:', rules.common_auth_domains);
      }

      return rules;
    }
  } catch (error) {
    console.error('Error loading rules:', error);
  }
  return null;
}

// ==========================================
// DOMAIN BLOCKING LOGIC
// ==========================================

function isDomainAllowed(hostname, serviceDomains) {
  // 1. Always allow if blocking is disabled
  if (!config.blockingEnabled) return true;

  // 2. Always allow common auth domains (Critical for logins)
  for (const domain of commonAuthDomains) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return true;
    }
  }

  // 3. Check specific service whitelist
  if (serviceDomains && serviceDomains.length > 0) {
    for (const domain of serviceDomains) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
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

        // Allow local resources
        if (details.url.startsWith('devtools://') || details.url.startsWith('file://')) {
          return callback({});
        }

        // Determine service context
        const serviceId = config.lastActiveService;
        let serviceDomains = [];

        if (serviceId) {
          const rules = loadRules();
          if (rules && rules.service_domains && rules.service_domains[serviceId]) {
            serviceDomains = rules.service_domains[serviceId];
          }
        }

        if (isDomainAllowed(hostname, serviceDomains)) {
          callback({}); // Allow
        } else {
          console.log(`Blocked: ${hostname} (Service: ${serviceId || 'none'})`);
          callback({ cancel: true }); // Block
        }
      } catch (e) {
        console.error('Error in blocker:', e);
        callback({});
      }
    }
  );
}

// ==========================================
// WINDOW MANAGEMENT
// ==========================================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AI Hub Desktop',
    backgroundColor: '#202124',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ==========================================
// IPC HANDLERS
// ==========================================

ipcMain.handle('get-config', () => config);
ipcMain.handle('get-services', () => loadServices());
ipcMain.handle('get-rules', () => loadRules());
ipcMain.handle('update-remote-data', async () => await updateRemoteData());

ipcMain.handle('save-config', (event, newConfig) => {
  config = { ...config, ...newConfig };
  saveConfig();
  return config;
});

ipcMain.handle('set-active-service', (event, serviceId) => {
  config.lastActiveService = serviceId;
  return true;
});

// Fix for race condition: Receive service ID BEFORE webview loads
ipcMain.on('set-active-service', (event, serviceId) => {
  config.lastActiveService = serviceId;
  // We don't need to save config to disk here, just update runtime memory
});

// ==========================================
// APP LIFECYCLE
// ==========================================

app.whenReady().then(() => {
  loadConfig();
  loadRules();
  setupWebRequestBlocking();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
