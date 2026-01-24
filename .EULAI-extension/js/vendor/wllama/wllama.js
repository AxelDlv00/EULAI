// js/vendor/wllama/wllama.js

import { ProxyToWorker } from './worker.js';
import { absoluteUrl } from './utils.js';

export class Wllama {
    proxy = null;
    pathConfig;

    constructor(pathConfig, config = {}) {
        this.pathConfig = pathConfig;
        this.config = config;
    }

    async loadModel(ggufBlobs, config = {}) {
        if (this.proxy) return;
        const mPathConfig = {
            'wllama.js': absoluteUrl(this.pathConfig['single-thread/wllama.js']),
            'wllama.wasm': absoluteUrl(this.pathConfig['single-thread/wllama.wasm']),
        };
        this.proxy = new ProxyToWorker(mPathConfig, 1, false, console);
        await this.proxy.moduleInit(ggufBlobs.map(blob => ({ name: 'model.gguf', blob })));
        await this.proxy.wllamaStart();
        await this.proxy.wllamaAction('load', {
            ...config,
            n_ctx: 2048,
            model_path: '/models/model.gguf',
        });
    }

    async createCompletion(prompt, options) {
        await this.proxy.wllamaAction('sampling_init', options.sampling || { temp: 0.2 });
        
        const res = await this.proxy.wllamaAction('completion', {
            prompt,
            n_predict: options.nPredict || 512
        }, options.onNewToken);

        // SÉCURITÉ: Vérifier si res est null
        if (!res) {
            console.error("Wllama: La génération a échoué (réponse nulle du Worker)");
            return { text: "Erreur interne de génération." };
        }

        return res;
    }
}