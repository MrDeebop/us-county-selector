import { state } from './state.js';

// Export groups to Excel
function exportToExcel() {
    if (Object.keys(state.groups).length === 0) {
        showMessage('No groups to export', 'error', document.getElementById('export-message'));
        return;
    }
    
    try {
        // Prepare data
        const data = [];
        
        // Add headers
        data.push(['Group Name', 'County Name', 'State']);
        
        // Add group data
        Object.values(state.groups).forEach(group => {
            group.counties.forEach(item => {
                const name = item.countyFeature.properties.NAME || 
                             item.countyFeature.properties.name || 
                             'Unknown County';
                const stateName = item.stateName || 'Unknown State';
                data.push([group.name, name, stateName]);
            });
        });
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'County Groups');
        
        // Export
        XLSX.writeFile(wb, 'county_groups.xlsx');
        showMessage('Excel file exported successfully with state data', 'success', document.getElementById('export-message'));
    } catch (error) {
        showMessage(`Export failed: ${error.message}`, 'error', document.getElementById('export-message'));
        console.error(error);
    }
}

// UI helper function
function showMessage(text, type, element) {
    element.textContent = text;
    element.className = type;
    if (type === 'error') console.error(text);
}

// Setup event listener for export
function setupExport() {
    document.getElementById('export-excel').addEventListener('click', exportToExcel);
}

export { setupExport };
