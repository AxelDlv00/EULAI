"use strict";

/*
 ╔════════════════════════════════════════════════════════╗
 ║                     EULAI Logic                        ║
 ╚════════════════════════════════════════════════════════╝
*/

/* // +--------------------------------------------------------+
// | This script manages the AI engine initialization,      |
// | text segmentation, page extraction, and the real-time  |
// | rendering of analysis results for the EULAI extension. |
// +--------------------------------------------------------+
*/

import "./popup.css";
import { marked } from "marked"; 
import {
  MLCEngineInterface,
  InitProgressReport,
  CreateMLCEngine,
  ChatCompletionMessageParam,
} from "@mlc-ai/web-llm";
import { Line } from "progressbar.js";

/*
// ╭────────────────────────────────────────────────────────╮
// │                 Global Configuration                   │
// ╰────────────────────────────────────────────────────────╯
*/

const MY_EULAI_MODEL = {
  model: "https://huggingface.co/AxelDlv00/EULAI-q4f16_1-MLC",
  model_id: "EULAI-q4f16_1-MLC",
  model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
};

const MAX_CHARS_PER_BLOCK = 2000;

/*
// ╭────────────────────────────────────────────────────────╮
// │                  UI Element Selectors                  │
// ╰────────────────────────────────────────────────────────╯
*/

const getEl = (id: string) => document.getElementById(id)!;

// Interactive Elements
const queryInput = getEl("query-input") as HTMLInputElement;
const submitButton = getEl("submit-button") as HTMLButtonElement;
const btnRead = getEl("btn-read") as HTMLButtonElement;
const btnAnalyzePage = getEl("btn-analyze-page") as HTMLButtonElement;
const btnCopyMd = getEl("copy-markdown") as HTMLButtonElement;

// Display & Feedback Elements
const modelNameLabel = getEl("model-name");
const docArea = getEl("raw-document-area");
const docPreview = getEl("document-preview");
const loader = getEl("loading-indicator");
const answerWrapper = getEl("answerWrapper");
const answerDiv = getEl("answer");

// Progress Tracking Elements
const progressContainer = getEl("analysis-progress-container");
const progressFill = getEl("analysis-progress-fill");
const progressText = getEl("progress-text");
const progressPercent = getEl("progress-percent");

// State Variables
let requestInProgress = false;
let isLoadingParams = true;

/*
// ╭────────────────────────────────────────────────────────╮
// │               AI Engine Initialization                 │
// ╰────────────────────────────────────────────────────────╯
*/

let loadingBar = new Line("#loadingContainer", {
  strokeWidth: 4,
  easing: "easeInOut",
  duration: 800,
  color: "#4361ee",
  trailColor: "#f0f0f0",
  svgStyle: { width: "100%", height: "100%", borderRadius: "10px" },
});

/**
 * Updates UI based on model loading progress
 */
const initProgressCallback = (report: InitProgressReport) => {
  const label = getEl("init-label");
  if (label) label.innerText = report.text.replace(/\[.*\]/, "").trim();
  loadingBar.animate(report.progress);
  
  if (report.progress === 1.0) {
    setTimeout(() => {
      const box = getEl("loadingBox");
      if (box) {
        box.style.opacity = "0";
        setTimeout(() => box.remove(), 500);
      }
      isLoadingParams = false;
      submitButton.disabled = false;
      btnAnalyzePage.disabled = false;
      queryInput.focus();
      modelNameLabel.innerText = "Ready to assist.";
    }, 800);
  }
};

const engine: MLCEngineInterface = await CreateMLCEngine(MY_EULAI_MODEL.model_id, {
  initProgressCallback,
  appConfig: { model_list: [MY_EULAI_MODEL] }
});

/*
// ╭────────────────────────────────────────────────────────╮
// │                 Text Segmentation Logic                │
// ╰────────────────────────────────────────────────────────╯
*/

/**
 * Splits large text into smaller chunks for optimal AI processing
 */
function segmentText(text: string): string[] {
    if (!text || text.trim().length === 0) return [];
    if (text.length <= MAX_CHARS_PER_BLOCK) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= MAX_CHARS_PER_BLOCK) {
            chunks.push(remaining.trim());
            break;
        }

        let slice = remaining.slice(0, MAX_CHARS_PER_BLOCK);
        let cutIndex = -1;
        const separators = [
            { regex: /\n(?=#\s)/g, priority: 4 }, // Markdown Headers
            { regex: /\n\n/g, priority: 3 },      // Paragraphs
            { regex: /[.!?]\s/g, priority: 2 },   // Sentences
            { regex: /\s/g, priority: 1 }         // Spaces
        ];

        for (const sep of separators) {
            sep.regex.lastIndex = 0;
            let match;
            let lastMatchIndex = -1;
            while ((match = sep.regex.exec(slice)) !== null) {
                lastMatchIndex = match.index;
            }
            if (lastMatchIndex > 100) {
                cutIndex = lastMatchIndex;
                break;
            }
        }

        if (cutIndex === -1) cutIndex = MAX_CHARS_PER_BLOCK;

        const chunk = remaining.slice(0, cutIndex + 1).trim();
        if (chunk) chunks.push(chunk);
        remaining = remaining.slice(cutIndex + 1);
    }
    return chunks;
}

