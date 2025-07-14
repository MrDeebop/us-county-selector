// Initialize map
const map = L.map('map').setView([39.8283, -98.5795], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Color definitions for groups
const GROUP_COLORS = [
    'group-color-1', // Red
    'group-color-2', // Green
    'group-color-3', // Blue
    'group-color-4', // Yellow
    'group-color-5', // Purple
    'group-color-6', // Orange
    'group-color-7', // Teal
    'group-color-8'  // Pink
];

// State management
const state = {
    selectedCounties: [],
    groups: {},
    countyStateMap: {},
    countyGroupMap: {},
    // ADD THESE NEW PROPERTIES:
    isDragging: false,
    dragStarted: false,
    dragSelectedCounties: new Set(),
    ctrlPressed: false
};

// DOM elements
const elements = {
    map,
    fileInput: document.getElementById('shapefile-upload'),
    uploadBtn: document.getElementById('upload-btn'),
    messageDiv: document.getElementById('message'),
    loadingDiv: document.getElementById('loading'),
    loadingText: document.getElementById('loading-text'),
    progressBar: document.getElementById('progress'),
    dropZone: document.getElementById('drop-zone'),
    groupNameInput: document.getElementById('group-name'),
    createGroupBtn: document.getElementById('create-group'),
    groupsContainer: document.getElementById('groups'),
    selectedCountiesContainer: document.getElementById('selected-counties'),
    clearSelectionBtn: document.getElementById('clear-selection'),
    exportExcelBtn: document.getElementById('export-excel'),
    exportMessage: document.getElementById('export-message'),
    excelMessage: document.getElementById('excel-message')
};

let geoJsonLayer = null;

// Initialize the application
function init() {
    setupEventListeners();
    updateSelectedCountiesDisplay();
}

// Set up event listeners
function setupEventListeners() {
    // File upload
    elements.uploadBtn.addEventListener('click', handleFileUpload);
    
    // Drag and drop
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('active');
    });
    
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('active');
    });
    
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('active');
        handleDroppedFiles(e.dataTransfer.items || e.dataTransfer.files);
    });
    
    // Group management
    elements.createGroupBtn.addEventListener('click', createGroup);
    elements.clearSelectionBtn.addEventListener('click', clearSelection);
    elements.exportExcelBtn.addEventListener('click', exportToExcel);

    // Excel upload
    document.getElementById('excel-upload-btn').addEventListener('click', handleExcelUpload);
    document.getElementById('excel-drop-zone').addEventListener('dragover', (e) => {
        e.preventDefault();
        document.getElementById('excel-drop-zone').classList.add('active');
    });
    document.getElementById('excel-drop-zone').addEventListener('dragleave', () => {
        document.getElementById('excel-drop-zone').classList.remove('active');
    });
    document.getElementById('excel-drop-zone').addEventListener('drop', (e) => {
        e.preventDefault();
        document.getElementById('excel-drop-zone').classList.remove('active');
        handleDroppedExcelFile(e.dataTransfer.files);
    });
    
    // Keyboard event listeners for Ctrl key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Control' || e.ctrlKey) {
            if (!state.ctrlPressed) {
                state.ctrlPressed = true;
                // Disable map dragging
                map.dragging.disable();
                // Change cursor to indicate drag selection mode
                elements.map.getContainer().style.cursor = 'crosshair';
                document.body.classList.add('drag-selection-mode');
            }
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || !e.ctrlKey) {
            state.ctrlPressed = false;
            // Re-enable map dragging
            map.dragging.enable();
            // Reset cursor
            elements.map.getContainer().style.cursor = '';
            document.body.classList.remove('drag-selection-mode');
            // End any active drag selection
            if (state.isDragging) {
                endDragSelection();
            }
        }
    });
    
    // Handle window blur to reset Ctrl state
    window.addEventListener('blur', () => {
        state.ctrlPressed = false;
        map.dragging.enable();
        elements.map.getContainer().style.cursor = '';
        document.body.classList.remove('drag-selection-mode');
        if (state.isDragging) {
            endDragSelection();
        }
    });
    
    // Handle window focus to check ctrl state
    window.addEventListener('focus', () => {
        // Reset ctrl state when window regains focus
        state.ctrlPressed = false;
        map.dragging.enable();
        elements.map.getContainer().style.cursor = '';
        document.body.classList.remove('drag-selection-mode');
    });
}

