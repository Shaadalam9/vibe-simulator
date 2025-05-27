import * as THREE from 'three';

function createBuildingGeometry(buildings, textures) {
    const buildingGroup = new THREE.Group();
    const buildingMaterial = new THREE.MeshStandardMaterial({
        map: textures.building,
        roughness: 0.7,
        metalness: 0.1
    });

    buildings.forEach(building => {
        const coordinates = building.geometry.coordinates[0];
        const shape = new THREE.Shape();
        
        // Create shape from coordinates
        coordinates.forEach((coord, index) => {
            if (index === 0) {
                shape.moveTo(coord[0], coord[1]);
            } else {
                shape.lineTo(coord[0], coord[1]);
            }
        });

        // Get building height from OSM tags or use default
        const levels = building.properties['building:levels'] || 2;
        const height = levels * 3; // Assuming 3 meters per floor

        // Create building geometry
        const extrudeSettings = {
            steps: 1,
            depth: height,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mesh = new THREE.Mesh(geometry, buildingMaterial);
        
        // Enable shadows
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Rotate to match Three.js coordinate system
        mesh.rotation.x = -Math.PI / 2;
        
        // Scale coordinates to match Three.js units (1 unit = 1 meter)
        mesh.scale.set(1, 1, 1);

        buildingGroup.add(mesh);
    });

    return buildingGroup;
}

export { createBuildingGeometry }; 