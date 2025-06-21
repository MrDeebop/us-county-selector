// Global variables to hold our data
let countyGeoJSON = null;
let countyAssignments = {};

document.addEventListener('DOMContentLoaded', function() {
    const geojsonUpload = document.getElementById('geojson-upload');
    const csvUpload = document.getElementById('csv-upload');
    const startButton = document.getElementById('start-app');
    
    // Handle GeoJSON upload
    // Replace the existing GeoJSON upload handler with this:
    geojsonUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoading('Processing GeoJSON...');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                // Handle both GeoJSON and mapshaper's JSON output
                if (data.type === "FeatureCollection") {
                    // Standard GeoJSON
                    countyGeoJSON = data;
                } else if (data.objects && Object.values(data.objects)[0]) {
                    // Mapshaper output - convert to GeoJSON
                    const topLevelKey = Object.keys(data.objects)[0];
                    const converted = {
                        type: "FeatureCollection",
                        features: data.objects[topLevelKey].geometries.map(geom => ({
                            type: "Feature",
                            properties: geom.properties || {},
                            geometry: geom
                        }))
                    };
                    countyGeoJSON = converted;
                } else {
                    throw new Error("Unsupported JSON format");
                }
                
                checkReadyState();
            } catch (error) {
                hideLoading();
                alert('Error parsing file: ' + error.message + '\n\nPlease ensure you upload a valid GeoJSON or mapshaper JSON file.');
            }
        };
        reader.readAsText(file);
    });
    
    // Handle CSV upload
    csvUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoading('Processing CSV...');
        
        Papa.parse(file, {
            header: true,
            complete: function(results) {
                countyAssignments = {};
                
                results.data.forEach(row => {
                    if (row.countyId && row.group) {
                        countyAssignments[row.countyId] = row.group;
                    }
                });
                
                hideLoading();
                checkReadyState();
            },
            error: function(error) {
                hideLoading();
                alert('Error parsing CSV: ' + error.message);
            }
        });
    });
    
    // Check if both files are processed
    function checkReadyState() {
        if (countyGeoJSON) {
            startButton.disabled = false;
        }
    }
    
    // Start the main application
    startButton.addEventListener('click', function() {
        document.getElementById('welcome-modal').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        
        // Initialize main app with our data
        if (window.app) {
            app.init(countyGeoJSON, countyAssignments);
        }
    });
});

function showLoading(message) {
    // Implement loading spinner display
    const spinner = document.getElementById('loading-spinner') || 
        document.querySelector('#loading-spinner template').content.cloneNode(true);
    document.body.appendChild(spinner);
}

function hideLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.remove();
}