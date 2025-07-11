let map, drawnItems, countiesLayer;
let countyData = {};
let assignedCounties = {};
let currentName = "";

function initializeMap() {
  map = L.map('map').setView([37.8, -96], 4);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 10,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: {
      polygon: true,
      polyline: false,
      rectangle: false,
      circle: false,
      marker: false,
      circlemarker: false
    },
    edit: { featureGroup: drawnItems }
  });

  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, event => {
    const layer = event.layer;
    drawnItems.addLayer(layer);
    assignCounties(layer);
  });
}

function assignCounties(polygonLayer) {
  if (!currentName) {
    alert("Please enter a name before drawing.");
    return;
  }

  const polygon = polygonLayer.toGeoJSON();
  const turfPolygon = turf.polygon(polygon.geometry.coordinates);

  countiesLayer.eachLayer(layer => {
    const feature = layer.feature;
    const turfCounty = turf.polygon(feature.geometry.coordinates);

    if (turf.booleanIntersects(turfPolygon, turfCounty)) {
      const countyId = feature.properties.GEOID || feature.properties.id;
      assignedCounties[countyId] = currentName;
      layer.setStyle({ fillColor: 'orange' });
    }
  });
}

function loadGeoJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const geojson = JSON.parse(reader.result);

    if (countiesLayer) map.removeLayer(countiesLayer);

    countiesLayer = L.geoJSON(geojson, {
      style: {
        color: "#444",
        weight: 1,
        fillColor: "#ccc",
        fillOpacity: 0.6
      }
    }).addTo(map);
  };
  reader.readAsText(file);
}

function loadExcel(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const workbook = XLSX.read(reader.result, { type: 'binary' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    data.forEach(row => {
      assignedCounties[row.county_id] = row.name;
    });
  };
  reader.readAsBinaryString(file);
}

function exportExcel() {
  const rows = Object.entries(assignedCounties).map(([id, name]) => ({
    county_id: id,
    name: name
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Assignments");

  XLSX.writeFile(workbook, "county_assignments.xlsx");
}

document.getElementById('geojson-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) loadGeoJSON(file);
});

document.getElementById('excel-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) loadExcel(file);
});

document.getElementById('name-input').addEventListener('input', e => {
  currentName = e.target.value.trim();
});

document.getElementById('start-selection').addEventListener('click', () => {
  if (!currentName) {
    alert("Enter a name before selecting counties.");
    return;
  }
  document.getElementById('end-selection').disabled = false;
});

document.getElementById('end-selection').addEventListener('click', () => {
  drawnItems.clearLayers();
  document.getElementById('end-selection').disabled = true;
});

document.getElementById('export-excel').addEventListener('click', exportExcel);

initializeMap();
