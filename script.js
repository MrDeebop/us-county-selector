// Color palette for groups (expand as needed)
const GROUP_COLORS = [
    '#e74c3c', // Red
    '#2ecc71', // Green
    '#3498db', // Blue
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Turquoise
    '#d35400', // Pumpkin
    '#34495e', // Dark blue
    '#7f8c8d', // Gray
    '#c0392b'  // Dark red
];

// Initialize map and state with color tracking
const map = L.map('map').setView([39.8283, -98.5795], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const state = {
    selectedCounties: [],
    groups: {},
    currentGroupId: null,
    countyStateMap: {},
    countyGroupMap: {}, // Tracks which group each county belongs to
    nextColorIndex: 0  // Tracks which color to use next
};

const elements = {
    // Previous elements plus new Excel upload elements
    map,
    fileInput: document.getElementById('shapefile-upload'),
    excelInput: document.getElementById('excel-upload'),
    uploadBtn: document.getElementById('upload-btn'),
    uploadExcelBtn: document.getElementById('upload-excel-btn'),
    // ... rest of the elements remain the same
};

let geoJsonLayer = null;

// Modified createGroup function with color assignment
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
    const groupColor = GROUP_COLORS[state.nextColorIndex % GROUP_COLORS.length];
    
    state.groups[groupId] = {
        name: groupName,
        counties: [...state.selectedCounties],
        color: groupColor
    };
    
    // Update county-group mapping
    state.selectedCounties.forEach(item => {
        const countyId = getCountyId(item.countyFeature);
        state.countyGroupMap[countyId] = groupId;
    });
    
    state.nextColorIndex++;
    renderGroups();
    updateMapWithGroupColors();
    clearSelection();
    elements.groupNameInput.value = '';
    showMessage(`Group "${groupName}" created with ${state.selectedCounties.length} counties`, 'success', elements.exportMessage);
}

// Modified renderGroups to show color indicators
function renderGroups() {
    elements.groupsContainer.innerHTML = '';
    
    Object.entries(state.groups).forEach(([groupId, group]) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'group-item';
        
        const stateCount = new Set(group.counties.map(c => c.stateName)).size;
        
        groupEl.innerHTML = `
            <div>
                <span class="group-color" style="background-color: ${group.color}"></span>
                <strong>${group.name}</strong>
                <div>${group.counties.length} counties across ${stateCount} states</div>
            </div>
            <button data-group-id="${groupId}" class="delete-group">Delete</button>
        `;
        
        elements.groupsContainer.appendChild(groupEl);
        
        groupEl.querySelector('.delete-group').addEventListener('click', (e) => {
            deleteGroup(e.target.dataset.groupId);
        });
    });
}

function deleteGroup(groupId) {
    // Remove group references from counties
    state.groups[groupId].counties.forEach(item => {
        const countyId = getCountyId(item.countyFeature);
        delete state.countyGroupMap[countyId];
    });
    
    delete state.groups[groupId];
    renderGroups();
    updateMapWithGroupColors();
}

// New function to update map with group colors
function updateMapWithGroupColors() {
    if (!geoJsonLayer) return;
    
    geoJsonLayer.eachLayer(layer => {
        const countyId = getCountyId(layer.feature);
        const groupId = state.countyGroupMap[countyId];
        
        if (groupId) {
            const group = state.groups[groupId];
            layer.setStyle({
                fillColor: group.color,
                weight: 2,
                className: 'county-in-group'
            });
        } else {
            // Reset to default style if not in a group
            layer.setStyle({
                fillColor: '#3388ff',
                weight: 1,
                className: ''
            });
        }
    });
}

// New function to handle Excel upload
async function handleExcelUpload() {
    const file = elements.excelInput.files[0];
    if (!file) {
        showMessage('Please select an Excel file first.', 'error');
        return;
    }
    
    try {
        showLoading('Processing Excel file...');
        
        const data = await readExcelFile(file);
        
        if (!data || data.length < 2) {
            throw new Error('Invalid Excel format or empty file');
        }
        
        // Clear existing groups
        state.groups = {};
        state.countyGroupMap = {};
        state.nextColorIndex = 0;
        
        // Process each row (skip header)
        for (let i = 1; i < data.length; i++) {
            const [groupName, countyName, stateName] = data[i];
            
            // Find or create the group
            let group = Object.values(state.groups).find(g => g.name === groupName);
            if (!group) {
                const groupId = Date.now().toString() + i; // Unique ID
                const groupColor = GROUP_COLORS[state.nextColorIndex % GROUP_COLORS.length];
                
                group = {
                    name: groupName,
                    counties: [],
                    color: groupColor
                };
                state.groups[groupId] = group;
                state.nextColorIndex++;
            }
            
            // Find the county in the GeoJSON (if loaded)
            if (geoJsonLayer) {
                let countyFound = false;
                
                geoJsonLayer.eachLayer(layer => {
                    const feature = layer.feature;
                    const currentCountyName = feature.properties.NAME || feature.properties.name;
                    const currentStateName = state.countyStateMap[getCountyId(feature)];
                    
                    if (currentCountyName === countyName && currentStateName === stateName) {
                        group.counties.push({
                            countyFeature: feature,
                            stateName: currentStateName
                        });
                        
                        state.countyGroupMap[getCountyId(feature)] = Object.keys(state.groups).find(
                            key => state.groups[key].name === groupName
                        );
                        
                        countyFound = true;
                    }
                });
                
                if (!countyFound) {
                    console.warn(`County not found: ${countyName}, ${stateName}`);
                }
            }
        }
        
        renderGroups();
        updateMapWithGroupColors();
        showMessage('Excel file loaded successfully', 'success');
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error');
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

// Modified toggleCountySelection to respect group colors
function toggleCountySelection(feature, layer) {
    const countyId = getCountyId(feature);
    const stateName = state.countyStateMap[countyId] || 'Unknown State';
    const groupId = state.countyGroupMap[countyId];
    
    // If county is already in a group, don't allow selection
    if (groupId) {
        const group = state.groups[groupId];
        showMessage(`This county is already in group "${group.name}"`, 'error');
        return;
    }
    
    const index = state.selectedCounties.findIndex(c => getCountyId(c.countyFeature) === countyId);
    
    if (index === -1) {
        state.selectedCounties.push({
            countyFeature: feature,
            stateName: stateName
        });
        layer.setStyle({ fillColor: '#e74c3c', weight: 2 });
    } else {
        state.selectedCounties.splice(index, 1);
        layer.setStyle({ fillColor: '#3388ff', weight: 1 });
    }
    
    updateSelectedCountiesDisplay();
}

// Initialize with new event listeners
function setupEventListeners() {
    // Previous event listeners
    elements.uploadBtn.addEventListener('click', handleFileUpload);
    elements.uploadExcelBtn.addEventListener('click', handleExcelUpload);
    
    // ... rest of the event listeners remain the same
}

// Initialize the application
setupEventListeners();
updateSelectedCountiesDisplay();
