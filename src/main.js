import './style.css'
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Car } from './Car.js';
import { Terrain } from './Terrain.js';

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

// Initialize the game
function init() {
    // Create loading manager
    loadingManager = new THREE.LoadingManager();
    loadingManager.onLoad = () => {
        // Add a slight delay to make the loading screen transition visible
        setTimeout(() => {
            document.querySelector('.loading').style.display = 'none';
            isGameInitialized = true;

            // Add a border to the renderer's canvas for debugging
            if (renderer && renderer.domElement) {
                renderer.domElement.style.border = '2px solid red';
            }

        }, 500); // 500ms delay
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
    document.body.appendChild(renderer.domElement);

    // Create physics world
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    // Create clock for timing
    clock = new THREE.Clock();

    // Create sky and lighting
    createSky();
    createLighting();

    // Create terrain
    terrain = new Terrain(scene, world);

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
            topColor: { value: new THREE.Color(0x0077ff) },
            bottomColor: { value: new THREE.Color(0xffffff) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
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

    // Create sun
    const sunGeometry = new THREE.SphereGeometry(20, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);
}

function createLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
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
    if (!isGameInitialized) return;
    
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
    if (!isGameInitialized) return;
    
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
    requestAnimationFrame(animate);

    if (!isGameInitialized) return;

    const deltaTime = clock.getDelta();

    // Update physics
    world.step(1/60);

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
