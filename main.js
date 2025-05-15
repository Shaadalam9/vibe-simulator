import * as THREE from 'three';
import { CityLoader } from './CityLoader.js';

// Add texture loader
const textureLoader = new THREE.TextureLoader();

// Create environment map for reflections
function createEnvironmentMap() {
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 512;
    envCanvas.height = 512;
    const envContext = envCanvas.getContext('2d');

    // Create sky gradient
    const skyGradient = envContext.createLinearGradient(0, 0, 0, 512);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#E0F7FF');
    envContext.fillStyle = skyGradient;
    envContext.fillRect(0, 0, 512, 512);

    // Add some clouds
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 256;
        const radius = Math.random() * 50 + 30;
        envContext.beginPath();
        envContext.arc(x, y, radius, 0, Math.PI * 2);
        envContext.fillStyle = 'rgba(255, 255, 255, 0.8)';
        envContext.fill();
    }

    const envTexture = new THREE.CanvasTexture(envCanvas);
    return new THREE.WebGLCubeRenderTarget(512).fromEquirectangularTexture(envTexture);
}

// Create procedural textures for car materials
function createCarTextures() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // Create metallic paint texture
    const paintGradient = context.createLinearGradient(0, 0, 0, 512);
    paintGradient.addColorStop(0, '#ff0000');
    paintGradient.addColorStop(0.5, '#cc0000');
    paintGradient.addColorStop(1, '#ff0000');
    context.fillStyle = paintGradient;
    context.fillRect(0, 0, 512, 512);

    // Add noise for metallic effect
    for (let i = 0; i < 10000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const brightness = Math.random() * 50;
        context.fillStyle = `rgba(255, 255, 255, ${brightness / 255})`;
        context.fillRect(x, y, 1, 1);
    }

    const paintTexture = new THREE.CanvasTexture(canvas);
    paintTexture.wrapS = THREE.RepeatWrapping;
    paintTexture.wrapT = THREE.RepeatWrapping;
    paintTexture.repeat.set(4, 2);

    // Create normal map for paint
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = 512;
    normalCanvas.height = 512;
    const normalContext = normalCanvas.getContext('2d');
    
    // Generate normal map
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 20 + 10;
        const gradient = normalContext.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgb(128, 128, 255)');
        gradient.addColorStop(1, 'rgb(128, 128, 128)');
        normalContext.fillStyle = gradient;
        normalContext.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    const normalMap = new THREE.CanvasTexture(normalCanvas);
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(4, 2);

    return { paintTexture, normalMap };
}

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

// Update ambient light for better overall visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

