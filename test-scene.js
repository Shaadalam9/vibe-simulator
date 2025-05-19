import * as THREE from 'three';

// Create the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

// Create the renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Create the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
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
function createGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // Base color
    context.fillStyle = '#1a1a1a';
    context.fillRect(0, 0, 512, 512);

    // Add noise
    for (let i = 0; i < 10000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 2 + 1;
        const brightness = Math.random() * 30;
        context.fillStyle = `rgba(255, 255, 255, ${brightness / 255})`;
        context.fillRect(x, y, size, size);
    }

    return new THREE.CanvasTexture(canvas);
}

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshStandardMaterial({ 
        map: createGroundTexture(),
        roughness: 0.8,
        metalness: 0.2
    })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Create realistic tree
function createTree(x, z, type = 'random') {
    const tree = new THREE.Group();
    
    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 5, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4d2926,
        roughness: 0.9
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2.5;
    trunk.castShadow = true;
    tree.add(trunk);

    // Tree foliage
    if (type === 'pine') {
        // Pine tree
        const foliageGeometry = new THREE.ConeGeometry(3, 8, 8);
        const foliageMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1e4020,
            roughness: 0.8
        });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = 7;
        foliage.castShadow = true;
        tree.add(foliage);
    } else {
        // Deciduous tree
        const foliageColors = [0x2d5a27, 0x1e4020, 0x153017];
        const foliageLayers = 3;
        
        for (let i = 0; i < foliageLayers; i++) {
            const foliageGeometry = new THREE.SphereGeometry(3 - i * 0.5, 8, 8);
            const foliageMaterial = new THREE.MeshStandardMaterial({ 
                color: foliageColors[i],
                roughness: 0.8
            });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.y = 5 + i * 2;
            foliage.castShadow = true;
            tree.add(foliage);
        }
    }

    tree.position.set(x, 0, z);
    return tree;
}

// Create realistic building
function createBuilding(x, z, type = 'random') {
    const building = new THREE.Group();
    let height, width, depth, color;

    switch(type) {
        case 'skyscraper':
            height = 60 + Math.random() * 40;
            width = 25;
            depth = 25;
            color = 0x88aacc;
            break;
        case 'office':
            height = 30 + Math.random() * 20;
            width = 20;
            depth = 20;
            color = 0xcccccc;
            break;
        case 'residential':
            height = 15 + Math.random() * 15;
            width = 15;
            depth = 15;
            color = 0xd4b483;
            break;
        case 'modern':
            height = 40 + Math.random() * 20;
            width = 30;
            depth = 30;
            color = 0x88ccff;
            break;
        default:
            height = 20 + Math.random() * 20;
            width = 18;
            depth = 18;
            color = 0xcccccc;
    }

    // Main structure
    const mainGeometry = new THREE.BoxGeometry(width, height, depth);
    const mainMaterial = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.8,
        roughness: 0.2
    });
    const main = new THREE.Mesh(mainGeometry, mainMaterial);
    main.position.y = height / 2;
    main.castShadow = true;
    building.add(main);

    // Windows
    const windowRows = Math.floor(height / 4);
    const windowCols = Math.floor(width / 5);
    const windowGeometry = new THREE.PlaneGeometry(1.5, 2.5);
    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        metalness: 1,
        roughness: 0,
        transparent: true,
        opacity: 0.7
    });

    // Add windows to each side
    for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
            // Front windows
            const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            frontWindow.position.set(
                -width/2 + 2 + col * 5,
                4 + row * 4,
                depth/2 + 0.1
            );
            building.add(frontWindow);

            // Back windows
            const backWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            backWindow.position.set(
                -width/2 + 2 + col * 5,
                4 + row * 4,
                -depth/2 - 0.1
            );
            backWindow.rotation.y = Math.PI;
            building.add(backWindow);

            // Side windows
            const sideWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            sideWindow.position.set(
                width/2 + 0.1,
                4 + row * 4,
                -depth/2 + 2 + col * 5
            );
            sideWindow.rotation.y = Math.PI / 2;
            building.add(sideWindow);

            const sideWindow2 = new THREE.Mesh(windowGeometry, windowMaterial);
            sideWindow2.position.set(
                -width/2 - 0.1,
                4 + row * 4,
                -depth/2 + 2 + col * 5
            );
            sideWindow2.rotation.y = -Math.PI / 2;
            building.add(sideWindow2);
        }
    }

    // Add architectural details based on building type
    if (type === 'skyscraper') {
        // Add antenna
        const antennaGeometry = new THREE.CylinderGeometry(0.2, 0.2, 10, 8);
        const antennaMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.9,
            roughness: 0.1
        });
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.y = height + 5;
        building.add(antenna);

        // Add decorative top
        const topGeometry = new THREE.ConeGeometry(width/2, 10, 4);
        const topMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.9,
            roughness: 0.1
        });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = height + 5;
        building.add(top);
    } else if (type === 'modern') {
        // Add glass facade
        const facadeGeometry = new THREE.BoxGeometry(width + 0.2, height, depth + 0.2);
        const facadeMaterial = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            metalness: 1,
            roughness: 0,
            transparent: true,
            opacity: 0.3
        });
        const facade = new THREE.Mesh(facadeGeometry, facadeMaterial);
        facade.position.y = height / 2;
        building.add(facade);
    }

    building.position.set(x, 0, z);
    return building;
}

