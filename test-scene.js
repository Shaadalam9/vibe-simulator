import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Create the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 100, 300);

// Create the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Create the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(50, 50, 50);
camera.lookAt(0, 0, 0);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Enhanced lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// Create ground with texture
const groundTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
groundTexture.repeat.set(25, 25);
groundTexture.anisotropy = 16;

// Create materials first
const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9,
    metalness: 0.1
});

const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.8,
    metalness: 0.1
});

const lineMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.1
});

// Increase ground size
const groundSize = 400;
const roadWidth = 15;
const blockSize = 60;

// Update ground
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    new THREE.MeshStandardMaterial({ 
        map: groundTexture,
        roughness: 0.8,
        metalness: 0.2
    })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Update road dimensions
const roadLength = groundSize;

// Create main roads
const mainRoads = [
    { x: 0, z: 0, width: roadWidth, length: roadLength, rotation: 0 },
    { x: 0, z: 0, width: roadLength, length: roadWidth, rotation: Math.PI / 2 },
    { x: -groundSize/4, z: 0, width: roadWidth, length: roadLength, rotation: 0 },
    { x: groundSize/4, z: 0, width: roadWidth, length: roadLength, rotation: 0 },
    { x: 0, z: -groundSize/4, width: roadLength, length: roadWidth, rotation: Math.PI / 2 },
    { x: 0, z: groundSize/4, width: roadLength, length: roadWidth, rotation: Math.PI / 2 }
];

mainRoads.forEach(road => {
    const roadMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(road.width, road.length),
        roadMaterial
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(road.x, 0.01, road.z);
    roadMesh.rotation.z = road.rotation;
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Add sidewalks
    const sidewalkMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(road.width + 4, road.length),
        sidewalkMaterial
    );
    sidewalkMesh.rotation.x = -Math.PI / 2;
    sidewalkMesh.position.set(road.x, 0.02, road.z);
    sidewalkMesh.rotation.z = road.rotation;
    sidewalkMesh.receiveShadow = true;
    scene.add(sidewalkMesh);

    // Add road markings
    const centerLine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, road.length),
        lineMaterial
    );
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.set(road.x, 0.03, road.z);
    centerLine.rotation.z = road.rotation;
    scene.add(centerLine);
});

// Create sidewalks with texture
const sidewalkTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/brick_bump.jpg');
sidewalkTexture.wrapS = sidewalkTexture.wrapT = THREE.RepeatWrapping;
sidewalkTexture.repeat.set(2, 2);

// Create building with windows and texture
function createBuilding(x, z, width, depth, height) {
    const buildingTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/brick_diffuse.jpg');
    buildingTexture.wrapS = buildingTexture.wrapT = THREE.RepeatWrapping;
    buildingTexture.repeat.set(width/10, height/10);

    const building = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({
            map: buildingTexture,
            roughness: 0.7,
            metalness: 0.3
        })
    );
    building.position.set(x, height / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);

    // Add windows
    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x88ccff,
        emissiveIntensity: 0.2
    });

    const windowSize = 2;
    const windowSpacing = 4;
    const windowRows = Math.floor(height / windowSpacing);
    const windowCols = Math.floor(width / windowSpacing);

    // Add windows to all sides
    for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
            if (Math.random() > 0.3) {
                // Front windows
                const window = new THREE.Mesh(
                    new THREE.PlaneGeometry(windowSize, windowSize),
                    windowMaterial
                );
                window.position.set(
                    x - width/2 + col * windowSpacing + windowSpacing/2,
                    row * windowSpacing + windowSpacing/2,
                    z - depth/2 - 0.1
                );
                window.rotation.y = Math.PI;
                scene.add(window);

                // Back windows
                const backWindow = window.clone();
                backWindow.position.z = z + depth/2 + 0.1;
                backWindow.rotation.y = 0;
                scene.add(backWindow);

                // Left side windows
                const leftWindow = window.clone();
                leftWindow.position.set(
                    x - width/2 - 0.1,
                    row * windowSpacing + windowSpacing/2,
                    z - depth/2 + col * windowSpacing + windowSpacing/2
                );
                leftWindow.rotation.y = -Math.PI / 2;
                scene.add(leftWindow);

                // Right side windows
                const rightWindow = window.clone();
                rightWindow.position.set(
                    x + width/2 + 0.1,
                    row * windowSpacing + windowSpacing/2,
                    z - depth/2 + col * windowSpacing + windowSpacing/2
                );
                rightWindow.rotation.y = Math.PI / 2;
                scene.add(rightWindow);
            }
        }
    }

    // Add roof details
    if (Math.random() > 0.5) {
        const roofGeometry = new THREE.BoxGeometry(width + 2, 2, depth + 2);
        const roofMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.8,
            metalness: 0.2
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(x, height + 1, z);
        roof.castShadow = true;
        scene.add(roof);
    }

    // Add entrance
    const entranceWidth = 4;
    const entranceHeight = 6;
    const entrance = new THREE.Mesh(
        new THREE.BoxGeometry(entranceWidth, entranceHeight, 0.5),
        new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.5,
            metalness: 0.8
        })
    );
    entrance.position.set(
        x - width/2 + entranceWidth/2,
        entranceHeight/2,
        z - depth/2 - 0.2
    );
    scene.add(entrance);
}

