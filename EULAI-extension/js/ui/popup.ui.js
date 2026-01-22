export class PopupUI {
    constructor() {
        this.btn = document.getElementById('btn-analyze');
        this.container = document.getElementById('result-container');
        
        // Zones spécifiques
        this.statusArea = document.getElementById('status-area');
        this.statusText = document.getElementById('status-text');
        this.aiArea = document.getElementById('ai-response-area');
        this.aiContent = document.getElementById('ai-content');
        this.docArea = document.getElementById('raw-document-area');
        this.docContent = document.getElementById('document-preview');
        
        // Buffer pour le markdown streaming
        this.streamBuffer = "";
    }

    // Affiche le conteneur global
    showContainer() {
        this.container.classList.remove('hidden');
    }

    // Affiche le document extrait (Markdown) immédiatement
    renderExtractedMarkdown(markdownText) {
        this.showContainer();
        // On affiche le texte brut ou un preview léger
        this.docContent.innerText = markdownText;
    }

    // Met à jour la barre de statut
    updateStatus(message, isLoading = true) {
        this.statusArea.classList.remove('hidden');
        this.statusText.innerText = message;
        
        const spinner = this.statusArea.querySelector('.spinner-small');
        if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
    }

    // Prépare la zone IA pour le streaming
    startAiStreaming() {
        this.aiArea.classList.remove('hidden');
        this.aiContent.innerHTML = ""; // On vide
        this.streamBuffer = "";
        
        // Config marked
        marked.setOptions({ breaks: true, gfm: true });
    }

    // Ajoute un bout de texte (token) à l'affichage IA
    appendAiToken(tokenText) {
        this.streamBuffer += tokenText;
        // On convertit le buffer complet en HTML à chaque fois 
        // (c'est rapide pour des petits textes, permet d'avoir le gras/listes en temps réel)
        this.aiContent.innerHTML = marked.parse(this.streamBuffer);
        
        // Scroll auto vers le bas
        this.aiContent.scrollTop = this.aiContent.scrollHeight;
    }

    hideStatus() {
        this.statusArea.classList.add('hidden');
    }

    setBtnLoading(isLoading) {
        if (!this.btn) return;
        this.btn.disabled = isLoading;
        this.btn.textContent = isLoading ? "Analyse en cours..." : "Analyser la page";
    }

    renderEmpty() {
        this.showContainer();
        this.docContent.innerHTML = "Aucun texte légal trouvé.";
    }

    showError(msg) {
        this.showContainer();
        this.updateStatus("Erreur : " + msg, false);
        this.statusArea.style.background = "#fee2e2";
        this.statusArea.style.color = "#dc2626";
    }
}