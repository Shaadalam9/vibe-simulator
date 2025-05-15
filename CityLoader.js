import * as THREE from 'three';
import * as osmtogeojson from 'osmtogeojson';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';

export class CityLoader {
    constructor(scene, centerLat, centerLon, renderer, camera) {
        this.scene = scene;
        this.centerLat = centerLat;
        this.centerLon = centerLon;
        this.renderer = renderer;
        this.camera = camera;
        
        this.buildings = new THREE.Group();
        this.scene.add(this.buildings);
        this.tiles = new THREE.Group();
        this.scene.add(this.tiles);
        this.roads = new THREE.Group();
        this.scene.add(this.roads);
        this.details = new THREE.Group();
        this.scene.add(this.details);
        this.vegetation = new THREE.Group();
        this.scene.add(this.vegetation);
        this.particles = new THREE.Group();
        this.scene.add(this.particles);
        
        this.noise = new SimplexNoise();
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        
        this.loadTextures();
        this.setupEnvironment();
        this.setupPostProcessing();
        console.log('CityLoader initialized with center:', { lat: centerLat, lon: centerLon });
    }

    setupEnvironment() {
        // Add sky
        const sky = new Sky();
        sky.scale.setScalar(10000);
        this.scene.add(sky);

        const skyUniforms = sky.material.uniforms;
        skyUniforms['turbidity'].value = 10;
        skyUniforms['rayleigh'].value = 2;
        skyUniforms['mieCoefficient'].value = 0.005;
        skyUniforms['mieDirectionalG'].value = 0.8;

        const sun = new THREE.Vector3();
        const phi = THREE.MathUtils.degToRad(88);
        const theta = THREE.MathUtils.degToRad(180);
        sun.setFromSphericalCoords(1, phi, theta);
        skyUniforms['sunPosition'].value.copy(sun);

        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.scene.add(ambientLight);

        // Add directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.copy(sun);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        this.scene.add(sunLight);

        // Add fog for depth
        this.scene.fog = new THREE.FogExp2(0xcccccc, 0.002);
    }

