// This file contains the logic for creating a .zip file
// in the browser using the global JSZip library.

export const createZip = async (fileList) => {
    // JSZip is expected to be available globally from the CDN script in index.html
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is not loaded. Please check the script tag in index.html.');
    }

    const zip = new JSZip();

    // Add each file to the zip archive
    fileList.forEach(file => {
        zip.file(file.path, file.content);
    });

    // Generate the zip file as a blob
    const blob = await zip.generateAsync({ type: "blob" });
    return blob;
};