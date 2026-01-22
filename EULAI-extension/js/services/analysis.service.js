// js/services/analysis.service.js
import { ProxyToWorker } from '../vendor/wllama/worker.js';

export class AnalysisService {
    constructor() {
        this.proxy = null;
    }

    async fetchSummaryStream(ignoredText, onProgress, onToken) {
        try {
            if (!this.proxy) {
                onProgress("Chargement du cerveau IA (378MB)...");
                const url = chrome.runtime.getURL("models/EULAI-Q4_K_M.gguf");
                const resp = await fetch(url);
                const blob = await resp.blob();

                const paths = {
                    'wllama.js': chrome.runtime.getURL("js/vendor/wllama/single-thread.js"),
                    'wllama.wasm': chrome.runtime.getURL("js/vendor/wllama/wllama.wasm"),
                };

                this.proxy = new ProxyToWorker(paths);
                await this.proxy.init(blob);
            }

            onProgress("L'IA réfléchit...");
            const result = await this.proxy.runInference();
            
            if (result && result.text) {
                onToken(result.text);
            } else {
                throw new Error("Réponse vide de l'IA");
            }
            return result;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }
}