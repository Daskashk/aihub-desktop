/// main.js - Main Process for AI Hub Desktop
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// --- PATHS ---
const configPath = path.join(app.getPath('userData'), 'config.json');
const dataDir = path.join(app.getPath('userData'), 'data');
const servicesPath = path.join(dataDir, 'remote_services.json');
const rulesPath = path.join(dataDir, 'remote_rules.json');

// --- DEFAULT CONFIG ---
const defaultConfig = {
  lastUpdate: null,
  lastUpdateCheck: null,
  blockingEnabled: true,
  maxActiveServices: 3,
  darkMode: true,
  enabledServices: ['chatgpt', 'claude', 'gemini'],
  favoriteServices: [],
  serviceOrder: [],
  lastActiveService: null,
  defaultService: 'chatgpt',
    loadLastOpenedAI: true,
    customJs: '',
    customCss: '',
    thirdPartyCookies: false,
    updateFrequencyDays: 3,
    fontSize: 'medium',
    proxyEnabled: false,
    proxyType: 'http',
    proxyHost: '',
    proxyPort: '',
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

// Store old data for update diff
let oldServicesData = null;
let oldRulesData = null;
let lastUpdateDetails = null;

// --- CONFIG LOAD / SAVE ---
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const savedConfig = JSON.parse(data);
      config = {
        ...defaultConfig,
        ...savedConfig,
        enabledServices: savedConfig.enabledServices || defaultConfig.enabledServices,
        favoriteServices: savedConfig.favoriteServices || [],
        serviceOrder: savedConfig.serviceOrder || [],
        remoteUrls: { ...defaultConfig.remoteUrls, ...(savedConfig.remoteUrls || {}) }
      };
      // Security: validate remote URLs use https
      for (const key of Object.keys(config.remoteUrls)) {
        if (!config.remoteUrls[key].startsWith('https://')) {
          config.remoteUrls[key] = defaultConfig.remoteUrls[key] || '';
        }
      }
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

// --- REMOTE DATA FETCHING ---
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    // Security: only allow http/https schemes
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return reject(new Error('Invalid URL scheme'));
    }
    const protocol = url.startsWith('https') ? https : http;

    // Manual timeout wrapper (compatible with all Electron builds)
    const timeout = setTimeout(() => {
      req.destroy(new Error('Request timeout'));
    }, 15000);

    const req = protocol.get(url, (response) => {
      clearTimeout(timeout);
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (response.headers.location) return fetchUrl(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${response.statusCode}`));
      }
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(data));
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// --- UPDATE DIFF CALCULATION ---
function calculateUpdateDiff(oldServices, newServices, oldRules, newRules) {
  const diff = {
    servicesAdded: [],
    servicesRemoved: [],
    servicesChanged: [],
    domainsAdded: [],
    domainsRemoved: [],
    alwaysBlockedAdded: [],
    alwaysBlockedRemoved: [],
    commonAuthAdded: [],
    commonAuthRemoved: [],
    trackingParamsAdded: [],
    trackingParamsRemoved: [],
    hasChanges: false
  };

  const getServiceMap = (data) => {
    const map = new Map();
    if (data && data.ai_services) {
      data.ai_services.forEach(s => {
        const name = s[0];
        const id = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
        map.set(id, { name, data: s });
      });
    }
    return map;
  };

  const oldMap = getServiceMap(oldServices);
  const newMap = getServiceMap(newServices);

  // Find added and changed services
  for (const [id, service] of newMap) {
    if (!oldMap.has(id)) {
      diff.servicesAdded.push(service.name);
    } else {
      const old = oldMap.get(id);
      if (JSON.stringify(old.data) !== JSON.stringify(service.data)) {
        diff.servicesChanged.push(service.name);
      }
    }
  }

  // Find removed services
  for (const [id, service] of oldMap) {
    if (!newMap.has(id)) {
      diff.servicesRemoved.push(service.name);
    }
  }

  // Compare domain rules
  if (oldRules && newRules) {
    const oldDomains = oldRules.service_domains || {};
    const newDomains = newRules.service_domains || {};

    for (const [key, domains] of Object.entries(newDomains)) {
      if (!oldDomains[key]) {
        diff.domainsAdded.push(key);
      } else if (JSON.stringify(oldDomains[key].sort()) !== JSON.stringify(domains.sort())) {
        diff.domainsAdded.push(key);
      }
    }
    for (const key of Object.keys(oldDomains)) {
      if (!newDomains[key]) {
        diff.domainsRemoved.push(key);
      }
    }

    // Always blocked domains
    const oldBlocked = oldRules.always_blocked_domains || {};
    const newBlocked = newRules.always_blocked_domains || {};
    for (const key of Object.keys(newBlocked)) {
      if (!oldBlocked[key]) diff.alwaysBlockedAdded.push(key);
    }
    for (const key of Object.keys(oldBlocked)) {
      if (!newBlocked[key]) diff.alwaysBlockedRemoved.push(key);
    }

    // Common auth domains
    const oldAuth = new Set(oldRules.common_auth_domains || []);
    const newAuth = new Set(newRules.common_auth_domains || []);
    for (const d of newAuth) { if (!oldAuth.has(d)) diff.commonAuthAdded.push(d); }
    for (const d of oldAuth) { if (!newAuth.has(d)) diff.commonAuthRemoved.push(d); }

    // Tracking params
    const oldParams = new Set(oldRules.tracking_params || []);
    const newParams = new Set(newRules.tracking_params || []);
    for (const p of newParams) { if (!oldParams.has(p)) diff.trackingParamsAdded.push(p); }
    for (const p of oldParams) { if (!newParams.has(p)) diff.trackingParamsRemoved.push(p); }
  }

  diff.hasChanges =
  diff.servicesAdded.length > 0 ||
  diff.servicesRemoved.length > 0 ||
  diff.servicesChanged.length > 0 ||
  diff.domainsAdded.length > 0 ||
  diff.domainsRemoved.length > 0 ||
  diff.alwaysBlockedAdded.length > 0 ||
  diff.alwaysBlockedRemoved.length > 0 ||
  diff.commonAuthAdded.length > 0 ||
  diff.commonAuthRemoved.length > 0 ||
  diff.trackingParamsAdded.length > 0 ||
  diff.trackingParamsRemoved.length > 0;

  return diff;
}

async function updateRemoteData() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    let updated = false;

    // Store old data for diff
    oldServicesData = fs.existsSync(servicesPath) ? JSON.parse(fs.readFileSync(servicesPath, 'utf8')) : null;
    oldRulesData = rulesCache || (fs.existsSync(rulesPath) ? JSON.parse(fs.readFileSync(rulesPath, 'utf8')) : null);

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
      config.lastUpdateCheck = new Date().toISOString();
      saveConfig();
      loadRules();

      // Calculate diff
      const newServicesData = JSON.parse(remoteServicesData);
      const newRulesData = JSON.parse(remoteRulesData);
      lastUpdateDetails = calculateUpdateDiff(oldServicesData, newServicesData, oldRulesData, newRulesData);

      // Auto-enable new services
      if (newServicesData && newServicesData.ai_services) {
        newServicesData.ai_services.forEach(s => {
          const name = s[0];
          const id = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
          if (!config.serviceOrder.includes(id)) {
            config.serviceOrder.push(id);
          }
        });
        saveConfig();
      }
    } else {
      config.lastUpdateCheck = new Date().toISOString();
      saveConfig();
    }

    return { success: true, updated, updateDetails: updated ? lastUpdateDetails : null };
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

  // Apply third-party cookies setting
  if (!config.thirdPartyCookies) {
    if (typeof ses.cookies.flushStorageData === 'function') {
      ses.cookies.flushStorageData().catch(() => {});
    } else if (typeof ses.flushStorageData === 'function') {
      ses.flushStorageData();
    }
  }

  // Apply proxy if enabled
  if (config.proxyEnabled && config.proxyHost && config.proxyPort) {
    applyProxyToSession(ses);
  }

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

// --- PROXY SUPPORT ---
function applyProxyToSession(ses) {
  if (!config.proxyEnabled || !config.proxyHost || !config.proxyPort) {
    ses.setProxy({ mode: 'system' }).catch(() => {});
    return;
  }
  const proxyConfig = {
    proxyRules: `${config.proxyType}://${config.proxyHost}:${config.proxyPort}`
  };
  ses.setProxy(proxyConfig).catch(err => {
    console.error('[Proxy] Failed to set proxy:', err);
  });
}

function applyProxyToAllSessions() {
  for (const partitionName of initializedSessions) {
    const ses = session.fromPartition(partitionName);
    applyProxyToSession(ses);
  }
}

// --- THIRD-PARTY COOKIES ---
async function applyThirdPartyCookiesPolicy(ses) {
  // Electron doesn't have a direct third-party cookie API like Android WebView
  // We use content blocking via webRequest to block cross-origin cookies
  if (!config.thirdPartyCookies) {
    // Already handled by domain blocking - cross-origin requests are blocked
    // This is effectively more restrictive than Android's third-party cookie setting
  }
}

// --- CUSTOM INJECTION ---
function getCustomJs() {
  return config.customJs || '';
}

function getCustomCss() {
  return config.customCss || '';
}

// --- SESSION WARMUP ---
function warmupSessions() {
  if (!config.enabledServices) return;
  config.enabledServices.forEach(serviceId => {
    const ses = session.fromPartition(`persist:${serviceId}`);
    ses.cookies.get({}).catch(() => {});
    // Apply proxy if enabled
    if (config.proxyEnabled && config.proxyHost && config.proxyPort) {
      applyProxyToSession(ses);
    }
  });
}

// --- AUTO UPDATE CHECK ---
function shouldAutoUpdate() {
  if (!config.updateFrequencyDays || config.updateFrequencyDays === -1) return false;
  if (!config.lastUpdateCheck) return true;
  const lastCheck = new Date(config.lastUpdateCheck);
  const now = new Date();
  const daysSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60 * 24);
  return daysSinceLastCheck >= config.updateFrequencyDays;
}

