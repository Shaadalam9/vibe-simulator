import * as THREE from 'three';
import { GeoConverter } from 'three-geo';
import { osmToGeoJSON } from 'osmtogeojson';

export class CityLoader {
    constructor(scene, centerLat, centerLon) {
        this.scene = scene;
        this.centerLat = centerLat;
        this.centerLon = centerLon;
        
        // Initialize GeoConverter with proper scale
        this.converter = new GeoConverter();
        this.converter.setCenter(centerLat, centerLon);
        this.converter.setScale(1); // Set scale to 1 meter per unit
        
        this.buildings = new THREE.Group();
        this.scene.add(this.buildings);
        this.tiles = new THREE.Group();
        this.scene.add(this.tiles);
        
        console.log('CityLoader initialized with center:', { lat: centerLat, lon: centerLon });
    }

    async loadCityData(bounds) {
        console.log('Loading city data for bounds:', bounds);
        const { minLat, maxLat, minLon, maxLon } = bounds;
        const query = `
            [out:json][timeout:25];
            (
                way["building"](${minLat},${minLon},${maxLat},${maxLon});
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
            
            await this.processBuildings(geojsonData);
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
                const building = await this.createBuilding(feature.geometry.coordinates[0], height);
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
        }
        return Math.random() * 10 + 5;
    }

    async createBuilding(coordinates, height) {
        try {
            const shape = new THREE.Shape();
            
            coordinates.forEach((coord, index) => {
                const [x, y] = this.converter.latLonToXY(coord[1], coord[0]);
                if (index === 0) {
                    shape.moveTo(x, y);
                } else {
                    shape.lineTo(x, y);
                }
            });

            const extrudeSettings = {
                depth: height,
                bevelEnabled: false
            };

            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            const material = new THREE.MeshPhongMaterial({
                color: 0xcccccc,
                flatShading: true,
                side: THREE.DoubleSide
            });

            const building = new THREE.Mesh(geometry, material);
            building.castShadow = true;
            building.receiveShadow = true;
            
            return building;
        } catch (error) {
            console.error('Error creating building:', error);
            return null;
        }
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
            const [posX, posY] = this.converter.latLonToXY(lon, lat);
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
