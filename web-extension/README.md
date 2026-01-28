<div align="center">
  <img src="src/icons/icon-base.png" alt="EULAI Logo" width="120">

  # You lie? EULAI!
  **Local AI Browser Assistant for Legal Document Analysis**
  
  *[Axel Delaval](https://axeldlv00.github.io/axel-delaval-personal-page/) • 28 January 2026*
  <br />

  [![GitHub](https://img.shields.io/badge/Source_Code-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/AxelDlv00/EULAI)
[![License](https://img.shields.io/badge/LICENSE-MIT-yellow?style=for-the-badge)](../LICENSE) [![HF Model](https://img.shields.io/badge/%F0%9F%A4%97%20Model-EULAI--Base-green?style=for-the-badge)](https://huggingface.co/AxelDlv00/EULAI)[![HF MLC Model](https://img.shields.io/badge/%F0%9F%A4%97%20MLC_Weights-EULAI--q4f16-blue?style=for-the-badge)](https://huggingface.co/AxelDlv00/EULAI-q4f16_1-MLC) [![HF Dataset](https://img.shields.io/badge/%F0%9F%A4%97%20Dataset-EULAI-8A2BE2?style=for-the-badge)](https://huggingface.co/datasets/AxelDlv00/EULAI)

</div>

**EULAI** is a privacy-centric Chrome extension designed to summarize and analyze complex legal documents (Terms of Service, Privacy Policies) directly in your browser.

**EULAI** is one of the first Web extensions to leverage **100% local inference**. 

---

## ⚠️ Disclaimer

EULAI uses an experimental local model. While highly capable for a 0.6B parameter model, it may occasionally **hallucinate** or misinterpret complex legal jargon. **Always verify critical clauses** using the provided source links.

---

## Key Features

* **Local WebGPU Inference**: High-performance AI chat powered by [MLC Web-LLM](https://webllm.mlc.ai/). No API keys or servers required.
* **Intelligent Extraction**: Converts any webpage into clean, structured Markdown while filtering out UI noise (ads, navbars, footers).
* **Hierarchical Segmentation**: Processes massive documents by automatically splitting them into optimized chunks (~2000 chars) to prevent context overflow.
* **Source Transparency**: "View Source" feature allows you to see the exact Markdown segment the AI used for each part of its analysis.
* **Modern UI**: A clean, responsive interface featuring real-time analysis progress bars and a beautiful Glassmorphism design.
* **TOS;DR outputs**: Our extension provides [TOS;DR](https://tosdr.org/)-style summaries, highlighting key points in legal documents for quick understanding.

---

## Project Structure

```text
├── src/                  
│   ├── icons/            
│   ├── content.js        
│   ├── manifest.json     
│   ├── popup.html        
│   ├── popup.css        
│   └── popup.ts          
├── dist/                 
├── package.json          
└── README.md             
```

---

## Build & Installation Instructions

### Prerequisites

Clone the repository and install dependencies:

```bash
# Install dependencies
npm install

# Build the project (Bundles TS, CSS, and Assets via Parcel)
npm run build
```

### Load into Chrome

1. Open **Chrome** and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `dist/` folder in the project directory.

### Load into Firefox

1. Open **Firefox** and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select the `dist/manifest.json` file in the project directory.