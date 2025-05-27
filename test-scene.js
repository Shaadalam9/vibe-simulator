import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import osmtogeojson from 'osmtogeojson';

// Scene dimensions
const groundSize = 400; // Size of the ground plane
const roadWidth = 15;
const blockSize = 60;

// Enhanced City Configuration
const CITY_CONFIG = {
    name: 'Amsterdam',
    center: { lat: 52.3676, lng: 4.9041 },
    radius: 1000,
    zoom: 18,
    // Google Maps 3D tiles configuration
    tiles: {
        baseUrl: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        buildingUrl: 'https://mt1.google.com/vt/lyrs=3d&x={x}&y={y}&z={z}',
        terrainUrl: 'https://mt1.google.com/vt/lyrs=t&x={x}&y={y}&z={z}'
    }
};

// OpenStreetMap Configuration
const OSM_CONFIG = {
    baseUrl: 'https://overpass-api.de/api/interpreter',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
};

// Texture Configuration
const TEXTURE_CONFIG = {
    // CC0 Textures from Polyhaven
    brick: {
        diffuse: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_wall_001/brick_wall_001_diff_1k.jpg',
        normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_wall_001/brick_wall_001_nor_1k.jpg',
        roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_wall_001/brick_wall_001_rough_1k.jpg'
    },
    roof: {
        diffuse: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/roof_tiles_01/roof_tiles_01_diff_1k.jpg',
        normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/roof_tiles_01/roof_tiles_01_nor_1k.jpg',
        roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/roof_tiles_01/roof_tiles_01_rough_1k.jpg'
    },
    window: {
        diffuse: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/glass_window_01/glass_window_01_diff_1k.jpg',
        normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/glass_window_01/glass_window_01_nor_1k.jpg',
        roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/glass_window_01/glass_window_01_rough_1k.jpg'
    },
    // OpenAerialMap for ground texture
    ground: {
        satellite: OSM_CONFIG.tileUrl
    }
};

// API Configuration
const API_CONFIG = {
    googleMaps: {
        apiKey: 'YOUR_GOOGLE_MAPS_API_KEY', // Replace with your API key
        staticUrl: 'https://maps.googleapis.com/maps/api/staticmap',
        streetViewUrl: 'https://maps.googleapis.com/maps/api/streetview'
    },
    mapbox: {
        accessToken: 'YOUR_MAPBOX_ACCESS_TOKEN', // Replace with your access token
        terrainUrl: 'https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw'
    },
    mapillary: {
        clientId: 'YOUR_MAPILLARY_CLIENT_ID', // Replace with your client ID
        apiUrl: 'https://graph.mapillary.com'
    }
};

// Leiden coordinates
const LEIDEN_CONFIG = {
    center: { lat: 52.165, lng: 4.475 },
    bbox: {
        minLat: 52.16,
        maxLat: 52.17,
        minLng: 4.47,
        maxLng: 4.48
    }
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Light blue sky

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(100, 100, 100);
camera.lookAt(0, 0, 0);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Controls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Lighting setup
// Ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Directional light (sun)
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 200, 100);
directionalLight.castShadow = true;

// Configure shadow properties
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// Ground plane
const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Create procedural materials as fallbacks
const proceduralMaterials = {
    brick: new THREE.MeshStandardMaterial({
        color: 0xE8D0AA,
        roughness: 0.7,
        metalness: 0.3,
        bumpScale: 0.1
    }),
    concrete: new THREE.MeshStandardMaterial({
        color: 0xCCCCCC,
        roughness: 0.8,
        metalness: 0.2
    }),
    glass: new THREE.MeshPhysicalMaterial({
        color: 0x88CCFF,
        roughness: 0.1,
        metalness: 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.7
    })
};

