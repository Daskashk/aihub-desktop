document.addEventListener("DOMContentLoaded", () => {
  const elements = {
    sidebar: document.getElementById("sidebar"),
    toggleSidebarBtn: document.getElementById("btn-toggle-sidebar"),
    servicesList: document.getElementById("services-list"),
    allServicesList: document.getElementById("all-services-list"),
    webviewsContainer: document.getElementById("webviews-container"),
    welcomeScreen: document.getElementById("welcome-screen"),
    settingsPanel: document.getElementById("settings-panel"),
    btnSettings: document.getElementById("btn-settings"),
    btnUpdate: document.getElementById("btn-update"),
    toggleBlocking: document.getElementById("toggle-blocking"),
    maxServicesInput: document.getElementById("max-services"),
    toggleDarkMode: document.getElementById("toggle-dark-mode"),
    lastUpdate: document.getElementById("last-update"),
    btnSaveSettings: document.getElementById("btn-save-settings"),
    btnCloseSettings: document.getElementById("btn-close-settings"),
    modalTabs: document.querySelectorAll(".modal-tab"),
    tabContents: document.querySelectorAll(".tab-content"),
    btnZoomIn: document.getElementById("btn-zoom-in"),
    btnZoomOut: document.getElementById("btn-zoom-out"),
    btnZoomReset: document.getElementById("btn-zoom-reset"),
    btnOpenBrowser: document.getElementById("btn-open-browser"),
    blockingIndicator: document.getElementById("blocking-indicator"),
    blockingText: document.getElementById("blocking-text"),
    btnClearData: document.getElementById("btn-clear-data"),
    clearDataModal: document.getElementById("clear-data-modal"),
    btnCancelClear: document.getElementById("btn-cancel-clear"),
    btnConfirmClear: document.getElementById("btn-confirm-clear"),
    btnReloadPage: document.getElementById("btn-reload-page"),
    serviceSearch: document.getElementById("service-search"),
    categoryFilter: document.getElementById("category-filter"),
    // New elements
    activeServicesBadge: document.getElementById("active-services-badge"),
    sidebarSearchInput: document.getElementById("sidebar-search-input"),
    sidebarCategories: document.getElementById("sidebar-categories"),

    errorOverlay: document.getElementById("error-overlay"),
    errorMessage: document.getElementById("error-message"),
    btnRetry: document.getElementById("btn-retry"),
    toggleLoadLast: document.getElementById("toggle-load-last"),
    defaultServiceSelect: document.getElementById("default-service-select"),
    fontSizeSelect: document.getElementById("font-size-select"),
    toggleThirdPartyCookies: document.getElementById(
      "toggle-third-party-cookies",
    ),
    toggleProxy: document.getElementById("toggle-proxy"),
    proxyConfigSection: document.getElementById("proxy-config-section"),
    proxyTypeSelect: document.getElementById("proxy-type-select"),
    proxyHostInput: document.getElementById("proxy-host-input"),
    proxyPortInput: document.getElementById("proxy-port-input"),
    updateFrequencySelect: document.getElementById("update-frequency-select"),
    customJsEditor: document.getElementById("custom-js-editor"),
    customCssEditor: document.getElementById("custom-css-editor"),
    btnSaveInjection: document.getElementById("btn-save-injection"),
    jsUnsaved: document.getElementById("js-unsaved"),
    cssUnsaved: document.getElementById("css-unsaved"),
    btnClearCache: document.getElementById("btn-clear-cache"),
    btnClearAllData: document.getElementById("btn-clear-all-data"),
    clearAllDataModal: document.getElementById("clear-all-data-modal"),
    btnCancelClearAll: document.getElementById("btn-cancel-clear-all"),
    btnConfirmClearAll: document.getElementById("btn-confirm-clear-all"),
    updateDetailsModal: document.getElementById("update-details-modal"),
    updateDetailsBody: document.getElementById("update-details-body"),
    btnCloseUpdateDetails: document.getElementById("btn-close-update-details"),
    btnDismissUpdate: document.getElementById("btn-dismiss-update"),
    btnApplyUpdate: document.getElementById("btn-apply-update"),
  };

  let config = {
    enabledServices: [],
    favoriteServices: [],
    serviceOrder: [],
    blockingEnabled: true,
    maxActiveServices: 3,
    darkMode: true,
    lastUpdate: null,
    lastUpdateCheck: null,
    defaultService: "chatgpt",
    loadLastOpenedAI: true,
    customJs: "",
    customCss: "",
    thirdPartyCookies: false,
    updateFrequencyDays: 3,
    fontSize: "medium",
    proxyEnabled: false,
    proxyType: "http",
    proxyHost: "",
    proxyPort: "",
  };
  let allServices = [];
  let activeTabs = [];
  let currentTabId = null;
  let appVersion = "0.6.1-beta";
  let currentFilter = "all";
  let sidebarFilter = "all";
  let searchQuery = "";
  let sidebarSearchQuery = "";
  let pendingUpdateDetails = null;
  let injectionDirty = { js: false, css: false };

  // --- UTILITY FUNCTIONS ---
  const formatDate = (isoString) => {
    if (!isoString) return "Never";
    return new Date(isoString).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const generateId = (name) =>
    name
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9-]/g, "");

  const escapeHtml = (unsafe) => {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const sanitizeColor = (color) => {
    if (!color) return "#4285f4";
    const hex = color.replace(/^#/, "");
    return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{4}$|^[0-9A-Fa-f]{6}$|^[0-9A-Fa-f]{8}$/.test(
      hex,
    )
      ? `#${hex}`
      : "#4285f4";
  };

  const getFontSizePercent = (size) => {
    const map = {
      "x-small": 80,
      small: 90,
      medium: 100,
      large: 110,
      "x-large": 120,
    };
    return map[size] || 100;
  };

  // --- BADGE GENERATORS ---
  const getPrivacyBadge = (privacy) => {
    if (!privacy) return "";
    const normalized = privacy.toLowerCase().trim();
    if (normalized === "privacy focused") {
      return `<span class="privacy-badge privacy-focused">Privacy Focused</span>`;
    } else if (normalized === "privacy friendly") {
      return `<span class="privacy-badge privacy-friendly">Privacy Friendly</span>`;
    } else if (normalized === "not for privacy") {
      return `<span class="privacy-badge not-for-privacy">Not for Privacy</span>`;
    }
    return "";
  };

  const getPricingBadge = (type) => {
    if (!type) return "";
    const normalized = type.toLowerCase().trim();
    if (normalized === "free") {
      return `<span class="pricing-badge pricing-free">Free</span>`;
    } else if (normalized === "freemium") {
      return `<span class="pricing-badge pricing-freemium">Freemium</span>`;
    } else if (normalized === "paid") {
      return `<span class="pricing-badge pricing-paid">Paid</span>`;
    }
    return "";
  };

  // --- UI UPDATE FUNCTIONS ---
  const updateBlockingUI = (enabled) => {
    elements.blockingIndicator.className = enabled
      ? "indicator active"
      : "indicator inactive";
    elements.blockingText.textContent = enabled
      ? "Blocking Active"
      : "Blocking Inactive";
  };

  const applyDarkMode = (enabled) => {
    document.body.classList.toggle("dark-mode", enabled);
  };

  const updateActiveServicesBadge = () => {
    if (activeTabs.length > 0) {
      elements.activeServicesBadge.style.display = "inline-flex";
      elements.activeServicesBadge.textContent = activeTabs.length;
    } else {
      elements.activeServicesBadge.style.display = "none";
    }
  };

  // --- ERROR OVERLAY ---
  const showErrorOverlay = (errorMsg) => {
    elements.errorMessage.textContent =
      errorMsg ||
      "Failed to load this service. Check your connection and try again.";
    elements.errorOverlay.classList.add("visible");
  };

  const hideErrorOverlay = () => {
    elements.errorOverlay.classList.remove("visible");
  };

  // --- CUSTOM INJECTION INTO WEBVIEW ---
  const injectCustomCode = (webview) => {
    if (!webview) return;
    const css = config.customCss || "";
    const js = config.customJs || "";

    if (css) {
      try {
        const escapedCss = css
          .replace(/\\/g, "\\\\")
          .replace(/`/g, "\\`")
          .replace(/\$/g, "\\$");
        webview
          .executeJavaScript(
            `
                (function() {
                    const style = document.createElement('style');
                    style.id = 'aihub-custom-css';
                    const existing = document.getElementById('aihub-custom-css');
                    if (existing) existing.remove();
                    style.textContent = \`${escapedCss}\`;
                    document.head.appendChild(style);
                })();
                `,
          )
          .catch(() => {});
      } catch (e) {}
    }

    if (js) {
      try {
        webview.executeJavaScript(js).catch(() => {});
      } catch (e) {}
    }
  };

  // --- FONT SIZE APPLICATION ---
  const applyFontSize = (webview) => {
    if (!webview) return;
    const percent = getFontSizePercent(config.fontSize);
    if (percent !== 100) {
      try {
        webview
          .executeJavaScript(
            `
                document.documentElement.style.fontSize = '${percent}%';
                `,
          )
          .catch(() => {});
      } catch (e) {}
    }
  };

  // --- LOAD CONFIG & SERVICES ---
  const loadConfig = async () => {
    try {
      config = await window.electronAPI.getConfig();
      elements.toggleBlocking.checked = config.blockingEnabled;
      elements.maxServicesInput.value = config.maxActiveServices;
      elements.toggleDarkMode.checked = config.darkMode;
      elements.lastUpdate.textContent = formatDate(config.lastUpdate);
      updateBlockingUI(config.blockingEnabled);
      applyDarkMode(config.darkMode);

      // New settings
      if (elements.toggleLoadLast)
        elements.toggleLoadLast.checked = config.loadLastOpenedAI !== false;
      if (elements.toggleThirdPartyCookies)
        elements.toggleThirdPartyCookies.checked = !!config.thirdPartyCookies;
      if (elements.toggleProxy)
        elements.toggleProxy.checked = !!config.proxyEnabled;
      if (elements.proxyConfigSection)
        elements.proxyConfigSection.style.display = config.proxyEnabled
          ? "block"
          : "none";
      if (elements.proxyTypeSelect)
        elements.proxyTypeSelect.value = config.proxyType || "http";
      if (elements.proxyHostInput)
        elements.proxyHostInput.value = config.proxyHost || "";
      if (elements.proxyPortInput)
        elements.proxyPortInput.value = config.proxyPort || "";
      if (elements.updateFrequencySelect)
        elements.updateFrequencySelect.value = String(
          config.updateFrequencyDays || 3,
        );
      if (elements.fontSizeSelect)
        elements.fontSizeSelect.value = config.fontSize || "medium";
      if (elements.customJsEditor)
        elements.customJsEditor.value = config.customJs || "";
      if (elements.customCssEditor)
        elements.customCssEditor.value = config.customCss || "";

      // Reset dirty flags
      injectionDirty = { js: false, css: false };
      if (elements.jsUnsaved) elements.jsUnsaved.classList.remove("visible");
      if (elements.cssUnsaved) elements.cssUnsaved.classList.remove("visible");

      populateDefaultServiceSelect();
      renderSidebarServices();
      renderSettingsServices();
    } catch (error) {
      console.error(error);
    }
  };

  const loadServices = async () => {
    try {
      const data = await window.electronAPI.getServices();
      if (data && data.ai_services) {
        allServices = data.ai_services;
        populateCategoryFilter();
        populateSidebarCategories();
        populateDefaultServiceSelect();
        renderSidebarServices();
        renderSettingsServices();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadAppVersion = async () => {
    try {
      appVersion = await window.electronAPI.getAppVersion();
      const versionEl = document.getElementById("about-version");
      if (versionEl) versionEl.textContent = `v${appVersion}`;
    } catch (e) {}
  };

  // --- DEFAULT SERVICE SELECT ---
  const populateDefaultServiceSelect = () => {
    if (!elements.defaultServiceSelect) return;
    const select = elements.defaultServiceSelect;
    const currentValue = config.defaultService || "chatgpt";
    select.innerHTML = "";

    // Add enabled services
    const enabledServices = allServices.filter((s) => {
      const id = generateId(s[0]);
      return config.enabledServices.includes(id);
    });

    enabledServices.forEach((service) => {
      const name = service[0];
      const id = generateId(name);
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      if (id === currentValue) option.selected = true;
      select.appendChild(option);
    });

    if (enabledServices.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No services enabled";
      select.appendChild(option);
    }
  };

  // --- CATEGORY FILTER (Settings) ---
  const populateCategoryFilter = () => {
    if (!elements.categoryFilter) return;
    const categories = new Set();
    allServices.forEach((s) => {
      if (s[2]) categories.add(s[2]);
    });

    elements.categoryFilter.innerHTML =
      '<option value="all">All Categories</option>';
    [...categories].sort().forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat.toLowerCase();
      option.textContent = cat;
      elements.categoryFilter.appendChild(option);
    });
  };

  // --- SIDEBAR CATEGORY CHIPS ---
  const populateSidebarCategories = () => {
    if (!elements.sidebarCategories) return;
    const categories = new Set();
    allServices
      .filter((s) => {
        const id = generateId(s[0]);
        return config.enabledServices.includes(id);
      })
      .forEach((s) => {
        if (s[2]) categories.add(s[2]);
      });

    elements.sidebarCategories.innerHTML = "";
    const allChip = document.createElement("span");
    allChip.className = "sidebar-category-chip active";
    allChip.textContent = "All";
    allChip.dataset.category = "all";
    allChip.addEventListener("click", () => {
      sidebarFilter = "all";
      elements.sidebarCategories
        .querySelectorAll(".sidebar-category-chip")
        .forEach((c) => c.classList.remove("active"));
      allChip.classList.add("active");
      renderSidebarServices();
    });
    elements.sidebarCategories.appendChild(allChip);

    // Add favorites chip
    if (config.favoriteServices && config.favoriteServices.length > 0) {
      const favChip = document.createElement("span");
      favChip.className = "sidebar-category-chip";
      favChip.textContent = "\u2605 Favs";
      favChip.dataset.category = "favorites";
      favChip.addEventListener("click", () => {
        sidebarFilter = "favorites";
        elements.sidebarCategories
          .querySelectorAll(".sidebar-category-chip")
          .forEach((c) => c.classList.remove("active"));
        favChip.classList.add("active");
        renderSidebarServices();
      });
      elements.sidebarCategories.appendChild(favChip);
    }

    [...categories].sort().forEach((cat) => {
      const chip = document.createElement("span");
      chip.className = "sidebar-category-chip";
      chip.textContent = cat;
      chip.dataset.category = cat.toLowerCase();
      chip.addEventListener("click", () => {
        sidebarFilter = cat.toLowerCase();
        elements.sidebarCategories
          .querySelectorAll(".sidebar-category-chip")
          .forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        renderSidebarServices();
      });
      elements.sidebarCategories.appendChild(chip);
    });
  };

  // --- SORT SERVICES BY ORDER ---
  const sortServicesByOrder = (services) => {
    const order = config.serviceOrder || [];
    if (order.length === 0) return services;

    return [...services].sort((a, b) => {
      const idA = generateId(a[0]);
      const idB = generateId(b[0]);
      const indexA = order.indexOf(idA);
      const indexB = order.indexOf(idB);
      // Services in order list come first, in their order
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0; // Keep original order for services not in list
    });
  };

  // --- SIDEBAR RENDERING ---
  const renderSidebarServices = () => {
    const enabledServices = allServices.filter((s) => {
      const id = generateId(s[0]);
      return config.enabledServices.includes(id);
    });

    if (enabledServices.length === 0) {
      elements.servicesList.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 10px;">No active services.<br>Go to Settings.</div>`;
      return;
    }

    // Apply sidebar search filter
    let filteredServices = enabledServices;
    if (sidebarSearchQuery) {
      const q = sidebarSearchQuery.toLowerCase();
      filteredServices = filteredServices.filter(
        (s) => s[0] && s[0].toLowerCase().includes(q),
      );
    }

    // Apply sidebar category filter
    if (sidebarFilter !== "all" && sidebarFilter !== "favorites") {
      filteredServices = filteredServices.filter(
        (s) => s[2] && s[2].toLowerCase() === sidebarFilter,
      );
    }

    // Sort by custom order
    filteredServices = sortServicesByOrder(filteredServices);

    // Separate favorites and non-favorites
    const favorites = filteredServices.filter((s) => {
      const id = generateId(s[0]);
      return config.favoriteServices && config.favoriteServices.includes(id);
    });
    const nonFavorites = filteredServices.filter((s) => {
      const id = generateId(s[0]);
      return !config.favoriteServices || !config.favoriteServices.includes(id);
    });

    // If filtering by favorites, only show favorites
    const showFavorites =
      sidebarFilter === "favorites"
        ? favorites
        : favorites.length > 0 && sidebarFilter === "all"
          ? true
          : false;
    const showNonFavorites = sidebarFilter === "favorites" ? [] : nonFavorites;

    elements.servicesList.innerHTML = "";

    // Render favorites section
    if (showFavorites && favorites.length > 0) {
      const label = document.createElement("div");
      label.className = "sidebar-section-label";
      label.textContent = "FAVORITES";
      elements.servicesList.appendChild(label);

      favorites.forEach((service) => {
        elements.servicesList.appendChild(createSidebarItem(service));
      });

      if (showNonFavorites.length > 0) {
        const divider = document.createElement("div");
        divider.className = "sidebar-divider";
        elements.servicesList.appendChild(divider);
      }
    }

    // Render non-favorites section
    if (showNonFavorites.length > 0) {
      if (showFavorites && favorites.length > 0 && sidebarFilter === "all") {
        const label = document.createElement("div");
        label.className = "sidebar-section-label";
        label.textContent = "ALL SERVICES";
        elements.servicesList.appendChild(label);
      }

      showNonFavorites.forEach((service) => {
        elements.servicesList.appendChild(createSidebarItem(service));
      });
    }

    updateActiveServicesBadge();
  };

  const createSidebarItem = (service) => {
    const [name, url, type, privacy, color] = service;
    const id = generateId(name);
    const bgColor = sanitizeColor(color);
    const isOpen = activeTabs.some((t) => t.id === id);
    const isActive = id === currentTabId;
    const isFavorite =
      config.favoriteServices && config.favoriteServices.includes(id);

    const item = document.createElement("div");
    item.className = `service-launcher ${isActive ? "active" : ""} ${isOpen ? "is-open" : ""}`;
    item.dataset.id = id;
    item.innerHTML = `
        <div class="launcher-info">
        <div class="service-dot" style="background-color: ${bgColor}"></div>
        <div class="service-name" style="color: ${bgColor}">${escapeHtml(name)}</div>
        </div>
        <div style="display:flex; align-items:center; gap:2px;">
        <button class="btn-fav ${isFavorite ? "is-favorite" : ""}" data-id="${id}" title="${isFavorite ? "Remove from favorites" : "Add to favorites"}">${isFavorite ? "\u2605" : "\u2606"}</button>
        <div class="launcher-actions">
        <button class="btn-xs btn-reload" title="Reload">&#8635;</button>
        <button class="btn-xs btn-close" title="Close">&#10005;</button>
        </div>
        </div>`;

    item.addEventListener("click", (e) => {
      if (e.target.closest(".btn-close")) closeTab(id);
      else if (e.target.closest(".btn-reload")) reloadTab(id);
      else if (e.target.closest(".btn-fav")) toggleFavorite(id);
      else {
        if (isOpen) switchToTab(id);
        else createTab(id, url, name);
      }
    });
    return item;
  };

  // --- FAVORITE TOGGLE ---
  const toggleFavorite = async (serviceId) => {
    try {
      config.favoriteServices =
        await window.electronAPI.toggleFavorite(serviceId);
      renderSidebarServices();
      populateSidebarCategories();
    } catch (error) {
      console.error("[Favorites] Error:", error);
    }
  };

  // --- SETTINGS SERVICES RENDERING (IMPROVED UI with reorder) ---
  const renderSettingsServices = () => {
    elements.allServicesList.innerHTML = "";

    // Filter and search
    let filteredServices = allServices;
    if (currentFilter !== "all") {
      filteredServices = filteredServices.filter(
        (s) => s[2] && s[2].toLowerCase() === currentFilter,
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredServices = filteredServices.filter(
        (s) => s[0] && s[0].toLowerCase().includes(q),
      );
    }

    if (filteredServices.length === 0) {
      elements.allServicesList.innerHTML =
        '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 12px;">No services match your filter.</div>';
      return;
    }

    // Sort by custom order for enabled services, keep disabled at bottom
    const enabledFiltered = filteredServices.filter((s) => {
      const id = generateId(s[0]);
      return config.enabledServices.includes(id);
    });
    const disabledFiltered = filteredServices.filter((s) => {
      const id = generateId(s[0]);
      return !config.enabledServices.includes(id);
    });

    const sortedEnabled = sortServicesByOrder(enabledFiltered);
    const sortedAll = [...sortedEnabled, ...disabledFiltered];

    sortedAll.forEach((service, index) => {
      const [name, url, type, privacy, color] = service;
      const id = generateId(name);
      const bgColor = sanitizeColor(color);
      const isEnabled = config.enabledServices.includes(id);
      const privacyBadgeHtml = getPrivacyBadge(privacy);
      const pricingBadgeHtml = getPricingBadge(type);

      const item = document.createElement("div");
      item.className = "service-setting-item";
      item.innerHTML = `
            <div class="service-info">
            ${
              isEnabled
                ? `
                <div class="service-reorder-controls">
                <button class="btn-reorder" data-id="${id}" data-dir="up" title="Move up">&#9650;</button>
                <button class="btn-reorder" data-id="${id}" data-dir="down" title="Move down">&#9660;</button>
                </div>`
                : ""
            }
                <div class="service-info-details">
                <div class="service-info-name" style="color: ${bgColor}">${escapeHtml(name)}</div>
                <div class="service-info-badges">
                ${pricingBadgeHtml}
                ${privacyBadgeHtml}
                </div>
                </div>
                </div>
                <label class="toggle-switch material-toggle">
                <input type="checkbox" ${isEnabled ? "checked" : ""} data-service-id="${id}">
                <span class="toggle-slider"></span>
                </label>`;

      // Toggle handler
      item
        .querySelector('input[type="checkbox"]')
        .addEventListener("change", async (e) => {
          const serviceId = e.target.dataset.serviceId;
          try {
            config.enabledServices =
              await window.electronAPI.toggleService(serviceId);
            populateDefaultServiceSelect();
            populateSidebarCategories();
            renderSidebarServices();
            renderSettingsServices(); // Re-render to show/hide reorder buttons
          } catch (error) {
            e.target.checked = !e.target.checked;
          }
        });

      // Reorder handlers
      item.querySelectorAll(".btn-reorder").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const serviceId = btn.dataset.id;
          const dir = btn.dataset.dir;
          const order = config.serviceOrder || [...config.enabledServices];
          const idx = order.indexOf(serviceId);
          if (idx === -1) return;
          if (dir === "up" && idx > 0) {
            [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
          } else if (dir === "down" && idx < order.length - 1) {
            [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
          }
          try {
            config.serviceOrder =
              await window.electronAPI.setServiceOrder(order);
            renderSidebarServices();
            renderSettingsServices();
          } catch (error) {
            console.error("[Reorder] Error:", error);
          }
        });
      });

      elements.allServicesList.appendChild(item);
    });
  };

  // --- WEBVIEW LISTENERS ---
  const setupWebviewListeners = (webview, serviceId) => {
    // Handle new-window events for external links
    webview.addEventListener("new-window", async (e) => {
      e.preventDefault();
      if (
        e.url &&
        (e.url.startsWith("http://") || e.url.startsWith("https://"))
      ) {
        try {
          await window.electronAPI.openInBrowser(e.url);
        } catch (error) {
          console.error("[Webview] Failed to open URL in browser:", error);
        }
      }
    });

    // Loading state - inject custom code on stop
    webview.addEventListener("did-stop-loading", () => {
      // Inject custom code after page loads
      injectCustomCode(webview);
      applyFontSize(webview);
    });

    webview.addEventListener("did-finish-load", () => {
      if (serviceId === currentTabId) {
        hideErrorOverlay();
      }
      // Inject custom code after page loads
      injectCustomCode(webview);
      applyFontSize(webview);
    });

    webview.addEventListener("did-fail-load", (event) => {
      if (serviceId === currentTabId) {
        let errorMsg = "Failed to load this service.";
        if (event.errorDescription) {
          if (
            event.errorDescription.includes("ERR_NAME_NOT_RESOLVED") ||
            event.errorDescription.includes("ERR_INTERNET_DISCONNECTED")
          ) {
            errorMsg =
              "No internet connection. Please check your network and try again.";
          } else if (event.errorDescription.includes("ERR_SSL")) {
            errorMsg =
              "SSL connection error. The site may have certificate issues.";
          } else if (event.errorDescription.includes("ERR_PROXY")) {
            errorMsg = "Proxy connection failed. Check your proxy settings.";
          } else if (event.errorDescription.includes("ERR_CONNECTION")) {
            errorMsg =
              "Connection refused or timed out. The service may be down.";
          } else {
            errorMsg = `Error: ${event.errorDescription}`;
          }
        }
        showErrorOverlay(errorMsg);
      }
    });

    // Context menu for right-click on webview
    webview.addEventListener("context-menu", async (e) => {
      e.preventDefault();
      const menuItems = [];

      // If there's a link URL, add link options
      if (
        e.linkURL &&
        (e.linkURL.startsWith("http://") || e.linkURL.startsWith("https://"))
      ) {
        menuItems.push({
          label: "Open Link in Browser",
          action: () => window.electronAPI.openInBrowser(e.linkURL),
        });
        menuItems.push({
          label: "Copy Link Address",
          action: async () => {
            try {
              const result = await window.electronAPI.cleanUrlTracking(
                e.linkURL,
              );
              await navigator.clipboard.writeText(result.cleanedUrl);
            } catch (err) {
              await navigator.clipboard.writeText(e.linkURL);
            }
          },
        });
        menuItems.push({ type: "separator" });
      }

      // Navigation options
      menuItems.push({
        label: "Go Back",
        action: () => {
          try {
            webview.goBack();
          } catch (err) {}
        },
        enabled: webview.canGoBack(),
      });
      menuItems.push({
        label: "Go Forward",
        action: () => {
          try {
            webview.goForward();
          } catch (err) {}
        },
        enabled: webview.canGoForward(),
      });
      menuItems.push({
        label: "Reload",
        action: () => webview.reload(),
      });
      menuItems.push({ type: "separator" });

      // Copy current page URL
      menuItems.push({
        label: "Copy Page URL",
        action: async () => {
          try {
            const currentUrl = webview.getURL();
            await navigator.clipboard.writeText(currentUrl);
          } catch (err) {}
        },
      });
      menuItems.push({
        label: "Open Page in Browser",
        action: async () => {
          try {
            const currentUrl = webview.getURL();
            if (currentUrl && currentUrl !== "about:blank") {
              await window.electronAPI.openInBrowser(currentUrl);
            }
          } catch (err) {}
        },
      });

      showContextMenu(menuItems, e);
    });
  };

  // --- CUSTOM CONTEXT MENU ---
  const showContextMenu = (items, event) => {
    // Remove any existing context menu
    const existingMenu = document.getElementById("custom-context-menu");
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement("div");
    menu.id = "custom-context-menu";
    menu.className = "context-menu";

    items.forEach((item) => {
      if (item.type === "separator") {
        const sep = document.createElement("div");
        sep.className = "context-menu-separator";
        menu.appendChild(sep);
      } else {
        const menuItem = document.createElement("div");
        menuItem.className = "context-menu-item";
        if (item.enabled === false) menuItem.classList.add("disabled");
        menuItem.textContent = item.label;
        menuItem.addEventListener("click", () => {
          menu.remove();
          if (item.enabled !== false && item.action) item.action();
        });
        menu.appendChild(menuItem);
      }
    });

    // Position the menu
    const x = event.clientX || (event.event && event.event.clientX) || 0;
    const y = event.clientY || (event.event && event.event.clientY) || 0;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    document.body.appendChild(menu);

    // Adjust position if menu goes off-screen
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth)
        menu.style.left = `${window.innerWidth - rect.width - 5}px`;
      if (rect.bottom > window.innerHeight)
        menu.style.top = `${window.innerHeight - rect.height - 5}px`;
    });

    // Close on click outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 10);

    // Close on Escape
    const escHandler = (e) => {
      if (e.key === "Escape") {
        menu.remove();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  };

  // --- TAB MANAGEMENT ---
  const createTab = (serviceId, url, title) => {
    if (activeTabs.length >= config.maxActiveServices) {
      alert(`Limit reached (${config.maxActiveServices}). Close a tab first.`);
      return;
    }
    const webview = document.createElement("webview");
    webview.dataset.id = serviceId;
    webview.setAttribute("src", url);
    webview.setAttribute("partition", `persist:${serviceId}`);
    webview.setAttribute("sandbox", "");
    webview.style.display = "none";
    elements.webviewsContainer.appendChild(webview);

    setupWebviewListeners(webview, serviceId);

    activeTabs.push({ id: serviceId, url, title, webview, zoomLevel: 0 });
    switchToTab(serviceId);
    window.electronAPI.setActiveService(serviceId);
    renderSidebarServices();
  };

  const switchToTab = (id) => {
    currentTabId = id;
    hideErrorOverlay();
    activeTabs.forEach((t) => {
      t.webview.style.display = t.id === id ? "flex" : "none";
    });
    elements.welcomeScreen.style.display = "none";
    window.electronAPI.setActiveService(id);
    renderSidebarServices();
  };

  const closeTab = (id) => {
    const index = activeTabs.findIndex((t) => t.id === id);
    if (index === -1) return;
    const tab = activeTabs[index];
    try {
      tab.webview.stop();
    } catch (e) {}
    tab.webview.remove();

    activeTabs.splice(index, 1);
    if (activeTabs.length > 0) {
      switchToTab(activeTabs[Math.min(index, activeTabs.length - 1)].id);
    } else {
      currentTabId = null;
      elements.welcomeScreen.style.display = "flex";
      hideErrorOverlay();
    }
    renderSidebarServices();
  };

  const reloadTab = (id) => {
    const tab = activeTabs.find((t) => t.id === id);
    if (tab) {
      hideErrorOverlay();
      tab.webview.reload();
    }
  };

  const applyZoom = (id, level) => {
    const tab = activeTabs.find((t) => t.id === id);
    if (tab) {
      tab.zoomLevel = level;
      tab.webview.setZoomLevel(level);
    }
  };

  const zoomIn = () => {
    if (!currentTabId) return;
    const tab = activeTabs.find((t) => t.id === currentTabId);
    if (tab) applyZoom(currentTabId, Math.min(tab.zoomLevel + 0.5, 5));
  };

  const zoomOut = () => {
    if (!currentTabId) return;
    const tab = activeTabs.find((t) => t.id === currentTabId);
    if (tab) applyZoom(currentTabId, Math.max(tab.zoomLevel - 0.5, -5));
  };

  const zoomReset = () => {
    if (!currentTabId) return;
    applyZoom(currentTabId, 0);
  };

  // Open current service in default browser
  const openInBrowser = async () => {
    if (!currentTabId) return;
    const tab = activeTabs.find((t) => t.id === currentTabId);
    if (tab) {
      try {
        const currentUrl = tab.webview.src || tab.url;
        if (currentUrl && currentUrl !== "about:blank") {
          await window.electronAPI.openInBrowser(currentUrl);
        }
      } catch (error) {
        console.error("[OpenInBrowser] Failed:", error);
      }
    }
  };

  // --- UPDATE DETAILS MODAL ---
  const showUpdateDetails = (details) => {
    if (!details || !details.hasChanges) {
      elements.updateDetailsBody.innerHTML =
        '<div class="update-no-changes">No changes detected.</div>';
    } else {
      let html = "";

      const renderCategory = (title, items, cssClass) => {
        if (items.length === 0) return "";
        return `
                        <div class="update-category">
                        <div class="update-category-title">${title}</div>
                        <ul class="update-category-list">
                        ${items.map((item) => `<li class="${cssClass}">${escapeHtml(item)}</li>`).join("")}
                        </ul>
                        </div>`;
      };

      html += renderCategory(
        "AI Services Added",
        details.servicesAdded || [],
        "added",
      );
      html += renderCategory(
        "AI Services Removed",
        details.servicesRemoved || [],
        "removed",
      );
      html += renderCategory(
        "AI Services Changed",
        details.servicesChanged || [],
        "changed",
      );
      html += renderCategory(
        "Domain Rules Added/Updated",
        details.domainsAdded || [],
        "added",
      );
      html += renderCategory(
        "Domain Rules Removed",
        details.domainsRemoved || [],
        "removed",
      );
      html += renderCategory(
        "Blocked Domains Added",
        details.alwaysBlockedAdded || [],
        "added",
      );
      html += renderCategory(
        "Blocked Domains Removed",
        details.alwaysBlockedRemoved || [],
        "removed",
      );
      html += renderCategory(
        "Common Auth Domains Added",
        details.commonAuthAdded || [],
        "added",
      );
      html += renderCategory(
        "Common Auth Domains Removed",
        details.commonAuthRemoved || [],
        "removed",
      );
      html += renderCategory(
        "Tracking Parameters Added",
        details.trackingParamsAdded || [],
        "added",
      );
      html += renderCategory(
        "Tracking Parameters Removed",
        details.trackingParamsRemoved || [],
        "removed",
      );

      elements.updateDetailsBody.innerHTML = html;
    }
    elements.updateDetailsModal.classList.remove("hidden");
  };

  const hideUpdateDetails = () => {
    elements.updateDetailsModal.classList.add("hidden");
    pendingUpdateDetails = null;
  };

  // --- EVENT LISTENERS ---

  elements.toggleSidebarBtn.addEventListener("click", () =>
    elements.sidebar.classList.toggle("hidden"),
  );

  elements.btnSettings.addEventListener("click", () => {
    renderSettingsServices();
    populateDefaultServiceSelect();
    // Reset injection editors from config
    if (elements.customJsEditor)
      elements.customJsEditor.value = config.customJs || "";
    if (elements.customCssEditor)
      elements.customCssEditor.value = config.customCss || "";
    injectionDirty = { js: false, css: false };
    if (elements.jsUnsaved) elements.jsUnsaved.classList.remove("visible");
    if (elements.cssUnsaved) elements.cssUnsaved.classList.remove("visible");
    elements.settingsPanel.classList.remove("hidden");
  });

  elements.btnCloseSettings.addEventListener("click", () =>
    elements.settingsPanel.classList.add("hidden"),
  );

  elements.btnSaveSettings.addEventListener("click", async () => {
    const newConfig = {
      blockingEnabled: elements.toggleBlocking.checked,
      maxActiveServices: parseInt(elements.maxServicesInput.value) || 3,
      darkMode: elements.toggleDarkMode.checked,
      loadLastOpenedAI: elements.toggleLoadLast
        ? elements.toggleLoadLast.checked
        : true,
      defaultService: elements.defaultServiceSelect
        ? elements.defaultServiceSelect.value
        : "chatgpt",
      thirdPartyCookies: elements.toggleThirdPartyCookies
        ? elements.toggleThirdPartyCookies.checked
        : false,
      updateFrequencyDays: elements.updateFrequencySelect
        ? parseInt(elements.updateFrequencySelect.value)
        : 3,
      fontSize: elements.fontSizeSelect
        ? elements.fontSizeSelect.value
        : "medium",
    };
    try {
      config = await window.electronAPI.saveConfig(newConfig);
      updateBlockingUI(config.blockingEnabled);
      applyDarkMode(config.darkMode);

      // Save proxy settings
      if (elements.toggleProxy) {
        const proxyConfig = {
          proxyEnabled: elements.toggleProxy.checked,
          proxyType: elements.proxyTypeSelect
            ? elements.proxyTypeSelect.value
            : "http",
          proxyHost: elements.proxyHostInput
            ? elements.proxyHostInput.value
            : "",
          proxyPort: elements.proxyPortInput
            ? elements.proxyPortInput.value
            : "",
        };
        await window.electronAPI.setProxy(proxyConfig);
        config.proxyEnabled = proxyConfig.proxyEnabled;
        config.proxyType = proxyConfig.proxyType;
        config.proxyHost = proxyConfig.proxyHost;
        config.proxyPort = proxyConfig.proxyPort;
      }

      // Apply font size to all active tabs
      if (config.fontSize !== "medium") {
        activeTabs.forEach((tab) => applyFontSize(tab.webview));
      }

      // Apply third-party cookies setting
      if (elements.toggleThirdPartyCookies) {
        await window.electronAPI.setThirdPartyCookies(
          elements.toggleThirdPartyCookies.checked,
        );
      }

      elements.settingsPanel.classList.add("hidden");
    } catch (error) {
      console.error("[Save] Error:", error);
    }
  });

  // Proxy toggle
  if (elements.toggleProxy) {
    elements.toggleProxy.addEventListener("change", () => {
      if (elements.proxyConfigSection) {
        elements.proxyConfigSection.style.display = elements.toggleProxy.checked
          ? "block"
          : "none";
      }
    });
  }

  // Custom injection save
  if (elements.btnSaveInjection) {
    elements.btnSaveInjection.addEventListener("click", async () => {
      const js = elements.customJsEditor ? elements.customJsEditor.value : "";
      const css = elements.customCssEditor
        ? elements.customCssEditor.value
        : "";
      try {
        const result = await window.electronAPI.saveCustomInjection(js, css);
        config.customJs = result.customJs;
        config.customCss = result.customCss;
        injectionDirty = { js: false, css: false };
        if (elements.jsUnsaved) elements.jsUnsaved.classList.remove("visible");
        if (elements.cssUnsaved)
          elements.cssUnsaved.classList.remove("visible");
        // Apply to all active tabs immediately
        activeTabs.forEach((tab) => injectCustomCode(tab.webview));
      } catch (error) {
        console.error("[Injection] Error saving:", error);
      }
    });
  }

  // Track unsaved changes in injection editors
  if (elements.customJsEditor) {
    elements.customJsEditor.addEventListener("input", () => {
      injectionDirty.js = true;
      if (elements.jsUnsaved) elements.jsUnsaved.classList.add("visible");
    });
  }
  if (elements.customCssEditor) {
    elements.customCssEditor.addEventListener("input", () => {
      injectionDirty.css = true;
      if (elements.cssUnsaved) elements.cssUnsaved.classList.add("visible");
    });
  }

  // Storage buttons
  if (elements.btnClearCache) {
    elements.btnClearCache.addEventListener("click", async () => {
      try {
        const result = await window.electronAPI.clearCache();
        if (result.success) {
          elements.btnClearCache.textContent = "Cleared!";
          setTimeout(() => {
            elements.btnClearCache.textContent = "Clear Cache";
          }, 2000);
        } else {
          alert("Failed to clear cache: " + (result.error || "Unknown error"));
        }
      } catch (error) {
        alert("Error clearing cache");
      }
    });
  }

  if (elements.btnClearAllData) {
    elements.btnClearAllData.addEventListener("click", () => {
      elements.clearAllDataModal.classList.remove("hidden");
    });
  }

  if (elements.btnCancelClearAll) {
    elements.btnCancelClearAll.addEventListener("click", () =>
      elements.clearAllDataModal.classList.add("hidden"),
    );
  }

  if (elements.btnConfirmClearAll) {
    elements.btnConfirmClearAll.addEventListener("click", async () => {
      elements.clearAllDataModal.classList.add("hidden");
      try {
        const result = await window.electronAPI.clearAllData();
        if (result.success) {
          // Reload all active tabs
          activeTabs.forEach((tab) => tab.webview.reload());
          elements.btnClearAllData.textContent = "Cleared!";
          setTimeout(() => {
            elements.btnClearAllData.textContent = "Clear All Data";
          }, 2000);
        } else {
          alert("Failed to clear data: " + (result.error || "Unknown error"));
        }
      } catch (error) {
        alert("Error clearing data");
      }
    });
  }

  elements.btnZoomIn.addEventListener("click", zoomIn);
  elements.btnZoomOut.addEventListener("click", zoomOut);
  if (elements.btnZoomReset)
    elements.btnZoomReset.addEventListener("click", zoomReset);
  elements.btnOpenBrowser.addEventListener("click", openInBrowser);
  elements.btnReloadPage.addEventListener("click", () => {
    if (currentTabId) reloadTab(currentTabId);
  });

  // Retry button
  if (elements.btnRetry) {
    elements.btnRetry.addEventListener("click", () => {
      if (currentTabId) {
        hideErrorOverlay();
        reloadTab(currentTabId);
      }
    });
  }

  // Update button
  elements.btnUpdate.addEventListener("click", async () => {
    elements.blockingIndicator.className = "indicator";
    elements.blockingText.textContent = "Updating...";
    try {
      const result = await window.electronAPI.updateRemoteData();
      if (result.success) {
        if (result.updated) {
          await loadServices();
          config.lastUpdate = new Date().toISOString();
          elements.lastUpdate.textContent = formatDate(config.lastUpdate);
          elements.blockingText.textContent = "Updated!";
          // Show update details if available
          if (result.updateDetails && result.updateDetails.hasChanges) {
            pendingUpdateDetails = result.updateDetails;
            showUpdateDetails(result.updateDetails);
          }
        } else {
          elements.blockingText.textContent = "Up to date";
        }
      } else {
        elements.blockingText.textContent = "Update Failed";
      }
      setTimeout(() => updateBlockingUI(config.blockingEnabled), 2500);
    } catch (error) {
      elements.blockingText.textContent = "Update Error";
      setTimeout(() => updateBlockingUI(config.blockingEnabled), 2500);
    }
  });

  // Update details modal buttons
  if (elements.btnCloseUpdateDetails) {
    elements.btnCloseUpdateDetails.addEventListener("click", hideUpdateDetails);
  }
  if (elements.btnDismissUpdate) {
    elements.btnDismissUpdate.addEventListener("click", hideUpdateDetails);
  }
  if (elements.btnApplyUpdate) {
    elements.btnApplyUpdate.addEventListener("click", () => {
      hideUpdateDetails();
      // Reload all active tabs to apply updates
      activeTabs.forEach((tab) => tab.webview.reload());
      renderSidebarServices();
    });
  }

  // Clear site data (per service)
  elements.btnClearData.addEventListener("click", () => {
    if (!currentTabId) return;
    elements.clearDataModal.classList.remove("hidden");
  });

  elements.btnCancelClear.addEventListener("click", () =>
    elements.clearDataModal.classList.add("hidden"),
  );

  elements.btnConfirmClear.addEventListener("click", async () => {
    elements.clearDataModal.classList.add("hidden");
    if (currentTabId) {
      try {
        const result = await window.electronAPI.clearServiceData(currentTabId);
        if (result.success) {
          reloadTab(currentTabId);
        } else {
          alert("Failed to clear data: " + (result.error || "Unknown error"));
        }
      } catch (error) {
        alert("Error clearing data");
      }
    }
  });

  elements.modalTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      elements.modalTabs.forEach((t) => t.classList.remove("active"));
      elements.tabContents.forEach((c) => c.classList.remove("active"));
      e.target.classList.add("active");
      document
        .getElementById(`tab-${e.target.dataset.tab}`)
        .classList.add("active");
    });
  });

  // Handle About tab link clicks
  document.querySelectorAll(".about-link-btn").forEach((link) => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      const url = e.target.dataset.url;
      if (url) {
        try {
          await window.electronAPI.openInBrowser(url);
        } catch (error) {
          console.error("[About] Failed to open link:", error);
        }
      }
    });
  });

  // Service search and category filter in settings
  if (elements.serviceSearch) {
    elements.serviceSearch.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderSettingsServices();
    });
  }

  if (elements.categoryFilter) {
    elements.categoryFilter.addEventListener("change", (e) => {
      currentFilter = e.target.value;
      renderSettingsServices();
    });
  }

  // Sidebar search
  if (elements.sidebarSearchInput) {
    elements.sidebarSearchInput.addEventListener("input", (e) => {
      sidebarSearchQuery = e.target.value.trim();
      renderSidebarServices();
    });
  }

  // Listen for login window close events
  window.electronAPI.onLoginWindowClosed((serviceId) => {
    // Reload the service tab if it's open
    const tab = activeTabs.find((t) => t.id === serviceId);
    if (tab) {
      tab.webview.reload();
    }
  });

  // Auto-update notification from main process
  window.electronAPI.onAutoUpdateAvailable((details) => {
    if (details && details.hasChanges) {
      pendingUpdateDetails = details;
      // Reload services list silently
      loadServices();
      showUpdateDetails(details);
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      elements.settingsPanel.classList.add("hidden");
      elements.clearDataModal.classList.add("hidden");
      if (elements.clearAllDataModal)
        elements.clearAllDataModal.classList.add("hidden");
      if (elements.updateDetailsModal)
        elements.updateDetailsModal.classList.add("hidden");
    }
    if (e.ctrlKey && e.key === "=") {
      e.preventDefault();
      zoomIn();
    }
    if (e.ctrlKey && e.key === "-") {
      e.preventDefault();
      zoomOut();
    }
    if (e.ctrlKey && e.key === "0") {
      e.preventDefault();
      zoomReset();
    }
    if (e.ctrlKey && e.key === "r") {
      e.preventDefault();
      if (currentTabId) reloadTab(currentTabId);
    }
  });

  // --- AUTO-OPEN LAST SERVICE ON STARTUP ---
  const autoOpenService = () => {
    if (config.loadLastOpenedAI !== false && config.lastActiveService) {
      // Check if the last active service is still enabled
      if (config.enabledServices.includes(config.lastActiveService)) {
        const service = allServices.find(
          (s) => generateId(s[0]) === config.lastActiveService,
        );
        if (service) {
          createTab(config.lastActiveService, service[1], service[0]);
          return true;
        }
      }
    }
    // Fallback to default service
    if (
      config.defaultService &&
      config.enabledServices.includes(config.defaultService)
    ) {
      const service = allServices.find(
        (s) => generateId(s[0]) === config.defaultService,
      );
      if (service) {
        createTab(config.defaultService, service[1], service[0]);
        return true;
      }
    }
    return false;
  };

  // --- INITIALIZATION ---
  const init = async () => {
    await loadConfig();
    await loadServices();
    await loadAppVersion();

    // Initialize service order from enabled services if not set
    if (!config.serviceOrder || config.serviceOrder.length === 0) {
      config.serviceOrder = [...config.enabledServices];
      try {
        await window.electronAPI.setServiceOrder(config.serviceOrder);
      } catch (e) {}
    }

    // Auto-open last used service or default
    if (allServices.length > 0) {
      autoOpenService();
    }
  };
  init();
});
