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

        showLoading('Processing file...');
        const progress = createProgressBar();

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const rawData = JSON.parse(e.target.result);
                updateProgress(progress, 30, "Parsing JSON...");
                
                // Convert to GeoJSON
                setTimeout(() => {
                    try {
                        countyGeoJSON = convertToGeoJSON(rawData);
                        updateProgress(progress, 100, "Conversion complete!");
                        setTimeout(() => {
                            hideLoading();
                            checkReadyState();
                        }, 500);
                    } catch (convertError) {
                        updateProgress(progress, 100, "Conversion failed");
                        setTimeout(() => {
                            hideLoading();
                            alert(`Conversion error: ${convertError.message}\n\nPlease ensure you upload a valid shapefile-converted JSON.`);
                        }, 500);
                    }
                }, 300);
            } catch (parseError) {
                hideLoading();
                alert(`Error parsing file: ${parseError.message}\n\nThe file must be valid JSON.`);
            }
        };
        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 30);
                updateProgress(progress, percent, "Uploading...");
            }
        };
        reader.readAsText(file);
    });

    function convertToGeoJSON(data) {
        // Case 1: Already proper GeoJSON
        if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
            return data;
        }
        
        // Case 2: Mapshaper output format
        if (data.objects) {
            const features = [];
            let featureCount = 0;
            
            // Process each object layer
            for (const [layerName, layerData] of Object.entries(data.objects)) {
                if (layerData.geometries) {
                    featureCount += layerData.geometries.length;
                    layerData.geometries.forEach(geom => {
                        features.push({
                            type: "Feature",
                            properties: geom.properties || {},
                            geometry: geom
                        });
                    });
                }
            }
            
            if (features.length > 0) {
                return {
                    type: "FeatureCollection",
                    features: features
                };
            }
        }
        
        // Case 3: Try to handle other common formats
        if (Array.isArray(data)) {
            return {
                type: "FeatureCollection",
                features: data.map(item => ({
                    type: "Feature",
                    properties: item.properties || {},
                    geometry: item.geometry || item
                }))
            };
        }
        
        throw new Error("Unsupported JSON format. Could not convert to GeoJSON.");
    }

    // Progress bar functions
    function createProgressBar() {
        const spinner = document.getElementById('loading-spinner');
        if (!spinner) return null;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.innerHTML = `
            <div class="progress-container">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-text">0%</div>
            <div class="progress-message">Starting...</div>
        `;
        spinner.appendChild(progressBar);
        return progressBar;
    }

    function updateProgress(progressBar, percent, message) {
        if (!progressBar) return;
        
        const fill = progressBar.querySelector('.progress-fill');
        const text = progressBar.querySelector('.progress-text');
        const msg = progressBar.querySelector('.progress-message');
        
        fill.style.width = `${percent}%`;
        text.textContent = `${percent}%`;
        msg.textContent = message;
    }
    
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