/*
// ╭────────────────────────────────────────────────────────╮
// │                Page Extraction Helpers                 │
// ╰────────────────────────────────────────────────────────╯
*/

/**
 * Communicates with content script to retrieve page text
 */
async function extractPageContent(): Promise<string | null> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) return null;
        const response = await chrome.tabs.sendMessage(tab.id, { action: "READ_PAGE" });
        return response && response.isValid ? response.text : null;
    } catch (e) {
        return null;
    }
}

/*
// ╭────────────────────────────────────────────────────────╮
// │                   UI Action Handlers                   │
// ╰────────────────────────────────────────────────────────╯
*/

/**
 * Handles "Extract MD" button - shows raw markdown preview
 */
async function handleExtractOnly() {
    btnRead.disabled = true;
    btnRead.innerHTML = '<i class="fa fa-spinner fa-spin"></i> ...';
    const text = await extractPageContent();
    if (text) {
        docArea.classList.remove("hidden");
        docPreview.innerHTML = await marked.parse(text);
        btnCopyMd.onclick = () => {
            navigator.clipboard.writeText(text);
            const i = btnCopyMd.querySelector("i")!;
            i.className = "fa fa-check";
            setTimeout(() => i.className = "fa fa-copy", 1000);
        };
    }
    btnRead.disabled = false;
    btnRead.innerHTML = '<i class="fa fa-file-code"></i> Extract MD';
}

/**
 * Handles "Analyze Page" button - triggers automated workflow
 */
async function handleAnalyzePage() {
    if (requestInProgress) return;
    btnAnalyzePage.disabled = true;
    btnAnalyzePage.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Reading...';
    
    const text = await extractPageContent();
    
    btnAnalyzePage.innerHTML = '<i class="fa fa-bolt"></i> Analyze Page';
    btnAnalyzePage.disabled = false;

    if (text) runAnalysisLoop(text);
    else alert("Could not read page content.");
}

/**
 * Handles manual text submission from chat input
 */
async function handleChatSubmission() {
    if (!queryInput.value || requestInProgress || isLoadingParams) return;
    const text = queryInput.value;
    queryInput.value = "";
    runAnalysisLoop(text);
}

/*
// ╭────────────────────────────────────────────────────────╮
// │                  Main Analysis Loop                    │
// ╰────────────────────────────────────────────────────────╯
*/

/**
 * Orchestrates the chunk-by-chunk analysis and UI updates
 */
