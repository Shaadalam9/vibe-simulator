import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';
import { createNoise2D } from 'simplex-noise';

export class RoadGenerator {
    static roadWidth = 8;
    static segmentLength = 20;
    static maxSegments = 1000; // Increased for longer roads
    static curveIntensity = 0.3; // Reduced for smoother curves
    static heightVariation = 5; // Reduced for smoother elevation changes

    constructor(scene, world, material) {
        this.scene = scene;
        this.world = world;
        this.material = material;
        this.noise = createNoise2D();
        this.roadPoints = [];
        this.roadMesh = null;
        this.lastGeneratedPoint = null;
        this.generationDistance = 1000; // Distance ahead to generate new road
        this.cleanupDistance = 2000; // Distance behind to remove old road
        this.segments = [];
        this.currentSegment = 0;
        
        // Initialize road generation
        this.generateInitialRoad();
    }

    generateInitialRoad() {
        // Generate initial road points
        let currentPoint = new THREE.Vector3(0, 0, 0);
        let currentDirection = new THREE.Vector3(0, 0, 1);
        let currentHeight = 0;

        for (let i = 0; i < RoadGenerator.maxSegments; i++) {
            // Generate next point with improved procedural generation
            const nextPoint = this.generateNextPoint(currentPoint, currentDirection, currentHeight);
            this.roadPoints.push(nextPoint);
            
            // Update current values for next iteration
            currentDirection = new THREE.Vector3().subVectors(nextPoint, currentPoint).normalize();
            currentPoint = nextPoint;
            currentHeight = nextPoint.y;
        }

        // Create initial road mesh
        this.createRoadMesh();
    }

    generateNextPoint(currentPoint, currentDirection, currentHeight) {
        // Use multiple octaves of noise for more natural curves
        const noiseScale = 0.01;
        const noise1 = this.noise(currentPoint.x * noiseScale, currentPoint.z * noiseScale);
        const noise2 = this.noise(currentPoint.x * noiseScale * 2, currentPoint.z * noiseScale * 2) * 0.5;
        const noise3 = this.noise(currentPoint.x * noiseScale * 4, currentPoint.z * noiseScale * 4) * 0.25;
        
        // Combine noise values for smoother curves
        const curveFactor = (noise1 + noise2 + noise3) * RoadGenerator.curveIntensity;
        
        // Calculate height variation using noise
        const heightNoise = this.noise(currentPoint.x * noiseScale * 0.5, currentPoint.z * noiseScale * 0.5);
        const heightChange = heightNoise * RoadGenerator.heightVariation;
        
        // Create rotation matrix for the curve
        const rotationMatrix = new THREE.Matrix4().makeRotationY(curveFactor);
        
        // Apply rotation to direction
        const newDirection = currentDirection.clone().applyMatrix4(rotationMatrix);
        
        // Calculate next point
        const nextPoint = currentPoint.clone().add(
            newDirection.multiplyScalar(RoadGenerator.segmentLength)
        );
        
        // Apply height change smoothly
        nextPoint.y = currentHeight + heightChange;
        
        return nextPoint;
    }

    createRoadMesh() {
        // Create road geometry
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const uvs = [];
        const normals = [];

        // Generate road mesh data
        for (let i = 0; i < this.roadPoints.length - 1; i++) {
            const p1 = this.roadPoints[i];
            const p2 = this.roadPoints[i + 1];
            
            // Calculate road segment direction and perpendicular
            const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
            const perpendicular = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
            
            // Calculate road edges
            const halfWidth = RoadGenerator.roadWidth / 2;
            const leftEdge1 = p1.clone().add(perpendicular.clone().multiplyScalar(-halfWidth));
            const rightEdge1 = p1.clone().add(perpendicular.clone().multiplyScalar(halfWidth));
            const leftEdge2 = p2.clone().add(perpendicular.clone().multiplyScalar(-halfWidth));
            const rightEdge2 = p2.clone().add(perpendicular.clone().multiplyScalar(halfWidth));
            
            // Add vertices
            const baseIndex = vertices.length / 3;
            vertices.push(
                leftEdge1.x, leftEdge1.y, leftEdge1.z,
                rightEdge1.x, rightEdge1.y, rightEdge1.z,
                leftEdge2.x, leftEdge2.y, leftEdge2.z,
                rightEdge2.x, rightEdge2.y, rightEdge2.z
            );
            
            // Add indices for two triangles
            indices.push(
                baseIndex, baseIndex + 1, baseIndex + 2,
                baseIndex + 1, baseIndex + 3, baseIndex + 2
            );
            
            // Add UVs
            uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
            
            // Add normals
            const normal = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(rightEdge1, leftEdge1),
                new THREE.Vector3().subVectors(leftEdge2, leftEdge1)
            ).normalize();
            
            for (let j = 0; j < 4; j++) {
                normals.push(normal.x, normal.y, normal.z);
            }
        }
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        
        // Create and add road mesh
        this.roadMesh = new THREE.Mesh(geometry, this.material);
        this.roadMesh.receiveShadow = true;
        this.scene.add(this.roadMesh);
        
