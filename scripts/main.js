// Main Application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    const app = {
        map: null,
        countyLayer: null,
        drawnItems: new L.FeatureGroup(),
        countyAssignments: {},
        currentSelection: [],
        
        init: function() {
            this.initMap();
            this.initControls();
            this.loadCountyData();
            this.loadAssignments();
        },
        
        initMap: function() {
            // Create map centered on continental US
            this.map = L.map('map').setView([39.8283, -98.5795], 4);
            
            // Add base tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);
            
            // Add drawn items layer
            this.drawnItems.addTo(this.map);
        },
        
        initControls: function() {
            // Draw button
            document.getElementById('draw-btn').addEventListener('click', () => {
                this.toggleDrawMode();
            });
            
            // Clear button
            document.getElementById('clear-btn').addEventListener('click', () => {
                this.clearSelection();
            });
            
            // Assign button
            document.getElementById('assign-btn').addEventListener('click', () => {
                this.assignCounties();
            });
            
            // Export button
            document.getElementById('export-btn').addEventListener('click', () => {
                this.exportData();
            });
            
            // Handle drawing events
            this.map.on(L.Draw.Event.CREATED, (e) => {
                const layer = e.layer;
                this.drawnItems.addLayer(layer);
                this.findIntersectingCounties(layer.toGeoJSON());
            });
        },
        
        toggleDrawMode: function() {
            const drawBtn = document.getElementById('draw-btn');
            if (this.drawControl) {
                this.map.removeControl(this.drawControl);
                this.drawControl = null;
                drawBtn.classList.remove('active');
            } else {
                this.drawControl = new L.Control.Draw({
                    draw: {
                        polygon: {
                            shapeOptions: { color: '#3388ff' },
                            allowIntersection: false,
                            showArea: true
                        },
                        polyline: false,
                        rectangle: false,
                        circle: false,
                        circlemarker: false,
                        marker: false
                    },
                    edit: false
                });
                this.map.addControl(this.drawControl);
                drawBtn.classList.add('active');
                
                // Disable draw control when drawing is done
                this.map.on(L.Draw.Event.DRAWSTOP, () => {
                    this.map.removeControl(this.drawControl);
                    this.drawControl = null;
                    drawBtn.classList.remove('active');
                });
            }
        },
        
        loadCountyData: function() {
            fetch('scripts/data/counties.geojson')
                .then(response => response.json())
                .then(data => {
                    this.countyLayer = L.geoJSON(data, {
                        style: this.getCountyStyle.bind(this),
                        onEachFeature: (feature, layer) => {
                            layer.on({
                                click: this.highlightCounty.bind(this)
                            });
                        }
                    }).addTo(this.map);
                })
                .catch(error => {
                    console.error('Error loading county data:', error);
                    alert('Failed to load county data. Please check console for details.');
                });
        },
        
        getCountyStyle: function(feature) {
            const countyId = feature.properties.GEOID;
            const assignedGroup = this.countyAssignments[countyId];
            
            return {
                fillColor: assignedGroup ? this.stringToColor(assignedGroup) : '#f8f9fa',
                weight: 0.5,
                opacity: 1,
                color: '#6c757d',
                fillOpacity: 0.7
            };
        },
        
        stringToColor: function(str) {
            // Simple hash function to generate consistent colors from strings
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            
            const h = hash % 360;
            return `hsl(${h}, 70%, 60%)`;
        },
        
        highlightCounty: function(e) {
            const layer = e.target;
            layer.setStyle({
                weight: 2,
                color: '#ff0000',
                fillOpacity: 0.7
            });
            
            layer.bringToFront();
            
            // Reset style after delay
            setTimeout(() => {
                this.countyLayer.resetStyle(layer);
            }, 1000);
        },
        
        findIntersectingCounties: function(drawnPolygon) {
            fetch('scripts/data/counties.geojson')
                .then(response => response.json())
                .then(data => {
                    this.currentSelection = [];
                    
                    data.features.forEach(county => {
                        const countyPolygon = turf.polygon(county.geometry.coordinates);
                        const intersection = turf.intersect(drawnPolygon, countyPolygon);
                        
                        if (intersection) {
                            this.currentSelection.push({
                                id: county.properties.GEOID,
                                name: county.properties.NAME,
                                state: county.properties.STATE_NAME
                            });
                        }
                    });
                    
                    this.displaySelection();
                });
        },
        
        displaySelection: function() {
            const listContainer = document.getElementById('county-list');
            const statsContainer = document.getElementById('selection-stats');
            
            // Clear previous results
            listContainer.innerHTML = '';
            
            if (this.currentSelection.length === 0) {
                listContainer.innerHTML = '<p class="no-results">No counties selected</p>';
                statsContainer.textContent = '';
                return;
            }
            
            // Add each county to the list
            this.currentSelection.forEach(county => {
                const countyElement = document.createElement('div');
                countyElement.className = 'county-item';
                
                const assignedGroup = this.countyAssignments[county.id] || 'Unassigned';
                
                countyElement.innerHTML = `
                    <span class="county-name">${county.name}, ${county.state}</span>
                    <span class="county-group">${assignedGroup}</span>
                `;
                
                listContainer.appendChild(countyElement);
            });
            
            // Update stats
            statsContainer.textContent = `Selected ${this.currentSelection.length} counties`;
        },
        
        assignCounties: function() {
            const groupName = document.getElementById('group-name').value.trim();
            
            if (!groupName) {
                alert('Please enter a group name');
                return;
            }
            
            if (this.currentSelection.length === 0) {
                alert('No counties selected to assign');
                return;
            }
            
            // Assign each county in current selection
            this.currentSelection.forEach(county => {
                this.countyAssignments[county.id] = groupName;
            });
            
            // Update the map display
            this.updateCountyStyles();
            
            // Save to localStorage
            this.saveAssignments();
            
            // Refresh the display
            this.displaySelection();
            
            // Clear the input
            document.getElementById('group-name').value = '';
        },
        
        clearSelection: function() {
            this.currentSelection = [];
            this.drawnItems.clearLayers();
            this.displaySelection();
        },
        
        updateCountyStyles: function() {
            this.countyLayer.eachLayer(layer => {
                const countyId = layer.feature.properties.GEOID;
                const assignedGroup = this.countyAssignments[countyId];
                
                layer.setStyle({
                    fillColor: assignedGroup ? this.stringToColor(assignedGroup) : '#f8f9fa'
                });
            });
        },
        
        loadAssignments: function() {
            const saved = localStorage.getItem('countyAssignments');
            if (saved) {
                this.countyAssignments = JSON.parse(saved);
                this.updateCountyStyles();
            }
        },
        
        saveAssignments: function() {
            localStorage.setItem('countyAssignments', JSON.stringify(this.countyAssignments));
        },
        
        exportData: function() {
            // Prepare data for export
            const exportData = [];
            
            // Get all counties from the layer
            this.countyLayer.eachLayer(layer => {
                const feature = layer.feature;
                exportData.push({
                    CountyID: feature.properties.GEOID,
                    CountyName: feature.properties.NAME,
                    State: feature.properties.STATE_NAME,
                    Group: this.countyAssignments[feature.properties.GEOID] || ''
                });
            });
            
            // Create worksheet
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            
            // Create workbook
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "County Assignments");
            
            // Export to file
            XLSX.writeFile(workbook, "county_assignments.xlsx");
        }
    };
    
    // Start the application
    app.init();
});