// Initialize city loader
const cityLoader = new CityLoader(scene, LEIDEN_CENTER.lat, LEIDEN_CENTER.lon, renderer, camera);

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
        camera.position.set(0, 5, 10);  // Start closer to the car
        camera.lookAt(0, 0, 0);
        
        // Check if CityLoader is properly initialized
        if (!cityLoader) {
            throw new Error('CityLoader not properly initialized');
        }
        
        // Load city data first
        console.log('Loading city data...');
        try {
            await cityLoader.loadCityData(bounds);
        } catch (error) {
            console.warn('Warning: Could not load city data:', error);
            // Create a basic city layout as fallback
            createFallbackCity();
        }
        
        // Then load map tiles
        console.log('Loading map tiles...');
        try {
            await cityLoader.loadMapTiles(bounds);
        } catch (error) {
            console.warn('Warning: Could not load map tiles:', error);
            // Continue without map tiles
        }
        
        console.log('City initialization complete');
    } catch (error) {
        console.error('Error initializing city:', error);
        loadingDiv.textContent = 'Error initializing city. Some features may be limited.';
        // Create fallback city even if initialization fails
        createFallbackCity();
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
const flareColor = new THREE.Color(0xffffeb);

// Create the ground plane with better material
const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a472a,
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
        const types = ['modern', 'classic', 'skyscraper', 'house', 'office'];
        type = types[Math.floor(Math.random() * types.length)];
    }
    
    let height, width, depth, color, style;
    switch(type) {
        case 'skyscraper':
            height = Math.random() * 80 + 100;
            width = Math.random() * 15 + 20;
            depth = Math.random() * 15 + 20;
            color = 0x88aacc;
            style = 'modern';
            break;
        case 'modern':
            height = Math.random() * 40 + 30;
            width = Math.random() * 20 + 25;
            depth = Math.random() * 15 + 25;
            color = 0xcccccc;
            style = 'modern';
            break;
        case 'office':
            height = Math.random() * 30 + 40;
            width = Math.random() * 25 + 30;
            depth = Math.random() * 20 + 30;
            color = 0x99aabb;
            style = 'modern';
            break;
        case 'classic':
            height = Math.random() * 25 + 15;
            width = Math.random() * 20 + 25;
            depth = Math.random() * 15 + 20;
            color = 0xd4b483;
            style = 'classic';
            break;
        case 'house':
        default:
            height = Math.random() * 10 + 8;
            width = Math.random() * 10 + 12;
            depth = Math.random() * 10 + 12;
            color = 0xe8d0b0;
            style = 'classic';
            break;
    }

    // Main structure with enhanced materials
    const buildingMaterial = new THREE.MeshPhysicalMaterial({
        color: color,
        roughness: style === 'modern' ? 0.3 : 0.7,
        metalness: style === 'modern' ? 0.8 : 0.2,
        clearcoat: style === 'modern' ? 0.5 : 0.1,
        envMapIntensity: 1.0
    });

    const mainStructure = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        buildingMaterial
    );
    mainStructure.position.y = height / 2;
    mainStructure.castShadow = true;
    mainStructure.receiveShadow = true;
    building.add(mainStructure);

    // Add windows
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.7,
        clearcoat: 1.0,
        transmission: 0.95
    });

    const windowSize = 2;
    const windowSpacing = 3;
    const sides = [
        { axis: 'z', value: depth/2, rotation: 0 },
        { axis: 'z', value: -depth/2, rotation: Math.PI },
        { axis: 'x', value: width/2, rotation: Math.PI/2 },
        { axis: 'x', value: -width/2, rotation: -Math.PI/2 }
    ];

    sides.forEach(side => {
        for (let y = 2; y < height - 2; y += windowSpacing) {
            for (let x = -width/2 + 2; x < width/2 - 2; x += windowSpacing) {
                const window = new THREE.Mesh(
                    new THREE.BoxGeometry(windowSize, windowSize, 0.1),
                    glassMaterial
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

    // Add architectural features based on style
    if (style === 'modern') {
        if (type === 'skyscraper') {
            // Add antenna/spire
            const spireGeometry = new THREE.CylinderGeometry(0.5, 0.5, height * 0.1, 8);
            const spireMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xcccccc,
                metalness: 0.9,
                roughness: 0.1
            });
            const spire = new THREE.Mesh(spireGeometry, spireMaterial);
            spire.position.y = height + height * 0.05;
            building.add(spire);
        }
    } else {
        if (type === 'house') {
            // Add pitched roof
            const roofGeometry = new THREE.ConeGeometry(width * 0.7, height * 0.4, 4);
            const roofMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x8b4513,
                roughness: 0.8,
                metalness: 0.1
            });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = height + height * 0.2;
            roof.rotation.y = Math.PI / 4;
            building.add(roof);

            // Add chimney
            const chimneyGeometry = new THREE.BoxGeometry(1, height * 0.3, 1);
            const chimney = new THREE.Mesh(chimneyGeometry, roofMaterial);
            chimney.position.set(width * 0.2, height + height * 0.35, depth * 0.2);
            building.add(chimney);
        } else {
            // Add cornice for classic buildings
            const corniceGeometry = new THREE.BoxGeometry(width + 1, 1, depth + 1);
            const corniceMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xcccccc,
                roughness: 0.7,
                metalness: 0.2
            });
            const cornice = new THREE.Mesh(corniceGeometry, corniceMaterial);
            cornice.position.y = height;
            building.add(cornice);
        }
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

    // Main body - luxury sports car proportions
    const bodyGeometry = new THREE.BoxGeometry(4.0, 1.2, 2.0);  // Reduced size
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x00ffff,  // Bright cyan color
        metalness: 0.9,
        roughness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.5,
        reflectivity: 1.0,
        transmission: 0.0,
        thickness: 0.5,
        ior: 2.5
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;  // Lowered position
    car.add(body);

    // Front section - aerodynamic design
    const frontGeometry = new THREE.BoxGeometry(1.2, 0.8, 2.0);  // Adjusted size
    const front = new THREE.Mesh(frontGeometry, bodyMaterial);
    front.position.set(1.5, 0.6, 0);  // Adjusted position
    car.add(front);

    // Hood - curved and aerodynamic
    const hoodGeometry = new THREE.BoxGeometry(1.5, 0.3, 2.0);  // Adjusted size
    const hood = new THREE.Mesh(hoodGeometry, bodyMaterial);
    hood.position.set(0.8, 0.9, 0);  // Adjusted position
    hood.rotation.x = -0.1;
    car.add(hood);

    // Roof - low and sleek
    const roofGeometry = new THREE.BoxGeometry(2.0, 0.8, 1.8);  // Adjusted size
    const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
    roof.position.set(-0.3, 1.3, 0);  // Adjusted position
    roof.rotation.x = 0.05;
    car.add(roof);

    // Enhanced glass material
    const glassMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x88ccff,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.6,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transmission: 0.95,
        thickness: 0.5,
        ior: 1.5,
        reflectivity: 1.0
    });

    // Windshield with proper angle
    const windshieldGeometry = new THREE.PlaneGeometry(1.8, 1.0);  // Adjusted size
    const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
    windshield.position.set(0.8, 1.3, 0);  // Adjusted position
    windshield.rotation.x = -Math.PI / 4;
    car.add(windshield);

    // Wheels with detailed rims
    const wheelPositions = [
        { x: -1.2, z: -1.0, camber: -0.05 },  // Front left
        { x: -1.2, z: 1.0, camber: 0.05 },    // Front right
        { x: 1.2, z: -1.0, camber: -0.02 },   // Rear left
        { x: 1.2, z: 1.0, camber: 0.02 }      // Rear right
    ];

    wheelPositions.forEach(pos => {
        // Tire
        const tireGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);  // Adjusted size
        const tireMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x111111,
            metalness: 0.1,
            roughness: 0.8,
            clearcoat: 0.1
        });
        const tire = new THREE.Mesh(tireGeometry, tireMaterial);
        tire.rotation.z = Math.PI / 2;
        tire.rotation.y = pos.camber;
        tire.position.set(pos.x, 0.4, pos.z);  // Adjusted position
        car.add(tire);

        // Rim
        const rimGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.31, 32);  // Adjusted size
        const rimMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xcccccc,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 1.0
        });
        const rim = new THREE.Mesh(rimGeometry, rimMaterial);
        rim.rotation.z = Math.PI / 2;
        rim.rotation.y = pos.camber;
        rim.position.set(pos.x, 0.4, pos.z);  // Adjusted position
        car.add(rim);

        // Add detailed spokes
        for (let i = 0; i < 10; i++) {
            const spokeGeometry = new THREE.BoxGeometry(0.3, 0.04, 0.04);  // Adjusted size
            const spoke = new THREE.Mesh(spokeGeometry, rimMaterial);
            spoke.position.set(pos.x, 0.4, pos.z);  // Adjusted position
            spoke.rotation.z = (i * Math.PI * 2) / 10;
            spoke.rotation.y = pos.camber;
            car.add(spoke);
        }
    });

    // Headlights with LED array
    const headlightPositions = [-0.8, 0.8];  // Adjusted positions
    headlightPositions.forEach(z => {
        const headlightMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            emissive: 0xffffcc,
            emissiveIntensity: 0.5,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 1.0,
            transparent: true,
            opacity: 0.9
        });

        const projectorGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.08, 32);  // Adjusted size
        const projector = new THREE.Mesh(projectorGeometry, headlightMaterial);
        projector.position.set(2.05, 0.6, z);  // Adjusted position
        projector.rotation.z = Math.PI / 2;
        car.add(projector);

        // Add LED array
        for (let i = 0; i < 3; i++) {
            const ledGeometry = new THREE.BoxGeometry(0.01, 0.04, 0.15);  // Adjusted size
            const ledMaterial = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.9
            });
            const led = new THREE.Mesh(ledGeometry, ledMaterial);
            led.position.set(2.06, 0.8 + i * 0.07, z);  // Adjusted position
            led.rotation.y = Math.PI / 2;
            car.add(led);
        }
    });

    // Add shadows to all parts
    car.traverse((object) => {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
        }
    });

    return car;
}