// Create traffic lights with more detail
function createTrafficLight(x, z, rotation = 0) {
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 8, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.7,
        metalness: 0.5
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, 4, z);
    pole.castShadow = true;
    scene.add(pole);

    const lightBoxGeometry = new THREE.BoxGeometry(1, 3, 0.5);
    const lightBoxMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.5,
        metalness: 0.8
    });
    const lightBox = new THREE.Mesh(lightBoxGeometry, lightBoxMaterial);
    lightBox.position.set(x, 8, z);
    lightBox.rotation.y = rotation;
    scene.add(lightBox);

    // Add lights with glow
    const lightPositions = [
        { y: 0.8, color: 0xff0000 },
        { y: 0, color: 0xffff00 },
        { y: -0.8, color: 0x00ff00 }
    ];

    lightPositions.forEach(({ y, color }) => {
        const lightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const lightMaterial = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(x, 8 + y, z);
        scene.add(light);

        // Add glow
        const glowGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(x, 8 + y, z);
        scene.add(glow);
    });
}

// Create tree with more detail
function createTree(x, z) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, 0, z);

    // Load textures
    const textureLoader = new THREE.TextureLoader();
    const barkTexture = textureLoader.load('https://threejs.org/examples/textures/bark.jpg');
    const barkNormalMap = textureLoader.load('https://threejs.org/examples/textures/bark_normal.jpg');
    const barkRoughnessMap = textureLoader.load('https://threejs.org/examples/textures/bark_roughness.jpg');
    const leafTexture = textureLoader.load('https://threejs.org/examples/textures/leaves.jpg');
    const leafNormalMap = textureLoader.load('https://threejs.org/examples/textures/leaves_normal.jpg');
    const groundTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');

    // Configure texture properties
    [barkTexture, barkNormalMap, barkRoughnessMap].forEach(texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
    });

    [leafTexture, leafNormalMap].forEach(texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
    });

    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(1, 1);

    // Create main trunk with realistic wood structure
    const trunkHeight = 5 + Math.random() * 2;
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, trunkHeight, 12);
    const trunkMaterial = new THREE.MeshStandardMaterial({
        map: barkTexture,
        normalMap: barkNormalMap,
        roughnessMap: barkRoughnessMap,
        color: 0x4d2926,
        roughness: 0.9,
        metalness: 0.1,
        normalScale: new THREE.Vector2(0.5, 0.5)
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Function to create a branch with natural curve
    function createBranch(startPoint, direction, length, radius, parent, isMainBranch = false) {
        if (!startPoint || !direction) {
            console.warn('Invalid branch parameters');
            return null;
        }

        const segments = 8;
        const points = [];
        const curve = new THREE.CatmullRomCurve3();
        
        // Create points for curved branch with natural variation
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const naturalCurve = Math.sin(t * Math.PI) * length * 0.2;
            const randomVariation = (Math.random() - 0.5) * length * 0.1;
            const point = new THREE.Vector3(
                startPoint.x + direction.x * length * t + randomVariation,
                startPoint.y + direction.y * length * t + naturalCurve,
                startPoint.z + direction.z * length * t + randomVariation
            );
            points.push(point);
        }
        
        curve.points = points;
        
        // Create branch geometry with tapering
        const branchGeometry = new THREE.TubeGeometry(curve, segments, radius, 8, false);
        const branch = new THREE.Mesh(branchGeometry, trunkMaterial);
        parent.add(branch);
        
        return { branch, curve, points, segments };
    }

    // Create main branches with natural curves
    const numMainBranches = 4 + Math.floor(Math.random() * 3);
    const mainBranches = [];
    
    for (let i = 0; i < numMainBranches; i++) {
        const angle = (i * Math.PI * 2) / numMainBranches + (Math.random() - 0.5) * Math.PI / 4;
        const height = 3 + Math.random() * 2;
        const length = 2 + Math.random() * 1.5;
        const radius = 0.15 + Math.random() * 0.1;
        mainBranches.push({ angle, height, length, radius });
    }

    mainBranches.forEach(({ angle, height, length, radius }) => {
        const startPoint = new THREE.Vector3(
            Math.sin(angle) * 0.5,
            height,
            Math.cos(angle) * 0.5
        );
        const direction = new THREE.Vector3(
            Math.sin(angle),
            0.2 + Math.random() * 0.2,
            Math.cos(angle)
        ).normalize();
        
        const branchResult = createBranch(startPoint, direction, length, radius, treeGroup, true);
        
        if (branchResult) {
            const { branch, curve, points, segments } = branchResult;
            
            // Add smaller branches with natural distribution
            const numSubBranches = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < numSubBranches; i++) {
                const t = 0.3 + i * 0.3;
                const pointIndex = Math.floor(t * segments);
                if (pointIndex < points.length) {
                    const branchPoint = points[pointIndex];
                    const subAngle = angle + (Math.random() - 0.5) * Math.PI / 2;
                    const subDirection = new THREE.Vector3(
                        Math.sin(subAngle),
                        0.3 + Math.random() * 0.2,
                        Math.cos(subAngle)
                    ).normalize();
                    
                    createBranch(branchPoint, subDirection, length * 0.6, radius * 0.6, treeGroup);
                }
            }
        }
    });

    // Create leaf clusters with more natural distribution
    function createLeafCluster(position, size, color) {
        const clusterGroup = new THREE.Group();
        clusterGroup.position.copy(position);

        // Create multiple leaf layers for depth
        const leafLayers = 4;
        for (let i = 0; i < leafLayers; i++) {
            const layerSize = size * (1 - i * 0.15);
            const leafGeometry = new THREE.ConeGeometry(layerSize, layerSize * 1.5, 8);
            const leafMaterial = new THREE.MeshStandardMaterial({
                map: leafTexture,
                normalMap: leafNormalMap,
                color: color,
                roughness: 0.8,
                metalness: 0.2,
                flatShading: true,
                normalScale: new THREE.Vector2(0.5, 0.5),
                transparent: true,
                opacity: 0.9,
                alphaTest: 0.5
            });
            
            const leafLayer = new THREE.Mesh(leafGeometry, leafMaterial);
            leafLayer.position.y = i * 0.3;
            leafLayer.rotation.y = (i * Math.PI) / 4;
            clusterGroup.add(leafLayer);
        }

        return clusterGroup;
    }

    // Create foliage with multiple clusters and natural variation
    const leafColors = [
        0x2d5a27, // Dark green
        0x1e4020, // Forest green
        0x3d6a37, // Medium green
        0x4a7a42  // Light green
    ];

    const leafSizes = [3.5, 3, 2.5, 2];
    const leafHeights = [7, 6.5, 6, 5.5];

    // Create main foliage clusters with natural distribution
    leafColors.forEach((color, i) => {
        const mainCluster = createLeafCluster(
            new THREE.Vector3(0, leafHeights[i], 0),
            leafSizes[i],
            color
        );
        treeGroup.add(mainCluster);

        // Add smaller clusters around main cluster with natural variation
        const numClusters = 4 + Math.floor(Math.random() * 3);
        for (let j = 0; j < numClusters; j++) {
            const angle = (j * Math.PI * 2) / numClusters + (Math.random() - 0.5) * Math.PI / 4;
            const distance = leafSizes[i] * (0.5 + Math.random() * 0.3);
            const offset = new THREE.Vector3(
                Math.sin(angle) * distance,
                (Math.random() - 0.5) * 0.5,
                Math.cos(angle) * distance
            );
            const smallCluster = createLeafCluster(
                new THREE.Vector3(0, leafHeights[i], 0).add(offset),
                leafSizes[i] * (0.6 + Math.random() * 0.2),
                color
            );
            treeGroup.add(smallCluster);
        }
    });

    // Add ground foliage with proper material
    const groundFoliageGeometry = new THREE.CircleGeometry(2, 8);
    const groundFoliageMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,
        color: 0x2d5a27,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    const groundFoliage = new THREE.Mesh(groundFoliageGeometry, groundFoliageMaterial);
    groundFoliage.rotation.x = -Math.PI / 2;
    groundFoliage.position.y = 0.1;
    groundFoliage.receiveShadow = true;
    treeGroup.add(groundFoliage);

    // Add some random small rocks with proper material
    for (let i = 0; i < 5; i++) {
        const rockGeometry = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.3, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.9,
            metalness: 0.1,
            normalScale: new THREE.Vector2(0.5, 0.5)
        });
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        const angle = (i * Math.PI * 2) / 5;
        rock.position.set(
            Math.sin(angle) * 2,
            0.1,
            Math.cos(angle) * 2
        );
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        rock.castShadow = true;
        treeGroup.add(rock);
    }

    scene.add(treeGroup);
    return treeGroup;
}