// Create traffic light
function createTrafficLight(x, z, rotation = 0) {
    const trafficLight = new THREE.Group();
    
    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.2, 0.2, 8, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.8,
        roughness: 0.2
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 4;
    pole.castShadow = true;
    trafficLight.add(pole);

    // Traffic light box
    const boxGeometry = new THREE.BoxGeometry(1.2, 3, 0.8);
    const boxMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222,
        metalness: 0.5,
        roughness: 0.5
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.y = 7;
    box.castShadow = true;
    trafficLight.add(box);

    // Lights
    const lightGeometry = new THREE.CircleGeometry(0.3, 16);
    const redLight = new THREE.Mesh(lightGeometry, new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    }));
    redLight.position.set(0, 8, 0.41);
    trafficLight.add(redLight);

    const yellowLight = new THREE.Mesh(lightGeometry, new THREE.MeshStandardMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.5
    }));
    yellowLight.position.set(0, 7, 0.41);
    trafficLight.add(yellowLight);

    const greenLight = new THREE.Mesh(lightGeometry, new THREE.MeshStandardMaterial({ 
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5
    }));
    greenLight.position.set(0, 6, 0.41);
    trafficLight.add(greenLight);

    trafficLight.position.set(x, 0, z);
    trafficLight.rotation.y = rotation;
    return trafficLight;
}

// Create sidewalk
function createSidewalk(x, z, width, length, rotation = 0) {
    const sidewalk = new THREE.Mesh(
        new THREE.PlaneGeometry(width, length),
        new THREE.MeshStandardMaterial({ 
            color: 0xcccccc,
            roughness: 0.9
        })
    );
    sidewalk.rotation.x = -Math.PI / 2;
    sidewalk.position.set(x, 0.02, z);
    sidewalk.rotation.z = rotation;
    sidewalk.receiveShadow = true;
    return sidewalk;
}

// Create bench
function createBench(x, z, rotation = 0) {
    const bench = new THREE.Group();
    
    // Bench seat
    const seatGeometry = new THREE.BoxGeometry(2, 0.2, 0.8);
    const seatMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9
    });
    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
    seat.position.y = 0.5;
    seat.castShadow = true;
    bench.add(seat);

    // Bench back
    const backGeometry = new THREE.BoxGeometry(2, 0.8, 0.2);
    const backMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9
    });
    const back = new THREE.Mesh(backGeometry, backMaterial);
    back.position.y = 0.9;
    back.position.z = -0.3;
    back.castShadow = true;
    bench.add(back);

    // Bench legs
    const legGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.8);
    const legMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x696969,
        metalness: 0.8,
        roughness: 0.2
    });

    const leg1 = new THREE.Mesh(legGeometry, legMaterial);
    leg1.position.set(-0.8, 0.25, 0);
    leg1.castShadow = true;
    bench.add(leg1);

    const leg2 = new THREE.Mesh(legGeometry, legMaterial);
    leg2.position.set(0.8, 0.25, 0);
    leg2.castShadow = true;
    bench.add(leg2);

    bench.position.set(x, 0, z);
    bench.rotation.y = rotation;
    return bench;
}