// File handling functions
async function handleExcelUpload() {
    const fileInput = document.getElementById('excel-upload');
    if (fileInput.files.length === 0) {
        showMessage('Please select an Excel file first.', 'error', document.getElementById('excel-message'));
        return;
    }
    await processExcelFile(fileInput.files[0]);
}

async function handleDroppedExcelFile(files) {
    if (files.length === 0) return;
    const excelFile = files[0];
    if (excelFile.name.match(/\.(xlsx|xls)$/i)) {
        await processExcelFile(excelFile);
    } else {
        showMessage('Please upload a valid Excel file (.xlsx or .xls)', 'error', document.getElementById('excel-message'));
    }
}

async function processExcelFile(file) {
    try {
        showLoading('Processing Excel file...');
        
        const data = await readExcelFile(file);
        if (!validateExcelFormat(data)) {
            throw new Error('Invalid Excel format. Please use the exported format.');
        }
        
        // Clear existing groups
        state.groups = {};
        state.countyGroupMap = {};
        
        // Process the Excel data into groups
        processExcelData(data);
        
        // Update the display
        renderGroups();
        refreshAllMapStyling();
        
        showMessage('Excel file loaded successfully', 'success', document.getElementById('excel-message'));
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', document.getElementById('excel-message'));
        console.error(error);
    } finally {
        hideLoading();
    }
}

async function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

function validateExcelFormat(data) {
    if (data.length < 2) return false;
    const headers = data[0];
    return headers[0] === 'Group Name' && 
           headers[1] === 'County Name' && 
           headers[2] === 'State' && 
           headers[3] === 'Color';
}

function processExcelData(data) {
    // Skip header row
    const rows = data.slice(1);
    
    // Clear existing groups
    state.groups = {};
    state.countyGroupMap = {};
    
    // Group rows by group name
    const groupsMap = {};
    rows.forEach(row => {
        if (row.length < 4) return;
        
        const groupName = row[0];
        const countyName = row[1];
        const stateName = row[2];
        const colorValue = row[3];
        
        if (!groupsMap[groupName]) {
            // Determine the color class from the Excel data
            let colorClass;
            if (typeof colorValue === 'string' && colorValue.match(/^\d+$/)) {
                // If color is a number string (like "1", "2", etc.)
                const index = parseInt(colorValue) - 1;
                colorClass = GROUP_COLORS[index] || GROUP_COLORS[0];
            } else if (typeof colorValue === 'number') {
                // If color is a number
                const index = colorValue - 1;
                colorClass = GROUP_COLORS[index] || GROUP_COLORS[0];
            } else if (typeof colorValue === 'string') {
                // If color is a string, try to match it to a color class
                const lowerColorValue = colorValue.toLowerCase();
                const colorIndex = GROUP_COLORS.findIndex(c => 
                    c.includes(lowerColorValue) || 
                    c === `group-color-${lowerColorValue}`
                );
                colorClass = colorIndex >= 0 ? GROUP_COLORS[colorIndex] : GROUP_COLORS[0];
            } else {
                // Default to first color
                colorClass = GROUP_COLORS[0];
            }
            
            groupsMap[groupName] = {
                name: groupName,
                counties: [],
                colorClass: colorClass
            };
        }
        
        // Find the actual county feature from the loaded shapefile
        let matchedCountyFeature = null;
        let matchedStateName = stateName;
        
        if (geoJsonLayer) {
            geoJsonLayer.eachLayer(layer => {
                const feature = layer.feature;
                const featureCountyName = (feature.properties.NAME || feature.properties.name || '').toLowerCase();
                const featureCountyId = getCountyId(feature);
                const featureStateName = state.countyStateMap[featureCountyId] || 
                                       extractStateName(feature) || '';
                
                // Try multiple matching strategies
                const excelCountyName = countyName.toLowerCase();
                const excelStateName = stateName.toLowerCase();
                const featureStateNameLower = featureStateName.toLowerCase();
                
                // Check if county names match
                const countyMatches = featureCountyName === excelCountyName ||
                                    featureCountyName.includes(excelCountyName) ||
                                    excelCountyName.includes(featureCountyName);
                
                // Check if states match (try multiple formats)
                const stateMatches = featureStateNameLower === excelStateName ||
                                   getStateAbbreviationFromName(featureStateName)?.toLowerCase() === excelStateName ||
                                   getStateAbbreviationFromName(stateName)?.toLowerCase() === featureStateNameLower ||
                                   getStateNameFromAbbreviation(featureStateName)?.toLowerCase() === excelStateName ||
                                   getStateNameFromAbbreviation(stateName)?.toLowerCase() === featureStateNameLower;
                
                if (countyMatches && stateMatches) {
                    matchedCountyFeature = feature;
                    matchedStateName = featureStateName;
                    
                    // Immediately update the county-group mapping with the actual feature's ID
                    const actualCountyId = getCountyId(feature);
                    state.countyGroupMap[actualCountyId] = groupsMap[groupName].colorClass;
                }
            });
        }
        
        // Use the matched feature if found, otherwise create a mock one
        const countyFeature = matchedCountyFeature || {
            properties: {
                NAME: countyName,
                STATEFP: getStateAbbreviationFromName(stateName) || stateName,
                STATE: getStateAbbreviationFromName(stateName) || stateName,
                STATE_NAME: stateName
            }
        };
        
        const countyData = {
            countyFeature: countyFeature,
            stateName: matchedStateName
        };
        
        groupsMap[groupName].counties.push(countyData);
    });
    
    // Add groups to state
    Object.values(groupsMap).forEach((group, index) => {
        const groupId = Date.now().toString() + index;
        state.groups[groupId] = group;
    });
    
    // Use the existing refreshAllMapStyling function to update the map
    refreshAllMapStyling();
}
async function handleFileUpload() {
    const files = Array.from(elements.fileInput.files);
    if (files.length === 0) {
        showMessage('Please select shapefile files first.', 'error');
        return;
    }
    await processShapefile(files);
}

