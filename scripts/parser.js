// This file contains the logic for parsing the Gemini activity HTML file.

export const SHORT_PROMPT_THRESHOLD = 20;

export const STRUCTURE_VOCABULARY = [
    'latex_documentclass', 'latex_document_env', 'latex_usepackage',
    'xml_declaration', 'doctype_declaration', 'html_tag', 'html_body_tag', 'svg_tag', 'xml_html_block_general',
    'python_def', 'python_class', 'python_import',
    'javascript_function', 'javascript_class', 'javascript_variable_declaration', 'javascript_console_log',
    'lisp_keyword_form',
    'markdown_code_block_other', 'markdown_table',
    'css_rules'
];

export const estimateTokens = (text) => {
    if (!text || typeof text !== 'string') return 0;
    return Math.ceil(text.length / 4);
};

export const removeVowels = (text) => {
    if (!text || typeof text !== 'string') return "";
    return text.replace(/[aeiouAEIOU]/g, '');
};

export const detectStructures = (prompt, response) => {
    const structures = new Set();
    const combinedText = `${prompt}\n${response}`;

    if (/\\documentclass\[?[^\]]*\]?\{[^}]*\}/.test(combinedText)) structures.add('latex_documentclass');
    if (/\\begin\{document\}/.test(combinedText)) structures.add('latex_document_env');
    if (/\\usepackage\{[^}]*\}/.test(combinedText)) structures.add('latex_usepackage');
    if (/<\?xml[^>]*\?>/.test(combinedText)) structures.add('xml_declaration');
    if (/<!DOCTYPE[^>]*>/i.test(combinedText)) structures.add('doctype_declaration');
    if (/<html[^>]*>/i.test(combinedText)) structures.add('html_tag');
    if (/<body[^>]*>/i.test(combinedText)) structures.add('html_body_tag');
    if (/<svg[^>]*>/i.test(combinedText)) structures.add('svg_tag');
    if (/<([a-zA-Z][\w:-]*)(?:\s+[a-zA-Z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^>\s]+))*\s*\/?>[\s\S]*?<\/\1\s*>/m.test(combinedText)) {
        structures.add('xml_html_block_general');
    }
    if (/\bdef\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/.test(combinedText)) structures.add('python_def');
    if (/\bclass\s+[A-Z_][a-zA-Z0-9_]*\s*[:\(]/.test(combinedText)) structures.add('python_class');
    if (/^\s*(?:from\s+[\w.]+\s+)?import\s+(?:[\w.*]+(?:,\s*[\w.*]+)*)/m.test(combinedText)) structures.add('python_import');
    if (/\bfunction(?:\s+[\w$]*)?\s*\(/.test(combinedText)) structures.add('javascript_function');
    if (/\bclass\s+[A-Z_$][\w$]*(\s+extends\s+[A-Z_$][\w$]*)?\s*\{/.test(combinedText)) structures.add('javascript_class');
    if (/\b(const|let|var)\s+[\w$]+\s*=?/.test(combinedText)) structures.add('javascript_variable_declaration');
    if (/\bconsole\.log\s*\(/.test(combinedText)) structures.add('javascript_console_log');
    if (/\((?:defun|define|lambda|let\*?|if|cond|setq)\s+[^)]*\)/i.test(combinedText)) structures.add('lisp_keyword_form');
    if (/```(?:[a-zA-Z0-9\-_]+)?\n[\s\S]*?\n```/g.test(combinedText)) {
        structures.add('markdown_code_block_other');
    }
    if (/^\s*\|.*?\n^\s*\|\s*---+\s*\|/m.test(combinedText)) structures.add('markdown_table');
    if (/(?:[.#]?[a-zA-Z][\w-]*|@md[^\{]+)\s*\{[\s\S]*?\}/.test(combinedText)) structures.add('css_rules');

    return Array.from(structures);
};

export const parseGeminiActivityHTML = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const interactions = [];
    const interactionElements = doc.querySelectorAll('div.outer-cell.mdl-cell.mdl-cell--12-col.mdl-shadow--2dp');

    if (!interactionElements || interactionElements.length === 0) {
        console.error("Could not find interaction elements. Please inspect your HTML structure.");
        return [];
    }

    interactionElements.forEach((elementContainer, i) => {
        let queryOriginal = "";
        let timestampStr = "";

        const mainContentCell = elementContainer.querySelector('div.content-cell.mdl-cell.mdl-cell--6-col.mdl-typography--body-1');

        if (mainContentCell) {
            const currentPromptParts = [];
            let responseStartNode = null;
            for (let nodeIdx = 0; nodeIdx < mainContentCell.childNodes.length; nodeIdx++) {
                const currentNode = mainContentCell.childNodes[nodeIdx];
                if (currentNode.nodeName.toLowerCase() === 'br') {
                    const nextSibling = currentNode.nextSibling;
                    if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
                        const potentialTimestamp = nextSibling.textContent.trim();
                        if (potentialTimestamp.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)(?:\s+[A-Z]{3})?/)) {
                            timestampStr = potentialTimestamp;
                            responseStartNode = nextSibling.nextSibling;
                            break;
                        }
                    }
                    currentPromptParts.push("\n");
                } else if (currentNode.nodeType === Node.TEXT_NODE) {
                    currentPromptParts.push(currentNode.textContent);
                } else if (currentNode.nodeType === Node.ELEMENT_NODE && !['script', 'style'].includes(currentNode.nodeName.toLowerCase())) {
                    currentPromptParts.push(currentNode.textContent || "");
                }
            }

            let tempPromptText = currentPromptParts.join("").trim();

            if (tempPromptText.startsWith("Prompted ")) {
                queryOriginal = tempPromptText.substring("Prompted ".length).trim();
            } else {
                queryOriginal = tempPromptText;
            }

            // --- NEW: Process response into structured parts ---
            const responseParts = [];
            if (responseStartNode) {
                let currentResponseSibling = responseStartNode;
                while (currentResponseSibling) {
                    if (currentResponseSibling.nodeType === Node.ELEMENT_NODE) {
                        const nodeNameLower = currentResponseSibling.nodeName.toLowerCase();
                        const nodeText = currentResponseSibling.textContent || "";

                        // Skip "Explore related topics" buttons etc.
                        if (nodeText.toLowerCase().includes("explore related topics") || currentResponseSibling.querySelector('button')) {
                            currentResponseSibling = currentResponseSibling.nextSibling;
                            continue;
                        }

                        if (nodeNameLower === 'pre') {
                            responseParts.push({
                                type: 'code_block',
                                content: nodeText.trim()
                            });
                        } else if (['p', 'div', 'ul', 'ol', 'table'].includes(nodeNameLower)) {
                             if(nodeText.trim()){
                                responseParts.push({
                                    type: 'prose',
                                    content: nodeText.trim()
                                });
                             }
                        }
                    } else if (currentResponseSibling.nodeType === Node.TEXT_NODE && currentResponseSibling.textContent.trim()) {
                         responseParts.push({
                            type: 'prose',
                            content: currentResponseSibling.textContent.trim()
                        });
                    }
                    currentResponseSibling = currentResponseSibling.nextSibling;
                }
            }

            if (!timestampStr) {
                 const captionCell = elementContainer.querySelector('div.content-cell.mdl-cell.mdl-cell--12-col.mdl-typography--caption');
                 if (captionCell) {
                    const captionTextNodes = Array.from(captionCell.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                    for (const textNode of captionTextNodes) {
                        const potentialTs = textNode.textContent.trim();
                        if (potentialTs.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)(?:\s+[A-Z]{3})?/)) {
                            timestampStr = potentialTs;
                            break;
                        }
                    }
                }
            }
        }

        // Combine response parts for token estimation and structure detection
        const combinedResponseText = responseParts.map(p => p.content).join('\n\n');
        const promptTokens = estimateTokens(queryOriginal);
        const responseTokens = estimateTokens(combinedResponseText);
        const detectedStructures = detectStructures(queryOriginal, combinedResponseText);

        if (queryOriginal || responseParts.length > 0 || (timestampStr && !queryOriginal && responseParts.length === 0)) {
            interactions.push({
                id: `interaction-${i}`,
                query: queryOriginal,
                responseParts: responseParts, // Use the new structured array
                detectedStructures: detectedStructures,
                timestamp: timestampStr || "Unknown Time",
                originalIndex: i,
                estimatedTokens: {
                    prompt: promptTokens,
                    response: responseTokens,
                    total: promptTokens + responseTokens
                },
            });
        }
    });
    return interactions;
};