// Create trash bin
function createTrashBin(x, z, rotation = 0) {
    const bin = new THREE.Group();
    
    // Bin body
    const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.8,
        roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    body.castShadow = true;
    bin.add(body);

    // Bin lid
    const lidGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 8);
    const lidMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444,
        metalness: 0.8,
        roughness: 0.2
    });
    const lid = new THREE.Mesh(lidGeometry, lidMaterial);
    lid.position.y = 1.05;
    lid.castShadow = true;
    bin.add(lid);

    bin.position.set(x, 0, z);
    bin.rotation.y = rotation;
    return bin;
}

// Create city
function createCity() {
    const city = new THREE.Group();
    const gridSize = 5;
    const blockSize = 50;
    const roadWidth = 10;
    const sidewalkWidth = 3;

    // Create roads with markings and sidewalks
    for (let i = -gridSize; i <= gridSize; i++) {
        // Horizontal roads
        const hRoad = new THREE.Mesh(
            new THREE.PlaneGeometry(blockSize * (gridSize * 2 + 1), roadWidth),
            new THREE.MeshStandardMaterial({ 
                color: 0x333333,
                roughness: 0.9
            })
        );
        hRoad.rotation.x = -Math.PI / 2;
        hRoad.position.set(0, 0.01, i * blockSize);
        city.add(hRoad);

        // Horizontal sidewalks
        const hSidewalk1 = createSidewalk(0, i * blockSize - roadWidth/2 - sidewalkWidth/2, 
            blockSize * (gridSize * 2 + 1), sidewalkWidth);
        city.add(hSidewalk1);
        
        const hSidewalk2 = createSidewalk(0, i * blockSize + roadWidth/2 + sidewalkWidth/2, 
            blockSize * (gridSize * 2 + 1), sidewalkWidth);
        city.add(hSidewalk2);

        // Road markings
        const markingGeometry = new THREE.PlaneGeometry(blockSize * (gridSize * 2 + 1), 0.5);
        const markingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const marking = new THREE.Mesh(markingGeometry, markingMaterial);
        marking.rotation.x = -Math.PI / 2;
        marking.position.set(0, 0.02, i * blockSize);
        city.add(marking);

        // Vertical roads
        const vRoad = new THREE.Mesh(
            new THREE.PlaneGeometry(blockSize * (gridSize * 2 + 1), roadWidth),
            new THREE.MeshStandardMaterial({ 
                color: 0x333333,
                roughness: 0.9
            })
        );
        vRoad.rotation.x = -Math.PI / 2;
        vRoad.rotation.z = Math.PI / 2;
        vRoad.position.set(i * blockSize, 0.01, 0);
        city.add(vRoad);

        // Vertical sidewalks
        const vSidewalk1 = createSidewalk(i * blockSize - roadWidth/2 - sidewalkWidth/2, 0,
            sidewalkWidth, blockSize * (gridSize * 2 + 1), Math.PI / 2);
        city.add(vSidewalk1);
        
        const vSidewalk2 = createSidewalk(i * blockSize + roadWidth/2 + sidewalkWidth/2, 0,
            sidewalkWidth, blockSize * (gridSize * 2 + 1), Math.PI / 2);
        city.add(vSidewalk2);

        // Road markings
        const vMarking = new THREE.Mesh(markingGeometry, markingMaterial);
        vMarking.rotation.x = -Math.PI / 2;
        vMarking.rotation.z = Math.PI / 2;
        vMarking.position.set(i * blockSize, 0.02, 0);
        city.add(vMarking);

        // Add traffic lights at intersections
        if (i !== gridSize) {
            // Traffic lights for horizontal roads
            for (let j = -gridSize; j <= gridSize; j++) {
                const trafficLight1 = createTrafficLight(
                    j * blockSize + blockSize/2,
                    i * blockSize - roadWidth/2 - 1,
                    Math.PI
                );
                city.add(trafficLight1);

                const trafficLight2 = createTrafficLight(
                    j * blockSize + blockSize/2,
                    i * blockSize + roadWidth/2 + 1
                );
                city.add(trafficLight2);
            }

            // Traffic lights for vertical roads
            for (let j = -gridSize; j <= gridSize; j++) {
                const trafficLight1 = createTrafficLight(
                    i * blockSize - roadWidth/2 - 1,
                    j * blockSize + blockSize/2,
                    -Math.PI / 2
                );
                city.add(trafficLight1);

                const trafficLight2 = createTrafficLight(
                    i * blockSize + roadWidth/2 + 1,
                    j * blockSize + blockSize/2,
                    Math.PI / 2
                );
                city.add(trafficLight2);
            }
        }
    }

    // Add street furniture
    for (let x = -gridSize; x < gridSize; x++) {
        for (let z = -gridSize; z < gridSize; z++) {
            // Add benches along sidewalks
            if (Math.random() < 0.3) {
                const bench = createBench(
                    x * blockSize + blockSize/2,
                    z * blockSize - roadWidth/2 - sidewalkWidth/2,
                    Math.PI
                );
                city.add(bench);
            }
            if (Math.random() < 0.3) {
                const bench = createBench(
                    x * blockSize + blockSize/2,
                    z * blockSize + roadWidth/2 + sidewalkWidth/2,
                    0
                );
                city.add(bench);
            }

            // Add trash bins
            if (Math.random() < 0.2) {
                const bin = createTrashBin(
                    x * blockSize + blockSize/2 + (Math.random() - 0.5) * 10,
                    z * blockSize - roadWidth/2 - sidewalkWidth/2 + (Math.random() - 0.5) * 2
                );
                city.add(bin);
            }
            if (Math.random() < 0.2) {
                const bin = createTrashBin(
                    x * blockSize + blockSize/2 + (Math.random() - 0.5) * 10,
                    z * blockSize + roadWidth/2 + sidewalkWidth/2 + (Math.random() - 0.5) * 2
                );
                city.add(bin);
            }
        }
    }

    // Add buildings and trees
    for (let x = -gridSize; x < gridSize; x++) {
        for (let z = -gridSize; z < gridSize; z++) {
            if (Math.random() < 0.7) {
                // Determine building type
                const rand = Math.random();
                const buildingType = rand < 0.1 ? 'skyscraper' :
                                   rand < 0.3 ? 'modern' :
                                   rand < 0.6 ? 'office' : 'residential';
                
                const building = createBuilding(
                    x * blockSize + blockSize/2,
                    z * blockSize + blockSize/2,
                    buildingType
                );
                city.add(building);
            } else if (Math.random() < 0.3) {
                // Add trees
                const treeType = Math.random() < 0.3 ? 'pine' : 'deciduous';
                const tree = createTree(
                    x * blockSize + blockSize/2 + (Math.random() - 0.5) * 20,
                    z * blockSize + blockSize/2 + (Math.random() - 0.5) * 20,
                    treeType
                );
                city.add(tree);
            }
        }
    }

    return city;
}

