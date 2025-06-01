import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.size = 1000;
        this.resolution = 128;
        this.heightScale = 30;
        this.noise = createNoise2D();
        this.chunks = new Map();
        this.activeChunks = new Set();
        this.chunkSize = 500;
        this.roadWidth = 6;
        this.roadSegments = [];
        this.roadLength = 2000;
        this.roadCurvature = 0.2;
        
        this.createInitialTerrain();
        this.generateRoadPath();
    }

    createInitialTerrain() {
        // Create initial chunks around origin
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                this.createChunk(x, z);
            }
        }
    }

    generateRoadPath() {
        // Generate a more natural road path using multiple sine waves
        const segments = [];
        let x = 0;
        let z = 0;
        let angle = 0;

        for (let i = 0; i < this.roadLength; i += 5) {
            // Combine multiple sine waves for more natural curves
            const curve1 = Math.sin(i * 0.005) * 200;
            const curve2 = Math.sin(i * 0.01) * 100;
            const curve3 = Math.sin(i * 0.002) * 300;
            
            angle += (curve1 + curve2 + curve3) * 0.0005;
            x += Math.sin(angle) * 5;
            z += Math.cos(angle) * 5;

            segments.push({
                position: new THREE.Vector3(x, 0, z),
                angle: angle
            });
        }

        this.roadSegments = segments;
    }

    createChunk(chunkX, chunkZ) {
        const chunkKey = `${chunkX},${chunkZ}`;
        if (this.chunks.has(chunkKey)) return;

        const geometry = new THREE.PlaneGeometry(
            this.chunkSize,
            this.chunkSize,
            this.resolution,
            this.resolution
        );
        geometry.rotateX(-Math.PI / 2);

        // Generate height map with improved noise
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i] + chunkX * this.chunkSize;
            const z = vertices[i + 2] + chunkZ * this.chunkSize;
            
            // Generate terrain height with multiple noise layers
            let height = 0;
            height += this.noise(x * 0.0005, z * 0.0005) * this.heightScale;
            height += this.noise(x * 0.001, z * 0.001) * this.heightScale * 0.5;
            height += this.noise(x * 0.002, z * 0.002) * this.heightScale * 0.25;
            height += this.noise(x * 0.004, z * 0.004) * this.heightScale * 0.125;
            
            // Add road influence
            const roadInfluence = this.getRoadInfluence(x, z);
            height = height * (1 - roadInfluence) + roadInfluence * 0;
            
            vertices[i + 1] = height;
        }

        geometry.computeVertexNormals();

        // Create terrain material with grass texture
        const material = new THREE.MeshStandardMaterial({
            color: 0x4a7c59,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize);
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Create road mesh with improved geometry
        this.createRoadMesh(chunkX, chunkZ);

        // Create physics body
        const shape = new CANNON.Heightfield(
            this.generateHeightfieldData(chunkX, chunkZ),
            { elementSize: this.chunkSize / this.resolution }
        );
        
        const body = new CANNON.Body({
            mass: 0,
            shape: shape,
            material: new CANNON.Material('terrainMaterial')
        });
        
        body.position.set(
            chunkX * this.chunkSize - this.chunkSize / 2,
            -this.heightScale / 2,
            chunkZ * this.chunkSize - this.chunkSize / 2
        );
        this.world.addBody(body);

        this.chunks.set(chunkKey, { mesh, body });
        this.activeChunks.add(chunkKey);
    }

    createRoadMesh(chunkX, chunkZ) {
        const chunkStartX = chunkX * this.chunkSize;
        const chunkStartZ = chunkZ * this.chunkSize;
        const chunkEndX = chunkStartX + this.chunkSize;
        const chunkEndZ = chunkStartZ + this.chunkSize;

        // Find road segments that intersect with this chunk
        const relevantSegments = this.roadSegments.filter(segment => {
            return segment.position.x >= chunkStartX && 
                   segment.position.x <= chunkEndX &&
                   segment.position.z >= chunkStartZ && 
                   segment.position.z <= chunkEndZ;
        });

        if (relevantSegments.length === 0) return;

        // Create road geometry
        const roadGeometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];
        const uvs = [];

        for (let i = 0; i < relevantSegments.length - 1; i++) {
            const current = relevantSegments[i];
            const next = relevantSegments[i + 1];

            // Calculate road width offset
            const offset = new THREE.Vector2(
                Math.cos(current.angle + Math.PI/2),
                Math.sin(current.angle + Math.PI/2)
            ).multiplyScalar(this.roadWidth/2);

            // Add vertices for road segment
            const baseIndex = vertices.length / 3;
            vertices.push(
                current.position.x + offset.x, 0.1, current.position.z + offset.y,
                current.position.x - offset.x, 0.1, current.position.z - offset.y,
                next.position.x + offset.x, 0.1, next.position.z + offset.y,
                next.position.x - offset.x, 0.1, next.position.z - offset.y
            );

            // Add indices for two triangles
            indices.push(
                baseIndex, baseIndex + 1, baseIndex + 2,
                baseIndex + 1, baseIndex + 3, baseIndex + 2
            );

            // Add UVs
            uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
        }

        roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        roadGeometry.setIndex(indices);
        roadGeometry.computeVertexNormals();

        // Create road material with texture
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c2c2c,
            roughness: 0.8,
            metalness: 0.1,
            map: this.createRoadTexture()
        });

        const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
        roadMesh.receiveShadow = true;
        this.scene.add(roadMesh);
    }

    createRoadTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Draw road base
        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw road markings
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([30, 30]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height/2);
        ctx.lineTo(canvas.width, canvas.height/2);
        ctx.stroke();

        // Add road edge lines
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height/4);
        ctx.lineTo(canvas.width, canvas.height/4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, canvas.height*3/4);
        ctx.lineTo(canvas.width, canvas.height*3/4);
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 20);
        return texture;
    }

    getRoadInfluence(x, z) {
        // Find nearest road segment
        let minDist = Infinity;
        let influence = 0;

        for (const segment of this.roadSegments) {
            const dx = x - segment.position.x;
            const dz = z - segment.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < minDist) {
                minDist = dist;
                // Calculate influence based on distance with smoother falloff
                influence = Math.max(0, 1 - Math.pow(dist / this.roadWidth, 2));
            }
        }

        return influence;
    }

    generateHeightfieldData(chunkX, chunkZ) {
        const data = [];
        for (let i = 0; i < this.resolution; i++) {
            data[i] = [];
            for (let j = 0; j < this.resolution; j++) {
                const x = (i / this.resolution - 0.5) * this.chunkSize + chunkX * this.chunkSize;
                const z = (j / this.resolution - 0.5) * this.chunkSize + chunkZ * this.chunkSize;
                
                let height = 0;
                height += this.noise(x * 0.0005, z * 0.0005) * this.heightScale;
                height += this.noise(x * 0.001, z * 0.001) * this.heightScale * 0.5;
                height += this.noise(x * 0.002, z * 0.002) * this.heightScale * 0.25;
                height += this.noise(x * 0.004, z * 0.004) * this.heightScale * 0.125;
                
                const roadInfluence = this.getRoadInfluence(x, z);
                height = height * (1 - roadInfluence) + roadInfluence * 0;
                
                data[i][j] = height;
            }
        }
        return data;
    }

    update(carPosition) {
        // Calculate which chunks should be active based on car position
        const chunkX = Math.floor(carPosition.x / this.chunkSize);
        const chunkZ = Math.floor(carPosition.z / this.chunkSize);
        
        // Create new chunks as needed
        for (let x = chunkX - 1; x <= chunkX + 1; x++) {
            for (let z = chunkZ - 1; z <= chunkZ + 1; z++) {
                this.createChunk(x, z);
            }
        }

        // Remove chunks that are too far away
        for (const key of this.activeChunks) {
            const [x, z] = key.split(',').map(Number);
            if (Math.abs(x - chunkX) > 2 || Math.abs(z - chunkZ) > 2) {
                const chunk = this.chunks.get(key);
                this.scene.remove(chunk.mesh);
                this.world.removeBody(chunk.body);
                this.chunks.delete(key);
                this.activeChunks.delete(key);
            }
        }
    }
} 