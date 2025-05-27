import * as THREE from 'three';

function createRoadGeometry(roads, textures) {
    const roadGroup = new THREE.Group();
    const roadMaterial = new THREE.MeshStandardMaterial({
        map: textures.road,
        roughness: 0.9,
        metalness: 0.1
    });

    const sidewalkMaterial = new THREE.MeshStandardMaterial({
        map: textures.sidewalk,
        roughness: 0.8,
        metalness: 0.1
    });

    roads.forEach(road => {
        const coordinates = road.geometry.coordinates;
        const points = coordinates.map(coord => new THREE.Vector3(coord[0], 0, coord[1]));
        
        // Create road geometry
        const roadWidth = getRoadWidth(road.properties.highway);
        const roadShape = new THREE.Shape();
        
        // Create road shape
        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            
            // Calculate perpendicular vector for road width
            const direction = new THREE.Vector3().subVectors(next, current).normalize();
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
            
            // Create road segment
            const halfWidth = roadWidth / 2;
            const p1 = new THREE.Vector3().addVectors(current, perpendicular.multiplyScalar(halfWidth));
            const p2 = new THREE.Vector3().addVectors(current, perpendicular.multiplyScalar(-halfWidth));
            const p3 = new THREE.Vector3().addVectors(next, perpendicular.multiplyScalar(-halfWidth));
            const p4 = new THREE.Vector3().addVectors(next, perpendicular.multiplyScalar(halfWidth));
            
            if (i === 0) {
                roadShape.moveTo(p1.x, p1.z);
            }
            roadShape.lineTo(p2.x, p2.z);
            roadShape.lineTo(p3.x, p3.z);
            roadShape.lineTo(p4.x, p4.z);
        }

        // Create road mesh
        const roadGeometry = new THREE.ShapeGeometry(roadShape);
        const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
        roadMesh.rotation.x = -Math.PI / 2;
        roadMesh.receiveShadow = true;
        roadGroup.add(roadMesh);

        // Add sidewalks if it's a major road
        if (isMajorRoad(road.properties.highway)) {
            const sidewalkWidth = 2;
            const sidewalkShape = new THREE.Shape();
            
            // Create sidewalk shape (similar to road but wider)
            for (let i = 0; i < points.length - 1; i++) {
                const current = points[i];
                const next = points[i + 1];
                const direction = new THREE.Vector3().subVectors(next, current).normalize();
                const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
                
                const halfWidth = (roadWidth / 2) + sidewalkWidth;
                const p1 = new THREE.Vector3().addVectors(current, perpendicular.multiplyScalar(halfWidth));
                const p2 = new THREE.Vector3().addVectors(current, perpendicular.multiplyScalar(-halfWidth));
                const p3 = new THREE.Vector3().addVectors(next, perpendicular.multiplyScalar(-halfWidth));
                const p4 = new THREE.Vector3().addVectors(next, perpendicular.multiplyScalar(halfWidth));
                
                if (i === 0) {
                    sidewalkShape.moveTo(p1.x, p1.z);
                }
                sidewalkShape.lineTo(p2.x, p2.z);
                sidewalkShape.lineTo(p3.x, p3.z);
                sidewalkShape.lineTo(p4.x, p4.z);
            }

            const sidewalkGeometry = new THREE.ShapeGeometry(sidewalkShape);
            const sidewalkMesh = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
            sidewalkMesh.rotation.x = -Math.PI / 2;
            sidewalkMesh.position.y = 0.1; // Slightly above road
            sidewalkMesh.receiveShadow = true;
            roadGroup.add(sidewalkMesh);
        }
    });

    return roadGroup;
}

function getRoadWidth(highwayType) {
    const widths = {
        'motorway': 12,
        'trunk': 10,
        'primary': 8,
        'secondary': 7,
        'tertiary': 6,
        'residential': 5,
        'unclassified': 4,
        'service': 3
    };
    return widths[highwayType] || 4;
}

function isMajorRoad(highwayType) {
    return ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(highwayType);
}

export { createRoadGeometry }; 