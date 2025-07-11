// State management with enhanced county-state tracking
const state = {
    selectedCounties: [], // Array of { countyFeature, stateName }
    groups: {}, // { groupId: { name, counties: [{ countyFeature, stateName }] } }
    currentGroupId: null,
    countyStateMap: {} // Maps county IDs to state names
};

// Helper functions for state identification
function isStateAbbreviation(abbr) {
    return !!getStateNameFromAbbreviation(abbr);
}

function isStateName(name) {
    return !!getStateAbbreviationFromName(name);
}

function getStateNameFromAbbreviation(abbr) {
    const states = {
        'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 
        'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 
        'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 
        'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas', 
        'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 
        'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 
        'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 
        'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York', 
        'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 
        'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina', 
        'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 
        'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 
        'WI': 'Wisconsin', 'WY': 'Wyoming'
    };
    return states[abbr.toUpperCase()] || null;
}

function getStateAbbreviationFromName(name) {
    const states = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 
        'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 
        'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 
        'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 
        'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD', 
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 
        'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 
        'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 
        'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 
        'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 
        'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 
        'wisconsin': 'WI', 'wyoming': 'WY'
    };
    return states[name.toLowerCase()] || null;
}

function getStateNameFromCode(code) {
    const fipsCodes = {
        '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
        '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
        '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
        '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
        '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
        '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
        '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
        '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
        '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
        '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
        '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
        '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
        '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
    };
    return fipsCodes[code] || null;
}

// Build a map of county IDs to state names
function buildCountyStateMap(geojson) {
    state.countyStateMap = {};
    
    geojson.features.forEach(feature => {
        const countyId = getCountyId(feature);
        const stateName = extractStateName(feature);
        
        if (stateName) {
            state.countyStateMap[countyId] = stateName;
        } else {
            console.warn('Could not determine state for county:', feature.properties);
        }
    });
}

// Enhanced state name extraction from DBF properties
function extractStateName(feature) {
    const props = feature.properties;
    
    // Try common state name property keys
    const possibleKeys = [
        'STATEFP', 'STATE', 'STATENS', 'STUSPS', 'STATE_NAME', 
        'STATENAME', 'STNAME', 'STATEABBR', 'STABBR'
    ];
    
    for (const key of possibleKeys) {
        if (props[key]) {
            // If it's a state code, try to map to name
            if (key === 'STATEFP' || key === 'STATE') {
                return getStateNameFromCode(props[key]) || props[key];
            }
            return props[key];
        }
    }
    
    // If no direct state property, try to find it in other fields
    for (const key in props) {
        const value = props[key];
        if (typeof value === 'string' && value.length === 2 && isStateAbbreviation(value)) {
            return getStateNameFromAbbreviation(value);
        }
        if (typeof value === 'string' && isStateName(value)) {
            return value;
        }
    }
    
    return null;
}

function getCountyId(feature) {
    // Create unique ID from county name and state code if available
    const name = feature.properties.NAME || feature.properties.name || 'unknown';
    const stateCode = feature.properties.STATEFP || feature.properties.STATE || '00';
    return `${name}-${stateCode}`.toLowerCase();
}

export { state, buildCountyStateMap, extractStateName, getCountyId };