async function handleDroppedFiles(items) {
    const files = [];
    
    if (items[0]?.webkitGetAsEntry) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if (item) await traverseFileTree(item, files);
        }
    } else {
        for (let i = 0; i < items.length; i++) {
            files.push(items[i]);
        }
    }
    
    await processShapefile(files);
}

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

async function processShapefile(files) {
    try {
        showLoading('Processing shapefile...');
        
        const shapefileFiles = files.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return ['shp', 'shx', 'dbf', 'prj', 'cpg', 'xml'].includes(ext);
        });
        
        if (shapefileFiles.length === 0) {
            throw new Error('No valid shapefile components found');
        }
        
        const shpFile = shapefileFiles.find(f => f.name.toLowerCase().endsWith('.shp'));
        const shxFile = shapefileFiles.find(f => f.name.toLowerCase().endsWith('.shx'));
        const dbfFile = shapefileFiles.find(f => f.name.toLowerCase().endsWith('.dbf'));
        
        if (!shpFile || !shxFile || !dbfFile) {
            throw new Error('Missing required .shp, .shx, or .dbf files');
        }
        
        const [shpBuffer, dbfBuffer] = await Promise.all([
            readFileAsArrayBuffer(shpFile),
            readFileAsArrayBuffer(dbfFile)
        ]);
        
        const geojson = shp.combine([
            shp.parseShp(shpBuffer),
            shp.parseDbf(dbfBuffer)
        ]);
        
        buildCountyStateMap(geojson);
        displayGeoJSON(geojson);
        showMessage('Shapefile loaded successfully with state data', 'success');
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error');
        console.error(error);
    } finally {
        hideLoading();
    }
}

// County and state management
function buildCountyStateMap(geojson) {
    state.countyStateMap = {};
    state.countyGroupMap = {};
    
    geojson.features.forEach(feature => {
        const countyId = getCountyId(feature);
        const stateName = extractStateName(feature);
        
        if (stateName) {
            state.countyStateMap[countyId] = stateName;
        } else {
            console.warn('Could not determine state for county:', feature.properties);
        }
    });
}

