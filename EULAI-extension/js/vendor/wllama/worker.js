// js/vendor/wllama/worker.js
export class ProxyToWorker {
    constructor(pathConfig) {
        this.pathConfig = pathConfig;
        this.worker = null;
        this.resolver = null;
    }

    async init(ggufBlob) {
        const url = chrome.runtime.getURL("js/vendor/wllama/worker.loader.js");
        this.worker = new Worker(url, { type: 'module' });
        
        this.worker.onmessage = (e) => {
            if (this.resolver) {
                if (e.data.err) this.resolver.reject(new Error(e.data.err.message));
                else this.resolver.resolve(e.data.result);
            }
        };

        // Enchaînement séquentiel strict
        await this.request('module.init', [this.pathConfig]);
        await this.request('fs.alloc', ['model.gguf', ggufBlob.size]);
        
        const reader = ggufBlob.stream().getReader();
        let offset = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await this.request('fs.write', ['model.gguf', value.buffer, offset], [value.buffer]);
            offset += value.byteLength;
        }
    }

    async runInference() {
        return this.request('wllama.run', []);
    }

    request(verb, args, transfer = []) {
        return new Promise((resolve, reject) => {
            this.resolver = { resolve, reject };
            this.worker.postMessage({ verb, args, callbackId: 1 }, { transfer });
        });
    }
}