document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let map;
    let countyLayer;
    let drawnItems = new L.FeatureGroup();
    let drawControl;
    let isDrawing = false;
    let currentGroupName = '';
    let assignments = {};
    let countyData = null;
    
    // DOM elements
    const geojsonUpload = document.getElementById('geojson-upload');
    const geojsonStatus = document.getElementById('geojson-status');
    const assignmentSection = document.getElementById('assignment-section');
    const groupNameInput = document.getElementById('group-name');
    const startDrawingBtn = document.getElementById('start-drawing');
    const endDrawingBtn = document.getElementById('end-drawing');
    const clearDrawingBtn = document.getElementById('clear-drawing');
    const exportDataBtn = document.getElementById('export-data');
    const importButton = document.getElementById('import-button');
    const importDataInput = document.getElementById('import-data');
    const clearAllBtn = document.getElementById('clear-all');
    const assignmentsBody = document.getElementById('assignments-body');
    
    // Initialize map
    function initMap() {
        map = L.map('map').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Initialize the draw control (but don't add it yet)
        drawControl = new L.Control.Draw({
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    shapeOptions: {
                        color: '#3388ff'
                    }
                },
                polyline: false,
                rectangle: false,
                circle: false,
                marker: false,
                circlemarker: false
            },
            edit: {
                featureGroup: drawnItems
            }
        });
        
        drawnItems.addTo(map);
        
        // Handle drawing events
        map.on(L.Draw.Event.CREATED, function(e) {
            if (!isDrawing) return;
            
            const layer = e.layer;
            drawnItems.addLayer(layer);
            
            // Find counties within the polygon
            findCountiesInPolygon(layer);
        });
    }
    
    // Initialize the application
    initMap();
    
    // Handle GeoJSON upload
    geojsonUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                countyData = JSON.parse(e.target.result);
                
                // Clear previous data
                if (countyLayer) {
                    map.removeLayer(countyLayer);
                }
                
                // Add new county data to map
                countyLayer = L.geoJSON(countyData, {
                    style: function(feature) {
                        return {
                            fillColor: '#f8f9fa',
                            weight: 1,
                            opacity: 1,
                            color: '#6c757d',
                            fillOpacity: 0.7
                        };
                    },
                    onEachFeature: function(feature, layer) {
                        // Store the original feature for later reference
                        layer.feature = feature;
                        
                        // Show county name on hover
                        if (feature.properties && feature.properties.NAME) {
                            layer.bindTooltip(feature.properties.NAME);
                        }
                    }
                }).addTo(map);
                
                // Fit map to the counties
                map.fitBounds(countyLayer.getBounds());
                
                // Show success message
                showStatus('GeoJSON loaded successfully!', 'success');
                
                // Show the assignment section
                assignmentSection.style.display = 'block';
                
                // Initialize assignments
                assignments = {};
                updateAssignmentsTable();
            } catch (error) {
                showStatus('Error parsing GeoJSON file: ' + error.message, 'error');
                console.error(error);
            }
        };
        reader.onerror = function() {
            showStatus('Error reading file', 'error');
        };
        reader.readAsText(file);
    });
    
    // Start drawing button
    startDrawingBtn.addEventListener('click', function() {
        const groupName = groupNameInput.value.trim();
        if (!groupName) {
            showStatus('Please enter a group name', 'error');
            return;
        }
        
        if (!countyData) {
            showStatus('Please upload GeoJSON first', 'error');
            return;
        }
        
        currentGroupName = groupName;
        isDrawing = true;
        
        // Add draw control to map
        map.addControl(drawControl);
        
        // Update button states
        startDrawingBtn.disabled = true;
        endDrawingBtn.disabled = false;
        groupNameInput.disabled = true;
        
        showStatus(`Drawing mode active for group "${groupName}". Draw a polygon around counties to assign.`, 'info');
    });
    
    // End drawing button
    endDrawingBtn.addEventListener('click', function() {
        isDrawing = false;
        
        // Remove draw control from map
        map.removeControl(drawControl);
        
        // Clear drawn items
        drawnItems.clearLayers();
        
        // Update button states
        startDrawingBtn.disabled = false;
        endDrawingBtn.disabled = true;
        groupNameInput.disabled = false;
        groupNameInput.value = '';
        
        showStatus(`Finished assigning counties to "${currentGroupName}"`, 'success');
        updateAssignmentsTable();
    });
    
    // Clear current drawing button
    clearDrawingBtn.addEventListener('click', function() {
        if (!isDrawing) return;
        
        drawnItems.clearLayers();
        showStatus('Cleared current drawing', 'info');
    });
    
    // Find counties within a drawn polygon
    function findCountiesInPolygon(polygonLayer) {
        if (!countyLayer || !currentGroupName) return;
        
        // Get the polygon geometry
        const polygon = polygonLayer.toGeoJSON();
        
        // Initialize group if it doesn't exist
        if (!assignments[currentGroupName]) {
            assignments[currentGroupName] = [];
        }
        
        // Check each county to see if it's inside the polygon
        countyLayer.eachLayer(function(countyLayer) {
            const county = countyLayer.feature;
            const countyId = county.properties.GEOID || county.properties.FIPS || county.properties.NAME;
            
            // Skip if already assigned to this group
            if (assignments[currentGroupName].includes(countyId)) return;
            
            // Check if county is inside polygon
            if (turf.booleanPointInPolygon(
                turf.centerOfMass(county),
                polygon
            )) {
                assignments[currentGroupName].push(countyId);
                
                // Highlight the county
                countyLayer.setStyle({
                    fillColor: getColorForGroup(currentGroupName),
                    fillOpacity: 0.7
                });
            }
        });
    }
    
    // Generate a color for a group based on its name
    function getColorForGroup(groupName) {
        // Simple hash function to generate consistent colors
        let hash = 0;
        for (let i = 0; i < groupName.length; i++) {
            hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }
    
    // Update the assignments table
    function updateAssignmentsTable() {
        assignmentsBody.innerHTML = '';
        
        for (const [groupName, counties] of Object.entries(assignments)) {
            const row = document.createElement('tr');
            
            const nameCell = document.createElement('td');
            nameCell.textContent = groupName;
            
            const countCell = document.createElement('td');
            countCell.textContent = counties.length;
            
            const actionsCell = document.createElement('td');
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.className = 'danger';
            deleteBtn.addEventListener('click', function() {
                delete assignments[groupName];
                updateCountyStyles();
                updateAssignmentsTable();
            });
            
            actionsCell.appendChild(deleteBtn);
            
            row.appendChild(nameCell);
            row.appendChild(countCell);
            row.appendChild(actionsCell);
            
            assignmentsBody.appendChild(row);
        }
    }
    
    // Update county styles based on assignments
    function updateCountyStyles() {
        if (!countyLayer) return;
        
        // Reset all counties to default style
        countyLayer.eachLayer(function(layer) {
            layer.setStyle({
                fillColor: '#f8f9fa',
                fillOpacity: 0.7
            });
        });
        
        // Apply group colors
        for (const [groupName, counties] of Object.entries(assignments)) {
            const color = getColorForGroup(groupName);
            
            countyLayer.eachLayer(function(layer) {
                const county = layer.feature;
                const countyId = county.properties.GEOID || county.properties.FIPS || county.properties.NAME;
                
                if (counties.includes(countyId)) {
                    layer.setStyle({
                        fillColor: color,
                        fillOpacity: 0.7
                    });
                }
            });
        }
    }
    
    // Export data to Excel
    exportDataBtn.addEventListener('click', function() {
        if (!countyData || Object.keys(assignments).length === 0) {
            showStatus('No assignments to export', 'error');
            return;
        }
        
        // Prepare data for export
        const exportData = [];
        
        // Create a map of county IDs to names for display
        const countyIdToName = {};
        countyLayer.eachLayer(function(layer) {
            const county = layer.feature;
            const countyId = county.properties.GEOID || county.properties.FIPS || county.properties.NAME;
            countyIdToName[countyId] = county.properties.NAME || countyId;
        });
        
        // Create rows for each assignment
        for (const [groupName, counties] of Object.entries(assignments)) {
            counties.forEach(countyId => {
                exportData.push({
                    'Group Name': groupName,
                    'County ID': countyId,
                    'County Name': countyIdToName[countyId] || countyId
                });
            });
        }
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'County Assignments');
        
        // Export to file
        XLSX.writeFile(wb, 'county_assignments.xlsx');
    });
    
    // Import data from Excel
    importButton.addEventListener('click', function() {
        importDataInput.click();
    });
    
    importDataInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                // Reset assignments
                assignments = {};
                
                // Process imported data
                jsonData.forEach(row => {
                    const groupName = row['Group Name'];
                    const countyId = row['County ID'];
                    
                    if (groupName && countyId) {
                        if (!assignments[groupName]) {
                            assignments[groupName] = [];
                        }
                        
                        if (!assignments[groupName].includes(countyId)) {
                            assignments[groupName].push(countyId);
                        }
                    }
                });
                
                // Update display
                updateCountyStyles();
                updateAssignmentsTable();
                showStatus('Assignments imported successfully!', 'success');
            } catch (error) {
                showStatus('Error importing Excel file: ' + error.message, 'error');
                console.error(error);
            }
        };
        reader.readAsArrayBuffer(file);
    });
    
    // Clear all assignments
    clearAllBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all assignments?')) {
            assignments = {};
            updateCountyStyles();
            updateAssignmentsTable();
            showStatus('All assignments cleared', 'info');
        }
    });
    
    // Show status message
    function showStatus(message, type) {
        geojsonStatus.innerHTML = `<div class="status-message ${type}">${message}</div>`;
    }
    
    // Load Turf.js dynamically (for spatial operations)
    function loadTurf() {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js';
        document.head.appendChild(script);
    }
    
    loadTurf();
});
