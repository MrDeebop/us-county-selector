import { initMap } from './map.js';
import { setupFileHandling } from './fileHandling.js';
import { setupGroupHandling, renderGroups } from './groups.js';
import { setupExport } from './export.js';

// Initialize application
function initApp() {
    initMap();
    setupFileHandling();
    setupGroupHandling();
    setupExport();
    
    // Initialize UI
    document.getElementById('selected-counties').innerHTML = '<p>No counties selected</p>';
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
