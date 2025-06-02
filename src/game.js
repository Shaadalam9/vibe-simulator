import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';
import { createNoise2D } from 'simplex-noise';
import { RoadGenerator } from './road-generator.js';
import { Car } from './Car.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        this.clock = new THREE.Clock();
        this.noise = createNoise2D();
        
        // Game state
        this.timeOfDay = 0; // 0-24 hours
        this.weather = 'clear'; // clear, cloudy, rainy, snowy
        this.cameraMode = 'chase'; // chase, cockpit, orbit
        
        this.init();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        document.body.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);

        // Setup physics world
        this.world.gravity.set(0, -9.82, 0);

        // Create environment
        this.createSky();
        this.createTerrain();
        this.createRoads();
        this.createCar();
        this.createLights();
        this.createWater();
        this.createAtmosphere();

        // Setup controls
        this.setupControls();

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Remove loading message
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    createSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(10000);
        this.scene.add(this.sky);

        const sun = new THREE.Vector3();
        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 10;
        uniforms['rayleigh'].value = 2;
        uniforms['mieCoefficient'].value = 0.005;
        uniforms['mieDirectionalG'].value = 0.8;

        const phi = THREE.MathUtils.degToRad(90 - 2);
        const theta = THREE.MathUtils.degToRad(180);
        sun.setFromSphericalCoords(1, phi, theta);
        uniforms['sunPosition'].value.copy(sun);
    }

    createTerrain() {
        const size = 20000;
        const resolution = 512;
        const heightScale = 500;

        // Create terrain geometry
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        geometry.rotateX(-Math.PI / 2);

        // Generate height map with multiple octaves of noise
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            let height = 0;
            // Base terrain
            height += this.noise(x * 0.0001, z * 0.0001) * heightScale;
            // Medium detail
            height += this.noise(x * 0.0002, z * 0.0002) * heightScale * 0.5;
            // Fine detail
            height += this.noise(x * 0.0004, z * 0.0004) * heightScale * 0.25;
            // Very fine detail
            height += this.noise(x * 0.0008, z * 0.0008) * heightScale * 0.125;
            
            vertices[i + 1] = height;
        }

        geometry.computeVertexNormals();

        // Create terrain material with better textures
        const material = new THREE.MeshStandardMaterial({
            color: 0x4a7c59,
            roughness: 0.7,
            metalness: 0.1,
            flatShading: false
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        // Create physics body for terrain
        const shape = new CANNON.Heightfield(
            this.generateHeightfieldData(size, resolution, heightScale),
            { elementSize: size / resolution }
        );
        
        const terrainBody = new CANNON.Body({
            mass: 0,
            shape: shape,
            material: new CANNON.Material('terrainMaterial')
        });
        
        terrainBody.position.set(-size / 2, -heightScale / 2, -size / 2);
        this.world.addBody(terrainBody);
    }

    generateHeightfieldData(size, resolution, heightScale) {
        const data = [];
        for (let i = 0; i < resolution; i++) {
            data[i] = [];
            for (let j = 0; j < resolution; j++) {
                const x = (i / resolution - 0.5) * size;
                const z = (j / resolution - 0.5) * size;
                
                let height = 0;
                height += this.noise(x * 0.001, z * 0.001) * heightScale;
                height += this.noise(x * 0.002, z * 0.002) * heightScale * 0.5;
                height += this.noise(x * 0.004, z * 0.004) * heightScale * 0.25;
                
                data[i][j] = height;
            }
        }
        return data;
    }

    createRoads() {
        this.roadGenerator = new RoadGenerator(this.scene, this.terrain);
        
        // Generate a network of roads
        const startPoints = [
            { x: 0, z: 0, y: 0 },
            { x: 100, z: 100, y: 0 },
            { x: -100, z: 100, y: 0 },
            { x: 100, z: -100, y: 0 },
            { x: -100, z: -100, y: 0 }
        ];

        startPoints.forEach(point => {
            this.roadGenerator.generateRoad(point, 500, 1.5);
        });
    }

    createCar() {
        // Create car body
        const geometry = new THREE.BoxGeometry(2, 1, 4);
        const material = new THREE.MeshPhongMaterial({
            color: 0x4444ff,
            shininess: 100
        });
        this.car = new THREE.Mesh(geometry, material);
        this.car.castShadow = true;
        this.scene.add(this.car);

        // Create car physics body
        const shape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
        this.carBody = new CANNON.Body({
            mass: 1000,
            position: new CANNON.Vec3(0, 1, 0),
            shape: shape,
            material: new CANNON.Material('carMaterial')
        });
        this.world.addBody(this.carBody);

        // Create wheels
        this.createWheels();
    }

    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.wheels = [];

        const wheelPositions = [
            [-1, -0.5, 1],  // Front left
            [1, -0.5, 1],   // Front right
            [-1, -0.5, -1], // Rear left
            [1, -0.5, -1]   // Rear right
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(...pos);
            wheel.rotation.z = Math.PI / 2;
            this.car.add(wheel);
            this.wheels.push(wheel);
        });
    }

    createLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);
    }

    createWater() {
        const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
        this.water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                sunDirection: new THREE.Vector3(),
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -100;
        this.scene.add(this.water);
    }

    createAtmosphere() {
        // Add fog
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0001);

        // Add particles for weather effects
        const particleCount = 1000;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 1000;
            positions[i + 1] = Math.random() * 500;
            positions[i + 2] = (Math.random() - 0.5) * 1000;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.6
        });

        this.weatherParticles = new THREE.Points(particles, particleMaterial);
        this.scene.add(this.weatherParticles);
    }

    updateWeather(deltaTime) {
        // Update weather particles
        if (this.weather === 'rainy' || this.weather === 'snowy') {
            const positions = this.weatherParticles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] -= deltaTime * (this.weather === 'rainy' ? 50 : 10);
                if (positions[i + 1] < 0) {
                    positions[i + 1] = 500;
                    positions[i] = (Math.random() - 0.5) * 1000;
                    positions[i + 2] = (Math.random() - 0.5) * 1000;
                }
            }
            this.weatherParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    updateTimeOfDay(deltaTime) {
        this.timeOfDay = (this.timeOfDay + deltaTime * 0.1) % 24;
        const sunAngle = (this.timeOfDay / 24) * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle);
        const sunIntensity = Math.max(0, sunHeight);

        // Update sky
        const uniforms = this.sky.material.uniforms;
        uniforms['sunPosition'].value.set(
            Math.cos(sunAngle) * 1000,
            sunHeight * 1000,
            Math.sin(sunAngle) * 1000
        );

        // Update lighting
        this.directionalLight.intensity = sunIntensity;
        this.ambientLight.intensity = 0.2 + (1 - sunIntensity) * 0.3;

        // Update water
        if (this.water) {
            this.water.material.uniforms['sunDirection'].value.set(
                Math.cos(sunAngle),
                sunHeight,
                Math.sin(sunAngle)
            ).normalize();
        }
    }

    setupControls() {
        this.controls = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        document.addEventListener('keydown', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w': this.controls.forward = true; break;
                case 's': this.controls.backward = true; break;
                case 'a': this.controls.left = true; break;
                case 'd': this.controls.right = true; break;
            }
        });

        document.addEventListener('keyup', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w': this.controls.forward = false; break;
                case 's': this.controls.backward = false; break;
                case 'a': this.controls.left = false; break;
                case 'd': this.controls.right = false; break;
            }
        });
    }

    updateCar(deltaTime) {
        // Handle acceleration
        if (this.controls.forward) {
            this.carBody.applyLocalForce(new CANNON.Vec3(0, 0, 1000), new CANNON.Vec3(0, 0, 0));
        } else if (this.controls.backward) {
            this.carBody.applyLocalForce(new CANNON.Vec3(0, 0, -500), new CANNON.Vec3(0, 0, 0));
        }

        // Handle steering
        if (this.controls.left) {
            this.carBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), 0.1);
        } else if (this.controls.right) {
            this.carBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -0.1);
        }

        // Update car mesh position and rotation
        this.car.position.copy(this.carBody.position);
        this.car.quaternion.copy(this.carBody.quaternion);

        // Update wheel rotations
        this.wheels.forEach(wheel => {
            wheel.rotation.x += deltaTime * 2;
        });
    }

    updateCamera() {
        const cameraOffset = new THREE.Vector3(0, 5, -10);
        cameraOffset.applyQuaternion(this.car.quaternion);
        this.camera.position.copy(this.car.position).add(cameraOffset);
        this.camera.lookAt(this.car.position);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();

        // Update physics
        this.world.step(1/60);

        // Update car
        this.updateCar(deltaTime);

        // Update camera
        this.updateCamera();

        // Update environment
        this.updateTimeOfDay(deltaTime);
        this.updateWeather(deltaTime);

        // Update water
        if (this.water) {
            this.water.material.uniforms['time'].value += deltaTime;
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

export { Game }; 