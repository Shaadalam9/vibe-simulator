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
        console.log('Game init() called - Start');
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        document.body.appendChild(this.renderer.domElement);
        console.log('Renderer setup complete.');

        // Setup camera
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);
        console.log('Camera setup complete.');

        // Setup physics world
        this.world.gravity.set(0, -9.82, 0);
        console.log('Physics world setup complete.');

        // Create physics materials
        this.wheelMaterial = new CANNON.Material('wheelMaterial');
        this.terrainMaterial = new CANNON.Material('terrainMaterial');
        this.carBodyMaterial = new CANNON.Material('carBodyMaterial');

        // Create contact material between wheels and terrain
        const wheelTerrainContact = new CANNON.ContactMaterial(
            this.wheelMaterial,
            this.terrainMaterial,
            {
                friction: 1.5, // Increased friction
                restitution: 0.1 // Low restitution
            }
        );
        this.world.addContactMaterial(wheelTerrainContact);

        // Create contact material between car body and terrain (for impacts)
         const bodyTerrainContact = new CANNON.ContactMaterial(
             this.carBodyMaterial,
             this.terrainMaterial,
             {
                 friction: 0.1, // Low friction for body
                 restitution: 0.3 // Some bounciness
             }
         );
         this.world.addContactMaterial(bodyTerrainContact);
         console.log('Physics materials and contacts setup complete.');

        // Create environment
        this.createSky();
        console.log('Sky created.');
        this.createTerrain(this.terrainMaterial);
        console.log('Terrain created.');
        this.createRoads();
        console.log('Roads created.');
        this.createCar(this.carBodyMaterial, this.wheelMaterial);
        console.log('Car created.');
        this.createLights();
        console.log('Lights created.');
        this.createWater();
        console.log('Water created.');
        this.createAtmosphere();
        console.log('Atmosphere created.');

        // Setup controls
        this.setupControls();
        console.log('Controls setup complete.');

        // Start animation loop
        this.animate();
        console.log('Animation loop started.');

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        console.log('Window resize listener added.');

        // Remove loading message - This will now be handled in main.js
        // console.log('Attempting to hide loading element with ID #loading.');
        // const loadingElement = document.querySelector('#loading');
        // if (loadingElement) {
        //     console.log('Loading element with ID #loading found.', loadingElement);
        //     loadingElement.style.display = 'none';
        //     console.log('Loading element display set to none.');
        // } else {
        //     console.log('Loading element with ID #loading not found.');
        // }

         const canvas = this.renderer.domElement;
         canvas.style.display = 'block'; // Ensure canvas is visible
         console.log('Canvas display set to block.', canvas);
         console.log('Game init() called - End');
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

    createTerrain(terrainMaterial) {
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
            // Base terrain - match visual noise scale
            height += this.noise(x * 0.0001, z * 0.0001) * heightScale;
            // Medium detail - match visual noise scale
            height += this.noise(x * 0.0002, z * 0.0002) * heightScale * 0.5;
            // Fine detail - match visual noise scale
            height += this.noise(x * 0.0004, z * 0.0004) * heightScale * 0.25;
            // Very fine detail - add visual noise scale for consistency
            height += this.noise(x * 0.0008, z * 0.0008) * heightScale * 0.125;
            
            vertices[i + 1] = height;
        }

        geometry.computeVertexNormals();

        // Create terrain material with better textures
        const textureLoader = new THREE.TextureLoader();
        const grassTexture = textureLoader.load('/textures/grass.jpg');
        const dirtTexture = textureLoader.load('/textures/dirt.jpg');
        const rockTexture = textureLoader.load('/textures/rock.jpg');

        // Set texture repeat
        const textureRepeat = 100;
        grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
        dirtTexture.wrapS = dirtTexture.wrapT = THREE.RepeatWrapping;
        rockTexture.wrapS = rockTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(textureRepeat, textureRepeat);
        dirtTexture.repeat.set(textureRepeat, textureRepeat);
        rockTexture.repeat.set(textureRepeat, textureRepeat);

        // Create terrain material with multiple textures
        const material = new THREE.MeshStandardMaterial({
            map: grassTexture,
            normalMap: grassTexture,
            roughnessMap: grassTexture,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);

        // Add trees and rocks
        this.addEnvironmentDetails();

        // Create physics body for terrain
        const shape = new CANNON.Heightfield(
            this.generateHeightfieldData(size, resolution, heightScale),
            { elementSize: size / resolution }
        );
        
        const terrainBody = new CANNON.Body({
            mass: 0,
            shape: shape,
            material: terrainMaterial
        });
        
        terrainBody.position.set(-size / 2, -heightScale / 2, -size / 2);
        this.world.addBody(terrainBody);
    }

    addEnvironmentDetails() {
        // Add trees
        const treeCount = 1000;
        const treeGeometry = new THREE.ConeGeometry(2, 5, 8);
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4d2926 });

        for (let i = 0; i < treeCount; i++) {
            const x = (Math.random() - 0.5) * 10000;
            const z = (Math.random() - 0.5) * 10000;
            const y = this.getTerrainHeightAt(x, z);

            // Create tree group
            const tree = new THREE.Group();
            
            // Add trunk
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 1;
            trunk.castShadow = true;
            tree.add(trunk);

            // Add foliage
            const foliage = new THREE.Mesh(treeGeometry, treeMaterial);
            foliage.position.y = 4;
            foliage.castShadow = true;
            tree.add(foliage);

            // Position tree
            tree.position.set(x, y, z);
            this.scene.add(tree);
        }

        // Add rocks
        const rockCount = 500;
        const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.1
        });

        for (let i = 0; i < rockCount; i++) {
            const x = (Math.random() - 0.5) * 10000;
            const z = (Math.random() - 0.5) * 10000;
            const y = this.getTerrainHeightAt(x, z);

            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(x, y, z);
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            rock.scale.set(
                1 + Math.random() * 2,
                1 + Math.random() * 2,
                1 + Math.random() * 2
            );
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
    }

    getTerrainHeightAt(x, z) {
        // Sample the height at the given x,z coordinates
        const size = 20000;
        const heightScale = 500;
        
        let height = 0;
        height += this.noise(x * 0.0001, z * 0.0001) * heightScale;
        height += this.noise(x * 0.0002, z * 0.0002) * heightScale * 0.5;
        height += this.noise(x * 0.0004, z * 0.0004) * heightScale * 0.25;
        height += this.noise(x * 0.0008, z * 0.0008) * heightScale * 0.125;
        
        return height;
    }

    generateHeightfieldData(size, resolution, heightScale) {
        const data = [];
        for (let i = 0; i < resolution; i++) {
            data[i] = [];
            for (let j = 0; j < resolution; j++) {
                const x = (i / resolution - 0.5) * size;
                const z = (j / resolution - 0.5) * size;
                
                let height = 0;
                // Base terrain - match visual noise scale
                height += this.noise(x * 0.0001, z * 0.0001) * heightScale;
                // Medium detail - match visual noise scale
                height += this.noise(x * 0.0002, z * 0.0002) * heightScale * 0.5;
                // Fine detail - match visual noise scale
                height += this.noise(x * 0.0004, z * 0.0004) * heightScale * 0.25;
                // Very fine detail - add visual noise scale for consistency
                height += this.noise(x * 0.0008, z * 0.0008) * heightScale * 0.125;
                
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

    createCar(carBodyMaterial, wheelMaterial) {
        this.car = new Car(this.scene, this.world, carBodyMaterial, wheelMaterial, new CANNON.Vec3(0, 200, 0));
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
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        // Directional light (sun)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        this.directionalLight.position.set(50, 100, 50);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 4096;
        this.directionalLight.shadow.mapSize.height = 4096;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 500;
        this.directionalLight.shadow.camera.left = -100;
        this.directionalLight.shadow.camera.right = 100;
        this.directionalLight.shadow.camera.top = 100;
        this.directionalLight.shadow.camera.bottom = -100;
        this.scene.add(this.directionalLight);
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
        // Update weather effects
        switch (this.weather) {
            case 'rainy':
                // Add rain particles
                if (!this.rainParticles) {
                    this.createRainParticles();
                }
                this.updateRainParticles(deltaTime);
                break;
            case 'snowy':
                // Add snow particles
                if (!this.snowParticles) {
                    this.createSnowParticles();
                }
                this.updateSnowParticles(deltaTime);
                break;
            case 'foggy':
                // Increase fog density
                this.scene.fog.density = 0.05;
                break;
            default:
                // Clear weather
                this.scene.fog.density = 0.005;
                if (this.rainParticles) {
                    this.scene.remove(this.rainParticles);
                    this.rainParticles = null;
                }
                if (this.snowParticles) {
                    this.scene.remove(this.snowParticles);
                    this.snowParticles = null;
                }
                break;
        }
    }

    createRainParticles() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.1,
            transparent: true,
            opacity: 0.6
        });
        
        this.rainParticles = new THREE.Points(geometry, material);
        this.scene.add(this.rainParticles);
    }

    updateRainParticles(deltaTime) {
        const positions = this.rainParticles.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= 50 * deltaTime;
            
            if (positions[i + 1] < 0) {
                positions[i] = (Math.random() - 0.5) * 100;
                positions[i + 1] = 50;
                positions[i + 2] = (Math.random() - 0.5) * 100;
            }
        }
        
        this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    createSnowParticles() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.2,
            transparent: true,
            opacity: 0.8
        });
        
        this.snowParticles = new THREE.Points(geometry, material);
        this.scene.add(this.snowParticles);
    }

    updateSnowParticles(deltaTime) {
        const positions = this.snowParticles.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.1;
            positions[i + 1] -= 5 * deltaTime;
            positions[i + 2] += Math.cos(Date.now() * 0.001 + i) * 0.1;
            
            if (positions[i + 1] < 0) {
                positions[i] = (Math.random() - 0.5) * 100;
                positions[i + 1] = 50;
                positions[i + 2] = (Math.random() - 0.5) * 100;
            }
        }
        
        this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }

    updateTimeOfDay(deltaTime) {
        // Update time of day (24-hour cycle)
        this.timeOfDay = (this.timeOfDay + deltaTime * 0.1) % 24;
        
        // Calculate sun position
        const sunAngle = (this.timeOfDay / 24) * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle);
        const sunDistance = Math.cos(sunAngle);
        
        // Update sun position
        const sun = new THREE.Vector3(
            Math.cos(sunAngle) * 1000,
            sunHeight * 1000,
            Math.sin(sunAngle) * 1000
        );
        
        // Update sky
        const uniforms = this.sky.material.uniforms;
        uniforms['sunPosition'].value.copy(sun);
        
        // Update lighting based on time of day
        const dayIntensity = Math.max(0, Math.min(1, (sunHeight + 0.2) / 0.4));
        this.ambientLight.intensity = 0.4 * dayIntensity;
        this.directionalLight.intensity = 1.0 * dayIntensity;
        
        // Update fog based on time of day
        if (this.timeOfDay > 19 || this.timeOfDay < 5) {
            // Night time - darker fog
            this.scene.fog.density = 0.02;
        } else if (this.timeOfDay > 6 && this.timeOfDay < 8) {
            // Dawn - light fog
            this.scene.fog.density = 0.01;
        } else if (this.timeOfDay > 17 && this.timeOfDay < 19) {
            // Dusk - light fog
            this.scene.fog.density = 0.01;
        } else {
            // Day time - clear
            this.scene.fog.density = 0.005;
        }
    }

    setupControls() {
        // Keyboard controls
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false,
            handbrake: false,
            camera: false
        };

        window.addEventListener('keydown', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w':
                    this.keys.forward = true;
                    break;
                case 's':
                    this.keys.backward = true;
                    break;
                case 'a':
                    this.keys.left = true;
                    break;
                case 'd':
                    this.keys.right = true;
                    break;
                case ' ':
                    this.keys.brake = true;
                    break;
                case 'shift':
                    this.keys.handbrake = true;
                    break;
                case 'c':
                    this.changeCamera();
                    break;
            }
        });

        window.addEventListener('keyup', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w':
                    this.keys.forward = false;
                    break;
                case 's':
                    this.keys.backward = false;
                    break;
                case 'a':
                    this.keys.left = false;
                    break;
                case 'd':
                    this.keys.right = false;
                    break;
                case ' ':
                    this.keys.brake = false;
                    break;
                case 'shift':
                    this.keys.handbrake = false;
                    break;
            }
        });

        // Mouse controls for orbit camera
        this.mouse = new THREE.Vector2();
        this.mouseDown = false;
        this.cameraRotation = new THREE.Vector2(0, 0);

        window.addEventListener('mousedown', (event) => {
            this.mouseDown = true;
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        window.addEventListener('mouseup', () => {
            this.mouseDown = false;
        });

        window.addEventListener('mousemove', (event) => {
            if (this.mouseDown && this.cameraMode === 'orbit') {
                const newMouse = new THREE.Vector2(
                    (event.clientX / window.innerWidth) * 2 - 1,
                    -(event.clientY / window.innerHeight) * 2 + 1
                );
                this.cameraRotation.x += (newMouse.x - this.mouse.x) * 2;
                this.cameraRotation.y += (newMouse.y - this.mouse.y) * 2;
                this.cameraRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.y));
                this.mouse.copy(newMouse);
            }
        });

        // Mouse wheel for zoom in orbit mode
        window.addEventListener('wheel', (event) => {
            if (this.cameraMode === 'orbit') {
                this.cameraDistance = Math.max(5, Math.min(50, this.cameraDistance - event.deltaY * 0.01));
            }
        });
    }

    updateCamera() {
        // Ensure car object and its visual body are initialized and have a valid quaternion
        if (!this.car || !this.car.body || !this.car.body.position || !this.car.body.quaternion || typeof this.car.body.quaternion.x === 'undefined') {
            console.warn('Car object or its visual body/quaternion not ready for camera update.');
            return; // Skip camera update if car is not ready or quaternion is invalid
        }

        const carPosition = this.car.body.position;
        const carRotation = this.car.body.quaternion; // Use quaternion for rotation

        switch (this.cameraMode) {
            case 'chase':
                // Chase camera follows behind the car
                const chaseOffset = new THREE.Vector3(0, 3, -8);
                chaseOffset.applyQuaternion(carRotation);
                this.camera.position.copy(carPosition).add(chaseOffset);
                this.camera.lookAt(carPosition);
                break;

            case 'cockpit':
                // Cockpit camera is inside the car
                const cockpitOffset = new THREE.Vector3(0, 1.5, 0.5);
                cockpitOffset.applyQuaternion(carRotation);
                this.camera.position.copy(carPosition).add(cockpitOffset);
                this.camera.quaternion.copy(carRotation);
                break;

            case 'orbit':
                // Orbit camera rotates around the car
                if (!this.cameraRotation || typeof this.cameraRotation.x === 'undefined' || typeof this.cameraRotation.y === 'undefined') {
                    console.warn('cameraRotation properties not ready for orbit mode.', this.cameraRotation);
                    // Optionally reset to a default valid state or return
                    this.cameraRotation = new THREE.Vector2(0, 0);
                    this.cameraDistance = 10; // Ensure distance is also valid
                }

                const orbitOffset = new THREE.Vector3(
                    Math.cos(this.cameraRotation.x) * Math.cos(this.cameraRotation.y),
                    Math.sin(this.cameraRotation.y),
                    Math.sin(this.cameraRotation.x) * Math.cos(this.cameraRotation.y)
                ).multiplyScalar(this.cameraDistance);
                this.camera.position.copy(carPosition).add(orbitOffset);
                this.camera.lookAt(carPosition);
                break;
        }

        // Add camera shake based on car speed and damage
        if (this.cameraMode !== 'orbit') {
            const shakeIntensity = Math.min(0.1, this.car.speed * 0.001 + this.car.damage * 0.01);
            this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * shakeIntensity;
            this.camera.position.z += (Math.random() - 0.5) * shakeIntensity;
        }
    }

    changeCamera() {
        const modes = ['chase', 'cockpit', 'orbit'];
        const currentIndex = modes.indexOf(this.cameraMode);
        this.cameraMode = modes[(currentIndex + 1) % modes.length];
        
        // Reset camera parameters when changing modes
        if (this.cameraMode === 'orbit') {
            this.cameraDistance = 10;
            this.cameraRotation.set(0, 0);
        }
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
        this.car.update(deltaTime, this.keys);

        // Update camera
        this.updateCamera();

        // Update time of day
        this.updateTimeOfDay(deltaTime);

        // Update weather
        this.updateWeather(deltaTime);

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    // Placeholder methods for camera change and car reset
    resetCar() {
        console.log('Reset car');
        // Implement car reset logic here
    }

     setWeather(weatherType) {
         this.weather = weatherType;
         console.log('Weather set to:', this.weather);
         // Implement visual weather changes here
         if (this.weather === 'clear') {
             this.weatherParticles.visible = false;
         } else {
              this.weatherParticles.visible = true;
         }
     }
}

export { Game }; 