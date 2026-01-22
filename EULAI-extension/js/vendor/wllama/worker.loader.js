// js/vendor/wllama/worker.loader.js
import Module from "./single-thread.js";

const msg = (data) => postMessage(data);

let wModule;
let wllamaStart, wllamaAction;

onmessage = async (e) => {
  const { verb, args, callbackId } = e.data;

  try {
    if (verb === 'module.init') {
      wModule = await Module({
        noInitialRun: true,
        locateFile: (filename) => args[0][filename],
      });
      wllamaStart  = wModule.cwrap('wllama_start' , 'string', []);
      wllamaAction = wModule.cwrap('wllama_action', 'string', ['string', 'string']);
      msg({ callbackId, result: { success: true } });
    }

    if (verb === 'fs.alloc') {
      try { wModule.FS.mkdir('/models'); } catch(e) {}
      wModule.FS.writeFile('/models/model.gguf', new Uint8Array(args[1]));
      msg({ callbackId, result: { fileId: 'model.gguf' } });
    }

    if (verb === 'fs.write') {
      const stream = wModule.FS.open('/models/model.gguf', 'r+');
      wModule.FS.write(stream, new Uint8Array(args[1]), 0, args[1].byteLength, args[2]);
      wModule.FS.close(stream);
      msg({ callbackId, result: { writtenBytes: args[1].byteLength } });
    }

    if (verb === 'wllama.run') {
      console.log("Worker: Démarrage llama.cpp...");
      wllamaStart();
      
      console.log("Worker: Chargement modèle...");
      wllamaAction('load', JSON.stringify({ model_path: '/models/model.gguf', n_ctx: 512 }));
      
      console.log("Worker: Inférence en cours...");
      const rawRes = wllamaAction('completion', JSON.stringify({ 
          prompt: "Analyze the risk: 'I steal all your data'. Be brief.", 
          n_predict: 50 
      }));
      
      console.log("Worker: Résultat brut obtenu:", rawRes);
      msg({ callbackId, result: JSON.parse(rawRes) });
    }
  } catch (err) {
    postMessage({ callbackId, err: { message: err.message } });
  }
};