// Create and position car
const car = createCar();
car.position.set(0, 0.4, 0);  // Lowered position to be on the road
scene.add(car);

// Add car-specific lighting
const carLight = new THREE.SpotLight(0xffffff, 3);  // Increased intensity
carLight.position.set(0, 15, 0);  // Raised light position
carLight.angle = Math.PI / 3;     // Wider angle
carLight.penumbra = 0.2;          // Softer edges
carLight.decay = 1.5;             // Reduced decay
carLight.distance = 100;          // Increased distance
carLight.castShadow = true;
carLight.shadow.mapSize.width = 2048;  // Increased shadow quality
carLight.shadow.mapSize.height = 2048;
scene.add(carLight);

// Add a point light to highlight the car
const pointLight = new THREE.PointLight(0xffffff, 2);  // Increased intensity
pointLight.position.set(0, 10, 0);
scene.add(pointLight);

// Add collision detection
function checkCollision(position, radius) {
    // Check collision with buildings
    cityElements.children.forEach(element => {
        if (element.isGroup && element.children.length > 0) {
            // Get the bounding box of the building
            const box = new THREE.Box3().setFromObject(element);
            
            // Check if car is too close to building
            if (box.containsPoint(position)) {
                return true;
            }
            
            // Check distance to building edges
            const distance = box.distanceToPoint(position);
            if (distance < radius) {
                return true;
            }
        }
    });
    return false;
}

