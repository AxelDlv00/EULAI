import { PopupUI } from './ui/popup.ui.js';
import { AnalysisService } from './services/analysis.service.js';

// --- SYSTEME DE LOGGING AMÉLIORÉ ---
function formatLogArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    
    // Gestion des erreurs natives avec Stack Trace
    if (arg instanceof Error) {
        return `🔴 ${arg.name}: ${arg.message}\n${arg.stack || ''}`;
    }
    
    // Gestion des événements d'erreur DOM (le fameux {"isTrusted":true})
    // Cela arrive souvent avec les Workers
    if (arg instanceof Event || (arg.type && arg.target)) {
        if (arg.type === 'error') {
            // Essayer de récupérer les détails de l'erreur du worker
            const msg = arg.message || "Erreur inconnue";
            const file = arg.filename || "Fichier inconnu";
            const line = arg.lineno || "?";
            return `💥 DOM Error Event: ${msg} (${file}:${line})`;
        }
        return `Event: ${arg.type}`;
    }

    if (typeof arg === 'object') {
        try {
            return JSON.stringify(arg, null, 2);
        } catch (e) {
            return String(arg);
        }
    }
    return String(arg);
}

function logToUI(args, type = 'info') {
    const debugConsole = document.getElementById('debug-console');
    if (!debugConsole) return;

    const span = document.createElement('div');
    span.className = type === 'error' ? 'log-error' : 'log-info';
    
    // Traitement de tous les arguments
    const textContent = Array.isArray(args) 
        ? args.map(formatLogArg).join(' ') 
        : formatLogArg(args);

    const time = new Date().toLocaleTimeString();
    span.innerText = `[${time}] ${textContent}`;
    
    debugConsole.appendChild(span);
    debugConsole.scrollTop = debugConsole.scrollHeight;
}

// 1. Intercepter console.error
const originalConsoleError = console.error;
console.error = function(...args) {
    originalConsoleError.apply(console, args);
    logToUI(args, 'error');
    
    const details = document.getElementById('debug-area');
    if(details) details.open = true;
};

// 2. Intercepter console.log
const originalConsoleLog = console.log;
console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    logToUI(args, 'info');
};

// 3. Intercepter les erreurs globales
window.addEventListener('error', (event) => {
    logToUI([event], 'error'); // On passe l'event brut pour que formatLogArg le traite
});

// 4. Intercepter les promesses rejetées
window.addEventListener('unhandledrejection', (event) => {
    logToUI(`Unhandled Rejection: ${event.reason}`, 'error');
});
// --- FIN SYSTEME LOGGING ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Popup chargée. Initialisation...");
    
    const ui = new PopupUI();
    const service = new AnalysisService();

    // Debug rapide : vérifier si le fichier modèle est accessible
    const modelUrl = chrome.runtime.getURL("models/EULAI-Q4_K_M.gguf");
    console.log(`Vérification chemin modèle: ${modelUrl}`);

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href && link.href.startsWith('http')) {
            chrome.tabs.create({ url: link.href });
            e.preventDefault();
        }
    });

    if (!ui.btn) {
        console.error("Bouton d'analyse introuvable");
        return;
    }

    ui.btn.addEventListener('click', async () => {
        console.log("▶️ Clic sur Analyser");
        ui.setBtnLoading(true);
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("about:")) {
                throw new Error("Impossible d'analyser cette page système.");
            }

            ui.updateStatus("Lecture de la page...", true);
            
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            if (results && results[0]?.result) {
                const { isValid, text } = results[0].result;
                
                if (!isValid || !text) {
                    ui.renderEmpty();
                    ui.setBtnLoading(false);
                    return;
                }

                ui.renderExtractedMarkdown(text);
                ui.startAiStreaming();

                const onProgress = (msg) => ui.updateStatus(msg, true);
                const onToken = (token) => ui.appendAiToken(token);

                console.log(`Texte extrait (${text.length} chars). Lancement IA...`);
                await service.fetchSummaryStream(text, onProgress, onToken);

                ui.updateStatus("Analyse terminée", false);
                ui.hideStatus();
            }
        } catch (err) {
            console.error(err);
            ui.showError(err.message || "Une erreur est survenue");
        } finally {
            ui.setBtnLoading(false);
        }
    });
});