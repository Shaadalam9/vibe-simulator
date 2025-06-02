console.log('main.js script started');
import './style.css'
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Car } from './Car.js';
import { Terrain } from './Terrain.js';
import { Game } from './game.js';

let scene, camera, renderer;
let car, terrain;
let world;
let clock;
let sky;
let sun;
let timeOfDay = 0.5;
let timeSpeed = 0.1;
let loadingManager;
let isGameInitialized = false;

// Camera settings
const cameraSettings = {
    distance: 8,
    height: 3,
    lookAhead: 20,
    smoothness: 0.1
};

// Create loading screen
const loadingElement = document.createElement('div');
loadingElement.id = 'loading';
loadingElement.style.position = 'fixed';
loadingElement.style.top = '0';
loadingElement.style.left = '0';
loadingElement.style.width = '100%';
loadingElement.style.height = '100%';
loadingElement.style.backgroundColor = '#000';
loadingElement.style.color = '#fff';
loadingElement.style.display = 'flex';
loadingElement.style.justifyContent = 'center';
loadingElement.style.alignItems = 'center';
loadingElement.style.fontSize = '24px';
loadingElement.style.fontFamily = 'Arial, sans-serif';
loadingElement.textContent = 'Loading...';
document.body.appendChild(loadingElement);

// Add styles
const style = document.createElement('style');
style.textContent = `
    body {
        margin: 0;
        overflow: hidden;
        background: #000;
    }
    canvas {
        display: block;
    }
    #loading {
        transition: opacity 0.5s;
    }
`;
document.head.appendChild(style);

// Initialize the game
function init() {
    console.log('init() function called');
    // Create loading manager
    loadingManager = new THREE.LoadingManager();
    
    // Since no assets are explicitly loaded, the manager is immediately ready.
    // Manually trigger the initialization steps.
    console.log('Attempting to force game initialization and hide loading screen.');
    document.querySelector('.loading').style.display = 'none';
    isGameInitialized = true;

    // Keep onLoad for potential future use (e.g., loading models, textures)
    loadingManager.onLoad = () => {
        console.log('Loading complete (onLoad callback - should not fire without assets).');
    };

    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, -10);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    console.log('Renderer DOM Element:', renderer.domElement);
    document.body.appendChild(renderer.domElement);
    
    // Ensure the canvas is on top
    renderer.domElement.style.zIndex = '1001';

    // Create physics world
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    // Create materials and contact material for car and terrain
    const wheelMaterial = new CANNON.Material('wheelMaterial');
    // Create terrain material and add it to the world BEFORE creating the Terrain object
    const terrainMaterial = new CANNON.Material('terrainMaterial');

    const wheelTerrainContact = new CANNON.ContactMaterial(
        wheelMaterial,
        terrainMaterial,
        {
            friction: 1.0, // High friction
            restitution: 0.1 // Low restitution (bounciness)
        }
    );
    world.addContactMaterial(wheelTerrainContact);

    // Create clock for timing
    clock = new THREE.Clock();

    // Create sky and lighting
    createSky();
    createLighting();

    // Create terrain
    terrain = new Terrain(scene, world, terrainMaterial);

    // Create car
    car = new Car(scene, world);

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start animation loop
    animate();
}

function createSky() {
    // Create sky dome
    const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x87CEEB) }, // Softer sky blue
            bottomColor: { value: new THREE.Color(0xFFFFFF) }, // White horizon
            offset: { value: 15 }, // Lower offset for a wider horizon effect
            exponent: { value: 0.8 } // Adjusted exponent for smoother gradient
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide
    });
    sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);

    // Create sun (simplified for now)
    const sunGeometry = new THREE.SphereGeometry(50, 32, 32); // Larger sun
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFCC, // Warmer sun color
        transparent: true,
        opacity: 1.0 // Solid sun
    });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);
}

function createLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Slightly brighter ambient light
    scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Adjusted intensity
    directionalLight.position.set(10, 10, 10); // Adjusted position
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -200; // Increased shadow camera size
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    scene.add(directionalLight);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Game controls
const gameControls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
    handbrake: false
};

// Handle keyboard input
document.addEventListener('keydown', (event) => {
    switch (event.key.toLowerCase()) {
        case 'w':
            gameControls.forward = true;
            break;
        case 's':
            gameControls.backward = true;
            break;
        case 'a':
            gameControls.left = true;
            break;
        case 'd':
            gameControls.right = true;
            break;
        case ' ':
            gameControls.handbrake = true;
            break;
        case 'b':
            gameControls.brake = true;
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.key.toLowerCase()) {
        case 'w':
            gameControls.forward = false;
            break;
        case 's':
            gameControls.backward = false;
            break;
        case 'a':
            gameControls.left = false;
            break;
        case 'd':
            gameControls.right = false;
            break;
        case ' ':
            gameControls.handbrake = false;
            break;
        case 'b':
            gameControls.brake = false;
            break;
    }
});

