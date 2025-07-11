// Initialize map
const map = L.map('map').setView([39.8283, -98.5795], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// State management with enhanced county-state tracking
const state = {
    selectedCounties: [], // Array of { countyFeature, stateName }
    groups: {}, // { groupId: { name, counties: [{ countyFeature, stateName }] } }
    currentGroupId: null,
    countyStateMap: {} // Maps county IDs to state names
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
    exportMessage: document.getElementById('export-message')
};

let geoJsonLayer = null;

// Event listeners
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
}

// File handling with enhanced state data extraction
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

// Build a map of county IDs to state names
function buildCountyStateMap(geojson) {
    state.countyStateMap = {};
    
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

// Enhanced state name extraction from DBF properties
function extractStateName(feature) {
    const props = feature.properties;
    
    // Try common state name property keys
    const possibleKeys = [
        'STATEFP', 'STATE', 'STATENS', 'STUSPS', 'STATE_NAME', 
        'STATENAME', 'STNAME', 'STATEABBR', 'STABBR'
    ];
    
    for (const key of possibleKeys) {
        if (props[key]) {
            // If it's a state code, try to map to name
            if (key === 'STATEFP' || key === 'STATE') {
                return getStateNameFromCode(props[key]) || props[key];
            }
            return props[key];
        }
    }
    
    // If no direct state property, try to find it in other fields
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

// Helper functions for state identification
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
    // Map FIPS state codes to state names
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

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// Map display functions with enhanced state handling
function displayGeoJSON(geojson) {
    // Clear previous layer if exists
    if (geoJsonLayer) {
        map.removeLayer(geoJsonLayer);
        clearSelection();
    }
    
    // Style function
    function style(feature) {
        return {
            fillColor: '#3388ff',
            weight: 1,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.7
        };
    }
    
    // Highlight on hover
    function highlightFeature(e) {
        const layer = e.target;
        layer.setStyle({
            weight: 3,
            color: '#666',
            dashArray: '',
            fillOpacity: 0.7
        });
        layer.bringToFront();
        
        // Show county and state info
        const countyName = layer.feature.properties.NAME || layer.feature.properties.name || 'Unknown County';
        const countyId = getCountyId(layer.feature);
        const stateName = state.countyStateMap[countyId] || 'Unknown State';
        elements.selectedCountiesContainer.innerHTML = `<strong>Hovering:</strong> ${countyName}, ${stateName}`;
    }
    
    function resetHighlight(e) {
        geoJsonLayer.resetStyle(e.target);
        updateSelectedCountiesDisplay();
    }
    
    // Handle feature clicks
    function onEachFeature(feature, layer) {
        layer.on({
            click: (e) => toggleCountySelection(feature, layer),
            mouseover: highlightFeature,
            mouseout: resetHighlight
        });
    }
    
    // Create GeoJSON layer
    geoJsonLayer = L.geoJSON(geojson, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);
    
    // Fit map to bounds
    map.fitBounds(geoJsonLayer.getBounds());
}

// County selection functions with state tracking
function toggleCountySelection(feature, layer) {
    const countyId = getCountyId(feature);
    const stateName = state.countyStateMap[countyId] || 'Unknown State';
    
    const index = state.selectedCounties.findIndex(c => getCountyId(c.countyFeature) === countyId);
    
    if (index === -1) {
        // Add to selection
        state.selectedCounties.push({
            countyFeature: feature,
            stateName: stateName
        });
        layer.setStyle({ fillColor: '#e74c3c', weight: 2 });
    } else {
        // Remove from selection
        state.selectedCounties.splice(index, 1);
        layer.setStyle({ fillColor: '#3388ff', weight: 1 });
    }
    
    updateSelectedCountiesDisplay();
}

function getCountyId(feature) {
    // Create unique ID from county name and state code if available
    const name = feature.properties.NAME || feature.properties.name || 'unknown';
    const stateCode = feature.properties.STATEFP || feature.properties.STATE || '00';
    return `${name}-${stateCode}`.toLowerCase();
}

function clearSelection() {
    // Reset styles
    if (geoJsonLayer) {
        state.selectedCounties.forEach(item => {
            geoJsonLayer.eachLayer(layer => {
                if (getCountyId(layer.feature) === getCountyId(item.countyFeature)) {
                    layer.setStyle({ fillColor: '#3388ff', weight: 1 });
                }
            });
        });
    }
    
    state.selectedCounties = [];
    updateSelectedCountiesDisplay();
}

// Group management functions with state data
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
    state.groups[groupId] = {
        name: groupName,
        counties: [...state.selectedCounties] // Copy the selected counties with their state data
    };
    
    renderGroups();
    clearSelection();
    elements.groupNameInput.value = '';
    showMessage(`Group "${groupName}" created with ${state.selectedCounties.length} counties`, 'success', elements.exportMessage);
}

function renderGroups() {
    elements.groupsContainer.innerHTML = '';
    
    Object.entries(state.groups).forEach(([groupId, group]) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'group-item';
        
        // Count unique states in this group
        const stateCount = new Set(group.counties.map(c => c.stateName)).size;
        
        groupEl.innerHTML = `
            <div>
                <strong>${group.name}</strong>
                <div>${group.counties.length} counties across ${stateCount} states</div>
            </div>
            <button data-group-id="${groupId}" class="delete-group">Delete</button>
        `;
        
        elements.groupsContainer.appendChild(groupEl);
        
        // Add delete button event
        groupEl.querySelector('.delete-group').addEventListener('click', (e) => {
            delete state.groups[e.target.dataset.groupId];
            renderGroups();
        });
    });
}

// Display functions with state information
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

// Export functions with state data
function exportToExcel() {
    if (Object.keys(state.groups).length === 0) {
        showMessage('No groups to export', 'error', elements.exportMessage);
        return;
    }
    
    try {
        // Prepare data
        const data = [];
        
        // Add headers
        data.push(['Group Name', 'County Name', 'State']);
        
        // Add group data
        Object.values(state.groups).forEach(group => {
            group.counties.forEach(item => {
                const name = item.countyFeature.properties.NAME || 
                             item.countyFeature.properties.name || 
                             'Unknown County';
                const stateName = item.stateName || 'Unknown State';
                data.push([group.name, name, stateName]);
            });
        });
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'County Groups');
        
        // Export
        XLSX.writeFile(wb, 'county_groups.xlsx');
        showMessage('Excel file exported successfully with state data', 'success', elements.exportMessage);
    } catch (error) {
        showMessage(`Export failed: ${error.message}`, 'error', elements.exportMessage);
        console.error(error);
    }
}

// UI helper functions
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

// Initialize
setupEventListeners();
updateSelectedCountiesDisplay();
