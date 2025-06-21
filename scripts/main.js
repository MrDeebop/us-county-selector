// Main Application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    const app = {
        // ... (keep all other methods the same) ...
        
        // Modified init function to accept parameters
        init: function(geoJSON, assignments = {}) {
            this.countyGeoJSON = geoJSON;
            this.countyAssignments = assignments;
            
            this.initMap();
            this.initControls();
            this.loadCountyData(); // Now uses the passed GeoJSON
            this.loadAssignments(); // Now uses the passed assignments
        },
        
        // Modified loadCountyData to use local GeoJSON
        loadCountyData: function() {
            if (!this.countyGeoJSON) {
                console.error('No county data loaded');
                return;
            }
            
            this.countyLayer = L.geoJSON(this.countyGeoJSON, {
                style: this.getCountyStyle.bind(this),
                onEachFeature: (feature, layer) => {
                    layer.on({
                        click: this.highlightCounty.bind(this)
                    });
                }
            }).addTo(this.map);
            
            // Fit map to the counties
            this.map.fitBounds(this.countyLayer.getBounds());
        },
        
        // Modified export to use CSV
        exportData: function() {
            // Prepare data for export
            const exportData = [];
            
            this.countyLayer.eachLayer(layer => {
                const feature = layer.feature;
                exportData.push({
                    countyId: feature.properties.GEOID,
                    countyName: feature.properties.NAME,
                    state: feature.properties.STATE_NAME,
                    group: this.countyAssignments[feature.properties.GEOID] || ''
                });
            });
            
            // Convert to CSV
            const csv = Papa.unparse(exportData);
            
            // Create download link
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', 'county_assignments.csv');
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    
    // Make app globally available for data-upload.js
    window.app = app;
});