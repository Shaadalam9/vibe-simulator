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

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create the camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

// Add lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 10, 0);
scene.add(light);

// Create ground
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ color: 0x333333 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Create a simple building
const building = new THREE.Mesh(
    new THREE.BoxGeometry(10, 20, 10),
    new THREE.MeshBasicMaterial({ color: 0x888888 })
);
building.position.set(0, 10, 0);
scene.add(building);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// Start animation
animate();

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize
function init() {
    const city = createCity();
    scene.add(city);
    
    // Position car
    car.position.set(0, 0.4, 0);
    car.rotation.y = Math.PI;
    scene.add(car);
    
    // Start animation
    animate();
}

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
    
    // Clear existing city elements
    while(cityElements.children.length > 0) {
        cityElements.remove(cityElements.children[0]);
    }
    
    // Create a grid of roads
    const gridSize = 8;
    const spacing = 30;
    
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
                    x * spacing + (Math.random() - 0.5) * 20,
                    0,
                    z * spacing + (Math.random() - 0.5) * 20
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
                    x * spacing + (Math.random() - 0.5) * 25,
                    0,
                    z * spacing + (Math.random() - 0.5) * 25
                );
                cityElements.add(light);
            }
        }
    }
    
    // Add some parks
    for (let x = -gridSize; x <= gridSize; x++) {
        for (let z = -gridSize; z <= gridSize; z++) {
            if (Math.random() < 0.1) {
                const park = createPark(15 + Math.random() * 8);
                park.position.set(
                    x * spacing + (Math.random() - 0.5) * 20,
                    0,
                    z * spacing + (Math.random() - 0.5) * 20
                );
                cityElements.add(park);
            }
        }
    }
    
    console.log('Fallback city layout created');
}

// Create realistic ground texture
function createGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext('2d');

    // Base asphalt color
    context.fillStyle = '#1a1a1a';
    context.fillRect(0, 0, 1024, 1024);

    // Add noise and texture
    for (let i = 0; i < 10000; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const size = Math.random() * 2 + 1;
        const brightness = Math.random() * 30;
        context.fillStyle = `rgba(255, 255, 255, ${brightness / 255})`;
        context.fillRect(x, y, size, size);
    }

    // Add road markings
    context.strokeStyle = '#ffffff';
    context.lineWidth = 4;
    for (let i = 0; i < 1024; i += 40) {
        context.beginPath();
        context.moveTo(i, 0);
        context.lineTo(i, 1024);
        context.stroke();
    }

    return new THREE.CanvasTexture(canvas);
}

// Create realistic building textures
function createBuildingTextures() {
    const textures = {
        modern: createModernBuildingTexture(),
        classic: createClassicBuildingTexture(),
        glass: createGlassTexture()
    };
    return textures;
}

function createModernBuildingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // Base color
    context.fillStyle = '#88aacc';
    context.fillRect(0, 0, 512, 512);

    // Add metallic effect
    for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 3 + 1;
        const brightness = Math.random() * 50;
        context.fillStyle = `rgba(255, 255, 255, ${brightness / 255})`;
        context.fillRect(x, y, size, size);
    }

    return new THREE.CanvasTexture(canvas);
}

function createClassicBuildingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // Base color
    context.fillStyle = '#d4b483';
    context.fillRect(0, 0, 512, 512);

    // Add stone texture
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 4 + 2;
        const brightness = Math.random() * 40;
        context.fillStyle = `rgba(255, 255, 255, ${brightness / 255})`;
        context.fillRect(x, y, size, size);
    }

    return new THREE.CanvasTexture(canvas);
}

function createGlassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');

    // Base color
    context.fillStyle = '#88ccff';
    context.fillRect(0, 0, 512, 512);

    // Add reflection effect
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 20 + 10;
        const brightness = Math.random() * 100;
        context.fillStyle = `rgba(255, 255, 255, ${brightness / 255})`;
        context.fillRect(x, y, size, size);
    }

    return new THREE.CanvasTexture(canvas);
}
  