function refreshAllMapStyling() {
    if (!geoJsonLayer) return;
    
    geoJsonLayer.eachLayer(layer => {
        const countyId = getCountyId(layer.feature);
        const colorClass = state.countyGroupMap[countyId];
        const isSelected = state.selectedCounties.some(c => getCountyId(c.countyFeature) === countyId);
        
        if (isSelected) {
            // Selected styling
            layer.setStyle({
                fillColor: colorClass ? getColorFromClass(colorClass) : '#e74c3c',
                weight: 3,
                opacity: 1,
                color: '#000000',
                dashArray: '',
                fillOpacity: 0.7
            });
        } else {
            // Normal styling
            layer.setStyle({
                fillColor: colorClass ? getColorFromClass(colorClass) : '#3388ff',
                weight: 1,
                opacity: 1,
                color: 'white',
                dashArray: '3',
                fillOpacity: 0.7
            });
        }
    });
}

function extractStateName(feature) {
    const props = feature.properties;
    const possibleKeys = [
        'STATEFP', 'STATE', 'STATENS', 'STUSPS', 'STATE_NAME', 
        'STATENAME', 'STNAME', 'STATEABBR', 'STABBR'
    ];
    
    for (const key of possibleKeys) {
        if (props[key]) {
            if (key === 'STATEFP' || key === 'STATE') {
                return getStateNameFromCode(props[key]) || props[key];
            }
            return props[key];
        }
    }
    
    for (const key in props) {
        const value = props[key];
        if (typeof value === 'string' && value.length === 2 && isStateAbbreviation(value)) {
            return getStateNameFromAbbreviation(value);
        }
        if (typeof value === 'string' && isStateName(value)) {
            return value;
        }
    }
    
    return null;
}

// State helper functions
function isStateAbbreviation(abbr) {
    return !!getStateNameFromAbbreviation(abbr);
}

function isStateName(name) {
    return !!getStateAbbreviationFromName(name);
}

function getStateNameFromAbbreviation(abbr) {
    const states = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 
        'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 
        'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 
        'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 
        'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 
        'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 
        'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    return states[abbr.toUpperCase()] || null;
}

function getStateAbbreviationFromName(name) {
    const states = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 
        'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 
        'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 
        'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 
        'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD', 
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 
        'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 
        'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 
        'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 
        'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 
        'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 
        'wisconsin': 'WI', 'wyoming': 'WY'
    };
    return states[name.toLowerCase()] || null;
}

function getStateNameFromCode(code) {
    const fipsCodes = {
        '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
        '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
        '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
        '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
        '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
        '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
        '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
        '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
        '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
        '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
        '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
        '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
        '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
    };
    return fipsCodes[code] || null;
}
function getNextAvailableColor() {
    // Get all colors currently in use
    const usedColors = new Set(Object.values(state.groups).map(group => group.colorClass));
    
    // Find the first unused color
    for (let i = 0; i < GROUP_COLORS.length; i++) {
        const color = GROUP_COLORS[i];
        if (!usedColors.has(color)) {
            return color;
        }
    }
    
    // If all colors are used, cycle back to the beginning
    return GROUP_COLORS[Object.keys(state.groups).length % GROUP_COLORS.length];
}

