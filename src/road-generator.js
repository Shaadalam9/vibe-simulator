import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class RoadGenerator {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.noise = createNoise2D();
        this.roadPoints = [];
        this.roadSegments = [];
        this.roadLength = 1000; // Length of road to generate
        this.segmentLength = 50; // Length of each road segment
        this.roadWidth = 8; // Width of the road
        this.curvature = 0.5; // How curvy the road is
        this.elevation = 0.3; // How hilly the road is
        
        // Initialize road
        this.generateInitialRoad();
    }

    generateInitialRoad() {
        // Generate initial road points
        let x = 0;
        let z = 0;
        let angle = 0;

        for (let i = 0; i < this.roadLength; i += this.segmentLength) {
            // Use noise to create natural-looking curves
            const noiseValue = this.noise(x * 0.01, z * 0.01);
            angle += noiseValue * this.curvature;
            
            // Calculate elevation using a different noise value
            const elevationNoise = this.noise(x * 0.02, z * 0.02);
            const y = elevationNoise * this.elevation * 100;

            // Calculate next point
            x += Math.cos(angle) * this.segmentLength;
            z += Math.sin(angle) * this.segmentLength;

            // Add point to road
            this.roadPoints.push(new THREE.Vector3(x, y, z));
        }

        // Create road mesh
        this.createRoadMesh();
    }

    createRoadMesh() {
        // Create road geometry
        const roadGeometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const uvs = [];

        // Generate road vertices
        for (let i = 0; i < this.roadPoints.length - 1; i++) {
            const current = this.roadPoints[i];
            const next = this.roadPoints[i + 1];
            
            // Calculate road direction
            const direction = new THREE.Vector3().subVectors(next, current).normalize();
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
            
            // Calculate road width offset
            const halfWidth = this.roadWidth / 2;
            
            // Add vertices for this segment
            vertices.push(
                current.x + perpendicular.x * halfWidth, current.y, current.z + perpendicular.z * halfWidth,
                current.x - perpendicular.x * halfWidth, current.y, current.z - perpendicular.z * halfWidth,
                next.x + perpendicular.x * halfWidth, next.y, next.z + perpendicular.z * halfWidth,
                next.x - perpendicular.x * halfWidth, next.y, next.z - perpendicular.z * halfWidth
            );

            // Add indices for triangles
            const baseIndex = i * 4;
            indices.push(
                baseIndex, baseIndex + 1, baseIndex + 2,
                baseIndex + 1, baseIndex + 3, baseIndex + 2
            );

            // Add UVs
            uvs.push(
                0, i / this.roadPoints.length,
                1, i / this.roadPoints.length,
                0, (i + 1) / this.roadPoints.length,
                1, (i + 1) / this.roadPoints.length
            );
        }

        // Set attributes
        roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        roadGeometry.setIndex(indices);

        // Create road material
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });

        // Create road mesh
        const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
        roadMesh.receiveShadow = true;
        this.scene.add(roadMesh);

        // Create road physics
        this.createRoadPhysics();
    }

    createRoadPhysics() {
        // Create road physics bodies
        for (let i = 0; i < this.roadPoints.length - 1; i++) {
            const current = this.roadPoints[i];
            const next = this.roadPoints[i + 1];
            
            // Create road segment physics
            const roadShape = new CANNON.Box(new CANNON.Vec3(this.roadWidth / 2, 0.1, this.segmentLength / 2));
            const roadBody = new CANNON.Body({
                mass: 0, // Static body
                position: new CANNON.Vec3(
                    (current.x + next.x) / 2,
                    (current.y + next.y) / 2,
                    (current.z + next.z) / 2
                ),
                shape: roadShape
            });

            // Calculate rotation to align with road direction
            const direction = new THREE.Vector3().subVectors(next, current).normalize();
            const angle = Math.atan2(direction.x, direction.z);
            roadBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);

            this.world.addBody(roadBody);
        }
    }

    update(carPosition) {
        // Check if we need to generate more road
        const lastPoint = this.roadPoints[this.roadPoints.length - 1];
        const distanceToLastPoint = carPosition.distanceTo(lastPoint);

        if (distanceToLastPoint < this.roadLength * 0.5) {
            this.generateMoreRoad();
        }
    }

    generateMoreRoad() {
        // Remove old road segments
        const removeCount = Math.floor(this.roadPoints.length * 0.2);
        this.roadPoints.splice(0, removeCount);

        // Generate new road points
        let lastPoint = this.roadPoints[this.roadPoints.length - 1];
        let angle = Math.atan2(
            lastPoint.x - this.roadPoints[this.roadPoints.length - 2].x,
            lastPoint.z - this.roadPoints[this.roadPoints.length - 2].z
        );

        for (let i = 0; i < removeCount; i++) {
            const noiseValue = this.noise(lastPoint.x * 0.01, lastPoint.z * 0.01);
            angle += noiseValue * this.curvature;
            
            const elevationNoise = this.noise(lastPoint.x * 0.02, lastPoint.z * 0.02);
            const y = elevationNoise * this.elevation * 100;

            lastPoint = new THREE.Vector3(
                lastPoint.x + Math.cos(angle) * this.segmentLength,
                y,
                lastPoint.z + Math.sin(angle) * this.segmentLength
            );

            this.roadPoints.push(lastPoint);
        }

        // Update road mesh
        this.updateRoadMesh();
    }

    updateRoadMesh() {
        // Remove old road mesh
        if (this.roadMesh) {
            this.scene.remove(this.roadMesh);
        }

        // Create new road mesh
        this.createRoadMesh();
    }

    getRoadPoints() {
        return this.roadPoints;
    }
} 