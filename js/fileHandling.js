import { buildCountyStateMap } from './state.js';
import { displayGeoJSON } from './map.js';

// Read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// Handle file upload
async function handleFileUpload() {
    const files = Array.from(document.getElementById('shapefile-upload').files);
    if (files.length === 0) {
        showMessage('Please select shapefile files first.', 'error');
        return;
    }
    await processShapefile(files);
}

// Handle dropped files
async function handleDroppedFiles(items) {
    const files = [];
    
    // Handle directory drop
    if (items[0]?.webkitGetAsEntry) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if (item) await traverseFileTree(item, files);
        }
    } 
    // Handle direct file drop
    else {
        for (let i = 0; i < items.length; i++) {
            files.push(items[i]);
        }
    }
    
    await processShapefile(files);
}

// Traverse directory structure
async function traverseFileTree(item, files, path = '') {
    return new Promise((resolve) => {
        if (item.isFile) {
            item.file((file) => {
                file.filepath = path + file.name;
                files.push(file);
                resolve();
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            dirReader.readEntries(async (entries) => {
                for (let i = 0; i < entries.length; i++) {
                    await traverseFileTree(entries[i], files, path + item.name + '/');
                }
                resolve();
            });
        }
    });
}

// Process shapefile
async function processShapefile(files) {
    try {
        showLoading('Processing shapefile...');
        
        // Filter to shapefile components
        const shapefileFiles = files.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return ['shp', 'shx', 'dbf', 'prj', 'cpg', 'xml'].includes(ext);
        });
        
        if (shapefileFiles.length === 0) {
            throw new Error('No valid shapefile components found');
        }
        
        // Find required files
        const shpFile = shapefileFiles.find(f => f.name.toLowerCase().endsWith('.shp'));
        const shxFile = shapefileFiles.find(f => f.name.toLowerCase().endsWith('.shx'));
        const dbfFile = shapefileFiles.find(f => f.name.toLowerCase().endsWith('.dbf'));
        
        if (!shpFile || !shxFile || !dbfFile) {
            throw new Error('Missing required .shp, .shx, or .dbf files');
        }
        
        // Read files
        const [shpBuffer, dbfBuffer] = await Promise.all([
            readFileAsArrayBuffer(shpFile),
            readFileAsArrayBuffer(dbfFile)
        ]);
        
        // Process with shapefile.js
        const geojson = shp.combine([
            shp.parseShp(shpBuffer),
            shp.parseDbf(dbfBuffer)
        ]);
        
        // Extract state information from properties
        buildCountyStateMap(geojson);
        
        // Display on map
        displayGeoJSON(geojson);
        showMessage('Shapefile loaded successfully with state data', 'success');
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error');
        console.error(error);
    } finally {
        hideLoading();
    }
}

// UI helper functions
function showLoading(message) {
    document.getElementById('loading-text').textContent = message;
    document.getElementById('loading').style.display = 'block';
    document.getElementById('progress').style.width = '0%';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showMessage(text, type, element = document.getElementById('message')) {
    element.textContent = text;
    element.className = type;
    if (type === 'error') console.error(text);
}

// Setup event listeners for file handling
function setupFileHandling() {
    // File upload
    document.getElementById('upload-btn').addEventListener('click', handleFileUpload);
    
    // Drag and drop
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('active');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        handleDroppedFiles(e.dataTransfer.items || e.dataTransfer.files);
    });
}

export { setupFileHandling };