// Load building textures with fallbacks
const buildingTextures = {
    brick: {
        color: loadTextureWithFallback('/textures/brick_diff.jpg', proceduralMaterials.brick),
        normal: loadTextureWithFallback('/textures/brick_nor.jpg', proceduralMaterials.brick),
        roughness: loadTextureWithFallback('/textures/brick_rough.jpg', proceduralMaterials.brick),
        ao: loadTextureWithFallback('/textures/brick_ao.jpg', proceduralMaterials.brick)
    },
    concrete: {
        color: loadTextureWithFallback('/textures/concrete_diff.jpg', proceduralMaterials.concrete),
        normal: loadTextureWithFallback('/textures/concrete_nor.jpg', proceduralMaterials.concrete),
        roughness: loadTextureWithFallback('/textures/concrete_rough.jpg', proceduralMaterials.concrete),
        ao: loadTextureWithFallback('/textures/concrete_ao.jpg', proceduralMaterials.concrete)
    },
    glass: {
        color: loadTextureWithFallback('/textures/glass_diff.jpg', proceduralMaterials.glass),
        normal: loadTextureWithFallback('/textures/glass_nor.jpg', proceduralMaterials.glass),
        roughness: loadTextureWithFallback('/textures/glass_rough.jpg', proceduralMaterials.glass),
        ao: loadTextureWithFallback('/textures/glass_ao.jpg', proceduralMaterials.glass)
    }
};

// Helper function to load textures with fallback
function loadTextureWithFallback(path, fallbackMaterial) {
    const textureLoader = new THREE.TextureLoader();
    try {
        const texture = textureLoader.load(path);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    } catch (error) {
        console.warn(`Failed to load texture ${path}, using fallback material`);
        return null;
    }
}

// Load 3D models
const modelLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
modelLoader.setDRACOLoader(dracoLoader);

// Model paths
const MODELS = {
    tree: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SimpleSparseAccessor/glTF/SimpleSparseAccessor.gltf',
    lampPost: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SimpleMeshes/glTF/SimpleMeshes.gltf'
};

// Store loaded models
let treeModel = null;
let lampPostModel = null;

// Load models
Promise.all([
    new Promise((resolve) => {
        modelLoader.load(MODELS.tree, (gltf) => {
            treeModel = gltf.scene;
            resolve();
        });
    }),
    new Promise((resolve) => {
        modelLoader.load(MODELS.lampPost, (gltf) => {
            lampPostModel = gltf.scene;
            resolve();
        });
    })
]).then(() => {
    console.log('All models loaded');
});

