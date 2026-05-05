<div align="center">

# AI Hub Desktop

**All your AI assistants. One desktop app. Privacy-first.**

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)
[![Version](https://img.shields.io/badge/Version-0.5.1--beta-green.svg)](https://github.com/Daskashk/aihub-desktop/releases)
[![Platform](https://img.shields.io/badge/Platform-Linux-fcc624.svg?logo=linux&logoColor=black)](https://github.com/Daskashk/aihub-desktop/releases)
[![Electron](https://img.shields.io/badge/Electron-41-47848f.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](https://github.com/Daskashk/aihub-desktop/pulls)

A lightweight, privacy-focused desktop application that brings **65+ AI assistants** together in a single tabbed interface. Built with Electron, powered by sandboxed WebViews, and fortified with network-level tracker blocking — no more juggling browser tabs or surrendering your data to analytics scripts.

**Desktop port of the acclaimed [AI Hub for Android](https://github.com/SilentCoderHere/aihub)** by [SilentCoder](https://github.com/SilentCoderHere).

[Download](#-installation) · [Features](#-features) · [Privacy](#-privacy--security) · [Build](#-building-from-source) · [Configuration](#-configuration) · [Contributing](#-contributing)

</div>

---

## ✨ Features

### Unified AI Workspace

Access **65+ AI assistants** — from ChatGPT and Claude to Gemini and DeepSeek — all within a single desktop window. Each service runs in its own isolated tab with persistent login sessions that survive app restarts.

### Privacy-First Network Firewall

Unlike regular browser tabs that happily load every tracker and analytics script, AI Hub Desktop blocks **all network requests** except those explicitly whitelisted for each service. Trackers, ads, and telemetry are stopped at the network level before they even load. A curated list of always-blocked tracking domains (Google Analytics, Baidu Analytics, and more) provides an additional layer of protection on top of per-service allowlists.

### Privacy Badges

Every AI service is labeled with a clear privacy rating — **Privacy Focused** (green), **Privacy Friendly** (yellow), or **Not for Privacy** (red) — so you can make informed decisions at a glance.

### Remotely Updated Service Directory

The AI service catalog and domain filtering rules are fetched from a shared [remote configuration repository](https://github.com/SilentCoderHere/aihub-config-data), meaning new AI services and updated privacy rules are delivered without requiring an app update.

### Service Manager

Enable, disable, and organize only the AI services you care about. A configurable cap (1–10) on concurrent active tabs lets you balance functionality against memory usage.

### Dark & Light Themes

Switch between dark and light modes to match your desktop environment and personal preference. All theming is handled through CSS custom properties for a consistent experience.

### Per-Service Data Isolation

Each AI service operates within its own Electron session partition (`persist:serviceId`), ensuring cookies, local storage, and session data are completely isolated between services — more secure than sharing a single browser profile.

---

## 🛡️ Privacy & Security

AI Hub Desktop was designed from the ground up with a security-first mindset. Here is how every layer protects you:

| Layer | Protection |
|-------|-----------|
| **Network Firewall** | All requests are intercepted via `webRequest.onBeforeRequest`. Only whitelisted domains for each service are allowed through. Everything else is silently blocked. |
| **Always-Blocked Domains** | Specific tracking and analytics subdomains are blocked even within otherwise-allowed services (e.g., `ab.chatgpt.com`, `www.google-analytics.com` on Gemini). |
| **Sandboxed WebViews** | Every WebView runs with `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`. |
| **Content Security Policy** | A strict CSP (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`) is enforced on the renderer. |
| **XSS Prevention** | All dynamic content is escaped via `escapeHtml()` and `sanitizeColor()` before rendering. |
| **IPC Whitelist** | Only specific configuration keys (`blockingEnabled`, `maxActiveServices`, `darkMode`) are accepted by the main process save handler. |
| **URL Validation** | The open-in-browser handler validates that URLs use `http:` or `https:` protocols before delegating to the system browser. |
| **Session Isolation** | Each service uses a separate `persist:` partition, preventing cross-service cookie or storage leakage. |
| **Clean Shutdown** | On quit, all `onBeforeRequest` listeners are removed and active WebViews are stopped, cleared, and properly disposed. |

---

## 🤖 Supported AI Services

AI Hub Desktop currently supports **65 AI assistants** spanning multiple categories — from general-purpose chatbots to specialized research tools, regional language models, and privacy-focused alternatives. The full list is dynamically loaded from the [shared config repository](https://github.com/SilentCoderHere/aihub-config-data) (currently at config version **5.9.0**).

### Popular Services

| Service | Type | Privacy |
|---------|------|---------|
| ChatGPT | Freemium | Not for Privacy |
| Claude | Freemium | Not for Privacy |
| Gemini | Freemium | Not for Privacy |
| DeepSeek | Free | Not for Privacy |
| Grok | Freemium | Not for Privacy |
| Copilot | Freemium | Not for Privacy |
| Perplexity | Freemium | Not for Privacy |
| Meta AI | Free | Not for Privacy |

### Privacy-Focused Services

| Service | Type | Privacy |
|---------|------|---------|
| Duck AI | Freemium | Privacy Focused |
| Venice | Freemium | Privacy Focused |
| Lumo (Proton) | Freemium | Privacy Focused |
| Brave | Free | Privacy Focused |
| OpenRouter Chat | Freemium | Privacy Focused |
| TurboSeek | Free | Privacy Focused |
| Euria (Infomaniak) | Freemium | Privacy Focused |

### Research & Academic

| Service | Type | Privacy |
|---------|------|---------|
| Consensus | Free | Not for Privacy |
| Elicit | Freemium | Privacy Friendly |
| SciSpace AI | Free | Not for Privacy |
| Paperguide AI | Freemium | Not for Privacy |
| Google NotebookLM | Free | Not for Privacy |

### Regional & Multilingual

| Service | Region | Privacy |
|---------|--------|---------|
| Qwen | China | Not for Privacy |
| Kimi | China | Not for Privacy |
| Doubao | China | Not for Privacy |
| Ernie (Baidu) | China | Not for Privacy |
| Zhipu Qingyan | China | Not for Privacy |
| Xunfei Starfire | China | Not for Privacy |
| Tencent Yuanbao | China | Not for Privacy |
| PLLuM | Poland | Not for Privacy |
| Indus | India | Privacy Friendly |
| SEA-LION | Southeast Asia | Privacy Friendly |

...and many more. The complete list is available in the [ai_services_list.json](https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/ai_services_list.json) config file.

---

## 🏗️ Architecture

AI Hub Desktop follows the standard Electron multi-process architecture with a deliberately minimal codebase:

```
aihub-desktop/
├── main.js                  # Electron main process (237 lines)
│   ├── App lifecycle & window management
│   ├── Config persistence (userData/config.json)
│   ├── Remote data fetching (services + rules)
│   ├── IPC handlers
│   └── Session-level domain blocking
│
├── preload.js               # Context bridge (13 lines)
│   └── Exposes electronAPI to renderer
│
└── ui/
    ├── index.html           # Main UI shell (200 lines)
    ├── renderer.js          # Frontend logic (303 lines)
    │   ├── Sidebar & tab management
    │   ├── Dynamic WebView creation
    │   ├── Settings modal
    │   └── Service state management
    └── styles.css           # Complete styling (186 lines)
        ├── Dark/light theme variables
        ├── Layout & components
        └── Privacy badge colors
```

### Process Communication

```
┌─────────────────────────────────────────────────┐
│               Main Process (main.js)             │
│   App lifecycle · Config · Remote fetch          │
│   Domain blocking · IPC handlers                 │
└────────────────────┬────────────────────────────┘
                     │ IPC (ipcMain ↔ ipcRenderer)
┌────────────────────┴────────────────────────────┐
│              Preload (preload.js)                 │
│              contextBridge API                    │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────┐
│           Renderer (index.html + renderer.js)     │
│   Sidebar · Tabs · Settings · Service Manager    │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ WebView  │ │ WebView  │ │ WebView  │
   │ ChatGPT  │ │  Claude  │ │  Gemini  │
   │ persist: │ │ persist: │ │ persist: │
   │ chatgpt  │ │  claude  │ │  gemini  │
   └──────────┘ └──────────┘ └──────────┘
   Each sandboxed   Isolated       Domain-
   & partitioned    sessions       filtered
```

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `get-config` | Renderer → Main | Retrieve current application config |
| `save-config` | Renderer → Main | Persist whitelisted config keys |
| `get-services` | Renderer → Main | Fetch AI services catalog |
| `get-rules` | Renderer → Main | Fetch domain filtering rules |
| `update-remote-data` | Renderer → Main | Pull latest remote config updates |
| `toggle-service` | Renderer → Main | Enable or disable an AI service |
| `set-active-service` | Renderer → Main | Switch active tab + configure blocking |
| `clear-service-data` | Renderer → Main | Clear cookies/cache for a service |
| `open-in-browser` | Renderer → Main | Open URL in system browser |

---

## 📥 Installation

### Download Pre-built AppImage

Grab the latest release from the [Releases page](https://github.com/Daskashk/aihub-desktop/releases):

> **Note:** Currently, only **Linux x64** builds are available. No plans for Windows and MacOS support for now.

---

## 🔨 Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) v24 or later (recommended)
- npm (included with Node.js)
- Linux x64 system for AppImage builds

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Daskashk/aihub-desktop.git
cd aihub-desktop

# Install dependencies
npm install

# Run in development mode
npm start
```

### Development Mode

When running with `NODE_ENV=development`, you can press **F12** to toggle DevTools for debugging.

### Building an AppImage

```bash
# Build Linux AppImage
npm run build:linux

# The output will be in the dist/ directory
```

For CI environments where publishing should be skipped:

```bash
npm run build:ci
```

---

## ⚙️ Configuration

### User-Configurable Settings

Settings are accessible through the in-app Settings modal (gear icon in the header):

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Domain Blocking | Enabled | On/Off | Toggle the network-level tracker/ad blocker |
| Max Active Services | 3 | 1–10 | Maximum number of concurrent AI service tabs |
| Dark Mode | Enabled | On/Off | Toggle between dark and light themes |

### Config File Location

Configuration is persisted at:

```
~/.config/ai-hub-desktop/config.json
```

*(Path follows Electron's `app.getPath('userData')` convention on your OS)*

### Default Config

```json
{
  "lastUpdate": null,
  "blockingEnabled": true,
  "maxActiveServices": 3,
  "activeServices": [],
  "remoteUrls": {
    "services": "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/ai_services_list.json",
    "rules": "https://raw.githubusercontent.com/SilentCoderHere/aihub-config-data/main/domain_filtering_rules.json"
  }
}
```

### Remote Data Cache

Fetched service and rule data is cached locally at:

```
~/.config/ai-hub-desktop/data/remote_services.json
~/.config/ai-hub-desktop/data/remote_rules.json
```

Click the **Update Lists** button in the header to fetch the latest AI service catalog and domain rules from the shared config repository.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + =` | Zoom in on active tab |
| `Ctrl + -` | Zoom out on active tab |
| `F12` | Toggle DevTools *(development mode only)* |

---

## 🗺️ Roadmap

AI Hub Desktop is in early beta. Here are some areas where the project could grow:

- [ ] **Custom CSS/JS injection** — Per-service style and script customization (as in the Android version)
- [ ] **Proxy support** — HTTP/SOCKS proxy configuration
- [ ] **Auto-update mechanism** — Check for and apply updates automatically

Have an idea? [Open an issue](https://github.com/Daskashk/aihub-desktop/issues) or submit a PR!

---

## 🤝 Contributing

Contributions are welcome and appreciated! Whether it is a bug fix, a new feature, translations, or documentation improvements — every contribution counts.

### Ways to Contribute

- **Code** — Fix bugs, add features, improve performance
- **Testing** — Report issues, test on different Linux distributions
- **Translations** — Help localize the interface
- **AI Service Data** — Suggest new AI services or update domain rules in the [config-data repository](https://github.com/SilentCoderHere/aihub-config-data)
- **Documentation** — Improve guides, write tutorials, create screenshots

---

## 🙏 Credits & Acknowledgements

### Built Upon

- **[AI Hub for Android](https://github.com/SilentCoderHere/aihub)** — The original Android application by [SilentCoder](https://github.com/SilentCoderHere). AI Hub Desktop is a direct port of this project, sharing the same remote configuration data, privacy philosophy, and community.

### Shared Infrastructure

- **[aihub-config-data](https://github.com/SilentCoderHere/aihub-config-data)** — The remote configuration repository that powers both the Android and Desktop versions. Contains the AI service catalog and domain filtering rules, maintained by the community.

### Inspiration

The original AI Hub Android app was inspired by:

- **[Nora](https://github.com/nonbili/Nora)** — The original concept of a unified AI assistant app
- **[gptAssist](https://github.com/woheller69/gptAssist)** — Pioneered the approach of blocking unnecessary connections in WebView-based AI apps
- **[Assistral](https://github.com/shano/assistral)** — Provided domain allowlists for Mistral
- **[HuggingAssist](https://github.com/woheller69/huggingassist)** — Provided domain allowlists for Hugging Face

### Community

- Join the conversation on Matrix:
  **[#aihub-silentcoder:matrix.org](https://matrix.to/#/#aihub-silentcoder:matrix.org)**
  **[#topic-guild:matrix.org](https://matrix.to/#/#topic-guild:matrix.org)**
- Join my community on Telegram:
  **[@topicguild](https://t.me/topicsguild)
  
---

## 📜 License

This project is licensed under the **GNU General Public License v3.0** — the same license as the original AI Hub Android app.

This means you are free to use, modify, and distribute this software, provided that any derivative works are also open-sourced under the GPL-3.0 license. See the [LICENSE](LICENSE) file for the full text.

---

<div align="center">

**[⬆ Back to Top](#ai-hub-desktop)**

Made with AI assistant· Based on [AI Hub](https://github.com/SilentCoderHere/aihub) by [SilentCoder](https://github.com/SilentCoderHere)

</div>
