import * as THREE from 'three';
import { CityLoader } from './CityLoader.js';

// Leiden coordinates
const LEIDEN_CENTER = {
    lat: 52.1601,
    lon: 4.4970
};

function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Create Sky class for realistic sky
class Sky {
  constructor() {
    // Sky dome geometry with higher resolution
    const skyGeo = new THREE.SphereGeometry(1000, 64, 64);
    
    // Create gradient texture for sky
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // Create enhanced gradient with more color stops
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#0a1a3f');    // Deep blue at top
    gradient.addColorStop(0.2, '#1e4877');  // Royal blue
    gradient.addColorStop(0.4, '#2a78aa');  // Steel blue
    gradient.addColorStop(0.6, '#4fa4d6');  // Light blue
    gradient.addColorStop(0.8, '#86c4e4');  // Pale blue
    gradient.addColorStop(0.9, '#c4e2ef');  // Very light blue
    gradient.addColorStop(1, '#e8f4f8');    // Almost white at horizon
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    const skyTexture = new THREE.CanvasTexture(canvas);
    skyTexture.wrapS = THREE.RepeatWrapping;
    skyTexture.wrapT = THREE.RepeatWrapping;
    skyTexture.repeat.set(4, 2);  // More texture repetition for better detail
    
    // Create sky material with improved settings
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      fog: false,
      transparent: true,
      opacity: 0.9
    });
    
    this.mesh = new THREE.Mesh(skyGeo, skyMat);
    this.canvas = canvas;
    this.context = context;
    this.texture = skyTexture;
  }

  // Update sky colors based on time of day
  updateColors(timeOfDay) { // 0 to 1 represents full day cycle
    const context = this.context;
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    
    if (timeOfDay < 0.25) { // Night to Dawn
      const t = timeOfDay * 4;
      gradient.addColorStop(0, '#000428');
      gradient.addColorStop(0.2, lerpColor('#000428', '#004e92', t));
      gradient.addColorStop(0.4, lerpColor('#000428', '#2c7aaa', t));
      gradient.addColorStop(0.6, lerpColor('#000428', '#48b1bf', t));
      gradient.addColorStop(0.8, lerpColor('#000428', '#f6d365', t));
      gradient.addColorStop(1, lerpColor('#000428', '#fda085', t));
    } else if (timeOfDay < 0.5) { // Dawn to Noon
      const t = (timeOfDay - 0.25) * 4;
      gradient.addColorStop(0, '#0034a5');
      gradient.addColorStop(0.2, '#0066ff');
      gradient.addColorStop(0.4, '#4d94ff');
      gradient.addColorStop(0.6, '#80b3ff');
      gradient.addColorStop(0.8, '#b3d1ff');
      gradient.addColorStop(1, '#e6f0ff');
    } else if (timeOfDay < 0.75) { // Noon to Dusk
      const t = (timeOfDay - 0.5) * 4;
      gradient.addColorStop(0, lerpColor('#0034a5', '#000428', t));
      gradient.addColorStop(0.2, lerpColor('#0066ff', '#004e92', t));
      gradient.addColorStop(0.4, lerpColor('#4d94ff', '#2c7aaa', t));
      gradient.addColorStop(0.6, lerpColor('#80b3ff', '#48b1bf', t));
      gradient.addColorStop(0.8, lerpColor('#b3d1ff', '#f6d365', t));
      gradient.addColorStop(1, lerpColor('#e6f0ff', '#fda085', t));
    } else { // Dusk to Night
      const t = (timeOfDay - 0.75) * 4;
      gradient.addColorStop(0, '#000428');
      gradient.addColorStop(0.2, lerpColor('#004e92', '#000428', t));
      gradient.addColorStop(0.4, lerpColor('#2c7aaa', '#000428', t));
      gradient.addColorStop(0.6, lerpColor('#48b1bf', '#000428', t));
      gradient.addColorStop(0.8, lerpColor('#f6d365', '#000428', t));
      gradient.addColorStop(1, lerpColor('#fda085', '#000428', t));
    }
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    this.texture.needsUpdate = true;
  }
}

// Helper function to interpolate between colors
function lerpColor(color1, color2, t) {
  const c1 = new THREE.Color(color1);
  const c2 = new THREE.Color(color2);
  const r = c1.r + (c2.r - c1.r) * t;
  const g = c1.g + (c2.g - c1.g) * t;
  const b = c1.b + (c2.b - c1.b) * t;
  return new THREE.Color(r, g, b).getHexString();
}