async function runAnalysisLoop(rawText: string) {
    if (requestInProgress) return;
    requestInProgress = true;
    submitButton.disabled = true;
    btnAnalyzePage.disabled = true;

    // Reset UI for new analysis
    answerDiv.innerHTML = "";
    answerWrapper.classList.add("hidden");
    docArea.classList.add("hidden");
    loader.style.display = "block";
    progressContainer.classList.remove("hidden");

    const chunks = segmentText(rawText);
    progressFill.style.width = "1%";
    progressText.innerText = `Preparing ${chunks.length} blocks...`;

    try {
        await engine.resetChat();

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // Update Progress Bar
            const percent = Math.round(((i) / chunks.length) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.innerText = `Analyzing Block ${i + 1}/${chunks.length}`;
            progressPercent.innerText = `${percent}%`;

            // Setup Result Block UI
            const blockId = `block-res-${i}`;
            const blockDiv = document.createElement("div");
            blockDiv.className = "block-result-container";
            blockDiv.innerHTML = `
                <div class="block-header">
                    <span class="block-label">Block ${i + 1}</span>
                    <button class="btn-show-source" id="btn-src-${i}">
                        <i class="fa fa-eye"></i> View Source
                    </button>
                </div>
                <div class="source-popup markdown-body" id="popup-src-${i}"></div>
                <div id="${blockId}" class="markdown-body"></div>
            `;
            
            answerDiv.appendChild(blockDiv);
            answerWrapper.classList.remove("hidden");

            // Source View Logic
            const btn = document.getElementById(`btn-src-${i}`);
            const pop = document.getElementById(`popup-src-${i}`);
            if (btn && pop) {
                const compiledSource = await marked.parse(chunk);
                pop.innerHTML = compiledSource; 
                btn.onclick = () => pop.classList.toggle("active");
            }

            // AI Inference Request
            const messages: ChatCompletionMessageParam[] = [
                { role: "user", content: `STRICTLY ANALYZE THIS TEXT ONLY:\n\n${chunk}` }
            ];

            const completion = await engine.chat.completions.create({ 
                stream: true, messages: messages, temperature: 0.0 
            });

            let buffer = "";
            const outputArea = document.getElementById(blockId)!;

            for await (const chunkResp of completion) {
                const delta = chunkResp.choices[0].delta.content;
                if (delta) {
                    buffer += delta;
                    const clean = buffer.replace(/NO_CLAUSES_FOUND/g, "").trim();
                    if (clean) outputArea.innerHTML = await renderBlockContent(clean);
                }
            }
            
            if (!buffer.replace(/NO_CLAUSES_FOUND|\s/g, "")) {
                outputArea.innerHTML = "<p style='color:#999;font-size:12px;font-style:italic'>No significant clauses found.</p>";
            }

            // Clear context between blocks to save memory
            await engine.resetChat();
        }

        progressFill.style.width = "100%";
        progressText.innerText = "Analysis Complete";
        progressPercent.innerText = "100%";

    } catch (e) {
        console.error(e);
        answerDiv.innerHTML += `<div style="color:red">Error during analysis.</div>`;
    } finally {
        requestInProgress = false;
        submitButton.disabled = false;
        btnAnalyzePage.disabled = false;
        loader.style.display = "none";
        setTimeout(() => progressContainer.classList.add("hidden"), 3000);
    }
}

/*
// ╭────────────────────────────────────────────────────────╮
// │                 Result Rendering Helpers               │
// ╰────────────────────────────────────────────────────────╯
*/

/**
 * Transforms AI output into structured HTML components with safety fallbacks
 */
async function renderBlockContent(text: string): Promise<string> {
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    
    // Pattern for classification tags [BLOCKER, BAD, GOOD, NEUTRAL]
    const statusRegex = /^[-]?\s?\[(BLOCKER|BAD|GOOD|NEUTRAL)\](?:\s*:\s*(\*\*|)([^:\n]*?)(\*\*|))?(?:\s*:\s*(.*))?$/gm;
    
    const iconMap: Record<string, string> = {
        BLOCKER: "fa-solid fa-ban", 
        BAD: "fa-solid fa-circle-exclamation",
        GOOD: "fa-solid fa-check-circle", 
        NEUTRAL: "fa-solid fa-circle-info"
    };

    // Format fallback check
    const hasValidTags = /\[(BLOCKER|BAD|GOOD|NEUTRAL)\]/.test(cleanText);
    let htmlOutput = "";

    if (!hasValidTags && cleanText.length > 0) {
        htmlOutput += `
            <div class="format-warning">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>Non-standard format detected - Free interpretation</span>
            </div>
        `;
    }

    let lastIndex = 0;
    let match;

    while ((match = statusRegex.exec(cleanText)) !== null) {
        const beforeText = cleanText.substring(lastIndex, match.index);
        if (beforeText.trim()) htmlOutput += await marked.parse(beforeText);

        const type = match[1];
        const title = match[3] ? match[3].trim() : "";
        const explanation = match[5] ? match[5].trim() : "";
        const displayTitle = title || "Analysis in progress...";

        htmlOutput += `
          <div class="status-box ${type}">
            <div class="status-icon-wrapper"><i class="${iconMap[type]} status-fa-icon"></i></div>
            <div class="status-content">
              <span class="status-title">${displayTitle}</span>
              ${explanation ? `<p class="status-explanation">${explanation}</p>` : ""}
            </div>
          </div>
        `;
        lastIndex = statusRegex.lastIndex;
    }

    const remaining = cleanText.substring(lastIndex);
    if (remaining.trim()) {
        htmlOutput += await marked.parse(remaining);
    }
    
    return htmlOutput;
}

/*
// ╭────────────────────────────────────────────────────────╮
// │                    Event Bindings                      │
// ╰────────────────────────────────────────────────────────╯
*/

btnRead.addEventListener("click", handleExtractOnly);
btnAnalyzePage.addEventListener("click", handleAnalyzePage);
submitButton.addEventListener("click", handleChatSubmission);

queryInput.addEventListener("keypress", (e) => { 
    if (e.key === "Enter") handleChatSubmission(); 
});