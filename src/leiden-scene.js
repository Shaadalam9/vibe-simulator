import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { fetchOSMData } from './osm-fetcher.js';
import { createBuildingGeometry } from './building-generator.js';
import { createRoadGeometry } from './road-generator.js';
import { loadTextures } from './texture-loader.js';
import { setupLighting } from './lighting.js';

class LeidenScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.textures = null;
        
        this.init();
    }

    async init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.set(0, 100, 200);
        this.camera.lookAt(0, 0, 0);

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Load textures
        this.textures = await loadTextures();

        // Setup lighting
        setupLighting(this.scene);

        // Fetch and process OSM data
        const osmData = await fetchOSMData();
        
        // Create geometries
        const buildings = createBuildingGeometry(osmData.buildings, this.textures);
        const roads = createRoadGeometry(osmData.roads, this.textures);
        
        this.scene.add(buildings);
        this.scene.add(roads);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start animation loop
        this.animate();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

export { LeidenScene }; 