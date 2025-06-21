// Global variables to hold our data
let countyGeoJSON = null;
let countyAssignments = {};

document.addEventListener('DOMContentLoaded', function() {
    const geojsonUpload = document.getElementById('geojson-upload');
    const csvUpload = document.getElementById('csv-upload');
    const startButton = document.getElementById('start-app');
    
    // Handle GeoJSON upload
    geojsonUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        showLoading('Processing GeoJSON...');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                countyGeoJSON = JSON.parse(e.target.result);
                checkReadyState();
            } catch (error) {
                hideLoading();
                alert('Error parsing GeoJSON: ' + error.message);
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