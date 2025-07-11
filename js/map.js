import { state, getCountyId } from './state.js';

let map;
let geoJsonLayer = null;

// Initialize map
function initMap() {
    map = L.map('map').setView([39.8283, -98.5795], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

// Display GeoJSON on map
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
        document.getElementById('selected-counties').innerHTML = `<strong>Hovering:</strong> ${countyName}, ${stateName}`;
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

// County selection functions
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

function updateSelectedCountiesDisplay() {
    const container = document.getElementById('selected-counties');
    container.innerHTML = '';
    
    if (state.selectedCounties.length === 0) {
        container.innerHTML = '<p>No counties selected</p>';
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
        container.appendChild(countyEl);
    });
}

export { initMap, displayGeoJSON, clearSelection, updateSelectedCountiesDisplay };