async function autoUpdateCheck() {
  if (shouldAutoUpdate()) {
    console.log('[AutoUpdate] Checking for updates...');
    const result = await updateRemoteData();
    if (result.success && result.updated && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auto-update-available', result.updateDetails);
    }
    return result;
  }
  return { success: true, updated: false };
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
      allowRunningInsecureContent: false,
      disableHtmlFullscreenWindowResize: true,
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
  const allowedKeys = [
    'blockingEnabled', 'maxActiveServices', 'darkMode',
    'defaultService', 'loadLastOpenedAI', 'thirdPartyCookies',
    'updateFrequencyDays', 'fontSize'
  ];
  if (newConfig && newConfig.enabledServices) {
    config.enabledServices = [...new Set(newConfig.enabledServices)];
  }
  for (const key of allowedKeys) {
    if (key in newConfig) {
      // Security: type validation for config values
      if (key === 'blockingEnabled' || key === 'darkMode' || key === 'loadLastOpenedAI' || key === 'thirdPartyCookies') {
        config[key] = !!newConfig[key];
      } else if (key === 'maxActiveServices') {
        const val = parseInt(newConfig[key], 10);
        config[key] = (val >= 1 && val <= 10) ? val : 3;
      } else if (key === 'updateFrequencyDays') {
        const val = parseInt(newConfig[key], 10);
        config[key] = (val === -1 || (val >= 1 && val <= 30)) ? val : 3;
      } else if (key === 'fontSize') {
        const validSizes = ['x-small', 'small', 'medium', 'large', 'x-large'];
        config[key] = validSizes.includes(newConfig[key]) ? newConfig[key] : 'medium';
      } else if (key === 'defaultService') {
        config[key] = typeof newConfig[key] === 'string' && /^[a-z0-9-]+$/.test(newConfig[key]) ? newConfig[key] : 'chatgpt';
      } else {
        config[key] = newConfig[key];
      }
    }
  }
  saveConfig();
  return config;
});

