import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class SlowRoadsSimulator {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        
        // Create groups for organization
        this.terrainGroup = new THREE.Group();
        this.roadGroup = new THREE.Group();
        this.environmentGroup = new THREE.Group();
        this.weatherGroup = new THREE.Group();
        this.skyGroup = new THREE.Group();
        
        // Add groups to scene
        this.scene.add(this.terrainGroup);
        this.scene.add(this.roadGroup);
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
        
        this.init();
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
        this.camera.position.set(0, 5, 10);
        this.camera.lookAt(0, 0, 0);

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 50;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1;
        this.controls.update();

        // Initialize sky
        this.initSky();

        // Setup lights
        this.setupLights();

        // Create terrain
        this.createTerrain();

        // Create road
        this.createRoad();

        // Create environment
        this.createEnvironment();

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
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        // Main directional light (sun)
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

    createTerrain() {
        // Create base terrain
        const terrainGeometry = new THREE.PlaneGeometry(100, 100, 32, 32);
        const terrainMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a7e4f,
            roughness: 0.8,
            metalness: 0.2
        });
        const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        this.terrainGroup.add(terrain);

        // Add terrain details
        this.addTerrainDetails();
    }

    addTerrainDetails() {
        // Add hills and valleys
        const geometry = this.terrainGroup.children[0].geometry;
        const vertices = geometry.attributes.position.array;

        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            // Create rolling hills
            vertices[i + 1] = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
    }

    createRoad() {
        // Create winding road
        const roadWidth = 8;
        const roadGeometry = new THREE.PlaneGeometry(100, roadWidth);
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.9,
            metalness: 0.1
        });
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.01;
        road.receiveShadow = true;
        this.roadGroup.add(road);

        // Add road markings
        this.addRoadMarkings();
    }

    addRoadMarkings() {
        const roadWidth = 8;
        const lineWidth = 0.3;
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.5
        });

        // Add center line
        const centerLine = new THREE.Mesh(
            new THREE.PlaneGeometry(100, lineWidth),
            lineMaterial
        );
        centerLine.rotation.x = -Math.PI / 2;
        centerLine.position.y = 0.02;
        this.roadGroup.add(centerLine);

        // Add dashed lines
        for (let i = -50; i < 50; i += 4) {
            if (i % 8 < 4) {
                const dash = new THREE.Mesh(
                    new THREE.PlaneGeometry(2, lineWidth),
                    lineMaterial
                );
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(i, 0.02, roadWidth/4);
                this.roadGroup.add(dash);

                const dash2 = new THREE.Mesh(
                    new THREE.PlaneGeometry(2, lineWidth),
                    lineMaterial
                );
                dash2.rotation.x = -Math.PI / 2;
                dash2.position.set(i, 0.02, -roadWidth/4);
                this.roadGroup.add(dash2);
            }
        }
    }

    createEnvironment() {
        // Add trees
        this.addTrees();
        
        // Add bushes
        this.addBushes();
        
        // Add rocks
        this.addRocks();
    }

    addTrees() {
        const treeCount = 50;
        const treeSpacing = 20;

        for (let i = 0; i < treeCount; i++) {
            const tree = this.createTree();
            const angle = (i / treeCount) * Math.PI * 2;
            const radius = 30 + Math.random() * 20;
            tree.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
            this.environmentGroup.add(tree);
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
        const bushCount = 30;
        const bushSpacing = 15;

        for (let i = 0; i < bushCount; i++) {
            const bush = this.createBush();
            const angle = (i / bushCount) * Math.PI * 2;
            const radius = 25 + Math.random() * 15;
            bush.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
            this.environmentGroup.add(bush);
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

    addRocks() {
        const rockCount = 20;
        const rockSpacing = 25;

        for (let i = 0; i < rockCount; i++) {
            const rock = this.createRock();
            const angle = (i / rockCount) * Math.PI * 2;
            const radius = 35 + Math.random() * 25;
            rock.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
            this.environmentGroup.add(rock);
        }
    }

    createRock() {
        const group = new THREE.Group();
        
        // Create a rock using multiple spheres
        for (let i = 0; i < 3; i++) {
            const sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 8, 8),
                new THREE.MeshStandardMaterial({
                    color: 0x808080,
                    roughness: 0.9,
                    metalness: 0.1
                })
            );
            sphere.position.set(
                (Math.random() - 0.5) * 0.5,
                0.25 + Math.random() * 0.5,
                (Math.random() - 0.5) * 0.5
            );
            sphere.scale.set(
                1 + Math.random() * 0.5,
                0.5 + Math.random() * 0.5,
                1 + Math.random() * 0.5
            );
            group.add(sphere);
        }

        return group;
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

    updateSky() {
        const time = this.sky.time;
        const dayTime = time > 0.25 && time < 0.75;

        // Update sky colors
        const skyMaterial = this.skyGroup.children[0].material;
        if (dayTime) {
            skyMaterial.uniforms.topColor.value.setHex(0x0077ff);
            skyMaterial.uniforms.bottomColor.value.setHex(0xffffff);
        } else {
            skyMaterial.uniforms.topColor.value.setHex(0x000033);
            skyMaterial.uniforms.bottomColor.value.setHex(0x000066);
        }

        // Update lighting
        this.updateLighting(time);
    }

    updateLighting(time) {
        const dayTime = time > 0.25 && time < 0.75;
        const intensity = dayTime ? 1.0 : 0.2;

        this.scene.children.forEach(child => {
            if (child instanceof THREE.AmbientLight) {
                child.intensity = intensity * 0.5;
            }
            if (child instanceof THREE.DirectionalLight) {
                child.intensity = intensity;
                const angle = time * Math.PI * 2;
                child.position.x = Math.cos(angle) * 100;
                child.position.y = Math.sin(angle) * 100;
                child.position.z = 0;
            }
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

export { SlowRoadsSimulator }; 