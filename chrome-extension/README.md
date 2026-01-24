# EULAI - Local AI Browser Assistant

Using [MLC Web-LLM](https://github.com/mlc-ai/web-llm/tree/main/examples/chrome-extension) as a technical reference.

EULAI is a Chrome extension that allows you to interact with a Large Language Model (LLM) directly in your browser. Unlike traditional AI extensions, inference is performed **100% locally** on your machine using **WebGPU**. This ensures total privacy, no data leaves your device, and there is no dependency on third-party servers.

## Project Structure

To maintain and compile the project, the following structure is used:

```text
eulai-extension/
├── package.json          # Dependencies (WebLLM, Parcel, TypeScript, Marked)
├── package-lock.json     # Dependency lock file
├── src/                  # Original source code
│   ├── icons/            # Extension icons (including github.svg and icon-base.png)
│   ├── content.js        # Script injected into tabs to extract page text
│   ├── manifest.json     # Manifest V3 configuration and CSP rules
│   ├── popup.css         # Modern UI styles
│   ├── popup.html        # Extension window structure
│   └── popup.ts          # TypeScript logic (WebLLM engine and UI management)
└── dist/                 # Generated folder after build (to be loaded into Chrome)

```

## Key Features

* **Local Inference**: Powered by WebGPU for fast, private, and offline-capable AI chat.
* **Markdown Extraction**: Convert any webpage (TOS, Privacy Policies, articles) into clean Markdown.
* **Privacy First**: No telemetry, no API keys, and no server-side processing.
* **Modern UI**: Glassmorphism design with a real-time progress bar for model initialization.

## Installation & Development

### 1. Prerequisites

* **Node.js** (LTS version recommended) installed on your machine.
* A **Chromium-based browser** (Chrome, Brave, Edge) with WebGPU support enabled.

### 2. Initialization

Navigate to the project root directory and install the necessary modules:

```bash
npm install
```

*Note: This installs `@mlc-ai/web-llm` for the engine and `@mlc-ai/web-runtime` for GPU communication.*

### 3. Compilation

To generate optimized files in the `/dist` folder, run the build script:

```bash
npm run build
```

*Note: Parcel will bundle the TypeScript and CSS into browser-ready files.*

### 4. Load into Chrome

1. Open `chrome://extensions/` in your browser.
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked**.
4. Select the **`/dist`** folder from the project root.

## Disclaimer

EULAI uses a lightweight local model. While optimized for browser performance, it may occasionally provide inaccurate information. Always verify critical details from the original document.