ipcMain.handle('toggle-service', (event, serviceId) => {
  // Allow hyphens in service IDs (e.g., "sea-lion")
  if (typeof serviceId !== 'string' || !/^[a-z0-9-]+$/.test(serviceId)) return config.enabledServices;
  const index = config.enabledServices.indexOf(serviceId);
  if (index === -1) {
    config.enabledServices.push(serviceId);
    // Add to service order if not already there
    if (!config.serviceOrder.includes(serviceId)) {
      config.serviceOrder.push(serviceId);
    }
  } else {
    // Don't allow disabling the last enabled service
    if (config.enabledServices.length <= 1) return config.enabledServices;
    config.enabledServices.splice(index, 1);
  }
  saveConfig();
  return config.enabledServices;
});

ipcMain.on('set-active-service', (event, serviceId) => {
  // Security: validate serviceId to prevent injection
  if (typeof serviceId !== 'string' || !/^[a-z0-9-]+$/.test(serviceId)) return;
  config.lastActiveService = serviceId;
  setupSessionBlocking(serviceId);
  saveConfig();
});

// New: Toggle favorite
ipcMain.handle('toggle-favorite', (event, serviceId) => {
  if (typeof serviceId !== 'string' || !/^[a-z0-9-]+$/.test(serviceId)) return config.favoriteServices;
  const index = config.favoriteServices.indexOf(serviceId);
  if (index === -1) {
    config.favoriteServices.push(serviceId);
  } else {
    config.favoriteServices.splice(index, 1);
  }
  saveConfig();
  return config.favoriteServices;
});

