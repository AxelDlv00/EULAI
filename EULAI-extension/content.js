(() => {
    const selectorsToExclude = [
        'script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'header', 
        'svg', 'aside', 'form', 'button', '.cookie-banner', '#chat', '.chat-window',
        '[role="banner"]', '[role="navigation"]', '#footer', '.footer'
    ];

    const getMarkdown = () => {
        const body = document.body;
        
        // Fonction récursive avec gestion de la profondeur (depth)
        const nodeToMarkdown = (node, depth = 0) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Exclusion du bruit et des éléments masqués
                if (node.closest(selectorsToExclude.join(',')) || 
                    window.getComputedStyle(node).display === 'none' ||
                    window.getComputedStyle(node).visibility === 'hidden') {
                    return "";
                }
                
                // Ignorer les éléments purement interactifs (inputs, checkboxes)
                if (node.tagName === 'INPUT' || node.tagName === 'LABEL' && node.querySelector('input')) {
                    return "";
                }
            }

            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.replace(/\s+/g, ' ');
                // On évite les petits fragments de texte isolés (bruit de mise en page)
                return text.length > 1 ? text : "";
            }

            let content = "";
            node.childNodes.forEach(child => {
                content += nodeToMarkdown(child, depth + (node.tagName === 'LI' ? 1 : 0));
            });

            const tag = node.tagName ? node.tagName.toLowerCase() : "";
            const trimmed = content.trim();
            if (!trimmed && tag !== 'br') return "";

            const indent = "  ".repeat(depth);

            switch (tag) {
                case 'h1': return `\n# ${trimmed}\n\n`;
                case 'h2': return `\n## ${trimmed}\n\n`;
                case 'h3': return `\n### ${trimmed}\n\n`;
                case 'p':  return `\n${trimmed}\n\n`;
                case 'li': return `\n${indent}* ${trimmed}`;
                case 'ul':
                case 'ol': return `\n${content}\n`;
                case 'strong':
                case 'b':  return ` **${trimmed}** `;
                case 'em':
                case 'i':  return ` *${trimmed}* `;
                case 'a':  return ` [${trimmed}](${node.href}) `;
                case 'table': return `\n\n${processTable(node)}\n\n`;
                case 'br': return `\n`;
                default: 
                    // Si c'est un élément de type block, on assure un espacement
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const display = window.getComputedStyle(node).display;
                        if (display.includes('block') || display.includes('flex')) {
                            return `\n${trimmed}\n`;
                        }
                    }
                    return content;
            }
        };

        return nodeToMarkdown(body).replace(/\n{3,}/g, '\n\n').trim();
    };

    const processTable = (table) => {
        const rows = Array.from(table.querySelectorAll('tr'));
        let tableMd = "";
        rows.forEach((row, i) => {
            const cells = Array.from(row.querySelectorAll('td, th')).map(c => {
                // On nettoie les éventuels boutons/inputs dans les cellules
                const cleanCell = c.innerText.trim().replace(/\n/g, " ");
                return cleanCell;
            });
            if (cells.length > 0) {
                tableMd += `| ${cells.join(' | ')} |\n`;
                if (i === 0) tableMd += `| ${cells.map(() => '---').join(' | ')} |\n`;
            }
        });
        return tableMd;
    };

    return { isValid: true, text: getMarkdown() };
})();