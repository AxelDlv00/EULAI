import { Wllama } from '../vendor/wllama/index.js';

export class AnalysisService {
    constructor() {
        this.wllama = null;
    }

    async initWllama(onProgress) {
        if (this.wllama) return;

        // Configuration des chemins vers les assets de la bibliothèque
        const config = {
            "wllama.js": chrome.runtime.getURL("js/vendor/wllama/index.js"),
            "wllama.wasm": chrome.runtime.getURL("js/vendor/wllama/wllama.wasm"),
            "wllama-mt.wasm": chrome.runtime.getURL("js/vendor/wllama/wllama-mt.wasm"),
        };

        this.wllama = new Wllama(config);
        
        onProgress("Chargement du modèle local...");
        const modelUrl = chrome.runtime.getURL("models/EULAI-Q4_K_M.gguf");
        
        await this.wllama.loadModelFromUrl(modelUrl, {
            progressCallback: ({ loaded, total }) => {
                const pct = Math.round((loaded / total) * 100);
                onProgress(`Chargement : ${pct}%`);
            }
        });
    }

    async fetchSummaryStream(text, onProgress, onToken) {
        try {
            await this.initWllama(onProgress);

            onProgress("Analyse juridique en cours...");

            const prompt = `[INST] Tu es un expert juridique. Analyse ce texte et liste les clauses risquées ou abusives de manière concise :
            
            TEXTE : ${text} [/INST]`;

            const output = await this.wllama.createCompletion(prompt, {
                nPredict: 512,
                sampling: { temp: 0.3, top_k: 40, top_p: 0.9 },
                onNewToken: (token) => onToken(token)
            });

            return output;
        } catch (e) {
            console.error("Erreur Inférence:", e);
            throw new Error("L'IA n'a pas pu répondre : " + e.message);
        }
    }
}