// Create car
function createCar() {
    const car = new THREE.Group();
    
    // Car body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2, 8),
        new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            metalness: 0.8,
            roughness: 0.2
        })
    );
    body.position.y = 1;
    body.castShadow = true;
    car.add(body);

    // Car roof
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(3, 1.5, 4),
        new THREE.MeshStandardMaterial({ 
            color: 0x880000,
            metalness: 0.8,
            roughness: 0.2
        })
    );
    roof.position.y = 2.75;
    roof.position.z = -0.5;
    roof.castShadow = true;
    car.add(roof);

    // Windows
    const windowGeometry = new THREE.PlaneGeometry(3, 1.2);
    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        metalness: 1,
        roughness: 0,
        transparent: true,
        opacity: 0.7
    });

    // Front window
    const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    frontWindow.position.set(0, 2.5, 3);
    car.add(frontWindow);

    // Back window
    const backWindow = new THREE.Mesh(windowGeometry, windowMaterial);
    backWindow.position.set(0, 2.5, -3);
    backWindow.rotation.y = Math.PI;
    car.add(backWindow);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.5, 32);
    const wheelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        roughness: 0.9
    });
    
    const wheelPositions = [
        { x: -2, y: 0.8, z: 2.5 },
        { x: 2, y: 0.8, z: 2.5 },
        { x: -2, y: 0.8, z: -2.5 },
        { x: 2, y: 0.8, z: -2.5 }
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        car.add(wheel);
    });

    return car;
}

