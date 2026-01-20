document.addEventListener('DOMContentLoaded', () => {
    const ui = new PopupUI();
    const service = new AnalysisService();

    // 1. GESTION DES LIENS (À mettre ici, au chargement de la popup)
    // Permet d'ouvrir les liens dans un nouvel onglet car les popups bloquent les liens par défaut
    document.addEventListener('click', (e) => {
        // On cherche si la cible ou l'un de ses parents est un lien (A)
        const link = e.target.closest('a');
        if (link && link.href && link.href.startsWith('http')) {
            chrome.tabs.create({ url: link.href });
            e.preventDefault();
        }
    });

    if (!ui.btn) return;

    // 2. GESTION DU BOUTON ANALYSER
    ui.btn.addEventListener('click', async () => {
        ui.setLoading(true);
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Sécurité pages système
            if (tab.url.startsWith("chrome://") || 
                tab.url.startsWith("https://chrome.google.com") || 
                tab.url.startsWith("about:")) {
                throw new Error("L'extension ne peut pas scanner cette page.");
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            if (results && results[0]?.result) {
                const { isValid, text } = results[0].result;
                
                if (!isValid) {
                    ui.renderEmpty();
                } else {
                    const analysis = await service.fetchSummary(text);
                    ui.render(analysis);
                }
            }
        } catch (err) {
            ui.showError(err.message);
        } finally {
            ui.setLoading(false);
        }
    });
});