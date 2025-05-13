import * as THREE from 'three';
import { osmToGeoJSON } from 'osmtogeojson';

export class CityLoader {
    constructor(scene, centerLat, centerLon) {
        this.scene = scene;
        this.centerLat = centerLat;
        this.centerLon = centerLon;
        this.buildings = new THREE.Group();
        this.scene.add(this.buildings);
        this.tiles = new THREE.Group();
        this.scene.add(this.tiles);
        this.roads = new THREE.Group();
        this.scene.add(this.roads);
        
        // Load textures
        this.textureLoader = new THREE.TextureLoader();
        this.loadTextures();
        
        console.log('CityLoader initialized with center:', { lat: centerLat, lon: centerLon });
    }

    async loadTextures() {
        this.textures = {
            building: await this.textureLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/brick_diffuse.jpg'),
            buildingNormal: await this.textureLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/brick_bump.jpg'),
            road: await this.textureLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/terrain/grasslight-big.jpg'),
            window: await this.textureLoader.loadAsync('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/hardwood2_diffuse.jpg')
        };
        
        // Configure texture settings
        Object.values(this.textures).forEach(texture => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4);
        });
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
                relation["building"](${minLat},${minLon},${maxLat},${maxLon});
            );
            out body;
            >;
            out skel qt;
        `;

        try {
            console.log('Fetching OSM data...');
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const osmData = await response.json();
            console.log('OSM data received:', osmData);
            
            const geojsonData = osmToGeoJSON(osmData);
            console.log('GeoJSON data converted:', geojsonData);
            
            await Promise.all([
                this.processBuildings(geojsonData),
                this.processRoads(geojsonData)
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
        // Try to get real height data
        if (properties.height) {
            return parseFloat(properties.height);
        } else if (properties.levels) {
            return parseFloat(properties.levels) * 3;
        } else if (properties.building === 'residential') {
            return Math.random() * 5 + 8; // 8-13 meters for residential
        } else if (properties.building === 'commercial') {
            return Math.random() * 10 + 15; // 15-25 meters for commercial
        } else if (properties.building === 'industrial') {
            return Math.random() * 5 + 6; // 6-11 meters for industrial
        }
        return Math.random() * 10 + 5; // Default height
    }

    async createBuilding(coordinates, height, properties) {
        try {
            const shape = new THREE.Shape();
            
            coordinates.forEach((coord, index) => {
                const [x, y] = this.latLonToXY(coord[1], coord[0]);
                if (index === 0) {
                    shape.moveTo(x, y);
                } else {
                    shape.lineTo(x, y);
                }
            });

            // Create building geometry with more detail
            const extrudeSettings = {
                depth: height,
                bevelEnabled: true,
                bevelThickness: 0.2,
                bevelSize: 0.1,
                bevelSegments: 3
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            
            // Create more realistic building material
            const material = new THREE.MeshPhysicalMaterial({
                map: this.textures.building,
                normalMap: this.textures.buildingNormal,
                normalScale: new THREE.Vector2(0.5, 0.5),
                roughness: 0.7,
                metalness: 0.2,
                clearcoat: 0.1,
                clearcoatRoughness: 0.2
            });

            const building = new THREE.Mesh(geometry, material);
            building.castShadow = true;
            building.receiveShadow = true;

            // Add windows
            this.addWindows(building, height, properties);
            
            return building;
        } catch (error) {
            console.error('Error creating building:', error);
            return null;
        }
    }

    addWindows(building, height, properties) {
        const windowGeometry = new THREE.PlaneGeometry(1, 1.5);
        const windowMaterial = new THREE.MeshPhysicalMaterial({
            map: this.textures.window,
            transparent: true,
            opacity: 0.7,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 1.0
        });

        // Add windows to each side of the building
        const sides = building.geometry.attributes.position;
        const windowCount = Math.floor(height / 3); // One window per 3 meters

        for (let i = 0; i < windowCount; i++) {
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.y = i * 3 + 1.5;
            window.rotation.y = Math.random() * Math.PI * 2;
            window.position.x = (Math.random() - 0.5) * 5;
            window.position.z = (Math.random() - 0.5) * 5;
            building.add(window);
        }
    }

    async processRoads(geojsonData) {
        const roadFeatures = geojsonData.features.filter(f => 
            f.properties.highway && ['primary', 'secondary', 'residential'].includes(f.properties.highway)
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

        const roadWidth = properties.highway === 'primary' ? 8 : 
                         properties.highway === 'secondary' ? 6 : 4;

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.MeshStandardMaterial({
            map: this.textures.road,
            roughness: 0.8,
            metalness: 0.2
        });

        const road = new THREE.Mesh(geometry, material);
        road.computeVertexNormals();
        return road;
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