// Initialize city and car
const city = createCity();
scene.add(city);

const car = createCar();
car.position.set(0, 0.4, 0);
scene.add(car);

// Simple car controls
const carControls = {
    speed: 0,
    maxSpeed: 0.5,
    acceleration: 0.02,  // Increased for more responsive acceleration
    deceleration: 0.01,  // Increased for more responsive deceleration
    turnSpeed: 0.03,
    bounceBack: 0.2
};

// Get all obstacles for collision detection
const obstacles = [];
city.traverse((object) => {
    if (object.isMesh && object !== ground) {
        object.userData.type = object.parent?.name || 'unknown';
        obstacles.push(object);
    }
});

// Car controls
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    // Log key press for debugging
    console.log('Key pressed:', e.key.toLowerCase());
});
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Check for collisions
function checkCollision(newPosition) {
    const carBox = new THREE.Box3().setFromCenterAndSize(
        newPosition,
        new THREE.Vector3(4, 2, 8)
    );

    for (const obstacle of obstacles) {
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);
        if (carBox.intersectsBox(obstacleBox)) {
            console.log('Collision with:', obstacle.userData.type);
            return true;
        }
    }

    const cityBoundary = 250;
    if (Math.abs(newPosition.x) > cityBoundary || Math.abs(newPosition.z) > cityBoundary) {
        console.log('Collision with city boundary');
        return true;
    }

    return false;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Handle car movement with more responsive controls
    if (keys['w'] || keys['arrowup']) {
        carControls.speed = Math.min(carControls.speed + carControls.acceleration, carControls.maxSpeed);
        console.log('Moving forward, speed:', carControls.speed);
    } else if (keys['s'] || keys['arrowdown']) {
        carControls.speed = Math.max(carControls.speed - carControls.acceleration, -carControls.maxSpeed);
        console.log('Moving backward, speed:', carControls.speed);
    } else {
        // Gradual deceleration when no keys are pressed
        if (carControls.speed > 0) {
            carControls.speed = Math.max(carControls.speed - carControls.deceleration, 0);
        } else if (carControls.speed < 0) {
            carControls.speed = Math.min(carControls.speed + carControls.deceleration, 0);
        }
    }

    // Always allow turning
    if (keys['a'] || keys['arrowleft']) {
        car.rotation.y += carControls.turnSpeed;
    }
    if (keys['d'] || keys['arrowright']) {
        car.rotation.y -= carControls.turnSpeed;
    }

    // Calculate new position
    const newPosition = car.position.clone();
    newPosition.x += Math.sin(car.rotation.y) * carControls.speed;
    newPosition.z += Math.cos(car.rotation.y) * carControls.speed;

    // Check for collisions before updating position
    if (checkCollision(newPosition)) {
        carControls.speed = -carControls.speed * carControls.bounceBack;
    } else {
        car.position.copy(newPosition);
    }

    // Update camera position
    const cameraOffset = new THREE.Vector3(
        Math.sin(car.rotation.y) * 8,
        5,
        Math.cos(car.rotation.y) * 8
    );
    camera.position.lerp(
        new THREE.Vector3(
            car.position.x + cameraOffset.x,
            car.position.y + cameraOffset.y,
            car.position.z + cameraOffset.z
        ),
        0.1
    );
    camera.lookAt(car.position);

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