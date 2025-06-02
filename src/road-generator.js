import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class RoadGenerator {
    constructor(scene, terrain) {
        this.scene = scene;
        this.terrain = terrain;
        this.noise = createNoise2D();
        this.roads = [];
        this.roadWidth = 8;
        this.roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2
        });
    }

    generateRoad(startPoint, length, curvature = 1.0) {
        const points = this.generateRoadPoints(startPoint, length, curvature);
        const roadGeometry = this.createRoadGeometry(points);
        const road = new THREE.Mesh(roadGeometry, this.roadMaterial);
        road.receiveShadow = true;
        this.scene.add(road);
        this.roads.push(road);
        return road;
    }

    generateRoadPoints(startPoint, length, curvature) {
        const points = [];
        const segments = Math.floor(length / 10);
        let currentPoint = new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z);
        let direction = new THREE.Vector3(1, 0, 0);
        let angle = 0;

        for (let i = 0; i < segments; i++) {
            points.push(currentPoint.clone());

            // Generate natural curve
            const noiseValue = this.noise(i * 0.1, 0) * curvature;
            angle += noiseValue * 0.1;
            direction.set(Math.cos(angle), 0, Math.sin(angle));

            // Adjust height based on terrain
            const nextPoint = currentPoint.clone().add(direction.multiplyScalar(10));
            const terrainHeight = this.getTerrainHeight(nextPoint.x, nextPoint.z);
            nextPoint.y = terrainHeight + 0.1; // Slightly above terrain

            currentPoint = nextPoint;
        }

        return points;
    }

    createRoadGeometry(points) {
        const shape = new THREE.Shape();
        const halfWidth = this.roadWidth / 2;

        // Create road shape
        shape.moveTo(-halfWidth, 0);
        shape.lineTo(halfWidth, 0);
        shape.lineTo(halfWidth, 1);
        shape.lineTo(-halfWidth, 1);
        shape.lineTo(-halfWidth, 0);

        // Create road geometry
        const geometry = new THREE.ExtrudeGeometry(shape, {
            steps: 1,
            depth: 0.1,
            bevelEnabled: false
        });

        // Position and rotate geometry along points
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const pointIndex = Math.floor(i / 9);
            if (pointIndex < points.length - 1) {
                const currentPoint = points[pointIndex];
                const nextPoint = points[pointIndex + 1];
                const direction = new THREE.Vector3()
                    .subVectors(nextPoint, currentPoint)
                    .normalize();
                const angle = Math.atan2(direction.z, direction.x);

                // Transform vertices
                const x = vertices[i];
                const y = vertices[i + 1];
                const z = vertices[i + 2];

                // Rotate
                const rotatedX = x * Math.cos(angle) - z * Math.sin(angle);
                const rotatedZ = x * Math.sin(angle) + z * Math.cos(angle);

                // Translate
                vertices[i] = rotatedX + currentPoint.x;
                vertices[i + 1] = y + currentPoint.y;
                vertices[i + 2] = rotatedZ + currentPoint.z;
            }
        }

        geometry.computeVertexNormals();
        return geometry;
    }

    getTerrainHeight(x, z) {
        // Get height from terrain at given x,z coordinates
        const terrainGeometry = this.terrain.geometry;
        const vertices = terrainGeometry.attributes.position.array;
        const size = Math.sqrt(vertices.length / 3);
        const halfSize = size / 2;

        // Convert world coordinates to terrain coordinates
        const terrainX = Math.floor((x + halfSize) / size * (size - 1));
        const terrainZ = Math.floor((z + halfSize) / size * (size - 1));

        // Get height at coordinates
        const index = (terrainZ * size + terrainX) * 3 + 1;
        return vertices[index];
    }

    update() {
        // Update road positions if terrain changes
        this.roads.forEach(road => {
            const geometry = road.geometry;
            const vertices = geometry.attributes.position.array;
            for (let i = 0; i < vertices.length; i += 3) {
                const x = vertices[i];
                const z = vertices[i + 2];
                vertices[i + 1] = this.getTerrainHeight(x, z) + 0.1;
            }
            geometry.attributes.position.needsUpdate = true;
            geometry.computeVertexNormals();
        });
    }
} 