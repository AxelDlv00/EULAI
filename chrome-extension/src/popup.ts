"use strict";

import "./popup.css";
import {
  MLCEngineInterface,
  InitProgressReport,
  CreateMLCEngine,
  ChatCompletionMessageParam,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";
import { ProgressBar, Line } from "progressbar.js";

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================

// Custom EULAI model configuration hosted on Hugging Face
const MY_EULAI_MODEL = {
  model: "https://huggingface.co/AxelDlv00/EULAI-q4f16_1-MLC",
  model_id: "EULAI-q4f16_1-MLC",
  model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Modified setLabel to not throw error if element doesn't exist
function setLabel(id: string, text: string) {
  const label = document.getElementById(id);
  if (label != null) {
    label.innerText = text;
  }
}

function getElementAndCheck(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element == null) {
    throw Error("Cannot find element " + id);
  }
  return element;
}

// Sleep helper function for async delays
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// DOM ELEMENTS & GLOBAL VARIABLES
// ============================================================================

const queryInput = getElementAndCheck("query-input")!;
const submitButton = getElementAndCheck("submit-button")!;
const modelName = getElementAndCheck("model-name");

// Stores the current page content for analysis
let context = "";
// Display name of the currently loaded model
let modelDisplayName = "";

// Fetch page contents on load (throws runtime.lastError if extension is refreshed with page already open)
fetchPageContents();

// Disable submit button initially until model loads
(<HTMLButtonElement>submitButton).disabled = true;

let progressBar: ProgressBar = new Line("#loadingContainer", {
  strokeWidth: 4,
  easing: "easeInOut",
  duration: 1400,
  color: "#ffd166",
  trailColor: "#eee",
  trailWidth: 1,
  svgStyle: { width: "100%", height: "100%" },
});

// Track whether model parameters are currently loading
let isLoadingParams = true;

// ============================================================================
// MODEL INITIALIZATION & PROGRESS TRACKING
// ============================================================================

// Callback to update progress bar during model initialization
let initProgressCallback = (report: InitProgressReport) => {
  setLabel("init-label", report.text);
  progressBar.animate(report.progress, {
    duration: 50,
  });
  if (report.progress == 1.0) {
    enableInputs();
  }
};

// Set EULAI as the default selected model
let selectedModel = MY_EULAI_MODEL.model_id;

// ============================================================================
// MODEL SELECTOR SETUP
// ============================================================================

// Populate the model selection dropdown
const modelSelector = getElementAndCheck(
  "model-selection",
) as HTMLSelectElement;

// Add all prebuilt models to the dropdown
for (let i = 0; i < prebuiltAppConfig.model_list.length; ++i) {
  const model = prebuiltAppConfig.model_list[i];
  const opt = document.createElement("option");
  opt.value = model.model_id;
  opt.innerHTML = model.model_id;
  opt.selected = (model.model_id == selectedModel);
  modelSelector.appendChild(opt);
}

// Manually add the custom EULAI model to the dropdown
const optEulai = document.createElement("option");
optEulai.value = MY_EULAI_MODEL.model_id;
optEulai.innerHTML = MY_EULAI_MODEL.model_id;
optEulai.selected = true;
modelSelector.appendChild(optEulai);

modelName.innerText = "Loading initial model...";

// ============================================================================
// ENGINE INITIALIZATION
// ============================================================================

// Initialize the MLC engine with custom EULAI model configuration
const engine: MLCEngineInterface = await CreateMLCEngine(selectedModel, {
  initProgressCallback: initProgressCallback,
  appConfig: {
    model_list: [
      ...prebuiltAppConfig.model_list,
      MY_EULAI_MODEL
    ]
  }
});
modelName.innerText = "Now chatting with " + modelDisplayName;

// Store the conversation history for context
let chatHistory: ChatCompletionMessageParam[] = [];

// ============================================================================
// UI STATE MANAGEMENT
// ============================================================================

// Enable user inputs after model has finished loading
function enableInputs() {
  if (isLoadingParams) {
    sleep(500);
    isLoadingParams = false;
  }

  const initLabel = document.getElementById("init-label");
  initLabel?.remove();
  const loadingBarContainer = document.getElementById("loadingContainer")!;
  loadingBarContainer?.remove();
  queryInput.focus();

  // Extract and format the model display name
  const modelNameArray = selectedModel.split("-");
  modelDisplayName = modelNameArray[0];
  let j = 1;
  while (j < modelNameArray.length && modelNameArray[j][0] != "q") {
    modelDisplayName = modelDisplayName + "-" + modelNameArray[j];
    j++;
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Track whether a request is currently being processed
let requestInProgress = false;

// Enable/disable submit button based on input state
queryInput.addEventListener("keyup", () => {
  if (
    (<HTMLInputElement>queryInput).value === "" ||
    requestInProgress ||
    isLoadingParams
  ) {
    (<HTMLButtonElement>submitButton).disabled = true;
  } else {
    (<HTMLButtonElement>submitButton).disabled = false;
  }
});

// Allow Enter key to submit the query
queryInput.addEventListener("keyup", (event) => {
  if (event.code === "Enter") {
    event.preventDefault();
    submitButton.click();
  }
});

// ============================================================================
// CHAT SUBMISSION HANDLER
// ============================================================================

// Handle user query submission
async function handleClick() {
  requestInProgress = true;
  (<HTMLButtonElement>submitButton).disabled = true;

  const message = (<HTMLInputElement>queryInput).value;
  document.getElementById("answer")!.innerHTML = "";
  document.getElementById("answerWrapper")!.style.display = "none";
  document.getElementById("loading-indicator")!.style.display = "block";

  // Format the input to match Qwen3's SFT training format
  let inp = message;
  if (context.length > 0) {
    inp = `Policy text to analyze:\n${context}\n\nUser request: ${message}`;
  }
  
  // Add user message to chat history
  chatHistory.push({ role: "user", content: inp });

  // Stream the model's response
  let curMessage = "";
  const completion = await engine.chat.completions.create({
    stream: true,
    messages: chatHistory,
  });
  for await (const chunk of completion) {
    const curDelta = chunk.choices[0].delta.content;
    if (curDelta) {
      curMessage += curDelta;
    }
    updateAnswer(curMessage);
  }
  
  // Get the complete response and add to chat history
  const response = await engine.getMessage();
  chatHistory.push({ role: "assistant", content: response });

  requestInProgress = false;
  (<HTMLButtonElement>submitButton).disabled = false;
}
submitButton.addEventListener("click", handleClick);

// ============================================================================
// MODEL SWITCHING
// ============================================================================

// Handle model selection changes
async function handleSelectChange() {
  // Don't allow switching while a model is loading
  if (isLoadingParams) {
    return;
  }

  // Reset UI for model reload
  modelName.innerText = "";
  const initLabel = document.createElement("p");
  initLabel.id = "init-label";
  initLabel.innerText = "Initializing model...";
  const loadingContainer = document.createElement("div");
  loadingContainer.id = "loadingContainer";

  const loadingBox = getElementAndCheck("loadingBox");
  loadingBox.appendChild(initLabel);
  loadingBox.appendChild(loadingContainer);

  isLoadingParams = true;
  (<HTMLButtonElement>submitButton).disabled = true;

  // Stop any ongoing generation and reset state
  if (requestInProgress) {
    engine.interruptGenerate();
  }
  engine.resetChat();
  chatHistory = [];
  await engine.unload();

  // Update selected model
  selectedModel = modelSelector.value;

  // Recreate progress bar for new model load
  progressBar = new Line("#loadingContainer", {
    strokeWidth: 4, easing: "easeInOut", duration: 1400, color: "#ffd166", trailColor: "#eee", trailWidth: 1,
    svgStyle: { width: "100%", height: "100%" },
  });

  initProgressCallback = (report: InitProgressReport) => {
    setLabel("init-label", report.text);
    progressBar.animate(report.progress, { duration: 50 });
    if (report.progress == 1.0) { enableInputs(); }
  };

  engine.setInitProgressCallback(initProgressCallback);

  requestInProgress = true;
  modelName.innerText = "Reloading with new model...";
  
  // Reload engine with custom configuration
  await engine.reload(selectedModel, {
    model_list: [
      ...prebuiltAppConfig.model_list,
      MY_EULAI_MODEL
    ]
  });
  
  requestInProgress = false;
  modelName.innerText = "Now chatting with " + modelDisplayName;
}
modelSelector.addEventListener("change", handleSelectChange);

// ============================================================================
// CHROME EXTENSION MESSAGE HANDLING
// ============================================================================

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener(({ answer, error }) => {
  if (answer) { updateAnswer(answer); }
});

// ============================================================================
// ANSWER DISPLAY & FORMATTING
// ============================================================================

// Update the UI with the model's response
function updateAnswer(answer: string) {
  // Remove <think> tags generated by Qwen3 for cleaner display
  const cleanAnswer = answer.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  document.getElementById("answerWrapper")!.style.display = "block";
  // Convert newlines to HTML line breaks
  const answerWithBreaks = cleanAnswer.replace(/\n/g, "<br>");
  document.getElementById("answer")!.innerHTML = answerWithBreaks;

  // Set up copy to clipboard functionality
  document.getElementById("copyAnswer")!.onclick = () => {
    navigator.clipboard.writeText(cleanAnswer)
      .then(() => console.log("Copied"))
      .catch((err) => console.error(err));
  };

  // Format and display timestamp
  const options: Intl.DateTimeFormatOptions = {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  };
  const time = new Date().toLocaleString("en-US", options);
  document.getElementById("timestamp")!.innerText = time;
  document.getElementById("loading-indicator")!.style.display = "none";
}

// ============================================================================
// PAGE CONTENT EXTRACTION
// ============================================================================

// Fetch the current page's content for policy analysis
function fetchPageContents() {
  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    if (tabs[0]?.id) {
      const port = chrome.tabs.connect(tabs[0].id, { name: "channelName" });
      port.postMessage({});
      port.onMessage.addListener(function (msg) {
        context = msg.contents;
      });
    }
  });
}