    setupPostProcessing() {
        if (!this.renderer || !this.camera) {
            console.warn('Renderer or camera not initialized, skipping post-processing setup');
            return;
        }

        try {
            this.composer = new EffectComposer(this.renderer);
            this.composer.addPass(new RenderPass(this.scene, this.camera));
            
            // Add bloom effect for lights
            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                1.5,  // strength
                0.4,  // radius
                0.85  // threshold
            );
            this.composer.addPass(bloomPass);
            
            // Add ambient occlusion
            const ssaoPass = new SSAOPass(
                this.scene,
                this.camera,
                window.innerWidth,
                window.innerHeight
            );
            ssaoPass.kernelRadius = 16;
            ssaoPass.minDistance = 0.005;
            ssaoPass.maxDistance = 0.1;
            this.composer.addPass(ssaoPass);
        } catch (error) {
            console.warn('Error setting up post-processing:', error);
        }
    }

    async loadTextures() {
        // Use more reliable texture URLs
        const textureUrls = {
            building: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/brick_diffuse.jpg',
            buildingNormal: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/brick_bump.jpg',
            road: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
            window: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/hardwood2_diffuse.jpg',
            concrete: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
            metal: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
            glass: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
            grass: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
            tree: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/sprites/spark1.png',
            water: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg',
            dirt: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg',
            asphalt: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg'
        };

        this.textures = {};
        
        // Load textures with error handling
        for (const [key, url] of Object.entries(textureUrls)) {
            try {
                this.textures[key] = await this.textureLoader.loadAsync(url);
                this.textures[key].wrapS = this.textures[key].wrapT = THREE.RepeatWrapping;
                this.textures[key].repeat.set(4, 4);
            } catch (error) {
                console.warn(`Failed to load texture ${key}:`, error);
                // Use a fallback color material if texture loading fails
                this.textures[key] = new THREE.MeshStandardMaterial({
                    color: 0x808080,
                    roughness: 0.8
                });
            }
        }
    }

    // Convert lat/lon to local coordinates
    latLonToXY(lat, lon) {
        const R = 6378137; // Earth radius in meters
        const x = R * (THREE.MathUtils.degToRad(lon - this.centerLon));
        const y = R * Math.log(Math.tan(Math.PI / 4 + THREE.MathUtils.degToRad(lat) / 2));
        const centerY = R * Math.log(Math.tan(Math.PI / 4 + THREE.MathUtils.degToRad(this.centerLat) / 2));
        return [x, y - centerY];
    }

    async loadCityData(bounds) {
        console.log('Loading city data for bounds:', bounds);
        const { minLat, maxLat, minLon, maxLon } = bounds;
        const query = `
            [out:json][timeout:25];
            (
                way["building"](${minLat},${minLon},${maxLat},${maxLon});
                way["highway"](${minLat},${minLon},${maxLat},${maxLon});
                way["landuse"](${minLat},${minLon},${maxLat},${maxLon});
                way["amenity"](${minLat},${minLon},${maxLat},${maxLon});
                way["leisure"](${minLat},${minLon},${maxLat},${maxLon});
                relation["building"](${minLat},${minLon},${maxLat},${maxLon});
            );
            out body;
            >;
            out skel qt;
        `;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });
            
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const osmData = await response.json();
            const geojsonData = osmtogeojson(osmData);
            
            await Promise.all([
                this.processBuildings(geojsonData),
                this.processRoads(geojsonData),
                this.processAmenities(geojsonData),
                this.processLeisure(geojsonData)
            ]);
        } catch (error) {
            console.error('Error loading OSM data:', error);
            throw error;
        }
    }

    async processBuildings(geojsonData) {
        console.log('Processing buildings...');
        const promises = geojsonData.features.map(async feature => {
            if (feature.geometry.type === 'Polygon' && feature.properties.building) {
                const height = this.getBuildingHeight(feature.properties);
                const building = await this.createBuilding(feature.geometry.coordinates[0], height, feature.properties);
                if (building) {
                    this.buildings.add(building);
                }
            }
        });
        await Promise.all(promises);
        console.log('Buildings processed');
    }

    getBuildingHeight(properties) {
        if (properties.height) {
            return parseFloat(properties.height);
        } else if (properties.levels) {
            return parseFloat(properties.levels) * 3;
        } else if (properties.building === 'residential') {
            return Math.random() * 5 + 8;
        } else if (properties.building === 'commercial') {
            return Math.random() * 10 + 15;
        } else if (properties.building === 'industrial') {
            return Math.random() * 5 + 6;
        } else if (properties.building === 'skyscraper') {
            return Math.random() * 50 + 100;
        }
        return Math.random() * 10 + 5;
    }

    async createBuilding(coordinates, height, properties) {
        try {
            const shape = new THREE.Shape();
            coordinates.forEach((coord, index) => {
                const [x, y] = this.latLonToXY(coord[1], coord[0]);
                if (index === 0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            });

            // Add architectural details
            const extrudeSettings = {
                depth: height,
                bevelEnabled: true,
                bevelThickness: 0.2,
                bevelSize: 0.1,
                bevelSegments: 3,
                curveSegments: 12
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            
            // Choose material based on building type
            let material;
            if (properties.building === 'commercial' || properties.building === 'skyscraper') {
                material = new THREE.MeshPhysicalMaterial({
                    map: this.textures.glass,
                    transparent: true,
                    opacity: 0.8,
                    metalness: 0.9,
                    roughness: 0.1,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    envMapIntensity: 1.0
                });
            } else if (properties.building === 'industrial') {
                material = new THREE.MeshPhysicalMaterial({
                    map: this.textures.metal,
                    metalness: 0.8,
                    roughness: 0.4,
                    clearcoat: 0.5
                });
            } else {
                material = new THREE.MeshPhysicalMaterial({
                    map: this.textures.building,
                    normalMap: this.textures.buildingNormal,
                    normalScale: new THREE.Vector2(0.5, 0.5),
                    roughness: 0.7,
                    metalness: 0.2,
                    clearcoat: 0.1,
                    clearcoatRoughness: 0.2
                });
            }

            const building = new THREE.Mesh(geometry, material);
            building.castShadow = true;
            building.receiveShadow = true;

            // Add architectural details
            this.addArchitecturalDetails(building, height, properties);
            
            // Add surrounding details
            this.addBuildingDetails(building, properties);
            
            // Add interior lighting
            this.addInteriorLighting(building, properties);
            
            return building;
        } catch (error) {
            console.error('Error creating building:', error);
            return null;
        }
    }

    addInteriorLighting(building, properties) {
        if (properties.building === 'commercial' || properties.building === 'skyscraper') {
            const windowCount = Math.floor(building.geometry.parameters.depth / 3);
            for (let i = 0; i < windowCount; i++) {
                const light = new THREE.PointLight(0xffffcc, 0.5, 10);
                light.position.set(
                    (Math.random() - 0.5) * 5,
                    i * 3 + 1.5,
                    (Math.random() - 0.5) * 5
                );
                building.add(light);
            }
        }
    }

    addBuildingDetails(building, properties) {
        // Add trees around buildings
        if (properties.building === 'residential') {
            const treeCount = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < treeCount; i++) {
                this.addTree(
                    building.position.x + (Math.random() - 0.5) * 10,
                    building.position.z + (Math.random() - 0.5) * 10
                );
            }
        }

        // Add parking spots for commercial buildings
        if (properties.building === 'commercial') {
            const parkingCount = Math.floor(Math.random() * 5) + 2;
            for (let i = 0; i < parkingCount; i++) {
                this.addParkingSpot(
                    building.position.x + (Math.random() - 0.5) * 15,
                    building.position.z + (Math.random() - 0.5) * 15
                );
            }
        }

        // Add ground details
        this.addGroundDetails(building, properties);
    }

    addGroundDetails(building, properties) {
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({
            map: this.textures.grass,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(
            building.position.x,
            -0.1,
            building.position.z
        );
        this.details.add(ground);
    }

    addTree(x, z) {
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);

        const leavesGeometry = new THREE.ConeGeometry(1.5, 3, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 2.5;

        const tree = new THREE.Group();
        tree.add(trunk);
        tree.add(leaves);
        tree.position.set(x, 0, z);
        tree.castShadow = true;
        this.vegetation.add(tree);

        // Add ground around tree
        const groundGeometry = new THREE.CircleGeometry(1, 32);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a5f0b,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        tree.add(ground);
    }

    addParkingSpot(x, z) {
        const spotGeometry = new THREE.PlaneGeometry(2.5, 5);
        const spotMaterial = new THREE.MeshStandardMaterial({
            map: this.textures.asphalt,
            roughness: 0.8
        });
        const spot = new THREE.Mesh(spotGeometry, spotMaterial);
        spot.rotation.x = -Math.PI / 2;
        spot.position.set(x, 0.01, z);
        this.details.add(spot);

        // Add parking lines
        const lineGeometry = new THREE.PlaneGeometry(0.1, 4);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, 0.02, z);
        this.details.add(line);
    }

    addArchitecturalDetails(building, height, properties) {
        // Add windows
        const windowCount = Math.floor(height / 3);
        const windowGeometry = new THREE.PlaneGeometry(1, 1.5);
        const windowMaterial = new THREE.MeshPhysicalMaterial({
            map: this.textures.window,
            transparent: true,
            opacity: 0.7,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 1.0
        });

        for (let i = 0; i < windowCount; i++) {
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.y = i * 3 + 1.5;
            window.rotation.y = Math.random() * Math.PI * 2;
            window.position.x = (Math.random() - 0.5) * 5;
            window.position.z = (Math.random() - 0.5) * 5;
            building.add(window);
        }

        // Add roof details
        if (properties.building === 'residential') {
            const roofGeometry = new THREE.ConeGeometry(5, 3, 4);
            const roofMaterial = new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.8
            });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = height + 1.5;
            building.add(roof);
        } else if (properties.building === 'commercial' || properties.building === 'skyscraper') {
            // Add antenna or spire to tall buildings
            const antennaGeometry = new THREE.CylinderGeometry(0.1, 0.1, 10, 8);
            const antennaMaterial = new THREE.MeshStandardMaterial({
                color: 0x888888,
                metalness: 0.8
            });
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.position.y = height + 5;
            building.add(antenna);

            // Add rooftop details
            this.addRooftopDetails(building, height);
        }
    }

    addRooftopDetails(building, height) {
        // Add rooftop garden or equipment
        const equipmentGeometry = new THREE.BoxGeometry(3, 2, 3);
        const equipmentMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.8,
            roughness: 0.4
        });
        const equipment = new THREE.Mesh(equipmentGeometry, equipmentMaterial);
        equipment.position.y = height + 1;
        building.add(equipment);
    }

    async processRoads(geojsonData) {
        const roadFeatures = geojsonData.features.filter(f => 
            f.properties.highway && ['primary', 'secondary', 'residential', 'tertiary'].includes(f.properties.highway)
        );

        roadFeatures.forEach(feature => {
            if (feature.geometry.type === 'LineString') {
                const road = this.createRoad(feature.geometry.coordinates, feature.properties);
                if (road) this.roads.add(road);
            }
        });
    }

    createRoad(coordinates, properties) {
        const points = coordinates.map(coord => {
            const [x, y] = this.latLonToXY(coord[1], coord[0]);
            return new THREE.Vector3(x, 0.1, y);
        });

        const roadWidth = properties.highway === 'primary' ? 12 : 
                         properties.highway === 'secondary' ? 8 : 
                         properties.highway === 'tertiary' ? 6 : 4;

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.MeshStandardMaterial({
            map: this.textures.road,
            roughness: 0.8,
            metalness: 0.2
        });

        const road = new THREE.Mesh(geometry, material);
        road.computeVertexNormals();

        // Add road markings
        this.addRoadMarkings(road, properties);
        
        // Add road details
        this.addRoadDetails(road, properties);
        
        // Add road wear and tear
        this.addRoadWear(road, properties);
        
        return road;
    }

    addRoadWear(road, properties) {
        const wearGeometry = new THREE.BufferGeometry().setFromPoints(
            road.geometry.attributes.position.array.map((_, i) => {
                const pos = new THREE.Vector3();
                road.geometry.attributes.position.getXYZAt(i / road.geometry.attributes.position.count, pos);
                return pos.clone().add(new THREE.Vector3(0, 0.02, 0));
            })
        );
        const wearMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.9,
            metalness: 0.1
        });
        const wear = new THREE.Mesh(wearGeometry, wearMaterial);
        road.add(wear);
    }

    addRoadDetails(road, properties) {
        // Add street lamps
        if (properties.highway === 'primary' || properties.highway === 'secondary') {
            const lampCount = Math.floor(road.geometry.attributes.position.count / 20);
            for (let i = 0; i < lampCount; i++) {
                const t = i / lampCount;
                const position = new THREE.Vector3();
                road.geometry.attributes.position.getXYZAt(t, position);
                
                this.addStreetLamp(position.x, position.z);
            }
        }

        // Add sidewalks
        const sidewalkGeometry = new THREE.BufferGeometry().setFromPoints(
            road.geometry.attributes.position.array.map((_, i) => {
                const pos = new THREE.Vector3();
                road.geometry.attributes.position.getXYZAt(i / road.geometry.attributes.position.count, pos);
                return pos.clone().add(new THREE.Vector3(0, 0.05, 0));
            })
        );
        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            map: this.textures.concrete,
            roughness: 0.9
        });
        const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
        road.add(sidewalk);

        // Add road signs
        if (properties.highway === 'primary') {
            this.addRoadSigns(road);
        }
    }

    addRoadSigns(road) {
        const signGeometry = new THREE.BoxGeometry(0.5, 1, 0.1);
        const signMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.8
        });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(
            road.position.x + (Math.random() - 0.5) * 10,
            1,
            road.position.z + (Math.random() - 0.5) * 10
        );
        this.details.add(sign);
    }

    addRoadMarkings(road, properties) {
        if (properties.highway === 'primary' || properties.highway === 'secondary') {
            const markingGeometry = new THREE.PlaneGeometry(0.3, road.geometry.attributes.position.count * 0.1);
            const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const marking = new THREE.Mesh(markingGeometry, markingMaterial);
            marking.rotation.x = -Math.PI / 2;
            marking.position.y = 0.11;
            road.add(marking);
        }
    }

    addStreetLamp(x, z) {
        const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.8
        });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);

        const lightGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const lightMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFF00,
            emissive: 0xFFFF00,
            emissiveIntensity: 1
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.y = 2.5;

        const lamp = new THREE.Group();
        lamp.add(pole);
        lamp.add(light);
        lamp.position.set(x, 0, z);

        // Add point light
        const pointLight = new THREE.PointLight(0xFFFF00, 1, 20);
        pointLight.position.y = 2.5;
        lamp.add(pointLight);

        this.details.add(lamp);
    }

    async processAmenities(geojsonData) {
        const amenityFeatures = geojsonData.features.filter(f => f.properties.amenity);
        
        amenityFeatures.forEach(feature => {
            if (feature.geometry.type === 'Point') {
                const [x, y] = this.latLonToXY(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
                this.addAmenity(x, y, feature.properties);
            }
        });
    }

    addAmenity(x, y, properties) {
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.7
        });
        const amenity = new THREE.Mesh(geometry, material);
        amenity.position.set(x, 1, y);
        this.details.add(amenity);
    }

    async processLeisure(geojsonData) {
        const leisureFeatures = geojsonData.features.filter(f => f.properties.leisure);
        
        leisureFeatures.forEach(feature => {
            if (feature.geometry.type === 'Polygon') {
                const [x, y] = this.latLonToXY(feature.geometry.coordinates[0][0][1], feature.geometry.coordinates[0][0][0]);
                this.addLeisureArea(x, y, feature.properties);
            }
        });
    }

    addLeisureArea(x, y, properties) {
        const geometry = new THREE.PlaneGeometry(10, 10);
        const material = new THREE.MeshStandardMaterial({
            color: 0x90EE90,
            roughness: 0.8
        });
        const area = new THREE.Mesh(geometry, material);
        area.rotation.x = -Math.PI / 2;
        area.position.set(x, 0.05, y);
        this.details.add(area);
    }

    async loadMapTiles(bounds) {
        console.log('Loading map tiles...');
        const { minLat, maxLat, minLon, maxLon } = bounds;
        const zoom = 18;

        const minTile = this.latLonToTile(minLat, minLon, zoom);
        const maxTile = this.latLonToTile(maxLat, maxLon, zoom);
        
        console.log('Tile bounds:', { minTile, maxTile });

        const promises = [];
        for (let x = minTile.x; x <= maxTile.x; x++) {
            for (let y = minTile.y; y <= maxTile.y; y++) {
                promises.push(this.loadTile(x, y, zoom));
            }
        }
        await Promise.all(promises);
        console.log('Map tiles loaded');
    }

    async loadTile(x, y, zoom) {
        const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
        
        try {
            const texture = await new THREE.TextureLoader().loadAsync(url);
            const geometry = new THREE.PlaneGeometry(256, 256);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide
            });
            
            const tile = new THREE.Mesh(geometry, material);
            tile.rotation.x = -Math.PI / 2;
            
            const [lat, lon] = this.tileToLatLon(x, y, zoom);
            const [posX, posY] = this.latLonToXY(lat, lon);
            tile.position.set(posX, 0, posY);
            
            this.tiles.add(tile);
        } catch (error) {
            console.error('Error loading tile:', error, 'at', { x, y, zoom });
        }
    }

    latLonToTile(lat, lon, zoom) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lon + 180) / 360 * n);
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
        return { x, y };
    }

    tileToLatLon(x, y, zoom) {
        const n = Math.pow(2, zoom);
        const lon = x / n * 360 - 180;
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
        return [lat, lon];
    }
} 
