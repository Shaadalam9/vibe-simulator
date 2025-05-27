import * as osmtogeojson from 'osmtogeojson';

// Leiden city center coordinates
const LEIDEN_BOUNDS = {
    minLat: 52.1550,
    maxLat: 52.1650,
    minLon: 4.4850,
    maxLon: 4.4950
};

async function fetchOSMData() {
    const overpassQuery = `
        [out:json][timeout:25];
        (
            // Fetch buildings
            way["building"](bbox:${LEIDEN_BOUNDS.minLat},${LEIDEN_BOUNDS.minLon},${LEIDEN_BOUNDS.maxLat},${LEIDEN_BOUNDS.maxLon});
            >;
            // Fetch roads
            way["highway"](bbox:${LEIDEN_BOUNDS.minLat},${LEIDEN_BOUNDS.minLon},${LEIDEN_BOUNDS.maxLat},${LEIDEN_BOUNDS.maxLon});
            >;
            // Fetch nodes for the ways
            node(bbox:${LEIDEN_BOUNDS.minLat},${LEIDEN_BOUNDS.minLon},${LEIDEN_BOUNDS.maxLat},${LEIDEN_BOUNDS.maxLon});
        );
        out body;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: overpassQuery
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const osmData = await response.json();
        const geojsonData = osmtogeojson(osmData);

        // Separate buildings and roads
        const buildings = geojsonData.features.filter(feature => 
            feature.properties.building && feature.geometry.type === 'Polygon'
        );

        const roads = geojsonData.features.filter(feature => 
            feature.properties.highway && 
            ['LineString', 'Polygon'].includes(feature.geometry.type)
        );

        return {
            buildings,
            roads,
            nodes: osmData.elements.filter(element => element.type === 'node')
        };
    } catch (error) {
        console.error('Error fetching OSM data:', error);
        throw error;
    }
}

export { fetchOSMData }; 