import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createNoise2D } from 'simplex-noise';
import { Car } from './Car.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        this.clock = new THREE.Clock();
        this.noise = createNoise2D();

        // Game state
        this.keys = {};
        this.car = null;
        this.road = null;
        this.roadPoints = [];
        this.currentRoadIndex = 0;
        this.speed = 0;

        this.init();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8;
        document.body.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);

        // Setup physics world
        this.world.gravity.set(0, -9.82, 0);

        // Create environment
        this.createSky();
        this.createTerrain();
        this.createRoad();
        this.createLights();

        // Create car
        this.createCar();

        // Setup controls
        this.setupControls();

        // Setup weather controls
        this.setupWeatherControls();

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    createSky() {
        // Create a simple sky using a large sphere
        const skyGeometry = new THREE.SphereGeometry(5000, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide });
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.sky);

        // Add fog
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);
    }

    createTerrain() {
        const size = 1000;
        const resolution = 64;
        const heightScale = 50;

        // Create terrain geometry
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        geometry.rotateX(-Math.PI / 2);

        // Generate height map
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            vertices[i + 1] = this.noise(x * 0.01, z * 0.01) * heightScale;
        }

        geometry.computeVertexNormals();

        // Create terrain material
        const material = new THREE.MeshStandardMaterial({
            color: 0x8fbc8f,
            flatShading: true,
            roughness: 0.8,
            metalness: 0.1
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
            shape: shape
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
                data[i][j] = this.noise(x * 0.01, z * 0.01) * heightScale;
            }
        }
        return data;
    }

    createRoad() {
        // Generate road points using noise
        const numPoints = 100;
        const radius = 100;
        const height = 0;
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const noise = this.noise(angle * 0.5, 0) * 20;
            const x = Math.cos(angle) * (radius + noise);
            const z = Math.sin(angle) * (radius + noise);
            this.roadPoints.push(new THREE.Vector3(x, height, z));
        }

        // Create road geometry
        const curve = new THREE.CatmullRomCurve3(this.roadPoints);
        const geometry = new THREE.TubeGeometry(curve, 100, 5, 8, false);
        const material = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2
        });

        this.road = new THREE.Mesh(geometry, material);
        this.road.receiveShadow = true;
        this.scene.add(this.road);
    }

    createCar() {
        // Create visual car
        this.car = new Car(this.scene);

        // Create physics body for car
        const shape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
        this.carBody = new CANNON.Body({
            mass: 1000,
            shape: shape
        });
        this.world.addBody(this.carBody);

        // Create RaycastVehicle
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.carBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2
        });

        // Add wheels
        const wheelOptions = {
            radius: 0.4,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 1.5,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        const wheelPositions = [
            [-1, 0, 2],  // Front left
            [1, 0, 2],   // Front right
            [-1, 0, -2], // Rear left
            [1, 0, -2]   // Rear right
        ];

        wheelPositions.forEach(position => {
            wheelOptions.chassisConnectionPointLocal.set(position[0], position[1], position[2]);
            this.vehicle.addWheel(wheelOptions);
        });

        this.vehicle.addToWorld(this.world);
    }

    createLights() {
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x808080, 0.8);
        this.scene.add(ambientLight);

        // Add directional light (simulating sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(1, 1, 1).normalize();
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    setupControls() {
        // Keyboard controls
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false
        };

        window.addEventListener('keydown', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w': this.keys.forward = true; break;
                case 's': this.keys.backward = true; break;
                case 'a': this.keys.left = true; break;
                case 'd': this.keys.right = true; break;
                case ' ': this.keys.brake = true; break;
            }
        });

        window.addEventListener('keyup', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w': this.keys.forward = false; break;
                case 's': this.keys.backward = false; break;
                case 'a': this.keys.left = false; break;
                case 'd': this.keys.right = false; break;
                case ' ': this.keys.brake = false; break;
            }
        });
    }

    setupWeatherControls() {
        const buttons = document.querySelectorAll('#weather-controls button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const weather = button.dataset.weather;
                this.setWeather(weather);
            });
        });
    }

    setWeather(weather) {
        switch (weather) {
            case 'clear':
                this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);
                break;
            case 'foggy':
                this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.01);
                break;
            case 'rainy':
                this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.005);
                // TODO: Add rain particles
                break;
        }
    }

    updateCar() {
        if (!this.vehicle) return;

        // Apply engine force
        const engineForce = 1000;
        const brakeForce = 1000000;
        const maxSteerVal = 0.5;

        // Apply forces to wheels
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.applyEngineForce(0, i);
            this.vehicle.setBrake(0, i);
        }

        // Apply engine force to rear wheels
        if (this.keys.forward) {
            this.vehicle.applyEngineForce(engineForce, 2);
            this.vehicle.applyEngineForce(engineForce, 3);
        }
        if (this.keys.backward) {
            this.vehicle.applyEngineForce(-engineForce, 2);
            this.vehicle.applyEngineForce(-engineForce, 3);
        }

        // Apply braking
        if (this.keys.brake) {
            for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
                this.vehicle.setBrake(brakeForce, i);
            }
        }

        // Apply steering to front wheels
        let steerVal = 0;
        if (this.keys.left) steerVal = maxSteerVal;
        if (this.keys.right) steerVal = -maxSteerVal;
        this.vehicle.setSteeringValue(steerVal, 0);
        this.vehicle.setSteeringValue(steerVal, 1);

        // Update car position and rotation
        if (this.car) {
            this.car.update(this.carBody.position, this.carBody.quaternion);
        }

        // Update speed display
        this.speed = Math.round(this.carBody.velocity.length() * 3.6); // Convert m/s to km/h
        document.getElementById('speed').textContent = this.speed;
    }

    updateCamera() {
        if (!this.car) return;

        // Third-person camera
        const cameraOffset = new THREE.Vector3(0, 5, -10);
        cameraOffset.applyQuaternion(this.carBody.quaternion);
        this.camera.position.copy(this.carBody.position).add(cameraOffset);
        this.camera.lookAt(this.carBody.position);
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
        this.world.step(1/60, deltaTime);

        // Update car
        this.updateCar();

        // Update camera
        this.updateCamera();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new Game(); 