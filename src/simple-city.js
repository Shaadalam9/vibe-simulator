import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class SimpleCity {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        
        // Create groups for organization
        this.buildingsGroup = new THREE.Group();
        this.groundGroup = new THREE.Group();
        this.districtsGroup = new THREE.Group();
        this.landmarksGroup = new THREE.Group();
        this.pathsGroup = new THREE.Group();
        this.streetElementsGroup = new THREE.Group();
        this.environmentGroup = new THREE.Group();
        this.weatherGroup = new THREE.Group();
        this.skyGroup = new THREE.Group();
        
        // Add groups to scene
        this.scene.add(this.buildingsGroup);
        this.scene.add(this.groundGroup);
        this.scene.add(this.districtsGroup);
        this.scene.add(this.landmarksGroup);
        this.scene.add(this.pathsGroup);
        this.scene.add(this.streetElementsGroup);
        this.scene.add(this.environmentGroup);
        this.scene.add(this.weatherGroup);
        this.scene.add(this.skyGroup);

        // Weather properties
        this.weather = {
            type: 'clear', // 'clear', 'rain', 'fog'
            intensity: 0.5,
            rainParticles: [],
            fogDensity: 0.0,
            isActive: false
        };
        
        // Sky properties
        this.sky = {
            time: 0.5, // 0 to 1 (0 = midnight, 0.5 = noon)
            turbidity: 10,
            rayleigh: 2,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.8,
            elevation: 45,
            azimuth: 180
        };
        
        // Load textures
        this.loadTextures();
        
        this.init();
    }

    loadTextures() {
        const textureLoader = new THREE.TextureLoader();
        
        // Modern building textures
        this.modernTextures = {
            base: textureLoader.load('https://threejs.org/examples/textures/brick_diffuse.jpg'),
            normal: textureLoader.load('https://threejs.org/examples/textures/brick_bump.jpg'),
            roughness: textureLoader.load('https://threejs.org/examples/textures/brick_roughness.jpg'),
            ao: textureLoader.load('https://threejs.org/examples/textures/brick_ao.jpg')
        };

        // Classic building textures
        this.classicTextures = {
            base: textureLoader.load('https://threejs.org/examples/textures/stone_diffuse.jpg'),
            normal: textureLoader.load('https://threejs.org/examples/textures/stone_normal.jpg'),
            roughness: textureLoader.load('https://threejs.org/examples/textures/stone_roughness.jpg'),
            ao: textureLoader.load('https://threejs.org/examples/textures/stone_ao.jpg')
        };

        // Industrial building textures
        this.industrialTextures = {
            base: textureLoader.load('https://threejs.org/examples/textures/metal_diffuse.jpg'),
            normal: textureLoader.load('https://threejs.org/examples/textures/metal_normal.jpg'),
            roughness: textureLoader.load('https://threejs.org/examples/textures/metal_roughness.jpg'),
            ao: textureLoader.load('https://threejs.org/examples/textures/metal_ao.jpg')
        };

        // Configure texture properties
        Object.values(this.modernTextures).forEach(texture => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
        });

        Object.values(this.classicTextures).forEach(texture => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
        });

        Object.values(this.industrialTextures).forEach(texture => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
        });
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        this.container.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(20, 15, 20);
        this.camera.lookAt(0, 0, 0);

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 50;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        this.controls.update();

        // Initialize sky
        this.initSky();

        // Setup lights
        this.setupLights();

        // Create ground
        this.createGround();

        // Create city elements
        this.createDistricts();
        this.createLandmarks();
        this.createPaths();
        this.createNodes();
        this.createStreetElements();
        this.createEnvironment();

        // Create buildings
        this.createBuildings();

        // Initialize weather
        this.initWeather();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start animation loop
        this.animate();
    }

    initSky() {
        // Create sky
        const skyGeometry = new THREE.SphereGeometry(400, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xffffff) },
                offset: { value: 400 },
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

        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.skyGroup.add(sky);

        // Create sun
        const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.skyGroup.add(this.sun);

        // Create moon
        const moonGeometry = new THREE.SphereGeometry(3, 32, 32);
        const moonMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
        this.skyGroup.add(this.moon);

        // Update sky colors and positions
        this.updateSky();
    }

    updateSky() {
        const time = this.sky.time;
        const dayTime = time > 0.25 && time < 0.75;

        // Update sky colors
        const skyMaterial = this.skyGroup.children[0].material;
        if (dayTime) {
            // Day colors
            skyMaterial.uniforms.topColor.value.setHex(0x0077ff);
            skyMaterial.uniforms.bottomColor.value.setHex(0xffffff);
        } else {
            // Night colors
            skyMaterial.uniforms.topColor.value.setHex(0x000033);
            skyMaterial.uniforms.bottomColor.value.setHex(0x000066);
        }

        // Update sun and moon positions
        const angle = time * Math.PI * 2;
        const radius = 300;
        
        // Sun position
        this.sun.position.x = Math.cos(angle) * radius;
        this.sun.position.y = Math.sin(angle) * radius;
        this.sun.position.z = 0;
        this.sun.visible = dayTime;

        // Moon position (opposite to sun)
        this.moon.position.x = Math.cos(angle + Math.PI) * radius;
        this.moon.position.y = Math.sin(angle + Math.PI) * radius;
        this.moon.position.z = 0;
        this.moon.visible = !dayTime;

        // Update lighting
        this.updateLighting(time);
    }

    updateLighting(time) {
        const dayTime = time > 0.25 && time < 0.75;
        const intensity = dayTime ? 1.0 : 0.2;

        // Update ambient light
        this.scene.children.forEach(child => {
            if (child instanceof THREE.AmbientLight) {
                child.intensity = intensity * 0.5;
            }
            if (child instanceof THREE.DirectionalLight) {
                child.intensity = intensity;
                // Update sun direction
                if (dayTime) {
                    const angle = time * Math.PI * 2;
                    child.position.x = Math.cos(angle) * 100;
                    child.position.y = Math.sin(angle) * 100;
                    child.position.z = 0;
                }
            }
        });
    }

    setTime(time) {
        this.sky.time = Math.max(0, Math.min(1, time));
        this.updateSky();
    }

    initWeather() {
        // Create rain particles
        const rainGeometry = new THREE.BufferGeometry();
        const rainCount = 1000;
        const positions = new Float32Array(rainCount * 3);
        const velocities = new Float32Array(rainCount * 3);

        for (let i = 0; i < rainCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = Math.random() * 30;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
            
            velocities[i * 3] = 0;
            velocities[i * 3 + 1] = -0.5 - Math.random() * 0.5;
            velocities[i * 3 + 2] = 0;
        }

        rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        rainGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

        const rainMaterial = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.1,
            transparent: true,
            opacity: 0.6
        });

        this.rainParticles = new THREE.Points(rainGeometry, rainMaterial);
        this.rainParticles.visible = false;
        this.weatherGroup.add(this.rainParticles);

        // Create fog
        this.scene.fog = new THREE.FogExp2(0xcccccc, 0.0);
    }

    setWeather(type, intensity = 0.5) {
        this.weather.type = type;
        this.weather.intensity = intensity;
        this.weather.isActive = type !== 'clear';

        switch(type) {
            case 'rain':
                this.rainParticles.visible = true;
                this.scene.fog.density = 0.01 * intensity;
                this.adjustLightingForWeather(0.7);
                break;
            case 'fog':
                this.rainParticles.visible = false;
                this.scene.fog.density = 0.02 * intensity;
                this.adjustLightingForWeather(0.8);
                break;
            case 'clear':
                this.rainParticles.visible = false;
                this.scene.fog.density = 0.0;
                this.adjustLightingForWeather(1.0);
                break;
        }
    }

    adjustLightingForWeather(intensity) {
        // Adjust ambient light
        this.scene.children.forEach(child => {
            if (child instanceof THREE.AmbientLight) {
                child.intensity = intensity;
            }
            if (child instanceof THREE.DirectionalLight) {
                child.intensity = intensity * 1.5;
            }
        });
    }

    updateWeather() {
        if (!this.weather.isActive) return;

        if (this.weather.type === 'rain') {
            const positions = this.rainParticles.geometry.attributes.position.array;
            const velocities = this.rainParticles.geometry.attributes.velocity.array;

            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += velocities[i + 1] * this.weather.intensity;

                // Reset particles that fall below ground
                if (positions[i + 1] < 0) {
                    positions[i] = (Math.random() - 0.5) * 50;
                    positions[i + 1] = 30;
                    positions[i + 2] = (Math.random() - 0.5) * 50;
                }
            }

            this.rainParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.updateWeather();
        
        // Slowly update time for day/night cycle
        this.sky.time = (this.sky.time + 0.0001) % 1;
        this.updateSky();
        
        this.renderer.render(this.scene, this.camera);
    }

    // Add weather control methods
    toggleRain() {
        if (this.weather.type === 'rain') {
            this.setWeather('clear');
        } else {
            this.setWeather('rain', this.weather.intensity);
        }
    }

    toggleFog() {
        if (this.weather.type === 'fog') {
            this.setWeather('clear');
        } else {
            this.setWeather('fog', this.weather.intensity);
        }
    }

    setWeatherIntensity(intensity) {
        this.setWeather(this.weather.type, intensity);
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        // Main directional light
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(10, 10, 10);
        sunLight.castShadow = true;
        
        // Configure shadow properties
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 50;
        sunLight.shadow.camera.left = -10;
        sunLight.shadow.camera.right = 10;
        sunLight.shadow.camera.top = 10;
        sunLight.shadow.camera.bottom = -10;
        
        this.scene.add(sunLight);
    }

    createGround() {
        // Create base ground
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.groundGroup.add(ground);

        // Create roads
        this.createRoads();
    }

    createRoads() {
        const citySize = 40;
        const roadWidth = 4;
        const sidewalkWidth = 1.5;
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.9,
            metalness: 0.1
        });

        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.7,
            metalness: 0.2
        });

        // Create main roads (horizontal and vertical)
        for (let i = -citySize/2; i <= citySize/2; i += 10) {
            // Horizontal roads with sidewalks
            const horizontalRoad = new THREE.Mesh(
                new THREE.PlaneGeometry(citySize, roadWidth),
                roadMaterial
            );
            horizontalRoad.rotation.x = -Math.PI / 2;
            horizontalRoad.position.set(0, 0.01, i);
            this.groundGroup.add(horizontalRoad);

            // Horizontal sidewalks
            const horizontalSidewalkTop = new THREE.Mesh(
                new THREE.PlaneGeometry(citySize, sidewalkWidth),
                sidewalkMaterial
            );
            horizontalSidewalkTop.rotation.x = -Math.PI / 2;
            horizontalSidewalkTop.position.set(0, 0.02, i + (roadWidth/2 + sidewalkWidth/2));
            this.groundGroup.add(horizontalSidewalkTop);

            const horizontalSidewalkBottom = new THREE.Mesh(
                new THREE.PlaneGeometry(citySize, sidewalkWidth),
                sidewalkMaterial
            );
            horizontalSidewalkBottom.rotation.x = -Math.PI / 2;
            horizontalSidewalkBottom.position.set(0, 0.02, i - (roadWidth/2 + sidewalkWidth/2));
            this.groundGroup.add(horizontalSidewalkBottom);

            // Vertical roads with sidewalks
            const verticalRoad = new THREE.Mesh(
                new THREE.PlaneGeometry(roadWidth, citySize),
                roadMaterial
            );
            verticalRoad.rotation.x = -Math.PI / 2;
            verticalRoad.position.set(i, 0.01, 0);
            this.groundGroup.add(verticalRoad);

            // Vertical sidewalks
            const verticalSidewalkLeft = new THREE.Mesh(
                new THREE.PlaneGeometry(sidewalkWidth, citySize),
                sidewalkMaterial
            );
            verticalSidewalkLeft.rotation.x = -Math.PI / 2;
            verticalSidewalkLeft.position.set(i - (roadWidth/2 + sidewalkWidth/2), 0.02, 0);
            this.groundGroup.add(verticalSidewalkLeft);

            const verticalSidewalkRight = new THREE.Mesh(
                new THREE.PlaneGeometry(sidewalkWidth, citySize),
                sidewalkMaterial
            );
            verticalSidewalkRight.rotation.x = -Math.PI / 2;
            verticalSidewalkRight.position.set(i + (roadWidth/2 + sidewalkWidth/2), 0.02, 0);
            this.groundGroup.add(verticalSidewalkRight);
        }

        // Add road markings
        this.addRoadMarkings();

        // Add sidewalk details
        this.addSidewalkDetails();
    }

    addRoadMarkings() {
        const citySize = 40;
        const roadWidth = 4;
        const lineWidth = 0.2;
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.5
        });

        // Create center lines for all roads
        for (let i = -citySize/2; i <= citySize/2; i += 10) {
            // Horizontal center lines
            const horizontalLine = new THREE.Mesh(
                new THREE.PlaneGeometry(citySize, lineWidth),
                lineMaterial
            );
            horizontalLine.rotation.x = -Math.PI / 2;
            horizontalLine.position.set(0, 0.02, i);
            this.groundGroup.add(horizontalLine);

            // Vertical center lines
            const verticalLine = new THREE.Mesh(
                new THREE.PlaneGeometry(lineWidth, citySize),
                lineMaterial
            );
            verticalLine.rotation.x = -Math.PI / 2;
            verticalLine.position.set(i, 0.02, 0);
            this.groundGroup.add(verticalLine);
        }

        // Add intersection markings
        this.addIntersectionMarkings();
    }

    addIntersectionMarkings() {
        const citySize = 40;
        const roadWidth = 4;
        const lineWidth = 0.2;
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.5
        });

        // Create intersection markings at each road crossing
        for (let x = -citySize/2; x <= citySize/2; x += 10) {
            for (let z = -citySize/2; z <= citySize/2; z += 10) {
                // Create intersection box
                const intersection = new THREE.Mesh(
                    new THREE.PlaneGeometry(roadWidth - lineWidth, roadWidth - lineWidth),
                    lineMaterial
                );
                intersection.rotation.x = -Math.PI / 2;
                intersection.position.set(x, 0.02, z);
                this.groundGroup.add(intersection);
            }
        }
    }

    addSidewalkDetails() {
        const citySize = 40;
        const roadWidth = 4;
        const sidewalkWidth = 1.5;
        const curbHeight = 0.1;
        const curbMaterial = new THREE.MeshStandardMaterial({
            color: 0x999999,
            roughness: 0.8,
            metalness: 0.3
        });

        // Add curbs along sidewalks
        for (let i = -citySize/2; i <= citySize/2; i += 10) {
            // Horizontal curbs
            const horizontalCurbTop = new THREE.Mesh(
                new THREE.BoxGeometry(citySize, curbHeight, 0.2),
                curbMaterial
            );
            horizontalCurbTop.position.set(0, curbHeight/2, i + (roadWidth/2 + sidewalkWidth/2));
            this.groundGroup.add(horizontalCurbTop);

            const horizontalCurbBottom = new THREE.Mesh(
                new THREE.BoxGeometry(citySize, curbHeight, 0.2),
                curbMaterial
            );
            horizontalCurbBottom.position.set(0, curbHeight/2, i - (roadWidth/2 + sidewalkWidth/2));
            this.groundGroup.add(horizontalCurbBottom);

            // Vertical curbs
            const verticalCurbLeft = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, curbHeight, citySize),
                curbMaterial
            );
            verticalCurbLeft.position.set(i - (roadWidth/2 + sidewalkWidth/2), curbHeight/2, 0);
            this.groundGroup.add(verticalCurbLeft);

            const verticalCurbRight = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, curbHeight, citySize),
                curbMaterial
            );
            verticalCurbRight.position.set(i + (roadWidth/2 + sidewalkWidth/2), curbHeight/2, 0);
            this.groundGroup.add(verticalCurbRight);
        }

        // Add crosswalks at intersections
        this.addCrosswalks();
    }

    addCrosswalks() {
        const citySize = 40;
        const roadWidth = 4;
        const sidewalkWidth = 1.5;
        const crosswalkWidth = 0.4;
        const crosswalkMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.5
        });

        // Add crosswalks at each intersection
        for (let x = -citySize/2; x <= citySize/2; x += 10) {
            for (let z = -citySize/2; z <= citySize/2; z += 10) {
                // Create crosswalk stripes
                for (let i = -1.5; i <= 1.5; i += 0.6) {
                    // Horizontal crosswalk
                    const horizontalStripe = new THREE.Mesh(
                        new THREE.PlaneGeometry(crosswalkWidth, sidewalkWidth),
                        crosswalkMaterial
                    );
                    horizontalStripe.rotation.x = -Math.PI / 2;
                    horizontalStripe.position.set(x + i, 0.03, z);
                    this.groundGroup.add(horizontalStripe);

                    // Vertical crosswalk
                    const verticalStripe = new THREE.Mesh(
                        new THREE.PlaneGeometry(sidewalkWidth, crosswalkWidth),
                        crosswalkMaterial
                    );
                    verticalStripe.rotation.x = -Math.PI / 2;
                    verticalStripe.position.set(x, 0.03, z + i);
                    this.groundGroup.add(verticalStripe);
                }
            }
        }
    }

    createDistricts() {
        const districts = [
            {
                name: 'Downtown',
                bounds: { x: [-20, 0], z: [-20, 0] },
                color: 0x4682B4,
                buildingHeight: { min: 8, max: 15 },
                density: 0.8
            },
            {
                name: 'Residential',
                bounds: { x: [0, 20], z: [-20, 0] },
                color: 0x8B4513,
                buildingHeight: { min: 4, max: 8 },
                density: 0.6
            },
            {
                name: 'Industrial',
                bounds: { x: [-20, 0], z: [0, 20] },
                color: 0x708090,
                buildingHeight: { min: 6, max: 10 },
                density: 0.7
            },
            {
                name: 'Commercial',
                bounds: { x: [0, 20], z: [0, 20] },
                color: 0x2E8B57,
                buildingHeight: { min: 5, max: 12 },
                density: 0.75
            }
        ];

        districts.forEach(district => {
            const districtMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(
                    district.bounds.x[1] - district.bounds.x[0],
                    district.bounds.z[1] - district.bounds.z[0]
                ),
                new THREE.MeshStandardMaterial({
                    color: district.color,
                    transparent: true,
                    opacity: 0.1,
                    roughness: 0.8,
                    metalness: 0.2
                })
            );
            districtMesh.rotation.x = -Math.PI / 2;
            districtMesh.position.set(
                (district.bounds.x[0] + district.bounds.x[1]) / 2,
                0.01,
                (district.bounds.z[0] + district.bounds.z[1]) / 2
            );
            this.districtsGroup.add(districtMesh);
        });

        return districts;
    }

    createLandmarks() {
        const landmarks = [
            {
                name: 'City Hall',
                position: { x: -10, z: -10 },
                type: 'government',
                height: 20,
                color: 0xFFFFFF
            },
            {
                name: 'Central Park',
                position: { x: 10, z: -10 },
                type: 'park',
                size: 8,
                color: 0x228B22
            },
            {
                name: 'Shopping Mall',
                position: { x: 10, z: 10 },
                type: 'commercial',
                height: 15,
                color: 0xFFD700
            },
            {
                name: 'Train Station',
                position: { x: -10, z: 10 },
                type: 'transport',
                height: 12,
                color: 0xCD853F
            }
        ];

        landmarks.forEach(landmark => {
            let landmarkMesh;
            if (landmark.type === 'park') {
                landmarkMesh = new THREE.Mesh(
                    new THREE.CircleGeometry(landmark.size, 32),
                    new THREE.MeshStandardMaterial({
                        color: landmark.color,
                        roughness: 0.8,
                        metalness: 0.2
                    })
                );
                landmarkMesh.rotation.x = -Math.PI / 2;
                landmarkMesh.position.set(landmark.position.x, 0.02, landmark.position.z);
            } else {
                landmarkMesh = new THREE.Mesh(
                    new THREE.BoxGeometry(6, landmark.height, 6),
                    new THREE.MeshStandardMaterial({
                        color: landmark.color,
                        roughness: 0.7,
                        metalness: 0.3
                    })
                );
                landmarkMesh.position.set(
                    landmark.position.x,
                    landmark.height / 2,
                    landmark.position.z
                );
            }
            landmarkMesh.castShadow = true;
            landmarkMesh.receiveShadow = true;
            this.landmarksGroup.add(landmarkMesh);
        });
    }

    createPaths() {
        const pathWidth = 2;
        const pathMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.1
        });

        const paths = [
            { start: { x: -10, z: -10 }, end: { x: 10, z: -10 } },  // City Hall to Park
            { start: { x: 10, z: -10 }, end: { x: 10, z: 10 } },    // Park to Mall
            { start: { x: 10, z: 10 }, end: { x: -10, z: 10 } },    // Mall to Station
            { start: { x: -10, z: 10 }, end: { x: -10, z: -10 } }   // Station to City Hall
        ];

        paths.forEach(path => {
            const length = Math.sqrt(
                Math.pow(path.end.x - path.start.x, 2) +
                Math.pow(path.end.z - path.start.z, 2)
            );
            const angle = Math.atan2(path.end.z - path.start.z, path.end.x - path.start.x);

            const pathMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(length, pathWidth),
                pathMaterial
            );
            pathMesh.rotation.x = -Math.PI / 2;
            pathMesh.rotation.z = -angle;
            pathMesh.position.set(
                (path.start.x + path.end.x) / 2,
                0.03,
                (path.start.z + path.end.z) / 2
            );
            this.pathsGroup.add(pathMesh);
        });
    }

    createNodes() {
        const nodeRadius = 0.5;
        const nodeMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF0000,
            roughness: 0.5,
            metalness: 0.5
        });

        const nodes = [
            { x: -10, z: -10 },  // City Hall
            { x: 10, z: -10 },   // Park
            { x: 10, z: 10 },    // Mall
            { x: -10, z: 10 },   // Station
            { x: 0, z: -10 },    // Intersection
            { x: 10, z: 0 },     // Intersection
            { x: 0, z: 10 },     // Intersection
            { x: -10, z: 0 }     // Intersection
        ];

        nodes.forEach(node => {
            const nodeMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(nodeRadius, nodeRadius, 0.2, 32),
                nodeMaterial
            );
            nodeMesh.rotation.x = Math.PI / 2;
            nodeMesh.position.set(node.x, 0.1, node.z);
            this.pathsGroup.add(nodeMesh);
        });
    }

    createBuilding(width, height, depth, type) {
        const group = new THREE.Group();

        // Create main building structure with improved geometry
        const geometry = new THREE.BoxGeometry(width, height, depth, 4, 4, 4);
        let material;

        switch(type.style) {
            case 'modern':
                material = new THREE.MeshPhysicalMaterial({
                    color: type.color,
                    map: this.modernTextures.base,
                    normalMap: this.modernTextures.normal,
                    roughnessMap: this.modernTextures.roughness,
                    aoMap: this.modernTextures.ao,
                    roughness: 0.2,
                    metalness: 0.8,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    envMapIntensity: 1.0,
                    reflectivity: 1.0,
                    ior: 1.5,
                    transmission: 0.1,
                    thickness: 0.5,
                    specularIntensity: 1.0,
                    specularColor: 0xffffff,
                    normalScale: new THREE.Vector2(0.5, 0.5),
                    aoMapIntensity: 1.0
                });
                break;
            case 'classic':
                material = new THREE.MeshStandardMaterial({
                    color: type.color,
                    map: this.classicTextures.base,
                    normalMap: this.classicTextures.normal,
                    roughnessMap: this.classicTextures.roughness,
                    aoMap: this.classicTextures.ao,
                    roughness: 0.7,
                    metalness: 0.2,
                    bumpScale: 0.05,
                    normalScale: new THREE.Vector2(0.5, 0.5),
                    displacementScale: 0.1,
                    displacementBias: -0.05,
                    aoMapIntensity: 1.0
                });
                break;
            case 'industrial':
                material = new THREE.MeshStandardMaterial({
                    color: type.color,
                    map: this.industrialTextures.base,
                    normalMap: this.industrialTextures.normal,
                    roughnessMap: this.industrialTextures.roughness,
                    aoMap: this.industrialTextures.ao,
                    roughness: 0.9,
                    metalness: 0.4,
                    bumpScale: 0.1,
                    normalScale: new THREE.Vector2(1, 1),
                    displacementScale: 0.2,
                    displacementBias: -0.1,
                    aoMapIntensity: 1.0
                });
                break;
            default:
                material = new THREE.MeshStandardMaterial({
                    color: type.color,
                    roughness: 0.7,
                    metalness: 0.3
                });
        }

        const building = new THREE.Mesh(geometry, material);
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);

        // Add architectural details based on building type
        if (type.style === 'modern') {
            this.addModernDetails(group, width, height, depth);
        } else if (type.style === 'classic') {
            this.addClassicDetails(group, width, height, depth);
        } else if (type.style === 'industrial') {
            this.addIndustrialDetails(group, width, height, depth);
        }

        // Add windows with improved materials
        this.addWindowsToBuilding(group, width, height, depth, type);

        // Add roof details
        this.addRoofDetails(group, width, height, depth, type);

        return group;
    }

    addModernDetails(group, width, height, depth) {
        // Add glass facade with improved material and geometry
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.3,
            roughness: 0.1,
            metalness: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            ior: 1.5,
            reflectivity: 1.0,
            envMapIntensity: 1.0,
            transmission: 0.8,
            thickness: 0.5,
            specularIntensity: 1.0,
            specularColor: 0xffffff,
            normalMap: this.modernTextures.normal,
            normalScale: new THREE.Vector2(0.5, 0.5)
        });

        // Add vertical glass strips with improved geometry
        const stripWidth = 0.2;
        const stripSpacing = 2;
        for (let x = -width/2; x <= width/2; x += stripSpacing) {
            const stripGeometry = new THREE.BoxGeometry(stripWidth, height, depth, 1, 4, 1);
            const strip = new THREE.Mesh(stripGeometry, glassMaterial);
            strip.position.set(x, 0, 0);
            group.add(strip);
        }

        // Add rooftop features with improved materials and geometry
        const antennaMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.5,
            metalness: 0.8,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            normalMap: this.modernTextures.normal,
            roughnessMap: this.modernTextures.roughness,
            aoMap: this.modernTextures.ao,
            aoMapIntensity: 1.0
        });

        const antennaGeometry = new THREE.CylinderGeometry(0.1, 0.1, height * 0.1, 16);
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0, height/2 + height * 0.05, 0);
        group.add(antenna);

        // Add decorative elements
        this.addModernDecorations(group, width, height, depth);
    }

    addModernDecorations(group, width, height, depth) {
        // Add metal trim with improved geometry
        const trimMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.3,
            metalness: 0.9,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            normalMap: this.modernTextures.normal,
            roughnessMap: this.modernTextures.roughness,
            aoMap: this.modernTextures.ao,
            aoMapIntensity: 1.0
        });

        // Add horizontal trim lines with improved geometry
        const trimSpacing = height / 5;
        for (let y = -height/2 + trimSpacing; y < height/2; y += trimSpacing) {
            const trimGeometry = new THREE.BoxGeometry(width + 0.1, 0.1, depth + 0.1, 4, 1, 4);
            const trim = new THREE.Mesh(trimGeometry, trimMaterial);
            trim.position.set(0, y, 0);
            group.add(trim);
        }

        // Add corner accents with improved geometry
        const cornerMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.2,
            metalness: 0.9,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            normalMap: this.modernTextures.normal,
            roughnessMap: this.modernTextures.roughness,
            aoMap: this.modernTextures.ao,
            aoMapIntensity: 1.0
        });

        const cornerSize = 0.3;
        const corners = [
            { x: width/2, z: depth/2 },
            { x: -width/2, z: depth/2 },
            { x: width/2, z: -depth/2 },
            { x: -width/2, z: -depth/2 }
        ];

        corners.forEach(pos => {
            const cornerGeometry = new THREE.BoxGeometry(cornerSize, height, cornerSize, 1, 4, 1);
            const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
            corner.position.set(pos.x, 0, pos.z);
            group.add(corner);
        });
    }

    addClassicDetails(group, width, height, depth) {
        // Add columns with improved geometry and materials
        const columnRadius = 0.3;
        const columnHeight = height * 0.8;
        const columnMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.6,
            metalness: 0.4,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            displacementScale: 0.1,
            displacementBias: -0.05,
            map: this.classicTextures.base,
            normalMap: this.classicTextures.normal,
            roughnessMap: this.classicTextures.roughness,
            aoMap: this.classicTextures.ao,
            aoMapIntensity: 1.0
        });

        const columnPositions = [
            { x: -width/2 + 1, z: -depth/2 + 1 },
            { x: width/2 - 1, z: -depth/2 + 1 },
            { x: -width/2 + 1, z: depth/2 - 1 },
            { x: width/2 - 1, z: depth/2 - 1 }
        ];

        columnPositions.forEach(pos => {
            const columnGeometry = new THREE.CylinderGeometry(columnRadius, columnRadius, columnHeight, 32, 4);
            const column = new THREE.Mesh(columnGeometry, columnMaterial);
            column.position.set(pos.x, columnHeight/2, pos.z);
            group.add(column);

            // Add column capital with improved geometry
            const capitalGeometry = new THREE.BoxGeometry(columnRadius * 2.5, columnRadius, columnRadius * 2.5, 4, 1, 4);
            const capital = new THREE.Mesh(capitalGeometry, columnMaterial);
            capital.position.set(pos.x, columnHeight, pos.z);
            group.add(capital);
        });

        // Add decorative cornice with improved geometry and material
        const corniceMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.6,
            metalness: 0.4,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            displacementScale: 0.1,
            displacementBias: -0.05,
            map: this.classicTextures.base,
            normalMap: this.classicTextures.normal,
            roughnessMap: this.classicTextures.roughness,
            aoMap: this.classicTextures.ao,
            aoMapIntensity: 1.0
        });

        const corniceGeometry = new THREE.BoxGeometry(width + 0.5, height * 0.05, depth + 0.5, 4, 1, 4);
        const cornice = new THREE.Mesh(corniceGeometry, corniceMaterial);
        cornice.position.set(0, height/2, 0);
        group.add(cornice);

        // Add decorative elements
        this.addClassicDecorations(group, width, height, depth);
    }

    addClassicDecorations(group, width, height, depth) {
        // Add decorative frieze with improved geometry
        const friezeMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.7,
            metalness: 0.3,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            displacementScale: 0.1,
            displacementBias: -0.05,
            map: this.classicTextures.base,
            normalMap: this.classicTextures.normal,
            roughnessMap: this.classicTextures.roughness,
            aoMap: this.classicTextures.ao,
            aoMapIntensity: 1.0
        });

        const friezeGeometry = new THREE.BoxGeometry(width + 0.3, height * 0.03, depth + 0.3, 4, 1, 4);
        const frieze = new THREE.Mesh(friezeGeometry, friezeMaterial);
        frieze.position.set(0, height/2 - height * 0.04, 0);
        group.add(frieze);

        // Add decorative pediment with improved geometry
        const pedimentMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.7,
            metalness: 0.3,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            displacementScale: 0.1,
            displacementBias: -0.05,
            map: this.classicTextures.base,
            normalMap: this.classicTextures.normal,
            roughnessMap: this.classicTextures.roughness,
            aoMap: this.classicTextures.ao,
            aoMapIntensity: 1.0
        });

        const pedimentGeometry = new THREE.BoxGeometry(width + 0.4, height * 0.1, depth + 0.4, 4, 1, 4);
        const pediment = new THREE.Mesh(pedimentGeometry, pedimentMaterial);
        pediment.position.set(0, height/2 + height * 0.05, 0);
        group.add(pediment);
    }

    addIndustrialDetails(group, width, height, depth) {
        // Add ventilation units with improved geometry and materials
        const ventMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            roughness: 0.8,
            metalness: 0.5,
            bumpScale: 0.1,
            normalScale: new THREE.Vector2(1, 1),
            displacementScale: 0.2,
            displacementBias: -0.1,
            map: this.industrialTextures.base,
            normalMap: this.industrialTextures.normal,
            roughnessMap: this.industrialTextures.roughness,
            aoMap: this.industrialTextures.ao,
            aoMapIntensity: 1.0
        });

        const ventSize = Math.min(width, depth) * 0.2;
        const ventGeometry = new THREE.BoxGeometry(ventSize, ventSize, ventSize, 4, 4, 4);
        const vent = new THREE.Mesh(ventGeometry, ventMaterial);
        vent.position.set(0, height/2 + ventSize/2, 0);
        group.add(vent);

        // Add pipes with improved geometry and materials
        const pipeMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.7,
            metalness: 0.6,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            displacementScale: 0.1,
            displacementBias: -0.05,
            map: this.industrialTextures.base,
            normalMap: this.industrialTextures.normal,
            roughnessMap: this.industrialTextures.roughness,
            aoMap: this.industrialTextures.ao,
            aoMapIntensity: 1.0
        });

        for (let i = 0; i < 3; i++) {
            const pipeGeometry = new THREE.CylinderGeometry(0.1, 0.1, height * 0.7, 32, 4);
            const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
            pipe.position.set(
                -width/2 + 1 + i * 2,
                height * 0.35,
                -depth/2 + 1
            );
            group.add(pipe);

            // Add pipe brackets with improved geometry
            const bracketMaterial = new THREE.MeshStandardMaterial({
                color: 0x888888,
                roughness: 0.6,
                metalness: 0.7,
                bumpScale: 0.05,
                normalScale: new THREE.Vector2(0.5, 0.5),
                map: this.industrialTextures.base,
                normalMap: this.industrialTextures.normal,
                roughnessMap: this.industrialTextures.roughness,
                aoMap: this.industrialTextures.ao,
                aoMapIntensity: 1.0
            });

            const bracketGeometry = new THREE.BoxGeometry(0.2, 0.1, 0.2, 2, 1, 2);
            const bracket = new THREE.Mesh(bracketGeometry, bracketMaterial);
            bracket.position.set(
                -width/2 + 1 + i * 2,
                height * 0.35,
                -depth/2 + 1.2
            );
            group.add(bracket);
        }

        // Add industrial details
        this.addIndustrialDecorations(group, width, height, depth);
    }

    addIndustrialDecorations(group, width, height, depth) {
        // Add metal beams with improved geometry
        const beamMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.6,
            metalness: 0.7,
            bumpScale: 0.05,
            normalScale: new THREE.Vector2(0.5, 0.5),
            displacementScale: 0.1,
            displacementBias: -0.05,
            map: this.industrialTextures.base,
            normalMap: this.industrialTextures.normal,
            roughnessMap: this.industrialTextures.roughness,
            aoMap: this.industrialTextures.ao,
            aoMapIntensity: 1.0
        });

        // Add horizontal beams with improved geometry
        const beamSpacing = height / 4;
        for (let y = -height/2 + beamSpacing; y < height/2; y += beamSpacing) {
            const beamGeometry = new THREE.BoxGeometry(width + 0.2, 0.2, 0.2, 4, 1, 1);
            const beam = new THREE.Mesh(beamGeometry, beamMaterial);
            beam.position.set(0, y, -depth/2 - 0.1);
            group.add(beam);
        }

        // Add vertical beams with improved geometry
        const verticalBeamSpacing = width / 4;
        for (let x = -width/2; x <= width/2; x += verticalBeamSpacing) {
            const beamGeometry = new THREE.BoxGeometry(0.2, height, 0.2, 1, 4, 1);
            const beam = new THREE.Mesh(beamGeometry, beamMaterial);
            beam.position.set(x, 0, -depth/2 - 0.1);
            group.add(beam);
        }
    }

    addWindowsToBuilding(building, width, height, depth, type) {
        const windowSize = 0.8;
        const windowSpacing = 1.5;
        let windowMaterial;

        switch(type.style) {
            case 'modern':
                windowMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0x88ccff,
                    emissive: 0x88ccff,
                    emissiveIntensity: 0.5,
                    transparent: true,
                    opacity: 0.7,
                    roughness: 0.1,
                    metalness: 0.9,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    ior: 1.5,
                    reflectivity: 1.0,
                    envMapIntensity: 1.0,
                    transmission: 0.8,
                    thickness: 0.5,
                    specularIntensity: 1.0,
                    specularColor: 0xffffff,
                    normalMap: this.modernTextures.normal,
                    normalScale: new THREE.Vector2(0.5, 0.5)
                });
                break;
            case 'classic':
                windowMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0x88ccff,
                    emissive: 0x88ccff,
                    emissiveIntensity: 0.3,
                    transparent: true,
                    opacity: 0.8,
                    roughness: 0.2,
                    metalness: 0.8,
                    clearcoat: 0.5,
                    clearcoatRoughness: 0.2,
                    transmission: 0.6,
                    thickness: 0.3,
                    specularIntensity: 0.8,
                    specularColor: 0xffffff,
                    normalMap: this.classicTextures.normal,
                    normalScale: new THREE.Vector2(0.5, 0.5)
                });
                break;
            case 'industrial':
                windowMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0x88ccff,
                    emissive: 0x88ccff,
                    emissiveIntensity: 0.4,
                    transparent: true,
                    opacity: 0.6,
                    roughness: 0.3,
                    metalness: 0.7,
                    clearcoat: 0.3,
                    clearcoatRoughness: 0.3,
                    transmission: 0.4,
                    thickness: 0.2,
                    specularIntensity: 0.6,
                    specularColor: 0xffffff,
                    normalMap: this.industrialTextures.normal,
                    normalScale: new THREE.Vector2(0.5, 0.5)
                });
                break;
            default:
                windowMaterial = new THREE.MeshPhysicalMaterial({
                    color: 0x88ccff,
                    emissive: 0x88ccff,
                    emissiveIntensity: 0.5,
                    transparent: true,
                    opacity: 0.7,
                    roughness: 0.2,
                    metalness: 0.8,
                    transmission: 0.5,
                    thickness: 0.4,
                    specularIntensity: 0.7,
                    specularColor: 0xffffff
                });
        }

        // Calculate number of windows per side
        const windowsX = Math.floor(width / windowSpacing);
        const windowsY = Math.floor(height / windowSpacing);
        const windowsZ = Math.floor(depth / windowSpacing);

        // Add windows to each face with improved geometry
        for (let y = 0; y < windowsY; y++) {
            for (let x = 0; x < windowsX; x++) {
                // Front face
                const frontWindowGeometry = new THREE.PlaneGeometry(windowSize, windowSize, 2, 2);
                const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
                frontWindow.position.set(
                    (x - windowsX/2) * windowSpacing + windowSpacing/2,
                    (y - windowsY/2) * windowSpacing + windowSpacing/2,
                    depth/2 + 0.01
                );
                building.add(frontWindow);

                // Back face
                const backWindowGeometry = new THREE.PlaneGeometry(windowSize, windowSize, 2, 2);
                const backWindow = new THREE.Mesh(backWindowGeometry, windowMaterial);
                backWindow.position.set(
                    (x - windowsX/2) * windowSpacing + windowSpacing/2,
                    (y - windowsY/2) * windowSpacing + windowSpacing/2,
                    -depth/2 - 0.01
                );
                backWindow.rotation.y = Math.PI;
                building.add(backWindow);
            }

            for (let z = 0; z < windowsZ; z++) {
                // Left face
                const leftWindowGeometry = new THREE.PlaneGeometry(windowSize, windowSize, 2, 2);
                const leftWindow = new THREE.Mesh(leftWindowGeometry, windowMaterial);
                leftWindow.position.set(
                    -width/2 - 0.01,
                    (y - windowsY/2) * windowSpacing + windowSpacing/2,
                    (z - windowsZ/2) * windowSpacing + windowSpacing/2
                );
                leftWindow.rotation.y = -Math.PI/2;
                building.add(leftWindow);

                // Right face
                const rightWindowGeometry = new THREE.PlaneGeometry(windowSize, windowSize, 2, 2);
                const rightWindow = new THREE.Mesh(rightWindowGeometry, windowMaterial);
                rightWindow.position.set(
                    width/2 + 0.01,
                    (y - windowsY/2) * windowSpacing + windowSpacing/2,
                    (z - windowsZ/2) * windowSpacing + windowSpacing/2
                );
                rightWindow.rotation.y = Math.PI/2;
                building.add(rightWindow);
            }
        }
    }

    addRoofDetails(group, width, height, depth, type) {
        const roofMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2
        });

        if (type.style === 'modern') {
            // Flat roof with parapet
            const parapet = new THREE.Mesh(
                new THREE.BoxGeometry(width + 0.5, height * 0.05, depth + 0.5),
                roofMaterial
            );
            parapet.position.set(0, height/2 + height * 0.025, 0);
            group.add(parapet);
        } else if (type.style === 'classic') {
            // Sloped roof
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(Math.max(width, depth) * 0.8, height * 0.3, 4),
                roofMaterial
            );
            roof.rotation.y = Math.PI / 4;
            roof.position.set(0, height/2 + height * 0.15, 0);
            group.add(roof);
        } else if (type.style === 'industrial') {
            // Sawtooth roof
            const segments = Math.ceil(width / 3);
            for (let i = 0; i < segments; i++) {
                const roofSegment = new THREE.Mesh(
                    new THREE.BoxGeometry(3, height * 0.2, depth + 0.5),
                    roofMaterial
                );
                roofSegment.position.set(
                    -width/2 + 1.5 + i * 3,
                    height/2 + height * 0.1,
                    0
                );
                roofSegment.rotation.x = Math.PI / 6;
                group.add(roofSegment);
            }
        }
    }

    createBuildings() {
        const citySize = 40;
        const blockSize = 10;
        const roadWidth = 4;
        const sidewalkWidth = 1.5;
        const districts = this.createDistricts();

        // Create buildings based on district characteristics
        districts.forEach(district => {
            for (let x = district.bounds.x[0]; x < district.bounds.x[1]; x += blockSize) {
                for (let z = district.bounds.z[0]; z < district.bounds.z[1]; z += blockSize) {
                    // Skip if this is a road intersection
                    if (Math.abs(x) < (roadWidth/2 + sidewalkWidth) && 
                        Math.abs(z) < (roadWidth/2 + sidewalkWidth)) continue;

                    // Random chance to place building based on district density
                    if (Math.random() > district.density) continue;

                    const height = district.buildingHeight.min + 
                        Math.random() * (district.buildingHeight.max - district.buildingHeight.min);
                    const width = 4 + Math.random() * 4;
                    const depth = 4 + Math.random() * 4;

                    // Determine building style based on district
                    let style;
                    if (district.name === 'Downtown') style = 'modern';
                    else if (district.name === 'Residential') style = 'classic';
                    else if (district.name === 'Industrial') style = 'industrial';
                    else style = Math.random() < 0.5 ? 'modern' : 'classic';

                    const building = this.createBuilding(width, height, depth, {
                        color: district.color,
                        style: style,
                        roughness: 0.7,
                        metalness: 0.3
                    });
                    
                    // Position building within its block, avoiding roads and sidewalks
                    const maxOffset = (blockSize - (roadWidth + 2 * sidewalkWidth) - Math.max(width, depth)) / 2;
                    building.position.x = x + (Math.random() * maxOffset * 2 - maxOffset);
                    building.position.z = z + (Math.random() * maxOffset * 2 - maxOffset);
                    building.position.y = height / 2;

                    this.buildingsGroup.add(building);
                }
            }
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    createStreetElements() {
        // Add street lights
        this.addStreetLights();
        
        // Add traffic signs
        this.addTrafficSigns();
        
        // Add benches and trash bins
        this.addStreetFurniture();
        
        // Add road markings
        this.addDetailedRoadMarkings();
    }

    addStreetLights() {
        const citySize = 40;
        const lightSpacing = 10;
        const poleHeight = 8;
        const poleRadius = 0.1;
        const lightRadius = 0.3;

        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.5
        });

        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffcc,
            emissive: 0xffffcc,
            emissiveIntensity: 1.0
        });

        // Create street lights along roads
        for (let x = -citySize/2; x <= citySize/2; x += lightSpacing) {
            for (let z = -citySize/2; z <= citySize/2; z += lightSpacing) {
                if (Math.abs(x) % 20 === 0 || Math.abs(z) % 20 === 0) {
                    // Create pole
                    const pole = new THREE.Mesh(
                        new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight, 8),
                        poleMaterial
                    );
                    pole.position.set(x, poleHeight/2, z);
                    this.streetElementsGroup.add(pole);

                    // Create light
                    const light = new THREE.Mesh(
                        new THREE.SphereGeometry(lightRadius, 16, 16),
                        lightMaterial
                    );
                    light.position.set(x, poleHeight - 1, z);
                    this.streetElementsGroup.add(light);

                    // Add point light
                    const pointLight = new THREE.PointLight(0xffffcc, 1, 20);
                    pointLight.position.set(x, poleHeight - 1, z);
                    this.scene.add(pointLight);
                }
            }
        }
    }

    addTrafficSigns() {
        const citySize = 40;
        const signSpacing = 20;
        const signHeight = 3;
        const signMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            roughness: 0.5,
            metalness: 0.5
        });

        // Add traffic signs at intersections
        for (let x = -citySize/2; x <= citySize/2; x += signSpacing) {
            for (let z = -citySize/2; z <= citySize/2; z += signSpacing) {
                if (Math.abs(x) % 20 === 0 && Math.abs(z) % 20 === 0) {
                    const sign = new THREE.Mesh(
                        new THREE.BoxGeometry(0.5, 1, 0.1),
                        signMaterial
                    );
                    sign.position.set(x + 2, signHeight, z + 2);
                    this.streetElementsGroup.add(sign);
                }
            }
        }
    }

    addStreetFurniture() {
        const citySize = 40;
        const furnitureSpacing = 15;

        // Add benches
        for (let x = -citySize/2; x <= citySize/2; x += furnitureSpacing) {
            for (let z = -citySize/2; z <= citySize/2; z += furnitureSpacing) {
                if (Math.random() < 0.3) {
                    const bench = this.createBench();
                    bench.position.set(x + 3, 0, z + 3);
                    this.streetElementsGroup.add(bench);
                }
            }
        }

        // Add trash bins
        for (let x = -citySize/2; x <= citySize/2; x += furnitureSpacing) {
            for (let z = -citySize/2; z <= citySize/2; z += furnitureSpacing) {
                if (Math.random() < 0.2) {
                    const bin = this.createTrashBin();
                    bin.position.set(x - 3, 0, z - 3);
                    this.streetElementsGroup.add(bin);
                }
            }
        }
    }

    createBench() {
        const group = new THREE.Group();
        
        // Bench seat
        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.1, 0.5),
            new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.8,
                metalness: 0.2
            })
        );
        seat.position.set(0, 0.5, 0);
        group.add(seat);

        // Bench back
        const back = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.5, 0.1),
            new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.8,
                metalness: 0.2
            })
        );
        back.position.set(0, 0.75, -0.2);
        group.add(back);

        // Bench legs
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.7,
            metalness: 0.5
        });

        const leg1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.5, 0.1),
            legMaterial
        );
        leg1.position.set(-0.9, 0.25, 0);
        group.add(leg1);

        const leg2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.5, 0.1),
            legMaterial
        );
        leg2.position.set(0.9, 0.25, 0);
        group.add(leg2);

        return group;
    }

    createTrashBin() {
        const group = new THREE.Group();
        
        // Bin body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 1, 16),
            new THREE.MeshStandardMaterial({
                color: 0x333333,
                roughness: 0.7,
                metalness: 0.5
            })
        );
        body.position.set(0, 0.5, 0);
        group.add(body);

        // Bin lid
        const lid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 0.1, 16),
            new THREE.MeshStandardMaterial({
                color: 0x666666,
                roughness: 0.6,
                metalness: 0.6
            })
        );
        lid.position.set(0, 1.05, 0);
        group.add(lid);

        return group;
    }

    addDetailedRoadMarkings() {
        const citySize = 40;
        const roadWidth = 4;
        const lineWidth = 0.2;
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.5
        });

        // Add dashed center lines
        for (let i = -citySize/2; i <= citySize/2; i += 10) {
            // Horizontal dashed lines
            for (let x = -citySize/2; x <= citySize/2; x += 2) {
                if (x % 4 < 2) {
                    const line = new THREE.Mesh(
                        new THREE.PlaneGeometry(1, lineWidth),
                        lineMaterial
                    );
                    line.rotation.x = -Math.PI / 2;
                    line.position.set(x, 0.02, i);
                    this.groundGroup.add(line);
                }
            }

            // Vertical dashed lines
            for (let z = -citySize/2; z <= citySize/2; z += 2) {
                if (z % 4 < 2) {
                    const line = new THREE.Mesh(
                        new THREE.PlaneGeometry(lineWidth, 1),
                        lineMaterial
                    );
                    line.rotation.x = -Math.PI / 2;
                    line.position.set(i, 0.02, z);
                    this.groundGroup.add(line);
                }
            }
        }
    }

    createEnvironment() {
        // Add trees
        this.addTrees();
        
        // Add bushes
        this.addBushes();
        
        // Add ground details
        this.addGroundDetails();
    }

    addTrees() {
        const citySize = 40;
        const treeSpacing = 15;

        for (let x = -citySize/2; x <= citySize/2; x += treeSpacing) {
            for (let z = -citySize/2; z <= citySize/2; z += treeSpacing) {
                if (Math.random() < 0.3) {
                    const tree = this.createTree();
                    tree.position.set(x + 5, 0, z + 5);
                    this.environmentGroup.add(tree);
                }
            }
        }
    }

    createTree() {
        const group = new THREE.Group();
        
        // Tree trunk
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.3, 3, 8),
            new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.9,
                metalness: 0.1
            })
        );
        trunk.position.set(0, 1.5, 0);
        group.add(trunk);

        // Tree leaves
        const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(2, 4, 8),
            new THREE.MeshStandardMaterial({
                color: 0x228B22,
                roughness: 0.8,
                metalness: 0.2
            })
        );
        leaves.position.set(0, 4, 0);
        group.add(leaves);

        return group;
    }

    addBushes() {
        const citySize = 40;
        const bushSpacing = 10;

        for (let x = -citySize/2; x <= citySize/2; x += bushSpacing) {
            for (let z = -citySize/2; z <= citySize/2; z += bushSpacing) {
                if (Math.random() < 0.2) {
                    const bush = this.createBush();
                    bush.position.set(x - 5, 0, z - 5);
                    this.environmentGroup.add(bush);
                }
            }
        }
    }

    createBush() {
        const group = new THREE.Group();
        
        // Create multiple spheres for a bushier look
        for (let i = 0; i < 5; i++) {
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 8, 8),
                new THREE.MeshStandardMaterial({
                    color: 0x228B22,
                    roughness: 0.8,
                    metalness: 0.2
                })
            );
            sphere.position.set(
                (Math.random() - 0.5) * 0.5,
                0.5 + Math.random() * 0.5,
                (Math.random() - 0.5) * 0.5
            );
            group.add(sphere);
        }

        return group;
    }

    addGroundDetails() {
        const citySize = 40;
        const detailSpacing = 5;

        // Add small ground details like rocks and patches
        for (let x = -citySize/2; x <= citySize/2; x += detailSpacing) {
            for (let z = -citySize/2; z <= citySize/2; z += detailSpacing) {
                if (Math.random() < 0.1) {
                    const detail = this.createGroundDetail();
                    detail.position.set(x, 0.01, z);
                    this.environmentGroup.add(detail);
                }
            }
        }
    }

    createGroundDetail() {
        const group = new THREE.Group();
        
        // Create a small rock or patch
        const detail = new THREE.Mesh(
            new THREE.SphereGeometry(0.2 + Math.random() * 0.3, 8, 8),
            new THREE.MeshStandardMaterial({
                color: 0x808080,
                roughness: 0.9,
                metalness: 0.1
            })
        );
        detail.scale.set(1, 0.3, 1);
        group.add(detail);

        return group;
    }
}

export { SimpleCity }; 