// Update time of day
function updateTimeOfDay() {
    timeOfDay = (timeOfDay + timeSpeed * clock.getDelta()) % 1;
    
    // Update sky colors based on time of day
    const skyMaterial = sky.material;
    const sunAngle = timeOfDay * Math.PI * 2;
    
    // Calculate sun position
    const sunX = Math.cos(sunAngle) * 500;
    const sunY = Math.sin(sunAngle) * 500;
    sun.position.set(sunX, sunY, 0);
    
    // Update sky colors
    if (timeOfDay < 0.25 || timeOfDay > 0.75) { // Night
        skyMaterial.uniforms.topColor.value.set(0x000033);
        skyMaterial.uniforms.bottomColor.value.set(0x000066);
        renderer.toneMappingExposure = 0.5;
    } else if (timeOfDay < 0.3) { // Sunrise
        const t = (timeOfDay - 0.25) / 0.05;
        skyMaterial.uniforms.topColor.value.set(0x0077ff * t + 0x000033 * (1 - t));
        skyMaterial.uniforms.bottomColor.value.set(0xffffff * t + 0x000066 * (1 - t));
        renderer.toneMappingExposure = 0.5 + t * 0.5;
    } else if (timeOfDay < 0.7) { // Day
        skyMaterial.uniforms.topColor.value.set(0x0077ff);
        skyMaterial.uniforms.bottomColor.value.set(0xffffff);
        renderer.toneMappingExposure = 1.0;
    } else { // Sunset
        const t = (timeOfDay - 0.7) / 0.05;
        skyMaterial.uniforms.topColor.value.set(0x0077ff * (1 - t) + 0x000033 * t);
        skyMaterial.uniforms.bottomColor.value.set(0xffffff * (1 - t) + 0x000066 * t);
        renderer.toneMappingExposure = 1.0 - t * 0.5;
    }
}

// Update camera position
function updateCamera() {
    // Calculate target position
    const carPosition = car.mesh.position.clone();
    const carDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(car.mesh.quaternion);
    
    // Calculate look-ahead point
    const lookAheadPoint = carPosition.clone().add(carDirection.multiplyScalar(cameraSettings.lookAhead));
    
    // Calculate camera position
    const cameraOffset = new THREE.Vector3(0, cameraSettings.height, -cameraSettings.distance);
    cameraOffset.applyQuaternion(car.mesh.quaternion);
    
    // Smoothly move camera
    camera.position.lerp(carPosition.clone().add(cameraOffset), cameraSettings.smoothness);
    
    // Look at the look-ahead point
    camera.lookAt(lookAheadPoint);
}

// Animation loop
function animate() {
    console.log('animate() called');
    requestAnimationFrame(animate);

    if (!isGameInitialized) {
        console.log('Game not initialized, returning from animate.');
        return;
    }

    console.log('Game initialized, continuing animate loop.');

    const deltaTime = clock.getDelta();

    // Update physics
    world.step(1/60);

    // Log car physics state
    if (car && car.vehicle && car.vehicle.chassisBody) {
        console.log('Car Linear Velocity:', car.vehicle.chassisBody.velocity.toArray());
        console.log('Car Angular Velocity:', car.vehicle.chassisBody.angularVelocity.toArray());
    }

    // Update time of day
    updateTimeOfDay();

    // Update car
    car.update(deltaTime, gameControls);

    // Update terrain
    terrain.update(car.mesh.position);

    // Update camera
    updateCamera();

    // Render scene
    renderer.render(scene, camera);
}

// Start the game
init();

// Initialize game
const game = new Game();

// Handle window resize
window.addEventListener('resize', () => {
    game.onWindowResize();
});

// Add keyboard controls help
const helpElement = document.createElement('div');
helpElement.style.position = 'fixed';
helpElement.style.bottom = '20px';
helpElement.style.left = '20px';
helpElement.style.color = '#fff';
helpElement.style.fontFamily = 'Arial, sans-serif';
helpElement.style.fontSize = '14px';
helpElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
helpElement.style.padding = '10px';
helpElement.style.borderRadius = '5px';
helpElement.innerHTML = `
    <h3 style="margin: 0 0 10px 0">Controls:</h3>
    <p style="margin: 5px 0">W/S - Accelerate/Brake</p>
    <p style="margin: 5px 0">A/D - Steer Left/Right</p>
    <p style="margin: 5px 0">Space - Handbrake</p>
    <p style="margin: 5px 0">C - Change Camera</p>
    <p style="margin: 5px 0">R - Reset Car</p>
`;
document.body.appendChild(helpElement);

// Add weather controls
const weatherElement = document.createElement('div');
weatherElement.style.position = 'fixed';
weatherElement.style.top = '20px';
weatherElement.style.right = '20px';
weatherElement.style.color = '#fff';
weatherElement.style.fontFamily = 'Arial, sans-serif';
weatherElement.style.fontSize = '14px';
weatherElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
weatherElement.style.padding = '10px';
weatherElement.style.borderRadius = '5px';
weatherElement.innerHTML = `
    <h3 style="margin: 0 0 10px 0">Weather:</h3>
    <button onclick="game.setWeather('clear')" style="margin: 5px">Clear</button>
    <button onclick="game.setWeather('cloudy')" style="margin: 5px">Cloudy</button>
    <button onclick="game.setWeather('rainy')" style="margin: 5px">Rainy</button>
    <button onclick="game.setWeather('snowy')" style="margin: 5px">Snowy</button>
`;
document.body.appendChild(weatherElement);

// Make game instance globally accessible for weather controls
window.game = game;