// Create Cloud class for realistic clouds
class Cloud {
  constructor() {
    this.mesh = new THREE.Object3D();
    
    // Create cloud particles
    const geometry = new THREE.SphereGeometry(5, 8, 8);
    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      flatShading: true
    });

    // Create random cloud shape with multiple spheres
    const nBlocs = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < nBlocs; i++) {
      const m = new THREE.Mesh(geometry.clone(), material);
      m.position.x = i * 4;
      m.position.y = Math.random() * 2;
      m.position.z = Math.random() * 2;
      m.rotation.z = Math.random() * Math.PI * 2;
      m.rotation.y = Math.random() * Math.PI * 2;
      
      const s = .1 + Math.random() * .9;
      m.scale.set(s, s, s);
      
      m.castShadow = true;
      m.receiveShadow = true;
      
      this.mesh.add(m);
    }
  }
}

// Create Clouds manager
class Clouds {
  constructor() {
    this.mesh = new THREE.Object3D();
    this.clouds = [];
    
    // Create clouds
    const nClouds = 20;
    for (let i = 0; i < nClouds; i++) {
      const cloud = new Cloud();
      cloud.mesh.position.set(
        Math.random() * 800 - 400,
        100 + Math.random() * 50,
        Math.random() * 800 - 400
      );
      cloud.mesh.rotation.y = Math.random() * Math.PI * 2;
      this.clouds.push(cloud);
      this.mesh.add(cloud.mesh);
    }
  }

  animate() {
    // Move clouds
    this.clouds.forEach((cloud, i) => {
      cloud.mesh.position.x += 0.1;
      if (cloud.mesh.position.x > 400) {
        cloud.mesh.position.x = -400;
      }
    });
  }
}

// Create the scene
const scene = new THREE.Scene();

// Add fog for depth
scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

// Create the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Create the renderer with better quality
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xe8f4f8);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Add directional light (sun)
const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.5);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
scene.add(sunLight);

// Add a secondary light for better ambient illumination
const hemisphereLight = new THREE.HemisphereLight(0xfffaf0, 0x080820, 0.5);
scene.add(hemisphereLight);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Initialize CityLoader for Leiden
console.log('Initializing CityLoader...');
const cityLoader = new CityLoader(scene, LEIDEN_CENTER.lat, LEIDEN_CENTER.lon);

// Load a small area of Leiden (adjust bounds as needed)
const bounds = {
    minLat: LEIDEN_CENTER.lat -
     0.005,
    maxLat: LEIDEN_CENTER.lat + 0.005,
    minLon: LEIDEN_CENTER.lon - 0.005,
    maxLon: LEIDEN_CENTER.lon + 0.005
};

// Load city data and map tiles
async function init() {
    try {
        console.log('Starting city initialization...');
        
        // Position camera to view the city
        camera.position.set(0, 50, 100);
        camera.lookAt(0, 0, 0);
        
        // Load city data first
        console.log('Loading city data...');
        await cityLoader.loadCityData(bounds);
        
        // Then load map tiles
        console.log('Loading map tiles...');
        await cityLoader.loadMapTiles(bounds);
        
        console.log('City initialization complete');
    } catch (error) {
        console.error('Error initializing city:', error);
    }
}

// Add loading indicator
const loadingDiv = document.createElement('div');
loadingDiv.style.position = 'absolute';
loadingDiv.style.top = '10px';
loadingDiv.style.left = '10px';
loadingDiv.style.color = 'white';
loadingDiv.style.fontFamily = 'Arial, sans-serif';
loadingDiv.style.fontSize = '14px';
loadingDiv.style.textShadow = '1px 1px 1px black';
document.body.appendChild(loadingDiv);

// Create and add sky
const sky = new Sky();
scene.add(sky.mesh);

// Create and add clouds
const clouds = new Clouds();
scene.add(clouds.mesh);

// Enhance sun properties
const sunGeometry = new THREE.SphereGeometry(15, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ 
  color: 0xffffa0,
  transparent: true,
  opacity: 0.9
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.position.set(50, 100, 50);
scene.add(sun);

// Add sun glow effect
const sunGlowGeometry = new THREE.SphereGeometry(20, 32, 32);
const sunGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffd0,
  transparent: true,
  opacity: 0.3
});
const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
sun.add(sunGlow);

