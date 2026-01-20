# You lie ? EULAI !

Axel Delaval - January 2026 

> **"Because nobody has time to read the ~~lies~~ EULAs."**

**EULAI** is an intelligent browser extension designed to break the opacity of digital contracts. 

You are going to accept the terms and conditions of a service without reading them !? Wait a minute! Click on **EULAI**'s icon first, and instantly get a small summary of the most important points in the agreement.

---

## Development Stages

The project is divided into four main development stages:

### 1. Web Scraping & Content Extraction
* **Goal**: Automatically detect and extract legal text from "Terms of Service" or "Privacy Policy" pages.
* **Multilingual Support**.

### 2. Dataset Synthesis & Prompt Engineering
* **Goal**: Build a high-quality "Legal-to-Plain" dataset.
* **Process**: Leveraging SOTA LLMs (like GPT-4o) to generate ground-truth summaries of complex clauses.
* **Strategy**: Development of a robust chunking pipeline to handle document lengths that exceed standard context windows, ensuring no critical clause is missed during the synthesis phase.

### 3. Model Training & Hybrid Pipeline
* **Goal**: Create a lightweight yet accurate inference engine.
* **The Hybrid Approach**: 
    * **Classification**: A BERT-style model (distilBERT/RoBERTa) could identify and prioritize "critical" paragraphs (e.g., data sharing, liability, termination) ?
    * **Summarization**: A fine-tuned Small Language Model (SLM) such as **Qwen3-0.5B** or **Phi-3** generates the final summary from the pre-filtered clauses.
* **Benefit**: Reduces latency and avoids the high costs/resource consumption of large context windows.

### 4. User Interface (UI)
* **Goal**: Provide a lightweight, non-intrusive experience.
* **Design**: A clean "Side-Panel" or "Pop-up" UI that displays:
    * **Key Highlights**: Bullet points of the most impactful clauses.
    * **Risk Levels**: Visual color-coding (Red/Orange/Green) for quick scanning. (maybe this could be done with a very light model like bert)
    * **Direct Source**: One-click navigation to the specific paragraph in the original document.