        // Create physics body for the road
        this.createRoadPhysics();
    }

    createRoadPhysics() {
        // Create physics body for the road
        const shape = new CANNON.Box(new CANNON.Vec3(
            RoadGenerator.roadWidth / 2,
            0.1,
            RoadGenerator.segmentLength / 2
        ));
        
        // Create physics bodies for each road segment
        for (let i = 0; i < this.roadPoints.length - 1; i++) {
            const p1 = this.roadPoints[i];
            const p2 = this.roadPoints[i + 1];
            
            // Calculate segment center and rotation
            const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
            const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
            const rotation = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                direction
            );
            
            // Create physics body
            const body = new CANNON.Body({
                mass: 0,
                shape: shape,
                position: new CANNON.Vec3(center.x, center.y, center.z),
                quaternion: new CANNON.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
            });
            
            this.world.addBody(body);
        }
    }

    update(carPosition) {
        // Log car position and road point count for debugging generation
        console.log('RoadGenerator update - Car Position:', carPosition.x, carPosition.y, carPosition.z, 'Road Points:', this.roadPoints.length);

        // Check if we need to generate more road ahead
        if (this.roadPoints.length > 0) {
            const lastPoint = this.roadPoints[this.roadPoints.length - 1];
            const distanceToLastPoint = carPosition.distanceTo(lastPoint);
            
            if (distanceToLastPoint < this.generationDistance) {
                this.generateMoreRoad();
            }
            
            // Clean up old road segments
            this.cleanupOldRoad(carPosition);
        }
    }

    generateMoreRoad() {
        console.log('Generating more road...');
        // Generate more road points
        const currentPoint = this.roadPoints[this.roadPoints.length - 1];
        const currentDirection = new THREE.Vector3().subVectors(
            currentPoint,
            this.roadPoints[this.roadPoints.length - 2]
        ).normalize();
        
        const currentHeight = currentPoint.y;
        
        // Generate new segments
        for (let i = 0; i < 10; i++) {
            const nextPoint = this.generateNextPoint(currentPoint, currentDirection, currentHeight);
            this.roadPoints.push(nextPoint);
        }
        
        // Update road mesh
        this.updateRoadMesh();
        console.log('Finished generating more road. New road points count:', this.roadPoints.length);
    }

    cleanupOldRoad(carPosition) {
        console.log('Cleaning up old road...');
        // Remove road segments that are too far behind
        const cleanupThreshold = this.cleanupDistance;
        
        while (this.roadPoints.length > 0) {
            const firstPoint = this.roadPoints[0];
            if (carPosition.distanceTo(firstPoint) > cleanupThreshold) {
                this.roadPoints.shift();
            } else {
                break;
            }
        }
        
        // Update road mesh after cleanup
        this.updateRoadMesh();
        console.log('Finished cleaning up old road. New road points count:', this.roadPoints.length);
    }

    updateRoadMesh() {
        if (this.roadMesh) {
            // Remove old mesh
            this.scene.remove(this.roadMesh);
        }
        
        // Create new mesh with updated points
        this.createRoadMesh();
    }

    getRoadPoints() {
        return this.roadPoints;
    }
} 