// Create lens flare for sun
const textureLoader = new THREE.TextureLoader();
const flareColor = new THREE.Color(0xffffeb);

// Create the ground plane with better material
const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
const groundMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x1a472a,
    shininess: 5,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide 
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

// City chunk management
const CHUNK_SIZE = 200;
const RENDER_DISTANCE = 2;
const loadedChunks = new Set();
const cityElements = new THREE.Group();
scene.add(cityElements);

// Create road segment
function createRoadSegment(x, z) {
    const segment = new THREE.Group();

    // Main road
    const roadGeometry = new THREE.PlaneGeometry(CHUNK_SIZE, 20);
    const roadMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8,
    });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    segment.add(road);

    // Road markings
    const markingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (let i = -CHUNK_SIZE/2 + 10; i < CHUNK_SIZE/2; i += 20) {
        const marking = new THREE.Mesh(
            new THREE.PlaneGeometry(3, 0.3),
            markingMaterial
        );
        marking.rotation.x = -Math.PI / 2;
        marking.position.set(i, 0.02, 0);
        segment.add(marking);
    }

    // Sidewalks
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0x999999 });
    [-12, 12].forEach(offset => {
        const sidewalk = new THREE.Mesh(
            new THREE.PlaneGeometry(CHUNK_SIZE, 5),
            sidewalkMaterial
        );
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(0, 0.05, offset);
        segment.add(sidewalk);

        // Curb
        const curb = new THREE.Mesh(
            new THREE.BoxGeometry(CHUNK_SIZE, 0.2, 0.3),
            new THREE.MeshStandardMaterial({ color: 0x888888 })
        );
        curb.position.set(0, 0.1, offset + (offset > 0 ? -2.5 : 2.5));
        segment.add(curb);
    });

    segment.position.set(x, 0, z);
    return segment;
}

// Create building with more detail and variety
function createBuilding(type = null) {
    const building = new THREE.Group();
    if (!type) {
        const types = ['modern', 'classic', 'skyscraper', 'house'];
        type = types[Math.floor(Math.random() * types.length)];
    }
    let height, width, depth, color;
    switch(type) {
        case 'skyscraper':
            height = Math.random() * 60 + 60;
            width = Math.random() * 10 + 15;
            depth = Math.random() * 10 + 15;
            color = 0xcccccc;
            break;
        case 'modern':
            height = Math.random() * 30 + 20;
            width = Math.random() * 15 + 20;
            depth = Math.random() * 10 + 20;
            color = 0x999999;
            break;
        case 'classic':
            height = Math.random() * 20 + 10;
            width = Math.random() * 15 + 20;
            depth = Math.random() * 10 + 15;
            color = 0xbfa77a;
            break;
        case 'house':
        default:
            height = Math.random() * 8 + 6;
            width = Math.random() * 8 + 8;
            depth = Math.random() * 8 + 8;
            color = 0xd9c9a9;
            break;
    }
    // Main structure
    const buildingMaterial = new THREE.MeshPhysicalMaterial({
        color: color,
        roughness: 0.7,
        metalness: 0.2,
        clearcoat: 0.1
    });
    const mainStructure = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        buildingMaterial
    );
    mainStructure.position.y = height / 2;
    mainStructure.castShadow = true;
    mainStructure.receiveShadow = true;
    building.add(mainStructure);
    // Add windows for tall buildings
    if (type !== 'house') {
        const windowMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7,
            clearcoat: 1.0
        });
        const sides = [
            { axis: 'z', value: depth/2, rotation: 0 },
            { axis: 'z', value: -depth/2, rotation: Math.PI },
            { axis: 'x', value: width/2, rotation: Math.PI/2 },
            { axis: 'x', value: -width/2, rotation: -Math.PI/2 }
        ];
        sides.forEach(side => {
            for (let y = 2; y < height - 2; y += 3) {
                for (let x = -width/2 + 2; x < width/2 - 2; x += 3) {
                    const window = new THREE.Mesh(
                        new THREE.BoxGeometry(2, 2, 0.1),
                        windowMaterial
                    );
                    if (side.axis === 'z') {
                        window.position.set(x, y, side.value);
                    } else {
                        window.position.set(side.value, y, x);
                        window.rotation.y = side.rotation;
                    }
                    building.add(window);
                }
            }
        });
    } else {
        // Add a roof for houses
        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(width * 0.7, 3, 4),
            new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
        );
        roof.position.y = height + 1.5;
        roof.rotation.y = Math.PI / 4;
        building.add(roof);
    }
    return building;
}