// Fetch OpenStreetMap data
async function fetchLeidenData() {
    const query = `
        [out:json];
        (
            way["building"](${LEIDEN_CONFIG.bbox.minLat},${LEIDEN_CONFIG.bbox.minLng},${LEIDEN_CONFIG.bbox.maxLat},${LEIDEN_CONFIG.bbox.maxLng});
            way["highway"](${LEIDEN_CONFIG.bbox.minLat},${LEIDEN_CONFIG.bbox.minLng},${LEIDEN_CONFIG.bbox.maxLat},${LEIDEN_CONFIG.bbox.maxLng});
        );
        out body;
        >;
        out skel qt;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });
        const osmData = await response.json();
        const geojsonData = osmtogeojson(osmData);
        return geojsonData;
    } catch (error) {
        console.error('Error fetching Leiden data:', error);
        return null;
    }
}

// Convert coordinates to local space
function convertCoordinates(lat, lng) {
    const x = (lng - LEIDEN_CONFIG.center.lng) * 1000;
    const z = (lat - LEIDEN_CONFIG.center.lat) * 1000;
    return { x, z };
}

// Create buildings from GeoJSON
function createBuildings(geojsonData) {
    geojsonData.features.forEach(feature => {
        if (feature.properties.building) {
            const coordinates = feature.geometry.coordinates[0];
            const points = coordinates.map(coord => convertCoordinates(coord[1], coord[0]));
            
            // Get building height from OSM tags
            let height = 10; // Default height in meters
            if (feature.properties.height) {
                height = parseFloat(feature.properties.height);
            } else if (feature.properties['building:levels']) {
                height = parseFloat(feature.properties['building:levels']) * 3;
            }

            // Create shape for extrusion
            const shape = new THREE.Shape();
            points.forEach((point, index) => {
                if (index === 0) {
                    shape.moveTo(point.x, point.z);
                } else {
                    shape.lineTo(point.x, point.z);
                }
            });
            shape.closePath();

            // Create building geometry
            const buildingGeometry = new THREE.ExtrudeGeometry(shape, {
                steps: 1,
                depth: height,
                bevelEnabled: true,
                bevelThickness: 0.5,
                bevelSize: 0.5,
                bevelSegments: 1
            });

            // Determine building material based on OSM tags
            let materialType = 'brick'; // Default material
            if (feature.properties['building:material']) {
                const osmMaterial = feature.properties['building:material'].toLowerCase();
                if (osmMaterial.includes('concrete')) {
                    materialType = 'concrete';
                } else if (osmMaterial.includes('glass')) {
                    materialType = 'glass';
                }
            }

            // Create building material with textures or fallback
            const textures = buildingTextures[materialType];
            let buildingMaterial;
            
            if (textures.color && textures.normal && textures.roughness && textures.ao) {
                buildingMaterial = new THREE.MeshPhysicalMaterial({
                    map: textures.color,
                    normalMap: textures.normal,
                    roughnessMap: textures.roughness,
                    aoMap: textures.ao,
                    roughness: materialType === 'glass' ? 0.1 : 0.7,
                    metalness: materialType === 'glass' ? 0.9 : 0.2,
                    clearcoat: materialType === 'glass' ? 1.0 : 0.0,
                    clearcoatRoughness: materialType === 'glass' ? 0.1 : 0.5,
                    transparent: materialType === 'glass',
                    opacity: materialType === 'glass' ? 0.7 : 1.0
                });
            } else {
                buildingMaterial = proceduralMaterials[materialType].clone();
            }

            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.set(0, 0, 0);
            building.rotation.x = -Math.PI / 2;
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);

            // Add windows if not a glass building
            if (materialType !== 'glass') {
                addWindowsToBuilding(building, points, height);
            }
        }
    });
}

// Add windows to buildings
function addWindowsToBuilding(building, points, height) {
    // Calculate building bounds
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    points.forEach(point => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
    });

    const width = maxX - minX;
    const depth = maxZ - minZ;
    const perimeter = 2 * (width + depth);

    // Calculate number of windows based on building size
    const windowsPerFloor = Math.floor(perimeter / 4); // One window every 4 meters
    const floors = Math.floor(height / 3); // One floor every 3 meters

    // Load window texture
    const windowTexture = textureLoader.load('https://ambientcg.com/get/Glass_01_1K-JPG.zip/Glass_01_1K-JPG_Color.jpg');
    windowTexture.wrapS = windowTexture.wrapT = THREE.RepeatWrapping;
    windowTexture.repeat.set(1, 1);

    const windowMaterial = new THREE.MeshPhysicalMaterial({
        map: windowTexture,
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
        metalness: 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });

    const windowGeometry = new THREE.PlaneGeometry(1.5, 2);

    // Add windows around the building
    for (let floor = 0; floor < floors; floor++) {
        for (let i = 0; i < windowsPerFloor; i++) {
            const angle = (i / windowsPerFloor) * Math.PI * 2;
            const radius = Math.max(width, depth) / 2;

            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(
                Math.cos(angle) * radius,
                floor * 3 + 1.5, // Window height
                Math.sin(angle) * radius
            );
            window.lookAt(0, window.position.y, 0);
            window.rotateY(Math.PI / 2);
            building.add(window);
        }
    }
}

// Create roads from GeoJSON
function createRoads(geojsonData) {
    // Load road textures
    const textureLoader = new THREE.TextureLoader();
    const asphaltTexture = textureLoader.load('https://ambientcg.com/get/Asphalt_01_1K-JPG.zip/Asphalt_01_1K-JPG_Color.jpg');
    const asphaltNormalMap = textureLoader.load('https://ambientcg.com/get/Asphalt_01_1K-JPG.zip/Asphalt_01_1K-JPG_NormalGL.jpg');
    const asphaltRoughnessMap = textureLoader.load('https://ambientcg.com/get/Asphalt_01_1K-JPG.zip/Asphalt_01_1K-JPG_Roughness.jpg');

    // Configure texture repeat
    const textureRepeat = 4;
    asphaltTexture.wrapS = asphaltTexture.wrapT = THREE.RepeatWrapping;
    asphaltNormalMap.wrapS = asphaltNormalMap.wrapT = THREE.RepeatWrapping;
    asphaltRoughnessMap.wrapS = asphaltRoughnessMap.wrapT = THREE.RepeatWrapping;
    asphaltTexture.repeat.set(textureRepeat, textureRepeat);
    asphaltNormalMap.repeat.set(textureRepeat, textureRepeat);
    asphaltRoughnessMap.repeat.set(textureRepeat, textureRepeat);

    // Create road material
    const roadMaterial = new THREE.MeshStandardMaterial({
        map: asphaltTexture,
        normalMap: asphaltNormalMap,
        roughnessMap: asphaltRoughnessMap,
        roughness: 0.8,
        metalness: 0.2
    });

    // Create sidewalk material
    const sidewalkMaterial = new THREE.MeshStandardMaterial({
        color: 0xCCCCCC,
        roughness: 0.9,
        metalness: 0.1
    });

    geojsonData.features.forEach(feature => {
        if (feature.properties.highway) {
            const coordinates = feature.geometry.coordinates;
            const points = coordinates.map(coord => convertCoordinates(coord[1], coord[0]));
            
            // Create road segments
            for (let i = 0; i < points.length - 1; i++) {
                const start = points[i];
                const end = points[i + 1];
                
                // Calculate road segment
                const length = Math.sqrt(
                    Math.pow(end.x - start.x, 2) + 
                    Math.pow(end.z - start.z, 2)
                );
                const angle = Math.atan2(end.z - start.z, end.x - start.x);

                // Create road segment
                const roadGeometry = new THREE.PlaneGeometry(length, roadWidth);
                const road = new THREE.Mesh(roadGeometry, roadMaterial);
                road.rotation.x = -Math.PI / 2;
                road.rotation.z = -angle;
                road.position.set(
                    (start.x + end.x) / 2,
                    0.01,
                    (start.z + end.z) / 2
                );
                road.receiveShadow = true;
                scene.add(road);

                // Create sidewalks
                const sidewalkWidth = 2;
                const sidewalkHeight = 0.1;
                
                // Left sidewalk
                const leftSidewalkGeometry = new THREE.BoxGeometry(length, sidewalkHeight, sidewalkWidth);
                const leftSidewalk = new THREE.Mesh(leftSidewalkGeometry, sidewalkMaterial);
                leftSidewalk.position.set(
                    (start.x + end.x) / 2 - Math.sin(angle) * (roadWidth/2 + sidewalkWidth/2),
                    sidewalkHeight/2,
                    (start.z + end.z) / 2 + Math.cos(angle) * (roadWidth/2 + sidewalkWidth/2)
                );
                leftSidewalk.rotation.y = angle;
                leftSidewalk.castShadow = true;
                leftSidewalk.receiveShadow = true;
                scene.add(leftSidewalk);

                // Right sidewalk
                const rightSidewalkGeometry = new THREE.BoxGeometry(length, sidewalkHeight, sidewalkWidth);
                const rightSidewalk = new THREE.Mesh(rightSidewalkGeometry, sidewalkMaterial);
                rightSidewalk.position.set(
                    (start.x + end.x) / 2 + Math.sin(angle) * (roadWidth/2 + sidewalkWidth/2),
                    sidewalkHeight/2,
                    (start.z + end.z) / 2 - Math.cos(angle) * (roadWidth/2 + sidewalkWidth/2)
                );
                rightSidewalk.rotation.y = angle;
                rightSidewalk.castShadow = true;
                rightSidewalk.receiveShadow = true;
                scene.add(rightSidewalk);

                // Add road markings
                addRoadMarkings(road, start, end, length, angle);

                // Add street furniture
                addStreetFurniture(road, start, end, length, angle);
            }
        }
    });
}

// Add road markings
function addRoadMarkings(road, start, end, length, angle) {
    const markingGeometry = new THREE.PlaneGeometry(0.3, 2);
    const markingMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.8,
        metalness: 0.2
    });

    // Add center line markings
    const markings = Math.floor(length / 4);
    for (let i = 0; i < markings; i++) {
        const t = i / markings;
        const x = start.x + (end.x - start.x) * t;
        const z = start.z + (end.z - start.z) * t;
        
        const marking = new THREE.Mesh(markingGeometry, markingMaterial);
        marking.position.set(x, 0.02, z);
        marking.rotation.x = -Math.PI / 2;
        marking.rotation.z = -angle;
        road.add(marking);
    }
}

// Create traffic light
function createTrafficLight(x, z) {
    const trafficLightGroup = new THREE.Group();
    
    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 8, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.7,
        metalness: 0.3
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.castShadow = true;
    trafficLightGroup.add(pole);

    // Light housing
    const housingGeometry = new THREE.BoxGeometry(1, 3, 1);
    const housingMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.5,
        metalness: 0.5
    });
    const housing = new THREE.Mesh(housingGeometry, housingMaterial);
    housing.position.y = 5;
    housing.castShadow = true;
    trafficLightGroup.add(housing);

    // Lights
    const lightGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const redLight = new THREE.Mesh(lightGeometry, new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000 }));
    const yellowLight = new THREE.Mesh(lightGeometry, new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00 }));
    const greenLight = new THREE.Mesh(lightGeometry, new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00 }));

    redLight.position.set(0, 6, 0);
    yellowLight.position.set(0, 5, 0);
    greenLight.position.set(0, 4, 0);

    trafficLightGroup.add(redLight);
    trafficLightGroup.add(yellowLight);
    trafficLightGroup.add(greenLight);

    trafficLightGroup.position.set(x, 0, z);
    scene.add(trafficLightGroup);

    // Animate traffic lights
    let state = 0;
    setInterval(() => {
        redLight.material.emissive.setHex(state === 0 ? 0xff0000 : 0x000000);
        yellowLight.material.emissive.setHex(state === 1 ? 0xffff00 : 0x000000);
        greenLight.material.emissive.setHex(state === 2 ? 0x00ff00 : 0x000000);
        state = (state + 1) % 3;
    }, 2000);
}

// Create trees
function createTree(x, z) {
    const treeGroup = new THREE.Group();
    
    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 5, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.9,
        metalness: 0.1
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    // Tree top
    const topGeometry = new THREE.ConeGeometry(3, 6, 8);
    const topMaterial = new THREE.MeshStandardMaterial({
        color: 0x228B22,
        roughness: 0.8,
        metalness: 0.2
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 5;
    top.castShadow = true;
    treeGroup.add(top);

    treeGroup.position.set(x, 0, z);
    scene.add(treeGroup);
}

// Create street lamps
function createStreetLamp(x, z) {
    const lampGroup = new THREE.Group();
    
    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 8, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.7,
        metalness: 0.3
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.castShadow = true;
    lampGroup.add(pole);

    // Lamp head
    const headGeometry = new THREE.BoxGeometry(1, 0.5, 1);
    const headMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.5,
        metalness: 0.5
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 7;
    head.castShadow = true;
    lampGroup.add(head);

    // Light
    const light = new THREE.PointLight(0xffffcc, 1, 20);
    light.position.set(0, 7, 0);
    lampGroup.add(light);

    lampGroup.position.set(x, 0, z);
    scene.add(lampGroup);
}

// Create benches
function createBench(x, z, rotation = 0) {
    const benchGroup = new THREE.Group();
    
    // Seat
    const seatGeometry = new THREE.BoxGeometry(4, 0.5, 1);
    const seatMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.8,
        metalness: 0.2
    });
    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
    seat.position.y = 1;
    seat.castShadow = true;
    benchGroup.add(seat);

    // Back
    const backGeometry = new THREE.BoxGeometry(4, 1, 0.5);
    const back = new THREE.Mesh(backGeometry, seatMaterial);
    back.position.set(0, 1.75, -0.75);
    back.castShadow = true;
    benchGroup.add(back);

    // Legs
    const legGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
    const legMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.7,
        metalness: 0.3
    });

    for (let i = -1.5; i <= 1.5; i += 3) {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(i, 0.5, 0);
        leg.castShadow = true;
        benchGroup.add(leg);
    }

    benchGroup.rotation.y = rotation;
    benchGroup.position.set(x, 0, z);
    scene.add(benchGroup);
}

// Create the city layout
// Main roads
createRoad(0, 0, roadWidth, groundSize, 0);
createRoad(0, 0, roadWidth, groundSize, Math.PI / 2);

// Buildings
for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
        if (Math.abs(i) > 1 || Math.abs(j) > 1) {
            const height = 20 + Math.random() * 30;
            createBuilding(
                i * blockSize,
                j * blockSize,
                15 + Math.random() * 10,
                height,
                15 + Math.random() * 10
            );
        }
    }
}

// Load and create Leiden city
async function initLeiden() {
    const geojsonData = await fetchLeidenData();
    if (geojsonData) {
        createBuildings(geojsonData);
        createRoads(geojsonData);
    }
}

// Initialize Leiden city
initLeiden();

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();

// Add street furniture
function addStreetFurniture(road, start, end, length, angle) {
    // Calculate positions along the road
    const spacing = 20; // Space between items
    const items = Math.floor(length / spacing);
    
    for (let i = 0; i < items; i++) {
        const t = i / items;
        const x = start.x + (end.x - start.x) * t;
        const z = start.z + (end.z - start.z) * t;
        
        // Randomly decide whether to place a tree or lamp post
        if (Math.random() < 0.7) { // 70% chance for trees
            addTree(x, z, angle);
        } else {
            addLampPost(x, z, angle);
        }
    }
}

// Add a tree
function addTree(x, z, angle) {
    if (!treeModel) return;
    
    const tree = treeModel.clone();
    
    // Random scale variation
    const scale = 0.5 + Math.random() * 0.3;
    tree.scale.set(scale, scale, scale);
    
    // Position tree slightly off the sidewalk
    const offset = 3; // Distance from road center
    tree.position.set(
        x - Math.sin(angle) * offset,
        0,
        z + Math.cos(angle) * offset
    );
    
    // Random rotation
    tree.rotation.y = Math.random() * Math.PI * 2;
    
    // Enable shadows
    tree.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    scene.add(tree);
}

// Add a lamp post
function addLampPost(x, z, angle) {
    if (!lampPostModel) return;
    
    const lamp = lampPostModel.clone();
    
    // Scale to appropriate size
    lamp.scale.set(0.5, 0.5, 0.5);
    
    // Position lamp on the sidewalk
    const offset = 2; // Distance from road center
    lamp.position.set(
        x - Math.sin(angle) * offset,
        0,
        z + Math.cos(angle) * offset
    );
    
    // Rotate to face the road
    lamp.rotation.y = angle + Math.PI / 2;
    
    // Add point light
    const light = new THREE.PointLight(0xffffcc, 1, 20);
    light.position.set(0, 5, 0);
    lamp.add(light);
    
    // Enable shadows
    lamp.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    scene.add(lamp);
}

// Create a simple road function
function createRoad(x, z, width, length, rotation = 0) {
    const roadGeometry = new THREE.PlaneGeometry(width, length);
    const roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = rotation;
    road.position.set(x, 0.01, z);
    road.receiveShadow = true;
    scene.add(road);
    return road;
}

// Update the city layout creation
function createCityLayout() {
    // Main roads
    createRoad(0, 0, roadWidth, groundSize, 0);
    createRoad(0, 0, roadWidth, groundSize, Math.PI / 2);

    // Buildings
    for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
            if (Math.abs(i) > 1 || Math.abs(j) > 1) {
                const height = 20 + Math.random() * 30;
                createBuilding(
                    i * blockSize,
                    j * blockSize,
                    15 + Math.random() * 10,
                    height,
                    15 + Math.random() * 10
                );
            }
        }
    }
}

// Call createCityLayout instead of direct createRoad calls
createCityLayout();

function createBuilding(x, z, width, height, depth) {
    // Choose a random material type for variety
    const materialTypes = ['brick', 'concrete', 'glass'];
    const materialType = materialTypes[Math.floor(Math.random() * materialTypes.length)];
    const textures = buildingTextures[materialType];

    let buildingMaterial;
    if (textures.color && textures.normal && textures.roughness && textures.ao) {
        buildingMaterial = new THREE.MeshPhysicalMaterial({
            map: textures.color,
            normalMap: textures.normal,
            roughnessMap: textures.roughness,
            aoMap: textures.ao,
            roughness: materialType === 'glass' ? 0.1 : 0.7,
            metalness: materialType === 'glass' ? 0.9 : 0.2,
            clearcoat: materialType === 'glass' ? 1.0 : 0.0,
            clearcoatRoughness: materialType === 'glass' ? 0.1 : 0.5,
            transparent: materialType === 'glass',
            opacity: materialType === 'glass' ? 0.7 : 1.0
        });
    } else {
        buildingMaterial = proceduralMaterials[materialType].clone();
    }

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, buildingMaterial);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
} 