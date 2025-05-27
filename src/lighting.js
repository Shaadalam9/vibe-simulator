import * as THREE from 'three';

function setupLighting(scene) {
    // Ambient light for overall scene illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(100, 100, 50);
    sunLight.castShadow = true;
    
    // Configure shadow properties
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    
    scene.add(sunLight);

    // Add some point lights for street lighting effect
    const streetLightPositions = [
        { x: 0, y: 5, z: 0 },
        { x: 20, y: 5, z: 20 },
        { x: -20, y: 5, z: -20 },
        { x: 20, y: 5, z: -20 },
        { x: -20, y: 5, z: 20 }
    ];

    streetLightPositions.forEach(pos => {
        const streetLight = new THREE.PointLight(0xffffee, 0.5, 20);
        streetLight.position.set(pos.x, pos.y, pos.z);
        streetLight.castShadow = true;
        scene.add(streetLight);

        // Add a visible light bulb
        const bulbGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffee });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.copy(streetLight.position);
        scene.add(bulb);
    });
}

export { setupLighting }; 