// Map display functions
function displayGeoJSON(geojson) {
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
        clearSelection();
    }
    
    function style(feature) {
        const countyId = getCountyId(feature);
        const colorClass = state.countyGroupMap[countyId];
        const color = colorClass ? getColorFromClass(colorClass) : '#3388ff';
        
        return {
            fillColor: color,
            weight: 1,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.7
        };
    }
    
    function highlightFeature(e) {
        const layer = e.target;
        layer.setStyle({
            weight: 3,
            color: '#666',
            dashArray: '',
            fillOpacity: 0.7
        });
        layer.bringToFront();
        
        const countyName = layer.feature.properties.NAME || layer.feature.properties.name || 'Unknown County';
        const countyId = getCountyId(layer.feature);
        const stateName = state.countyStateMap[countyId] || 'Unknown State';
        elements.selectedCountiesContainer.innerHTML = `<strong>Hovering:</strong> ${countyName}, ${stateName}`;
    }
    
    function resetHighlight(e) {
        const layer = e.target;
        const countyId = getCountyId(layer.feature);
        const colorClass = state.countyGroupMap[countyId];
        const isSelected = state.selectedCounties.some(c => getCountyId(c.countyFeature) === countyId);
        
        if (isSelected) {
            // Keep selection styling - don't reset if county is selected
            if (colorClass) {
                layer.setStyle({
                    fillColor: getColorFromClass(colorClass),
                    weight: 3,  // Keep thick border for selection
                    color: '#000000',  // Keep black border for selection
                    dashArray: ''  // Keep solid border for selection
                });
            } else {
                layer.setStyle({
                    fillColor: '#e74c3c', // Keep selection color
                    weight: 3,
                    color: '#000000',
                    dashArray: ''
                });
            }
        } else {
            // Not selected, use normal styling
            if (colorClass) {
                layer.setStyle({
                    fillColor: getColorFromClass(colorClass),
                    weight: 1,
                    color: 'white',
                    dashArray: '3'
                });
            } else {
                geoJsonLayer.resetStyle(layer);
            }
        }
        
        updateSelectedCountiesDisplay();
    }
    
    // Use the updated onEachFeature function here
    geoJsonLayer = L.geoJSON(geojson, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);
    
    map.fitBounds(geoJsonLayer.getBounds());
}

function getColorFromClass(colorClass) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(`--${colorClass.replace('group-color-', 'color-')}`)
        .trim() || '#3388ff';
}

// County selection and grouping
function toggleCountySelection(feature, layer) {
    const countyId = getCountyId(feature);
    const stateName = state.countyStateMap[countyId] || 'Unknown State';
    const existingColor = state.countyGroupMap[countyId];
    
    const index = state.selectedCounties.findIndex(c => getCountyId(c.countyFeature) === countyId);
    
    if (index === -1) {
        // Add to selection
        const newCounty = {
            countyFeature: feature,
            stateName: stateName,
            colorClass: existingColor || null
        };
        
        state.selectedCounties.push(newCounty);
        
        // Apply selection styling - show group color if exists, otherwise selection color
        if (existingColor) {
            layer.setStyle({ 
                fillColor: getColorFromClass(existingColor),
                weight: 3,  // Thicker border to show it's selected
                color: '#000000',  // Black border for selection
                dashArray: ''  // Solid border for selection
            });
        } else {
            layer.setStyle({ 
                fillColor: '#e74c3c', 
                weight: 3,
                color: '#000000',
                dashArray: ''
            });
        }
    } else {
        // Remove from selection
        state.selectedCounties.splice(index, 1);
        
        // Revert to group color or default, with normal styling
        if (existingColor) {
            layer.setStyle({ 
                fillColor: getColorFromClass(existingColor),
                weight: 1,
                color: 'white',
                dashArray: '3'
            });
        } else {
            layer.setStyle({ 
                fillColor: '#3388ff', 
                weight: 1,
                color: 'white',
                dashArray: '3'
            });
        }
    }
    
    updateSelectedCountiesDisplay();
}

function onEachFeature(feature, layer) {
    layer.on({
        click: (e) => {
            if (!state.ctrlPressed && !state.isDragging) {
                toggleCountySelection(feature, layer);
            }
        },
        mouseover: (e) => {
            if (state.isDragging && state.ctrlPressed) {
                // Add county to drag selection if not already selected
                const countyId = getCountyId(feature);
                if (!state.dragSelectedCounties.has(countyId)) {
                    state.dragSelectedCounties.add(countyId);
                    addCountyToSelection(feature, layer);
                }
            } else if (!state.isDragging) {
                highlightFeature(e);
            }
        },
        mouseout: (e) => {
            if (!state.isDragging) {
                resetHighlight(e);
            }
        },
        mousedown: (e) => {
            if (state.ctrlPressed) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                startDragSelection(feature, layer);
            }
        }
    });
}


