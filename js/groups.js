import { state, getCountyId } from './state.js';
import { updateSelectedCountiesDisplay, clearSelection } from './map.js';

// Create a new group
function createGroup() {
    const groupName = document.getElementById('group-name').value.trim();
    if (!groupName) {
        showMessage('Please enter a group name', 'error', document.getElementById('export-message'));
        return;
    }
    
    if (state.selectedCounties.length === 0) {
        showMessage('No counties selected to add to group', 'error', document.getElementById('export-message'));
        return;
    }
    
    const groupId = Date.now().toString();
    state.groups[groupId] = {
        name: groupName,
        counties: [...state.selectedCounties] // Copy the selected counties with their state data
    };
    
    renderGroups();
    clearSelection();
    document.getElementById('group-name').value = '';
    showMessage(`Group "${groupName}" created with ${state.selectedCounties.length} counties`, 'success', document.getElementById('export-message'));
}

// Render all groups
function renderGroups() {
    const container = document.getElementById('groups');
    container.innerHTML = '';
    
    Object.entries(state.groups).forEach(([groupId, group]) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'group-item';
        
        // Count unique states in this group
        const stateCount = new Set(group.counties.map(c => c.stateName)).size;
        
        groupEl.innerHTML = `
            <div>
                <strong>${group.name}</strong>
                <div>${group.counties.length} counties across ${stateCount} states</div>
            </div>
            <button data-group-id="${groupId}" class="delete-group">Delete</button>
        `;
        
        container.appendChild(groupEl);
        
        // Add delete button event
        groupEl.querySelector('.delete-group').addEventListener('click', (e) => {
            delete state.groups[e.target.dataset.groupId];
            renderGroups();
        });
    });
}

// Setup event listeners for group management
function setupGroupHandling() {
    document.getElementById('create-group').addEventListener('click', createGroup);
    document.getElementById('clear-selection').addEventListener('click', clearSelection);
}

export { renderGroups, setupGroupHandling };