// Create buildings in a larger grid
const buildingGrid = {
    minX: -3,
    maxX: 3,
    minZ: -3,
    maxZ: 3
};

for (let i = buildingGrid.minX; i <= buildingGrid.maxX; i++) {
    for (let j = buildingGrid.minZ; j <= buildingGrid.maxZ; j++) {
        // Skip center area for main roads
        if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue;

        const x = i * (blockSize + roadWidth);
        const z = j * (blockSize + roadWidth);
        
        // Add multiple buildings per block
        const buildingsPerBlock = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < buildingsPerBlock; k++) {
            const offsetX = (Math.random() - 0.5) * blockSize * 0.8;
            const offsetZ = (Math.random() - 0.5) * blockSize * 0.8;
            
            const width = blockSize * (0.3 + Math.random() * 0.4);
            const depth = blockSize * (0.3 + Math.random() * 0.4);
            const height = 20 + Math.random() * 40;
            
            createBuilding(x + offsetX, z + offsetZ, width, depth, height);
        }
    }
}

// Add traffic lights at all major intersections
const intersections = [];
for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
        if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue;
        intersections.push({
            x: i * (blockSize + roadWidth),
            z: j * (blockSize + roadWidth)
        });
    }
}

intersections.forEach(intersection => {
    createTrafficLight(intersection.x + roadWidth/2 + 2, intersection.z, 0);
    createTrafficLight(intersection.x - roadWidth/2 - 2, intersection.z, Math.PI);
    createTrafficLight(intersection.x, intersection.z + roadWidth/2 + 2, Math.PI/2);
    createTrafficLight(intersection.x, intersection.z - roadWidth/2 - 2, -Math.PI/2);
});