// Create street light
function createStreetLight() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 6, 8),
        new THREE.MeshPhysicalMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 })
    );
    pole.position.y = 3;
    group.add(pole);
    const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 12, 12),
        new THREE.MeshPhysicalMaterial({ color: 0xffffcc, emissive: 0xffffcc, emissiveIntensity: 0.7, transparent: true, opacity: 0.8 })
    );
    lamp.position.y = 6.1;
    group.add(lamp);
    return group;
}

// Create park (simple green area with trees)
function createPark(size = 20) {
    const group = new THREE.Group();
    const park = new THREE.Mesh(
        new THREE.BoxGeometry(size, 0.2, size),
        new THREE.MeshPhongMaterial({ color: 0x4fa34f })
    );
    park.position.y = 0.1;
    group.add(park);
    // Add some trees
    for (let i = 0; i < 8; i++) {
        const tree = createTree();
        tree.position.x = (Math.random() - 0.5) * (size - 4);
        tree.position.z = (Math.random() - 0.5) * (size - 4);
        group.add(tree);
    }
    return group;
}

// Create tree
function createTree() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, 2, 8),
        new THREE.MeshStandardMaterial({ color: 0x8b5a2b })
    );
    trunk.position.y = 1;
    group.add(trunk);
    const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x228b22 })
    );
    leaves.position.y = 2.5;
    group.add(leaves);
    return group;
}

// Update createCityChunk for grid layout, parks, street lights, sidewalks, crosswalks
function createCityChunk(chunkX, chunkZ) {
    const chunk = new THREE.Group();
    const chunkKey = `${chunkX},${chunkZ}`;
    if (loadedChunks.has(chunkKey)) return null;
    loadedChunks.add(chunkKey);
    // Add road
    const road = createRoadSegment(chunkX * CHUNK_SIZE, chunkZ * CHUNK_SIZE);
    chunk.add(road);
    // Add sidewalks
    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xb0b0b0 });
    [-16, 16].forEach(offset => {
        const sidewalk = new THREE.Mesh(
            new THREE.PlaneGeometry(CHUNK_SIZE, 4),
            sidewalkMaterial
        );
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(chunkX * CHUNK_SIZE, 0.06, chunkZ * CHUNK_SIZE + offset);
        chunk.add(sidewalk);
    });
    // Add crosswalks at intersections
    if (chunkX % 2 === 0 && chunkZ % 2 === 0) {
        for (let i = -8; i <= 8; i += 4) {
            const crosswalk = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 0.5),
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );
            crosswalk.rotation.x = -Math.PI / 2;
            crosswalk.position.set(chunkX * CHUNK_SIZE + i, 0.07, chunkZ * CHUNK_SIZE + 0);
            chunk.add(crosswalk);
        }
    }
    // Add buildings and parks
    for (let i = 0; i < 4; i++) {
        if (Math.random() < 0.2) {
            // Park
            const park = createPark(18 + Math.random() * 8);
            park.position.x = chunkX * CHUNK_SIZE + (Math.random() - 0.5) * (CHUNK_SIZE - 40);
            park.position.z = chunkZ * CHUNK_SIZE + (Math.random() > 0.5 ? 25 : -25);
            chunk.add(park);
        } else {
            // Building
            const building = createBuilding();
            building.position.x = chunkX * CHUNK_SIZE + (Math.random() - 0.5) * (CHUNK_SIZE - 40);
            building.position.z = chunkZ * CHUNK_SIZE + (Math.random() > 0.5 ? 25 : -25);
            chunk.add(building);
        }
    }
    // Add street lights
    for (let i = 0; i < 4; i++) {
        const light = createStreetLight();
        light.position.x = chunkX * CHUNK_SIZE + (i < 2 ? -CHUNK_SIZE/2 + 5 : CHUNK_SIZE/2 - 5);
        light.position.z = chunkZ * CHUNK_SIZE + (i % 2 === 0 ? -10 : 10);
        chunk.add(light);
    }
    return chunk;
}

