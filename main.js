// main.js - Main Process (Backend)
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
let mainWindow = null;
let config = {
  lastUpdate: null,
  blockingEnabled: true,
  maxActiveServices: 3, // Memory Manager setting
  darkMode: true, // Default dark mode
  remoteUrls: {
    services: "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/ai_services_list.json",
    rules: "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/domain_filtering_rules.json"
  }
};

// Whitelist for common auth domains (loaded from rules)
let commonAuthDomains = new Set();
// Map to track active services (simulated for single window context)
let activeServices = new Map(); 

// ==========================================
// CONFIGURATION MANAGEMENT
// ==========================================

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      config = { ...config, ...JSON.parse(data) };
    }
    saveConfig(); // Ensure file exists
  } catch (error) {
    console.error('Error loading config:', error);
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
// DATA MANAGEMENT
// ==========================================

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    
    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) return reject(new Error(`HTTP ${response.statusCode}`));
      
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function updateRemoteData() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    
    await downloadFile(config.remoteUrls.services, servicesPath);
    await downloadFile(config.remoteUrls.rules, rulesPath);
    
    config.lastUpdate = new Date().toISOString();
    saveConfig();
    
    // Reload rules to update common auth domains
    loadRules(); 
    
    return { success: true };
  } catch (error) {
    console.error('Error updating data:', error);
    return { success: false, error: error.message };
  }
}

function loadServices() {
  try {
    if (fs.existsSync(servicesPath)) {
      return JSON.parse(fs.readFileSync(servicesPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading services:', error);
  }
  return null;
}

function loadRules() {
  try {
    if (fs.existsSync(rulesPath)) {
      const data = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      
      // Extract common auth domains for the whitelist
      if (data.common_auth_domains) {
        commonAuthDomains = new Set(data.common_auth_domains);
        console.log('Common Auth Domains Loaded:', data.common_auth_domains);
      }
      
      return data;
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
  // 1. Always allow if blocking is disabled globally
  if (!config.blockingEnabled) return true;

  // 2. Always allow common auth domains (Critical Fix)
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

        // Determine which service this request belongs to
        // Note: In a single-window tabbed interface, we need to know which tab is making the request.
        // Since we can't easily filter by tab in onBeforeRequest without webContentsId checks,
        // we will rely on a simpler approach for now: 
        // We maintain a global "active service domains" list that updates when the user switches tabs.
        // (This logic will be connected via IPC from renderer when tabs change)
        
        const currentServiceId = config.lastActiveService; // Simplified for now
        const rules = loadRules();
        const serviceDomains = rules && rules.service_domains ? rules.service_domains[currentServiceId] : [];

        if (isDomainAllowed(hostname, serviceDomains)) {
          callback({}); // Allow
        } else {
          console.log(`Blocked: ${hostname} (Service: ${currentServiceId})`);
          callback({ cancel: true }); // Block
        }
      } catch (e) {
        console.error('Error in request blocker:', e);
        callback({}); // Allow on error to avoid breaking the app
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
    backgroundColor: '#202124', // Dark mode default
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true // Required for tabs
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

// Handle service activation for blocking context
ipcMain.on('set-active-service', (event, serviceId) => {
  config.lastActiveService = serviceId;
  // Update blocking rules dynamically if needed, though our logic reads from config on each request
});

// ==========================================
// APP LIFECYCLE
// ==========================================

app.whenReady().then(() => {
  loadConfig();
  loadRules(); // Load initial rules
  setupWebRequestBlocking();
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  session.defaultSession.webRequest.onBeforeRequest(null);
});