// Add more trees throughout the city
for (let i = buildingGrid.minX; i <= buildingGrid.maxX; i++) {
    for (let j = buildingGrid.minZ; j <= buildingGrid.maxZ; j++) {
        if (Math.random() > 0.7) {
            const x = i * (blockSize + roadWidth) + (Math.random() - 0.5) * blockSize;
            const z = j * (blockSize + roadWidth) + (Math.random() - 0.5) * blockSize;
            createTree(x, z);
        }
    }
}

// Update grid helper size
const gridHelper = new THREE.GridHelper(groundSize, 40);
scene.add(gridHelper);

// Update camera position for better view of larger city
camera.position.set(100, 100, 100);
camera.lookAt(0, 0, 0);

// Create car function
function createCar(x, z) {
    const carGroup = new THREE.Group();
    carGroup.position.set(x, 0, z);

    // Create environment map for better reflections
    const envMap = new THREE.CubeTextureLoader().load([
        'https://threejs.org/examples/textures/cube/Park2/posx.jpg',
        'https://threejs.org/examples/textures/cube/Park2/negx.jpg',
        'https://threejs.org/examples/textures/cube/Park2/posy.jpg',
        'https://threejs.org/examples/textures/cube/Park2/negy.jpg',
        'https://threejs.org/examples/textures/cube/Park2/posz.jpg',
        'https://threejs.org/examples/textures/cube/Park2/negz.jpg'
    ]);
    scene.environment = envMap;

    // Car materials
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x0066cc,
        roughness: 0.05,
        metalness: 0.95,
        envMap: envMap,
        envMapIntensity: 1.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    const chromeMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.1,
        metalness: 0.9,
        envMap: envMap,
        envMapIntensity: 1.0
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        roughness: 0.05,
        metalness: 0.9,
        transparent: true,
        opacity: 0.7,
        envMap: envMap,
        envMapIntensity: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    const blackMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.7,
        metalness: 0.3,
        envMap: envMap,
        envMapIntensity: 0.3
    });

    // Car body
    const bodyWidth = 6;
    const bodyLength = 12;
    const bodyHeight = 2;
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength),
        bodyMaterial
    );
    body.position.y = bodyHeight / 2;
    carGroup.add(body);

    // Roof
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth - 0.5, 1.5, bodyLength * 0.4),
        bodyMaterial
    );
    roof.position.set(0, bodyHeight + 0.75, -0.5);
    carGroup.add(roof);

    // Hood
    const hood = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth - 0.5, 0.2, bodyLength * 0.25),
        bodyMaterial
    );
    hood.position.set(0, bodyHeight/2 + 0.1, bodyLength/2 - 1.5);
    carGroup.add(hood);

    // Trunk
    const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth - 0.5, 0.2, bodyLength * 0.25),
        bodyMaterial
    );
    trunk.position.set(0, bodyHeight/2 + 0.1, -bodyLength/2 + 1.5);
    carGroup.add(trunk);

    // Front windshield
    const frontWindshield = new THREE.Mesh(
        new THREE.PlaneGeometry(bodyWidth - 1, 1.8),
        glassMaterial
    );
    frontWindshield.position.set(0, bodyHeight + 0.9, bodyLength/2 - 1);
    frontWindshield.rotation.x = Math.PI / 6;
    carGroup.add(frontWindshield);

    // Rear windshield
    const rearWindshield = new THREE.Mesh(
        new THREE.PlaneGeometry(bodyWidth - 1, 1.8),
        glassMaterial
    );
    rearWindshield.position.set(0, bodyHeight + 0.9, -bodyLength/2 + 1);
    rearWindshield.rotation.x = -Math.PI / 6;
    carGroup.add(rearWindshield);

    // Side windows
    const sideWindowGeometry = new THREE.PlaneGeometry(bodyLength * 0.4, 1.5);
    const leftWindow = new THREE.Mesh(sideWindowGeometry, glassMaterial);
    leftWindow.position.set(-bodyWidth/2 - 0.01, bodyHeight + 0.75, -0.5);
    leftWindow.rotation.y = Math.PI / 2;
    carGroup.add(leftWindow);
    const rightWindow = leftWindow.clone();
    rightWindow.position.set(bodyWidth/2 + 0.01, bodyHeight + 0.75, -0.5);
    rightWindow.rotation.y = -Math.PI / 2;
    carGroup.add(rightWindow);

    // Bumpers
    const frontBumper = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth, 0.8, 0.6),
        blackMaterial
    );
    frontBumper.position.set(0, 0.4, bodyLength/2 + 0.3);
    carGroup.add(frontBumper);
    const rearBumper = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth, 0.8, 0.6),
        blackMaterial
    );
    rearBumper.position.set(0, 0.4, -bodyLength/2 - 0.3);
    carGroup.add(rearBumper);

    // Grille
    const grille = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1.2, 0.1),
        blackMaterial
    );
    grille.position.set(0, bodyHeight/2 + 0.6, bodyLength/2 + 0.05);
    carGroup.add(grille);

    // Headlights
    const headlightGeometry = new THREE.CircleGeometry(0.45, 32);
    const headlightMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.5,
        roughness: 0.05,
        metalness: 0.9,
        envMap: envMap,
        envMapIntensity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
    leftHeadlight.position.set(-1.5, bodyHeight/2 + 0.6, bodyLength/2 + 0.05);
    carGroup.add(leftHeadlight);
    const rightHeadlight = leftHeadlight.clone();
    rightHeadlight.position.set(1.5, bodyHeight/2 + 0.6, bodyLength/2 + 0.05);
    carGroup.add(rightHeadlight);

    // Taillights
    const taillightGeometry = new THREE.CircleGeometry(0.45, 32);
    const taillightMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
        roughness: 0.05,
        metalness: 0.9,
        envMap: envMap,
        envMapIntensity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });
    const leftTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
    leftTaillight.position.set(-1.5, bodyHeight/2 + 0.6, -bodyLength/2 - 0.05);
    carGroup.add(leftTaillight);
    const rightTaillight = leftTaillight.clone();
    rightTaillight.position.set(1.5, bodyHeight/2 + 0.6, -bodyLength/2 - 0.05);
    carGroup.add(rightTaillight);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.9, 0.9, 0.6, 32);
    wheelGeometry.rotateZ(Math.PI / 2);
    const wheelRimGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 32);
    wheelRimGeometry.rotateZ(Math.PI / 2);
    function createWheel(x, z) {
        const wheelGroup = new THREE.Group();
        const tire = new THREE.Mesh(wheelGeometry, blackMaterial);
        wheelGroup.add(tire);
        const rim = new THREE.Mesh(wheelRimGeometry, chromeMaterial);
        wheelGroup.add(rim);
        for (let i = 0; i < 5; i++) {
            const spokeGeometry = new THREE.BoxGeometry(0.1, 0.9, 0.05);
            const spoke = new THREE.Mesh(spokeGeometry, chromeMaterial);
            spoke.rotation.z = (i * Math.PI * 2) / 5;
            wheelGroup.add(spoke);
        }
        wheelGroup.position.set(x, 0.9, z);
        wheelGroup.castShadow = true;
        return wheelGroup;
    }
    carGroup.add(createWheel(-bodyWidth/2 - 0.3, bodyLength/4));
    carGroup.add(createWheel(bodyWidth/2 + 0.3, bodyLength/4));
    carGroup.add(createWheel(-bodyWidth/2 - 0.3, -bodyLength/4));
    carGroup.add(createWheel(bodyWidth/2 + 0.3, -bodyLength/4));

    // Side mirrors
    const sideMirrorGeometry = new THREE.BoxGeometry(1.2, 0.6, 0.3);
    const leftMirror = new THREE.Mesh(sideMirrorGeometry, bodyMaterial);
    leftMirror.position.set(-bodyWidth/2 - 0.6, bodyHeight + 0.3, bodyLength/4);
    carGroup.add(leftMirror);
    const rightMirror = leftMirror.clone();
    rightMirror.position.set(bodyWidth/2 + 0.6, bodyHeight + 0.3, bodyLength/4);
    carGroup.add(rightMirror);
    const sideMirrorGlassGeometry = new THREE.PlaneGeometry(1, 0.5);
    const leftMirrorGlass = new THREE.Mesh(sideMirrorGlassGeometry, glassMaterial);
    leftMirrorGlass.position.set(-bodyWidth/2 - 0.75, bodyHeight + 0.3, bodyLength/4);
    leftMirrorGlass.rotation.y = Math.PI / 2;
    carGroup.add(leftMirrorGlass);
    const rightMirrorGlass = leftMirrorGlass.clone();
    rightMirrorGlass.position.set(bodyWidth/2 + 0.75, bodyHeight + 0.3, bodyLength/4);
    rightMirrorGlass.rotation.y = -Math.PI / 2;
    carGroup.add(rightMirrorGlass);

    // Four doors with handles, panel lines, and windows
    const doorMaterial = bodyMaterial;
    const doorHandleMaterial = chromeMaterial;
    const doorPanelLineMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.5,
        metalness: 0.2,
        envMap: envMap,
        envMapIntensity: 0.3
    });
    // Front left door
    const frontLeftDoorGeometry = new THREE.BoxGeometry(0.2, bodyHeight - 0.2, bodyLength * 0.25);
    const frontLeftDoor = new THREE.Mesh(frontLeftDoorGeometry, doorMaterial);
    frontLeftDoor.position.set(-bodyWidth/2 - 0.1, bodyHeight/2, bodyLength/4);
    carGroup.add(frontLeftDoor);
    // Front right door
    const frontRightDoor = frontLeftDoor.clone();
    frontRightDoor.position.set(bodyWidth/2 + 0.1, bodyHeight/2, bodyLength/4);
    carGroup.add(frontRightDoor);
    // Rear left door
    const rearLeftDoorGeometry = new THREE.BoxGeometry(0.2, bodyHeight - 0.2, bodyLength * 0.25);
    const rearLeftDoor = new THREE.Mesh(rearLeftDoorGeometry, doorMaterial);
    rearLeftDoor.position.set(-bodyWidth/2 - 0.1, bodyHeight/2, -bodyLength/4);
    carGroup.add(rearLeftDoor);
    // Rear right door
    const rearRightDoor = rearLeftDoor.clone();
    rearRightDoor.position.set(bodyWidth/2 + 0.1, bodyHeight/2, -bodyLength/4);
    carGroup.add(rearRightDoor);
    // Door handles
    function createDoorHandle(x, z) {
        const handleGroup = new THREE.Group();
        const handleBodyGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.05);
        const handleBody = new THREE.Mesh(handleBodyGeometry, doorHandleMaterial);
        handleBody.position.set(0, 0, 0.05);
        handleGroup.add(handleBody);
        const handleGripGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.1);
        const handleGrip = new THREE.Mesh(handleGripGeometry, doorHandleMaterial);
        handleGrip.position.set(0, 0, 0.1);
        handleGroup.add(handleGrip);
        const handleMountGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.05);
        const handleMount = new THREE.Mesh(handleMountGeometry, doorHandleMaterial);
        handleMount.position.set(0, 0, 0);
        handleGroup.add(handleMount);
        handleGroup.position.set(x, bodyHeight/2, z);
        return handleGroup;
    }
    carGroup.add(createDoorHandle(-bodyWidth/2 - 0.2, bodyLength/4));
    carGroup.add(createDoorHandle(bodyWidth/2 + 0.2, bodyLength/4));
    carGroup.add(createDoorHandle(-bodyWidth/2 - 0.2, -bodyLength/4));
    carGroup.add(createDoorHandle(bodyWidth/2 + 0.2, -bodyLength/4));
    // Door panel lines
    function createDoorPanelLine(x, z) {
        const panelLineGeometry = new THREE.BoxGeometry(0.02, bodyHeight - 0.2, bodyLength * 0.25);
        const panelLine = new THREE.Mesh(panelLineGeometry, doorPanelLineMaterial);
        panelLine.position.set(x, bodyHeight/2, z);
        return panelLine;
    }
    carGroup.add(createDoorPanelLine(-bodyWidth/2 - 0.11, bodyLength/4));
    carGroup.add(createDoorPanelLine(bodyWidth/2 + 0.11, bodyLength/4));
    carGroup.add(createDoorPanelLine(-bodyWidth/2 - 0.11, -bodyLength/4));
    carGroup.add(createDoorPanelLine(bodyWidth/2 + 0.11, -bodyLength/4));
    // Door windows
    function createDoorWindow(x, z) {
        const windowGeometry = new THREE.PlaneGeometry(bodyLength * 0.2, bodyHeight * 0.6);
        const window = new THREE.Mesh(windowGeometry, glassMaterial);
        window.position.set(x, bodyHeight/2 + 0.2, z);
        window.rotation.y = x < 0 ? Math.PI/2 : -Math.PI/2;
        return window;
    }
    carGroup.add(createDoorWindow(-bodyWidth/2 - 0.15, bodyLength/4));
    carGroup.add(createDoorWindow(bodyWidth/2 + 0.15, bodyLength/4));
    carGroup.add(createDoorWindow(-bodyWidth/2 - 0.15, -bodyLength/4));
    carGroup.add(createDoorWindow(bodyWidth/2 + 0.15, -bodyLength/4));

    // Interior (dashboard, seats, etc.)
    const interiorMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.7,
        metalness: 0.3,
        envMap: envMap,
        envMapIntensity: 0.3
    });
    const seatMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.2,
        envMap: envMap,
        envMapIntensity: 0.2
    });
    const dashboardMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.5,
        metalness: 0.5,
        envMap: envMap,
        envMapIntensity: 0.4
    });
    // Dashboard
    const dashboard = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth - 1, 0.8, 1.5),
        dashboardMaterial
    );
    dashboard.position.set(0, bodyHeight/2 + 0.4, bodyLength/2 - 1.5);
    carGroup.add(dashboard);
    // Steering wheel
    const steeringWheelGroup = new THREE.Group();
    const steeringWheelRimGeometry = new THREE.TorusGeometry(0.4, 0.05, 16, 32);
    const rim = new THREE.Mesh(steeringWheelRimGeometry, interiorMaterial);
    rim.rotation.x = Math.PI / 2;
    steeringWheelGroup.add(rim);
    const spokeGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4);
    for (let i = 0; i < 3; i++) {
        const spoke = new THREE.Mesh(spokeGeometry, interiorMaterial);
        spoke.rotation.z = (i * Math.PI * 2) / 3;
        steeringWheelGroup.add(spoke);
    }
    steeringWheelGroup.position.set(-1.2, bodyHeight/2 + 0.6, bodyLength/2 - 1.5);
    steeringWheelGroup.rotation.y = Math.PI / 6;
    carGroup.add(steeringWheelGroup);
    // Seats
    function createSeat(x, z, isDriver = false) {
        const seatGroup = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 1.2), seatMaterial);
        base.position.y = 0.15;
        seatGroup.add(base);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.3), seatMaterial);
        back.position.set(0, 0.9, -0.45);
        back.rotation.x = Math.PI / 6;
        seatGroup.add(back);
        const headrest = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.2), seatMaterial);
        headrest.position.set(0, 1.5, -0.3);
        seatGroup.add(headrest);
        if (isDriver) {
            const adjustment = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), interiorMaterial);
            adjustment.position.set(0.5, 0.2, 0.5);
            seatGroup.add(adjustment);
        }
        seatGroup.position.set(x, 0.3, z);
        return seatGroup;
    }
    carGroup.add(createSeat(-1.2, bodyLength/2 - 2.5, true));
    carGroup.add(createSeat(1.2, bodyLength/2 - 2.5));
    carGroup.add(createSeat(-1.2, bodyLength/2 - 4.5));
    carGroup.add(createSeat(1.2, bodyLength/2 - 4.5));
    // Center console
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 2), dashboardMaterial);
    console.position.set(0, bodyHeight/2 + 0.2, bodyLength/2 - 3);
    carGroup.add(console);
    // Gear shift
    const gearShift = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), interiorMaterial);
    gearShift.position.set(0, bodyHeight/2 + 0.5, bodyLength/2 - 3);
    carGroup.add(gearShift);
    // Gear shift knob
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), interiorMaterial);
    knob.position.set(0, bodyHeight/2 + 0.65, bodyLength/2 - 3);
    carGroup.add(knob);
    // Rear view mirror
    const rearMirror = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.2), interiorMaterial);
    rearMirror.position.set(0, bodyHeight + 0.4, bodyLength/2 - 1.2);
    carGroup.add(rearMirror);
    const rearMirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.1), glassMaterial);
    rearMirrorGlass.position.set(0, bodyHeight + 0.4, bodyLength/2 - 1.1);
    rearMirrorGlass.rotation.x = Math.PI / 2;
    carGroup.add(rearMirrorGlass);
    // Floor mats
    const floorMat = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.1,
        envMap: envMap,
        envMapIntensity: 0.2
    }));
    floorMat.rotation.x = -Math.PI / 2;
    floorMat.position.set(0, 0.01, bodyLength/2 - 3);
    carGroup.add(floorMat);

    // Add car to scene
    scene.add(carGroup);
    return carGroup;
}

// Create a car in the city
const car = createCar(0, 0);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate(); 