// Create car
function createCar() {
    const car = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(4, 1.5, 2),
        new THREE.MeshPhysicalMaterial({ 
            color: 0xff0000,
            metalness: 0.6,
            roughness: 0.4,
            clearcoat: 0.5
        })
    );
    body.position.y = 1;
    car.add(body);

    // Roof
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1.2, 1.8),
        new THREE.MeshPhysicalMaterial({ 
            color: 0xff0000,
            metalness: 0.6,
            roughness: 0.4,
            clearcoat: 0.5
        })
    );
    roof.position.set(-0.5, 2.35, 0);
    car.add(roof);

    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    
    [-1.5, 1.5].forEach(x => {
        [-0.8, 0.8].forEach(z => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.4, z);
            car.add(wheel);
        });
    });

    // Windows
    const windowMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x222222,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.8
    });

    // Windshield
    const windshield = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1),
        windowMaterial
    );
    windshield.position.set(0.7, 2, 0);
    windshield.rotation.x = -Math.PI / 6;
    car.add(windshield);

    // Headlights
    const headlightGeometry = new THREE.CircleGeometry(0.2, 16);
    const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffee });
    
    [-0.8, 0.8].forEach(z => {
        const headlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        headlight.position.set(2, 1, z);
        headlight.rotation.y = Math.PI / 2;
        car.add(headlight);
    });

    return car;
}

// Create and position car
const car = createCar();
car.position.set(0, 0, 0);
scene.add(car);

// Car controls
const carControls = {
    speed: 0,
    maxSpeed: 0.8,
    acceleration: 0.008,
    deceleration: 0.004,
    turnSpeed: 0.03
};

// Keyboard controls
const keys = {};
document.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// Update chunks based on car position
function updateChunks() {
    const currentChunkX = Math.floor(car.position.x / CHUNK_SIZE);
    const currentChunkZ = Math.floor(car.position.z / CHUNK_SIZE);

    // Load new chunks
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
            const chunk = createCityChunk(currentChunkX + x, currentChunkZ + z);
            if (chunk) cityElements.add(chunk);
        }
    }

    // Clean up far chunks
    const maxDistance = (RENDER_DISTANCE + 1) * CHUNK_SIZE;
    cityElements.children.forEach(chunk => {
        const distance = new THREE.Vector2(
            chunk.position.x - car.position.x,
            chunk.position.z - car.position.z
        ).length();
        
        if (distance > maxDistance) {
            cityElements.remove(chunk);
            loadedChunks.delete(`${Math.floor(chunk.position.x/CHUNK_SIZE)},${Math.floor(chunk.position.z/CHUNK_SIZE)}`);
        }
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update speed
    if (keys['w']) {
        carControls.speed = Math.min(carControls.speed + carControls.acceleration, carControls.maxSpeed);
    } else if (keys['s']) {
        carControls.speed = Math.max(carControls.speed - carControls.acceleration, -carControls.maxSpeed * 0.5);
    } else {
        carControls.speed *= 0.95;
    }

    // Rotate only while moving
    if (carControls.speed !== 0) {
        const direction = carControls.speed > 0 ? 1 : -1;
        if (keys['a']) car.rotation.y += carControls.turnSpeed * direction;
        if (keys['d']) car.rotation.y -= carControls.turnSpeed * direction;
    }

    // Move the car forward/backward
    car.position.x -= Math.sin(car.rotation.y) * carControls.speed;
    car.position.z -= Math.cos(car.rotation.y) * carControls.speed;

    // Chase camera behind the car
    const cameraDistance = 10;
    const cameraHeight = 5;
    const offsetX = Math.sin(car.rotation.y) * cameraDistance;
    const offsetZ = Math.cos(car.rotation.y) * cameraDistance;

    camera.position.x = car.position.x + offsetX;
    camera.position.y = car.position.y + cameraHeight;
    camera.position.z = car.position.z + offsetZ;

    camera.lookAt(car.position.clone().add(new THREE.Vector3(0, 2, 0)));

    // Update chunks
    updateChunks();

    // Animate clouds
    clouds.animate();

    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the application
console.log('Starting application...');
init().then(() => {
    console.log('Initialization complete, starting animation loop');
    animate();
}).catch(error => {
    console.error('Failed to initialize:', error);
    loadingDiv.textContent = 'Error loading city data. Please check console for details.';
});
  