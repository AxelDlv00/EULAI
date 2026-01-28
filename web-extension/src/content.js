const getPageMarkdown = () => {
    const selectorsToExclude = [
        'script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header', 
        'svg', 'aside', 'form', 'button', '.cookie-banner', '#chat', '.chat-window'
    ];

    const nodeToMarkdown = (node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.closest(selectorsToExclude.join(',')) || window.getComputedStyle(node).display === 'none') {
                return "";
            }
        }

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, ' ');
            return text.length > 1 ? text : "";
        }

        let content = "";
        node.childNodes.forEach(child => content += nodeToMarkdown(child));

        const tag = node.tagName ? node.tagName.toLowerCase() : "";
        const trimmed = content.trim();
        if (!trimmed && tag !== 'br') return "";

        switch (tag) {
            case 'h1': return `\n# ${trimmed}\n\n`;
            case 'h2': return `\n## ${trimmed}\n\n`;
            case 'h3': return `\n### ${trimmed}\n\n`;
            case 'p':  return `\n${trimmed}\n\n`;
            case 'li': return `\n  * ${trimmed}`;
            case 'strong':
            case 'b':  return ` **${trimmed}** `;
            default:   return content;
        }
    };

    return { 
        isValid: true, 
        text: nodeToMarkdown(document.body).replace(/\n{3,}/g, '\n\n').trim() 
    };
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "READ_PAGE") {
        try {
            sendResponse(getPageMarkdown());
        } catch (error) {
            sendResponse({ isValid: false, text: "", error: error.message });
        }
    }
    return true; 
});