// Update car controls for better handling
const carControls = {
    speed: 0,
    maxSpeed: 1.5,
    minSpeed: -0.8,
    acceleration: 0.03,
    deceleration: 0.02,
    brakeForce: 0.08,
    turnSpeed: 0.04,
    driftFactor: 0.98,
    currentTurnSpeed: 0,
    maxTurnSpeed: 0.06,
    handling: 0.95,
    collisionRadius: 2.0  // Collision detection radius
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

    // Handle acceleration and braking
    if (keys['w']) {
        carControls.speed = Math.min(carControls.speed + carControls.acceleration, carControls.maxSpeed);
    } else if (keys['s']) {
        if (carControls.speed > 0) {
            carControls.speed = Math.max(carControls.speed - carControls.brakeForce, 0);
        } else {
            carControls.speed = Math.max(carControls.speed - carControls.acceleration, carControls.minSpeed);
        }
    } else {
        if (carControls.speed > 0) {
            carControls.speed = Math.max(carControls.speed - carControls.deceleration, 0);
        } else if (carControls.speed < 0) {
            carControls.speed = Math.min(carControls.speed + carControls.deceleration, 0);
        }
    }

    // Handle turning with speed-dependent turning radius
    if (Math.abs(carControls.speed) > 0.1) {
        const speedFactor = Math.abs(carControls.speed) / carControls.maxSpeed;
        const direction = carControls.speed > 0 ? 1 : -1;
        
        if (keys['a']) {
            carControls.currentTurnSpeed = Math.min(
                carControls.currentTurnSpeed + carControls.turnSpeed,
                carControls.maxTurnSpeed * speedFactor
            );
        } else if (keys['d']) {
            carControls.currentTurnSpeed = Math.max(
                carControls.currentTurnSpeed - carControls.turnSpeed,
                -carControls.maxTurnSpeed * speedFactor
            );
        } else {
            carControls.currentTurnSpeed *= carControls.handling;
        }
        
        car.rotation.y += carControls.currentTurnSpeed * direction;
    } else {
        carControls.currentTurnSpeed = 0;
    }

    // Calculate movement with drift effect
    const moveX = Math.sin(car.rotation.y) * carControls.speed;
    const moveZ = Math.cos(car.rotation.y) * carControls.speed;
    
    // Check for collisions before moving
    const nextPosition = new THREE.Vector3(
        car.position.x - moveX,
        car.position.y,
        car.position.z - moveZ
    );

    if (!checkCollision(nextPosition, carControls.collisionRadius)) {
        // Apply movement if no collision
        car.position.x = nextPosition.x;
        car.position.z = nextPosition.z;
    } else {
        // Stop the car if collision detected
        carControls.speed = 0;
        carControls.currentTurnSpeed = 0;
    }

    // Update car light position to follow the car
    carLight.position.x = car.position.x;
    carLight.position.z = car.position.z;
    carLight.target = car;

    // Update point light position
    pointLight.position.x = car.position.x;
    pointLight.position.z = car.position.z;

    // Dynamic camera following with smooth transitions
    const cameraDistance = 10;
    const cameraHeight = 5;
    const cameraOffset = new THREE.Vector3(
        Math.sin(car.rotation.y) * cameraDistance,
        cameraHeight,
        Math.cos(car.rotation.y) * cameraDistance
    );

    camera.position.lerp(
        new THREE.Vector3(
            car.position.x + cameraOffset.x,
            car.position.y + cameraOffset.y,
            car.position.z + cameraOffset.z
        ),
        0.1
    );

    const lookAhead = new THREE.Vector3(
        car.position.x - Math.sin(car.rotation.y) * (carControls.speed * 3),
        car.position.y + 1.2,
        car.position.z - Math.cos(car.rotation.y) * (carControls.speed * 3)
    );
    camera.lookAt(lookAhead);

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

// Create a basic city layout as fallback
function createFallbackCity() {
    console.log('Creating fallback city layout...');
    
    // Create a grid of roads
    const gridSize = 8;  // Increased grid size
    const spacing = 30;  // Reduced spacing
    
    // Create horizontal roads
    for (let i = -gridSize; i <= gridSize; i++) {
        const road = createRoadSegment(i * spacing, 0);
        road.rotation.y = Math.PI / 2;
        cityElements.add(road);
    }
    
    // Create vertical roads
    for (let i = -gridSize; i <= gridSize; i++) {
        const road = createRoadSegment(0, i * spacing);
        cityElements.add(road);
    }
    
    // Add buildings along the roads
    for (let x = -gridSize; x <= gridSize; x++) {
        for (let z = -gridSize; z <= gridSize; z++) {
            if (Math.random() < 0.7) {
                const building = createBuilding();
                building.position.set(
                    x * spacing + (Math.random() - 0.5) * 20,  // Reduced spread
                    0,
                    z * spacing + (Math.random() - 0.5) * 20   // Reduced spread
                );
                cityElements.add(building);
            }
        }
    }
    
    // Add street lights
    for (let x = -gridSize; x <= gridSize; x++) {
        for (let z = -gridSize; z <= gridSize; z++) {
            if (Math.random() < 0.3) {
                const light = createStreetLight();
                light.position.set(
                    x * spacing + (Math.random() - 0.5) * 25,  // Reduced spread
                    0,
                    z * spacing + (Math.random() - 0.5) * 25   // Reduced spread
                );
                cityElements.add(light);
            }
        }
    }
    
    // Add some parks
    for (let x = -gridSize; x <= gridSize; x++) {
        for (let z = -gridSize; z <= gridSize; z++) {
            if (Math.random() < 0.1) {
                const park = createPark(15 + Math.random() * 8);  // Reduced size
                park.position.set(
                    x * spacing + (Math.random() - 0.5) * 20,  // Reduced spread
                    0,
                    z * spacing + (Math.random() - 0.5) * 20   // Reduced spread
                );
                cityElements.add(park);
            }
        }
    }
    
    console.log('Fallback city layout created');
}
  