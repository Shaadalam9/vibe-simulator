import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class Terrain {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.size = 1000;
        this.resolution = 128;
        this.heightScale = 50;
        this.noise = createNoise2D();
        this.chunks = new Map();
        this.activeChunks = new Set();
        this.chunkSize = 500;
        this.roadWidth = 10;
        
        this.createInitialTerrain();
    }

    createInitialTerrain() {
        // Create initial chunks around origin
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                this.createChunk(x, z);
            }
        }
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
            
            // Generate terrain height
            let height = 0;
            height += this.noise(x * 0.001, z * 0.001) * this.heightScale;
            height += this.noise(x * 0.002, z * 0.002) * this.heightScale * 0.5;
            height += this.noise(x * 0.004, z * 0.004) * this.heightScale * 0.25;
            
            // Add road influence
            const roadInfluence = this.getRoadInfluence(x, z);
            height = height * (1 - roadInfluence) + roadInfluence * 0;
            
            vertices[i + 1] = height;
        }

        geometry.computeVertexNormals();

        // Create terrain material with grass texture
        const material = new THREE.MeshStandardMaterial({
            color: 0x3a7e1a,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(chunkX * this.chunkSize, 0, chunkZ * this.chunkSize);
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Create road mesh
        const roadGeometry = new THREE.PlaneGeometry(this.roadWidth, this.chunkSize);
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.9,
            metalness: 0.1
        });
        const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
        roadMesh.rotation.x = -Math.PI / 2;
        roadMesh.position.set(chunkX * this.chunkSize, 0.1, chunkZ * this.chunkSize);
        roadMesh.receiveShadow = true;
        this.scene.add(roadMesh);

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

        this.chunks.set(chunkKey, { mesh, roadMesh, body });
        this.activeChunks.add(chunkKey);
    }

    getRoadInfluence(x, z) {
        // Create a winding road using sine waves
        const roadX = Math.sin(z * 0.01) * 100;
        const distance = Math.abs(x - roadX);
        return Math.max(0, 1 - distance / this.roadWidth);
    }

    generateHeightfieldData(chunkX, chunkZ) {
        const data = [];
        for (let i = 0; i < this.resolution; i++) {
            data[i] = [];
            for (let j = 0; j < this.resolution; j++) {
                const x = (i / this.resolution - 0.5) * this.chunkSize + chunkX * this.chunkSize;
                const z = (j / this.resolution - 0.5) * this.chunkSize + chunkZ * this.chunkSize;
                
                let height = 0;
                height += this.noise(x * 0.001, z * 0.001) * this.heightScale;
                height += this.noise(x * 0.002, z * 0.002) * this.heightScale * 0.5;
                height += this.noise(x * 0.004, z * 0.004) * this.heightScale * 0.25;
                
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
                this.scene.remove(chunk.roadMesh);
                this.world.removeBody(chunk.body);
                this.chunks.delete(key);
                this.activeChunks.delete(key);
            }
        }
    }
} 