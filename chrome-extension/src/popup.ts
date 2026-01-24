"use strict";

import "./popup.css";
import { marked } from "marked"; 
import {
  MLCEngineInterface,
  InitProgressReport,
  CreateMLCEngine,
  ChatCompletionMessageParam,
} from "@mlc-ai/web-llm";
import { Line } from "progressbar.js";

// ============================================================================
// AI MODEL CONFIGURATION
// ============================================================================
const MY_EULAI_MODEL = {
  model: "https://huggingface.co/AxelDlv00/EULAI-q4f16_1-MLC",
  model_id: "EULAI-q4f16_1-MLC",
  model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
};

// ============================================================================
// UI ELEMENT SELECTORS
// ============================================================================
const getEl = (id: string) => document.getElementById(id)!;

const queryInput = getEl("query-input") as HTMLInputElement;
const submitButton = getEl("submit-button") as HTMLButtonElement;
const btnRead = getEl("btn-read") as HTMLButtonElement;
const btnCopyMd = getEl("copy-markdown") as HTMLButtonElement;
const modelNameLabel = getEl("model-name");
const docArea = getEl("raw-document-area");
const docPreview = getEl("document-preview");
const loader = getEl("loading-indicator");
const answerWrapper = getEl("answerWrapper");
const answerDiv = getEl("answer");

let chatHistory: ChatCompletionMessageParam[] = [];
let requestInProgress = false;
let isLoadingParams = true;

// ============================================================================
// ENGINE INITIALIZATION & LOADING BAR
// ============================================================================
let progressBar = new Line("#loadingContainer", {
  strokeWidth: 100, // Full height fill
  easing: "easeInOut",
  duration: 800,
  color: "#4361ee",
  trailColor: "transparent",
  trailWidth: 0,
  svgStyle: { width: "100%", height: "100%", borderRadius: "10px", display: "block" },
});

const initProgressCallback = (report: InitProgressReport) => {
  const label = getEl("init-label");
  if (label) label.innerText = report.text.replace(/\[.*\]/, "").trim();
  
  progressBar.animate(report.progress);
  
  if (report.progress === 1.0) {
    setTimeout(() => {
      const box = getEl("loadingBox");
      if (box) {
        box.style.opacity = "0";
        box.style.transition = "opacity 0.5s ease";
        setTimeout(() => box.remove(), 500);
      }
      isLoadingParams = false;
      queryInput.focus();
      modelNameLabel.innerText = "Ready to chat.";
    }, 1000);
  }
};

const engine: MLCEngineInterface = await CreateMLCEngine(MY_EULAI_MODEL.model_id, {
  initProgressCallback,
  appConfig: { model_list: [MY_EULAI_MODEL] }
});

// ============================================================================
// FEATURE: PAGE TO MARKDOWN EXTRACTION
// ============================================================================
async function handleReadPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    btnRead.disabled = true;
    btnRead.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Extracting...';
    
    const response = await chrome.tabs.sendMessage(tab.id, { action: "READ_PAGE" });

    if (response?.isValid) {
      docArea.classList.remove("hidden");
      docPreview.innerHTML = await marked.parse(response.text); 
      
      btnCopyMd.onclick = () => {
        navigator.clipboard.writeText(response.text);
        const icon = btnCopyMd.querySelector("i")!;
        icon.className = "fa fa-check";
        setTimeout(() => icon.className = "fa fa-copy", 2000);
      };
    } else {
      throw new Error("Extraction failed");
    }
  } catch (err) {
    console.error(err);
    docArea.classList.remove("hidden");
    docPreview.innerHTML = `<p style="color:red">Error: Could not read page. Please refresh the tab.</p>`;
  } finally {
    btnRead.disabled = false;
    btnRead.innerHTML = '<i class="fa fa-file-code"></i> Extract Page to Markdown';
  }
}

// ============================================================================
// FEATURE: LOCAL AI CHAT
// ============================================================================
async function handleChatSubmission() {
  if (!queryInput.value || requestInProgress || isLoadingParams) return;

  const userMsg = queryInput.value;
  queryInput.value = "";
  requestInProgress = true;
  submitButton.disabled = true;

  answerDiv.innerHTML = "";
  answerWrapper.classList.add("hidden");
  loader.style.display = "block";

  chatHistory.push({ role: "user", content: userMsg });

  let streamingText = "";
  try {
    const completion = await engine.chat.completions.create({ stream: true, messages: chatHistory });

    for await (const chunk of completion) {
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        streamingText += delta;
        renderResponse(streamingText);
      }
    }
    chatHistory.push({ role: "assistant", content: streamingText });
  } catch (e) {
    console.error("Inference error:", e);
    answerDiv.innerText = "Error during generation.";
    answerWrapper.classList.remove("hidden");
  } finally {
    requestInProgress = false;
    submitButton.disabled = false;
    loader.style.display = "none";
  }
}

async function renderResponse(text: string) {
  const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  loader.style.display = "none";
  answerWrapper.classList.remove("hidden");
  answerDiv.innerHTML = await marked.parse(cleanText);
  
  getEl("timestamp").innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  getEl("copyAnswer").onclick = () => navigator.clipboard.writeText(cleanText);
}

// BIND EVENTS
btnRead.addEventListener("click", handleReadPage);
submitButton.addEventListener("click", handleChatSubmission);
queryInput.addEventListener("keypress", (e) => { if (e.key === "Enter") handleChatSubmission(); });