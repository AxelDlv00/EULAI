<div align="center">
  <img src="web-extension/src/icons/icon-base.png" alt="EULAI Logo" width="120">

  # You lie? EULAI!
  **Local AI Browser Assistant for Legal Document Analysis**
  
  *[Axel Delaval](https://axeldlv00.github.io/axel-delaval-personal-page/) • 28 January 2026*
  <br />

  [![GitHub](https://img.shields.io/badge/Source_Code-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/AxelDlv00/EULAI)
[![License](https://img.shields.io/badge/LICENSE-MIT-yellow?style=for-the-badge)](./LICENSE) [![HF Model](https://img.shields.io/badge/%F0%9F%A4%97%20Model-EULAI--Base-green?style=for-the-badge)](https://huggingface.co/AxelDlv00/EULAI)[![HF MLC Model](https://img.shields.io/badge/%F0%9F%A4%97%20MLC_Weights-EULAI--q4f16-blue?style=for-the-badge)](https://huggingface.co/AxelDlv00/EULAI-q4f16_1-MLC) [![HF Dataset](https://img.shields.io/badge/%F0%9F%A4%97%20Dataset-EULAI-8A2BE2?style=for-the-badge)](https://huggingface.co/datasets/AxelDlv00/EULAI)

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
├── data-generated
├── data-preparation
├── output.txt
├── README.md
├── training
└── web-extension     
```

--- 

## Dataset 

The EULAI dataset is available on [Hugging Face](https://huggingface.co/datasets/AxelDlv00/EULAI). 

The pipeline for dataset generation involves:
* **Segmentation**: Legal documents are hierarchically segmented into blocks of ~4500 characters using Markdown headers ($H1 \to H2 \to H3$) and paragraph breaks to maintain context integrity.
* **Expert Labeling**: Each block is processed with a specific system prompt instructing the AI to act as a **ToS;DR legal auditor**.
* **Classification**: Clauses are extracted and classified into four categories:
    * `[GOOD]`: Positive for user rights (e.g., encryption, clear notification).
    * `[NEUTRAL]`: Important facts for transparency (e.g., jurisdiction).
    * `[BAD]`: Risks or negative practices (e.g., tracking).
    * `[BLOCKER]`: Critical dangers (e.g., data selling).

## Training

The model is a fine-tuned version of **Qwen-0.6B**, optimized for legal document summarization and classification. 

The training process follows these steps:
1. **Data Collection**: Extraction of privacy policies and terms of service into Markdown.
2. **Synthetic Data Generation**: Using Gemini AI to generate structured highlights from raw legal text.
3. **Quantization**: The final weights are quantized using 4-bit quantization (`q4f16_1`) via the **MLC-LLM** framework to enable efficient execution on consumer-grade GPUs directly in the browser.

## Web-Extension

The Chrome extension is built using standard web technologies (HTML, CSS, JavaScript) and leverages the **MLC Web-LLM** library for local model inference. More details can be found in the [`web-extension`](web-extension/README.md) folder.