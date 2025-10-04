import { parseGeminiActivityHTML } from './parser.js';
import { organizeContent } from './organizer.js';
import { createZip } from './zipper.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Application script loaded.");

    // --- THEME ---
    let currentTheme = localStorage.getItem('theme') || 'dark';
    const themeToggleButton = document.getElementById('theme-toggle');
    const applyTheme = (theme) => {
        document.body.className = theme;
    };
    themeToggleButton.addEventListener('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    });
    applyTheme(currentTheme); // Apply theme on initial load

    // --- ELEMENT REFERENCES ---
    const fileUpload = document.getElementById('file-upload');
    const processButton = document.getElementById('process-button');
    const statusMessage = document.getElementById('status-message');

    // --- HELPER to trigger download ---
    const triggerDownload = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- CORE PROCESSING LOGIC ---
    processButton.addEventListener('click', async () => {
        const file = fileUpload.files[0];
        if (!file) {
            statusMessage.textContent = 'Please select a file first.';
            return;
        }
        if (file.type !== 'text/html') {
            statusMessage.textContent = 'Error: Please upload a valid .html file.';
            return;
        }

        statusMessage.textContent = 'Processing... This may take a moment.';
        processButton.disabled = true;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                // 1. Parse
                statusMessage.textContent = 'Step 1 of 3: Parsing HTML...';
                const fileContent = event.target.result;
                const interactions = parseGeminiActivityHTML(fileContent);
                if (interactions.length === 0) {
                    statusMessage.textContent = 'No interactions found in the file.';
                    processButton.disabled = false;
                    return;
                }

                // 2. Organize
                statusMessage.textContent = 'Step 2 of 3: Organizing content...';
                const organizedFiles = organizeContent(interactions);

                // 3. Zip
                statusMessage.textContent = 'Step 3 of 3: Creating .zip file...';
                const zipBlob = await createZip(organizedFiles);

                // 4. Download
                triggerDownload(zipBlob, 'gemini_activity_export.zip');
                statusMessage.textContent = `Successfully generated and downloaded ${organizedFiles.length} files.`;

            } catch (error) {
                console.error("An error occurred during processing:", error);
                statusMessage.textContent = `Error: ${error.message}`;
            } finally {
                processButton.disabled = false;
            }
        };
        reader.onerror = () => {
            statusMessage.textContent = 'Error reading the file.';
            processButton.disabled = false;
        };

        reader.readAsText(file);
    });
});