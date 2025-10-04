import { detectStructures } from './parser.js';

// Helper to create a clean filename from a string
const sanitizeFilename = (text, maxLength = 50) => {
    if (!text) return 'unnamed';
    const sanitized = text
        .toLowerCase()
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/[^\w.-]/g, '') // Remove non-word characters except dots and hyphens
        .substring(0, maxLength);
    return sanitized || 'unnamed';
};

// Determines the file extension based on detected structures
const getFileExtension = (structures) => {
    if (structures.includes('python_def') || structures.includes('python_class')) return '.py';
    if (structures.includes('javascript_function') || structures.includes('javascript_class')) return '.js';
    if (structures.includes('html_tag')) return '.html';
    if (structures.includes('css_rules')) return '.css';
    if (structures.includes('markdown_table') || structures.includes('markdown_code_block_other')) return '.md';
    if (structures.includes('xml_declaration') || structures.includes('xml_html_block_general')) return '.xml';
    if (structures.includes('latex_documentclass')) return '.tex';
    return '.txt'; // Default extension
};

// Determines the subdirectory based on detected structures
const getDirectory = (structures) => {
    if (structures.includes('python_def') || structures.includes('python_class')) return 'python';
    if (structures.includes('javascript_function') || structures.includes('javascript_class')) return 'javascript';
    if (structures.includes('html_tag') || structures.includes('xml_declaration')) return 'web';
    if (structures.includes('css_rules')) return 'web';
    if (structures.includes('markdown_table') || structures.includes('markdown_code_block_other')) return 'markdown';
    if (structures.includes('latex_documentclass')) return 'latex';
    return 'text'; // Default directory
};

export const organizeContent = (interactions) => {
    const fileList = [];
    let fileCounter = 0;

    interactions.forEach((interaction, interactionIndex) => {
        // Create a base name for the files in this interaction
        const timestamp = interaction.timestamp.replace(/[:\s,]/g, '_');
        const querySanitized = sanitizeFilename(interaction.query);
        const baseFilename = `${timestamp}_${interactionIndex}_${querySanitized}`;

        // 1. Add the prompt as a .txt file
        if (interaction.query) {
            fileList.push({
                path: `prompts/${baseFilename}_prompt.txt`,
                content: interaction.query
            });
        }

        // 2. Process each response part
        interaction.responseParts.forEach((part, partIndex) => {
            // Re-run detection on each part for more specific categorization
            const partStructures = detectStructures('', part.content);
            const directory = getDirectory(partStructures);
            const extension = getFileExtension(partStructures);

            const partFilename = `${baseFilename}_response_${partIndex}${extension}`;

            fileList.push({
                path: `${directory}/${partFilename}`,
                content: part.content
            });
        });
    });

    return fileList;
};