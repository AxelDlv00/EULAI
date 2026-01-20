class AnalysisService {
    async fetchSummary(rawText) {
        const words = rawText.split(/\s+/).length;
        return {
            metadata: { 
                wordCount: words, 
                date: new Date().toLocaleDateString() 
            },
            riskScore: "Debug", 
            points: [
                "Nombre de mots : " + words,
                "Contenu extrait : " // On s'en sert de label
            ],
            rawContent: rawText // On ajoute le texte brut ici
        };
    }
}