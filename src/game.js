import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';
import { createNoise2D } from 'simplex-noise';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        this.clock = new THREE.Clock();
        this.noise = createNoise2D();
        
        this.init();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);

        // Setup physics world
        this.world.gravity.set(0, -9.82, 0);

        // Create environment
        this.createSky();
        this.createTerrain();
        this.createCar();
        this.createLights();

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
        const skyGeometry = new THREE.SphereGeometry(1000, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide
        });
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.sky);
    }

    createTerrain() {
        const size = 1000;
        const resolution = 128;
        const heightScale = 50;

        // Create terrain geometry
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        geometry.rotateX(-Math.PI / 2);

        // Generate height map
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            let height = 0;
            height += this.noise(x * 0.001, z * 0.001) * heightScale;
            height += this.noise(x * 0.002, z * 0.002) * heightScale * 0.5;
            height += this.noise(x * 0.004, z * 0.004) * heightScale * 0.25;
            
            vertices[i + 1] = height;
        }

        geometry.computeVertexNormals();

        // Create terrain material
        const material = new THREE.MeshStandardMaterial({
            color: 0x3a7e1a,
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
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

        // Update game objects
        this.updateCar(deltaTime);
        this.updateCamera();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new Game(); 