import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';
import { createNoise2D } from 'simplex-noise';
import { RoadGenerator } from './road-generator.js';
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
        this.mouse = new THREE.Vector2();
        this.mouseDown = false;
        this.cameraRotation = new THREE.Vector2(0, 0);
        this.cameraMode = 'chase'; // chase, orbit
        this.cameraDistance = 10; // for orbit camera

        this.roadGenerator = null;
        this.car = null;

        this.init();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8; // Adjusted exposure
        document.body.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);

        // Setup physics world
        this.world.gravity.set(0, -9.82, 0);

        // Create physics materials
        this.wheelMaterial = new CANNON.Material('wheelMaterial');
        this.terrainMaterial = new CANNON.Material('terrainMaterial');
        this.carBodyMaterial = new CANNON.Material('carBodyMaterial');

        // Create contact material between wheels and terrain
        const wheelTerrainContact = new CANNON.ContactMaterial(
            this.wheelMaterial,
            this.terrainMaterial,
            {
                friction: 0.5,
                restitution: 0.3
            }
        );
        this.world.addContactMaterial(wheelTerrainContact);

         // Create contact material between car body and terrain
         const bodyTerrainContact = new CANNON.ContactMaterial(
             this.carBodyMaterial,
             this.terrainMaterial,
             {
                friction: 0.1,
                restitution: 0.3
             }
         );
         this.world.addContactMaterial(bodyTerrainContact);


        // Create environment
        this.createSky();
        this.createTerrain(this.terrainMaterial);
        this.createRoads();
        this.createLights();

        // Create car
        this.createCar(this.carBodyMaterial, this.wheelMaterial);

        // Setup controls
        this.setupControls();

        // Start animation loop
        this.animate();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    createSky() {
        // Create a simple sky using a large sphere
        const skyGeometry = new THREE.SphereGeometry(5000, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }); // Using a light blue color
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.sky);
    }

    createTerrain(terrainMaterial) {
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
        // Load terrain texture
        const textureLoader = new THREE.TextureLoader();
        const terrainTexture = textureLoader.load('/textures/concrete_diff.jpg', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(100, 100); // Adjust repeat based on terrain size and desired tiling
            texture.anisotropy = 16; // Improve texture quality at oblique angles
        });

        const material = new THREE.MeshStandardMaterial({
            map: terrainTexture,
            color: 0x8fbc8f, // Base color that blends with the texture
            flatShading: true,
            roughness: 0.8, // Add some basic material properties
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
            material: terrainMaterial
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

    createRoads() {
        console.log('createRoads called.');
        // Create texture loader instance using the loadingManager
        const textureLoader = new THREE.TextureLoader(this.loadingManager);

        let roadTexture = null;
        let roadNormalMap = null;
        const requiredTextures = 2; // roadTexture and roadNormalMap
        let loadedTextureCount = 0;

        const checkAndCreateRoad = () => {
            loadedTextureCount++;
            if (loadedTextureCount === requiredTextures) {
                console.log('All road textures loaded. Creating road material and generator.');

                // Create road material - textures are now loaded
                const roadMaterial = new THREE.MeshStandardMaterial({
                    map: roadTexture,
                    normalMap: roadNormalMap,
                    roughness: 0.8,
                    metalness: 0.2,
                    normalScale: new THREE.Vector2(0.5, 0.5) // Adjusted normal map intensity
                });

                // Create road generator with physics world
                this.roadGenerator = new RoadGenerator(this.scene, this.world, roadMaterial);
                 console.log('Road generator created.');

                // Get the road points that were generated by the RoadGenerator
                // This needs to happen after roadGenerator is created
                this.roadPoints = this.roadGenerator.getRoadPoints();
                 console.log('Road points obtained.');


                // Create the car AFTER the road points are available
                 this.createCar(this.carBodyMaterial, this.wheelMaterial);
                 console.log('Car creation initiated after road points.');
            }
        };


        // Load road texture - now tracked by loadingManager
        textureLoader.load('/textures/road.jpg', (texture) => {
            roadTexture = texture;
            roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
            roadTexture.repeat.set(1, 10);
            roadTexture.anisotropy = 16;
            console.log('Road texture loaded successfully.');
            checkAndCreateRoad();
        },
        undefined, // onProgress callback
        (error) => {
             console.error('Error loading road texture:', error);
             // Handle texture loading errors - potentially stop game or show error
             // For now, we'll just log and the road/car won't be created
        }
        );

        // Load road normal map - now tracked by loadingManager
        // Using concrete_nor.jpg as a temporary normal map
        textureLoader.load('/textures/concrete_nor.jpg', (texture) => {
            roadNormalMap = texture;
            roadNormalMap.wrapS = roadNormalMap.wrapT = THREE.RepeatWrapping;
            roadNormalMap.repeat.set(1, 10); // Match repeat with the base texture
            roadNormalMap.anisotropy = 16;
            console.log('Road normal map loaded successfully.');
            checkAndCreateRoad();
        },
        undefined, // onProgress callback
        (error) => {
             console.error('Error loading road normal map:', error);
             // Handle texture loading errors
        }
        );

        console.log('Road texture loading initiated.');
         // Road generator and car creation now happen inside checkAndCreateRoad
    }

    createCar(carBodyMaterial, wheelMaterial) {
        console.log('createCar called.');
        // Get the starting position from the road generator
        const roadPoints = this.roadGenerator.getRoadPoints();
        if (!roadPoints || roadPoints.length < 2) {
            console.error('Road points not available for car placement. Cannot create car.');
            return; // Exit the function if road points are not available
        }
        console.log('Road points available, creating car.');

        const startPoint = roadPoints[0];
        const nextPoint = roadPoints[1];
        const initialDirection = new THREE.Vector3().subVectors(nextPoint, startPoint).normalize();

        // Calculate initial rotation quaternion based on the direction
        const upVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), initialDirection);

        // Create the car at the starting road point with the calculated rotation
        // Lift slightly above the road surface
        const carPosition = new CANNON.Vec3(
            startPoint.x,
            startPoint.y + 0.5, // Lift slightly above the ground
            startPoint.z
        );

        // Create car physics body with improved properties
        this.chassisBody = new CANNON.Body({
            mass: 1500,
            position: carPosition,
            shape: new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)),
            material: carBodyMaterial,
            linearDamping: 0.5,
            angularDamping: 0.5
        });
        this.chassisBody.quaternion.copy(quaternion);
        this.world.addBody(this.chassisBody);

        // Create RaycastVehicle with improved settings
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2
        });

        // Add wheels with improved physics properties
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

        const axleWidth = 1.5;
        const wheelBase = 2.5;

        // Add wheels with proper positioning
        this.vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-axleWidth / 2, -0.3, wheelBase) }); // Front left
        this.vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(axleWidth / 2, -0.3, wheelBase) }); // Front right
        this.vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(-axleWidth / 2, -0.3, -wheelBase) }); // Rear left
        this.vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(axleWidth / 2, -0.3, -wheelBase) }); // Rear right

        this.vehicle.addToWorld(this.world);

        // Create the car's visual mesh and associate it
        // We are reusing the Car class for visual representation and update logic
        // Ensure the Car class constructor can handle being called like this
        // It seems the Car class constructor expects scene, world, materials, position, quaternion.
        // Let's update the Car class usage slightly to align with this.
        // However, the current Car class already manages its own physics body and visual mesh.
        // The line `this.car = new Car(...)` below is what creates and adds the visual mesh.
        // Let's ensure that part is still correct. Yes, the Car class handles adding its body to the scene.

        this.car = new Car(this.scene, this.world, carBodyMaterial, wheelMaterial, startPoint, quaternion); // Pass startPoint for initial visual position

        console.log('Car created and added to scene at road start.');
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
            brake: false,
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
                case ' ': // Spacebar for brake
                    this.keys.brake = true;
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
                case ' ': // Spacebar for brake
                    this.keys.brake = false;
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
        // Ensure car object and its visual body are initialized
        if (!this.car || !this.car.body || !this.car.body.position) {
            console.warn('Car object or its visual body not ready for camera update.');
            return; // Skip camera update if car is not ready
        }

        const carPosition = this.car.body.position;

        switch (this.cameraMode) {
            case 'chase':
                // Chase camera follows behind the car
                const chaseOffset = new THREE.Vector3(0, 3, -8);
                // Apply car's rotation to the offset
                const carQuaternion = this.car.body.quaternion;
                chaseOffset.applyQuaternion(carQuaternion);
                this.camera.position.copy(carPosition).add(chaseOffset);
                this.camera.lookAt(carPosition);
                break;

            case 'orbit':
                // Orbit camera rotates around the car
                const orbitOffset = new THREE.Vector3(
                    Math.cos(this.cameraRotation.x) * Math.cos(this.cameraRotation.y),
                    Math.sin(this.cameraRotation.y),
                    Math.sin(this.cameraRotation.x) * Math.cos(this.cameraRotation.y)
                ).multiplyScalar(this.cameraDistance);
                this.camera.position.copy(carPosition).add(orbitOffset);
                this.camera.lookAt(carPosition);
                break;
        }
    }

    changeCamera() {
        this.cameraMode = (this.cameraMode === 'chase') ? 'orbit' : 'chase';
        // Reset camera parameters when changing modes if needed
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
        this.world.step(1/60, deltaTime);

        // Update car physics and visuals
        if (this.car) {
            this.car.update(deltaTime, this.keys);
        }

        // Update camera position
        this.updateCamera();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
}

export { Game }; 