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
    
    // Initialize map with better default view
    function initMap() {
        map = L.map('map').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Initialize the draw control
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
        
        map.on(L.Draw.Event.CREATED, function(e) {
            if (!isDrawing) return;
            
            const layer = e.layer;
            drawnItems.addLayer(layer);
            findCountiesInPolygon(layer);
        });
    }
    
    initMap();
    
    // Handle GeoJSON upload with progress
    geojsonUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        showStatus('Loading GeoJSON (0%)...', 'info');
        
        // Read with progress tracking
        const reader = new FileReader();
        let lastProgress = 0;
        
        reader.onprogress = function(e) {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                // Only update if progress changed significantly
                if (percent >= lastProgress + 5 || percent === 100) {
                    showStatus(`Loading GeoJSON (${percent}%)...`, 'info');
                    lastProgress = percent;
                }
            }
        };
        
        reader.onload = function(e) {
            try {
                // Parse the GeoJSON
                countyData = JSON.parse(e.target.result);
                
                // Clear previous data
                if (countyLayer) {
                    map.removeLayer(countyLayer);
                }
                
                showStatus('Rendering counties...', 'info');
                
                // Process GeoJSON in chunks to avoid blocking UI
                setTimeout(() => {
                    try {
                        countyLayer = L.geoJSON(countyData, {
                            style: getDefaultCountyStyle,
                            onEachFeature: onEachCountyFeature
                        }).addTo(map);
                        
                        // Fit map to the counties
                        map.fitBounds(countyLayer.getBounds());
                        
                        showStatus('GeoJSON loaded successfully!', 'success');
                        assignmentSection.style.display = 'block';
                        assignments = {};
                        updateAssignmentsTable();
                    } catch (renderError) {
                        showStatus('Error rendering GeoJSON: ' + renderError.message, 'error');
                        console.error(renderError);
                    }
                }, 100);
            } catch (parseError) {
                showStatus('Error parsing GeoJSON: ' + parseError.message, 'error');
                console.error(parseError);
            }
        };
        
        reader.onerror = function() {
            showStatus('Error reading file', 'error');
        };
        
        reader.readAsText(file);
    });
    
    // Default county style
    function getDefaultCountyStyle(feature) {
        return {
            fillColor: '#f8f9fa',
            weight: 1,
            opacity: 1,
            color: '#6c757d',
            fillOpacity: 0.7
        };
    }
    
    // Style for assigned counties
    function getAssignedCountyStyle(groupName) {
        return {
            fillColor: getColorForGroup(groupName),
            weight: 1,
            opacity: 1,
            color: '#6c757d',
            fillOpacity: 0.7
        };
    }
    
    // Process each county feature
    function onEachCountyFeature(feature, layer) {
        // Store the original feature
        layer.feature = feature;
        
        // Show county name on hover
        const countyName = feature.properties?.NAME || 
                          feature.properties?.name || 
                          feature.properties?.NAMELSAD || 
                          'Unnamed County';
        layer.bindTooltip(countyName);
        
        // Check if this county is already assigned
        for (const [groupName, counties] of Object.entries(assignments)) {
            const countyId = getCountyId(feature);
            if (counties.includes(countyId)) {
                layer.setStyle(getAssignedCountyStyle(groupName));
                break;
            }
        }
    }
    
    // Get unique ID for a county
    function getCountyId(feature) {
        return feature.properties.GEOID || 
               feature.properties.FIPS || 
               feature.properties.NAME || 
               JSON.stringify(feature.geometry.coordinates);
    }
    
    // Start drawing mode
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
        
        map.addControl(drawControl);
        startDrawingBtn.disabled = true;
        endDrawingBtn.disabled = false;
        groupNameInput.disabled = true;
        
        showStatus(`Drawing mode active for group "${groupName}". Draw a polygon around counties to assign.`, 'info');
    });
    
    // End drawing mode
    endDrawingBtn.addEventListener('click', function() {
        isDrawing = false;
        map.removeControl(drawControl);
        drawnItems.clearLayers();
        
        startDrawingBtn.disabled = false;
        endDrawingBtn.disabled = true;
        groupNameInput.disabled = false;
        groupNameInput.value = '';
        
        showStatus(`Finished assigning counties to "${currentGroupName}"`, 'success');
        updateAssignmentsTable();
    });
    
    // Find counties within a polygon
    function findCountiesInPolygon(polygonLayer) {
        if (!countyLayer || !currentGroupName) return;
        
        // Initialize group if it doesn't exist
        if (!assignments[currentGroupName]) {
            assignments[currentGroupName] = [];
        }
        
        // Get the polygon geometry
        const polygon = polygonLayer.toGeoJSON();
        
        // Check each county
        countyLayer.eachLayer(function(countyLayer) {
            const county = countyLayer.feature;
            const countyId = getCountyId(county);
            
            // Skip if already assigned to this group
            if (assignments[currentGroupName].includes(countyId)) return;
            
            // Check if county is inside polygon
            if (window.turf && window.turf.booleanPointInPolygon) {
                try {
                    const countyCenter = window.turf.centerOfMass(county);
                    if (window.turf.booleanPointInPolygon(countyCenter, polygon)) {
                        assignments[currentGroupName].push(countyId);
                        countyLayer.setStyle(getAssignedCountyStyle(currentGroupName));
                    }
                } catch (turfError) {
                    console.error('Turf.js error:', turfError);
                }
            } else {
                // Fallback simple bounding box check if Turf.js isn't loaded
                const countyBounds = countyLayer.getBounds();
                const polygonBounds = polygonLayer.getBounds();
                
                if (polygonBounds.contains(countyBounds.getCenter())) {
                    assignments[currentGroupName].push(countyId);
                    countyLayer.setStyle(getAssignedCountyStyle(currentGroupName));
                }
            }
        });
    }
    
    // Update the assignments table
    function updateAssignmentsTable() {
        assignmentsBody.innerHTML = '';
        
        for (const [groupName, counties] of Object.entries(assignments)) {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${groupName}</td>
                <td>${counties.length}</td>
                <td><button class="danger">Delete</button></td>
            `;
            
            row.querySelector('button').addEventListener('click', function() {
                delete assignments[groupName];
                updateCountyStyles();
                updateAssignmentsTable();
            });
            
            assignmentsBody.appendChild(row);
        }
    }
    
    // Update all county styles
    function updateCountyStyles() {
        if (!countyLayer) return;
        
        countyLayer.eachLayer(function(layer) {
            let isAssigned = false;
            const countyId = getCountyId(layer.feature);
            
            // Check all assignments
            for (const [groupName, counties] of Object.entries(assignments)) {
                if (counties.includes(countyId)) {
                    layer.setStyle(getAssignedCountyStyle(groupName));
                    isAssigned = true;
                    break;
                }
            }
            
            if (!isAssigned) {
                layer.setStyle(getDefaultCountyStyle());
            }
        });
    }
    
    // Export data to Excel
    exportDataBtn.addEventListener('click', exportAssignments);
    
    function exportAssignments() {
        if (!countyData || Object.keys(assignments).length === 0) {
            showStatus('No assignments to export', 'error');
            return;
        }
        
        // Prepare data
        const exportData = [];
        const countyIdToName = {};
        
        // Create county name mapping
        countyLayer.eachLayer(function(layer) {
            const county = layer.feature;
            countyIdToName[getCountyId(county)] = 
                county.properties?.NAME || 
                county.properties?.name || 
                county.properties?.NAMELSAD || 
                getCountyId(county);
        });
        
        // Create export rows
        for (const [groupName, counties] of Object.entries(assignments)) {
            counties.forEach(countyId => {
                exportData.push({
                    'Group Name': groupName,
                    'County ID': countyId,
                    'County Name': countyIdToName[countyId] || countyId
                });
            });
        }
        
        // Create and download Excel file
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'County Assignments');
        XLSX.writeFile(wb, 'county_assignments.xlsx');
    }
    
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
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                assignments = {};
                
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
    
    // Generate consistent color for a group
    function getColorForGroup(groupName) {
        let hash = 0;
        for (let i = 0; i < groupName.length; i++) {
            hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }
    
    // Load Turf.js dynamically if not already loaded
    if (!window.turf) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js';
        document.head.appendChild(script);
    }
});