// New: Set service order
ipcMain.handle('set-service-order', (event, order) => {
  if (!Array.isArray(order)) return config.serviceOrder;
  config.serviceOrder = order.filter(id => typeof id === 'string' && /^[a-z0-9-]+$/.test(id));
  saveConfig();
  return config.serviceOrder;
});

// New: Save custom JS/CSS injection
ipcMain.handle('save-custom-injection', (event, js, css) => {
  // Security: limit injection size to prevent memory issues (50KB each max)
  const MAX_INJECTION_SIZE = 51200;
  if (typeof js === 'string' && js.length > MAX_INJECTION_SIZE) js = js.substring(0, MAX_INJECTION_SIZE);
  if (typeof css === 'string' && css.length > MAX_INJECTION_SIZE) css = css.substring(0, MAX_INJECTION_SIZE);
  config.customJs = typeof js === 'string' ? js : '';
  config.customCss = typeof css === 'string' ? css : '';
  saveConfig();
  return { success: true, customJs: config.customJs, customCss: config.customCss };
});

// New: Get update details
ipcMain.handle('get-update-details', () => {
  return lastUpdateDetails;
});

// New: Set proxy
ipcMain.handle('set-proxy', (event, proxyConfig) => {
  if (!proxyConfig || typeof proxyConfig !== 'object') return { success: false };
  config.proxyEnabled = !!proxyConfig.proxyEnabled;
  config.proxyType = (proxyConfig.proxyType === 'socks5' || proxyConfig.proxyType === 'http') ? proxyConfig.proxyType : 'http';
  // Security: strict validation on proxy host/port to prevent injection
  config.proxyHost = typeof proxyConfig.proxyHost === 'string' ? proxyConfig.proxyHost.replace(/[^a-zA-Z0-9.\-_:/]/g, '').substring(0, 253) : '';
  config.proxyPort = typeof proxyConfig.proxyPort === 'string' ? proxyConfig.proxyPort.replace(/[^0-9]/g, '').substring(0, 5) : '';
  // Validate port range
  if (config.proxyPort) {
    const portNum = parseInt(config.proxyPort, 10);
    if (portNum < 1 || portNum > 65535) config.proxyPort = '';
  }
  saveConfig();
  applyProxyToAllSessions();
  return { success: true };
});

// New: Apply proxy to a specific session
ipcMain.handle('apply-proxy-to-session', (event, serviceId) => {
  if (typeof serviceId !== 'string' || !/^[a-z0-9-]+$/.test(serviceId)) return;
  const partitionName = `persist:${serviceId}`;
  const ses = session.fromPartition(partitionName);
  applyProxyToSession(ses);
});

// New: Set third-party cookies
ipcMain.handle('set-third-party-cookies', (event, enabled) => {
  config.thirdPartyCookies = !!enabled;
  saveConfig();
  return { success: true };
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
      return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
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

// New: Clear cache only (not cookies/storage)
ipcMain.handle('clear-cache', async () => {
  try {
    const allServices = loadServices();
    const serviceIds = allServices?.ai_services?.map(s => {
      const name = s[0];
      return name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
    }) || [];

    for (const serviceId of serviceIds) {
      try {
        const partitionName = `persist:${serviceId}`;
        const ses = session.fromPartition(partitionName);
        await ses.clearCache();
      } catch (e) {
        // Continue even if one fails
      }
    }
    return { success: true };
  } catch (error) {
    console.error('[ClearCache] Error:', error);
    return { success: false, error: 'Failed to clear cache' };
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
        allowRunningInsecureContent: false,
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
    return pkg.version || '0.6.1-beta';
  } catch (e) {
    return '0.6.1-beta';
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

  // Auto-update check after a short delay
  setTimeout(() => {
    autoUpdateCheck().catch(err => {
      console.error('[AutoUpdate] Error:', err);
    });
  }, 3000);
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
