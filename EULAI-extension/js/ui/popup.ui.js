class PopupUI {
    constructor() {
        this.btn = document.getElementById('btn-analyze');
        this.container = document.getElementById('result-container');
        this.content = document.getElementById('result-content');
    }

    setLoading(isLoading) {
        if (!this.btn) return;
        this.btn.disabled = isLoading;
        this.btn.textContent = isLoading ? "Analyse..." : "Analyser la page";
        
        if (isLoading) {
            this.container.classList.remove('hidden');
            this.content.innerHTML = `
                <div style="text-align:center;padding:10px;">
                    <div class="spinner"></div>
                    <p style="font-size:12px;color:gray;">Lecture des clauses...</p>
                </div>`;
        }
    }

    renderEmpty() {
        this.container.classList.remove('hidden');
        this.content.innerHTML = `
            <div style="text-align:center;padding:15px;color:#64748b;">
                <p style="font-size:20px;margin:0;">🔍</p>
                <p><strong>Aucun document détecté.</strong></p>
                <p style="font-size:11px;">Cette page ne semble pas contenir de conditions juridiques.</p>
            </div>`;
    }

    render(data) {
        this.container.classList.remove('hidden');
        
        // Configuration de Marked
        marked.setOptions({ breaks: true, gfm: true });

        // Nettoyage des triples sauts de ligne en doubles pour éviter les gros trous
        const cleanMarkdown = data.rawContent.replace(/\n{3,}/g, '\n\n');
        const compiledHTML = marked.parse(cleanMarkdown);

        this.content.innerHTML = `
            <div class="analysis-meta">Document détecté</div>
            <div class="rendered-markdown">${compiledHTML}</div>
        `;
    }
    // Sécurité pour éviter que le Markdown ne soit interprété comme du HTML
    escapeHTML(str) {
        return str.replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[m]);
    }

    showError(msg) {
        this.container.classList.remove('hidden');
        this.content.innerHTML = `<div style="color:red;padding:10px;font-size:12px;">${msg}</div>`;
    }
}