function startDragSelection(feature, layer) {
    if (!state.ctrlPressed) return;
    
    state.isDragging = true;
    state.dragStarted = true;
    state.dragSelectedCounties.clear();
    
    // Add the starting county to drag selection
    const countyId = getCountyId(feature);
    state.dragSelectedCounties.add(countyId);
    addCountyToSelection(feature, layer);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    
    // Add global mouse events for drag continuation
    const handleMouseMove = (e) => {
        if (!state.isDragging || !state.ctrlPressed) return;
        
        // Get element under mouse
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        
        // Check if we're over a county layer
        if (geoJsonLayer) {
            geoJsonLayer.eachLayer(countyLayer => {
                if (countyLayer.getElement && countyLayer.getElement() === elementUnderMouse) {
                    const countyId = getCountyId(countyLayer.feature);
                    if (!state.dragSelectedCounties.has(countyId)) {
                        state.dragSelectedCounties.add(countyId);
                        addCountyToSelection(countyLayer.feature, countyLayer);
                    }
                } else if (countyLayer._path === elementUnderMouse) {
                    const countyId = getCountyId(countyLayer.feature);
                    if (!state.dragSelectedCounties.has(countyId)) {
                        state.dragSelectedCounties.add(countyId);
                        addCountyToSelection(countyLayer.feature, countyLayer);
                    }
                }
            });
        }
    };
    
    const handleMouseUp = (e) => {
        if (state.isDragging) {
            endDragSelection();
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function endDragSelection() {
    if (state.isDragging) {
        state.isDragging = false;
        state.dragStarted = false;
        
        // Re-enable text selection
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        document.body.style.msUserSelect = '';
        
        // Update display
        updateSelectedCountiesDisplay();
        
        // Clear drag selection set
        state.dragSelectedCounties.clear();
    }
}

function addCountyToSelection(feature, layer) {
    const countyId = getCountyId(feature);
    const stateName = state.countyStateMap[countyId] || 'Unknown State';
    const existingColor = state.countyGroupMap[countyId];
    
    // Check if county is already in selection
    const index = state.selectedCounties.findIndex(c => getCountyId(c.countyFeature) === countyId);
    
    if (index === -1) {
        // Add to selection
        const newCounty = {
            countyFeature: feature,
            stateName: stateName,
            colorClass: existingColor || null
        };
        
        state.selectedCounties.push(newCounty);
        
        // Apply selection styling - show group color if exists, otherwise selection color
        if (existingColor) {
            layer.setStyle({ 
                fillColor: getColorFromClass(existingColor),
                weight: 3,  // Thicker border to show it's selected
                color: '#000000',  // Black border for selection
                dashArray: ''  // Solid border for selection
            });
        } else {
            layer.setStyle({ 
                fillColor: '#e74c3c', 
                weight: 3,
                color: '#000000',
                dashArray: ''
            });
        }
    }
}

function getCountyId(feature) {
    const name = feature.properties.NAME || feature.properties.name || 'unknown';
    const stateCode = feature.properties.STATEFP || feature.properties.STATE || '00';
    return `${name}-${stateCode}`.toLowerCase();
}

function clearSelection() {
    if (geoJsonLayer) {
        geoJsonLayer.eachLayer(layer => {
            const countyId = getCountyId(layer.feature);
            const colorClass = state.countyGroupMap[countyId];
            
            if (colorClass) {
                layer.setStyle({
                    fillColor: getColorFromClass(colorClass),
                    weight: 1
                });
            } else {
                layer.setStyle({
                    fillColor: '#3388ff',
                    weight: 1
                });
            }
        });
    }
    
    state.selectedCounties = [];
    state.dragSelectedCounties.clear();
    updateSelectedCountiesDisplay();
}

// Group management
function createGroup() {
    const groupName = elements.groupNameInput.value.trim();
    if (!groupName) {
        showMessage('Please enter a group name', 'error', elements.exportMessage);
        return;
    }
    
    if (state.selectedCounties.length === 0) {
        showMessage('No counties selected to add to group', 'error', elements.exportMessage);
        return;
    }
    
    const groupId = Date.now().toString();
    const colorClass = getNextAvailableColor(); // Use the new function
    
    state.groups[groupId] = {
        name: groupName,
        counties: [...state.selectedCounties],
        colorClass: colorClass
    };
    
    // Update county-group mapping and map styling
    state.selectedCounties.forEach(item => {
        const countyId = getCountyId(item.countyFeature);
        state.countyGroupMap[countyId] = colorClass;
        
        if (geoJsonLayer) {
            geoJsonLayer.eachLayer(layer => {
                if (getCountyId(layer.feature) === countyId) {
                    layer.setStyle({ 
                        fillColor: getColorFromClass(colorClass),
                        weight: 1, // Reset to normal weight since it's no longer selected
                        color: 'white',
                        dashArray: '3'
                    });
                }
            });
        }
    });
    
    renderGroups();
    clearSelection();
    elements.groupNameInput.value = '';
    showMessage(`Group "${groupName}" created with ${state.selectedCounties.length} counties`, 'success', elements.exportMessage);
}

function renderGroups() {
    elements.groupsContainer.innerHTML = '';
    
    Object.entries(state.groups).forEach(([groupId, group]) => {
        const groupEl = document.createElement('div');
        groupEl.className = `group-item ${group.colorClass}`;
        
        const stateCount = new Set(group.counties.map(c => c.stateName)).size;
        
        groupEl.innerHTML = `
            <div>
                <strong>${group.name}</strong>
                <div>${group.counties.length} counties across ${stateCount} states</div>
            </div>
            <button data-group-id="${groupId}" class="delete-group">Delete</button>
        `;
        
        elements.groupsContainer.appendChild(groupEl);
        
        groupEl.querySelector('.delete-group').addEventListener('click', (e) => {
            const groupId = e.target.dataset.groupId;
            const group = state.groups[groupId];
            
            // Remove group colors from counties
            group.counties.forEach(item => {
                const countyId = getCountyId(item.countyFeature);
                delete state.countyGroupMap[countyId];
                
                // Reset map styling if layer exists
                if (geoJsonLayer) {
                    geoJsonLayer.eachLayer(layer => {
                        if (getCountyId(layer.feature) === countyId) {
                            layer.setStyle({ 
                                fillColor: '#3388ff',
                                weight: state.selectedCounties.some(c => getCountyId(c.countyFeature) === countyId) ? 2 : 1
                            });
                        }
                    });
                }
            });
            
            delete state.groups[groupId];
            renderGroups();
        });
    });
}

// Display functions
function updateSelectedCountiesDisplay() {
    elements.selectedCountiesContainer.innerHTML = '';
    
    if (state.selectedCounties.length === 0) {
        elements.selectedCountiesContainer.innerHTML = '<p>No counties selected</p>';
        return;
    }
    
    state.selectedCounties.forEach(item => {
        const countyEl = document.createElement('div');
        countyEl.className = 'county-item';
        
        const name = item.countyFeature.properties.NAME || 
                     item.countyFeature.properties.name || 
                     'Unknown County';
        const stateName = item.stateName || 'Unknown State';
        
        countyEl.textContent = `${name}, ${stateName}`;
        elements.selectedCountiesContainer.appendChild(countyEl);
    });
}

// Export functions
function exportToExcel() {
    if (Object.keys(state.groups).length === 0) {
        showMessage('No groups to export', 'error', elements.exportMessage);
        return;
    }
    
    try {
        const data = [['Group Name', 'County Name', 'State', 'Color']];
        
        Object.values(state.groups).forEach(group => {
            group.counties.forEach(item => {
                const name = item.countyFeature.properties.NAME || 
                             item.countyFeature.properties.name || 
                             'Unknown County';
                const stateName = item.stateName || 'Unknown State';
                data.push([group.name, name, stateName, group.colorClass.replace('group-color-', '')]);
            });
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'County Groups');
        XLSX.writeFile(wb, 'county_groups.xlsx');
        showMessage('Excel file exported successfully with state data', 'success', elements.exportMessage);
    } catch (error) {
        showMessage(`Export failed: ${error.message}`, 'error', elements.exportMessage);
        console.error(error);
    }
}

// Utility functions
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

function showLoading(message) {
    elements.loadingText.textContent = message;
    elements.loadingDiv.style.display = 'block';
    elements.progressBar.style.width = '0%';
}

function hideLoading() {
    elements.loadingDiv.style.display = 'none';
}

function showMessage(text, type, element = elements.messageDiv) {
    element.textContent = text;
    element.className = type;
    if (type === 'error') console.error(text);
}

// Initialize the application
init();
