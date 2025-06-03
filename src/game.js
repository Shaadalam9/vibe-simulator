import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';
import { createNoise2D } from 'simplex-noise';
import { RoadGenerator } from './road-generator.js';
import { Car } from './Car.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        this.clock = new THREE.Clock();
        this.noise = createNoise2D();
        
        // Game state
        this.timeOfDay = 0; // 0-24 hours
        this.weather = 'clear'; // clear, cloudy, rainy, snowy
        this.cameraMode = 'chase'; // chase, cockpit, orbit
        
        this.roadGenerator = null;
        
        this.init();
    }

    init() {
        console.log('Game init() called - Start');
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        document.body.appendChild(this.renderer.domElement);
        console.log('Renderer setup complete.');

        // Setup camera
        this.camera.position.set(0, 5, -10);
        this.camera.lookAt(0, 0, 0);
        console.log('Camera setup complete.');

        // Setup physics world
        this.world.gravity.set(0, -9.82, 0);
        console.log('Physics world setup complete.');

        // Create physics materials
        this.wheelMaterial = new CANNON.Material('wheelMaterial');
        this.terrainMaterial = new CANNON.Material('terrainMaterial');
        this.carBodyMaterial = new CANNON.Material('carBodyMaterial');

        // Create contact material between wheels and terrain
        const wheelTerrainContact = new CANNON.ContactMaterial(
            this.wheelMaterial,
            this.terrainMaterial,
            {
                friction: 1.5, // Increased friction
                restitution: 0.1 // Low restitution
            }
        );
        this.world.addContactMaterial(wheelTerrainContact);

        // Create contact material between car body and terrain (for impacts)
         const bodyTerrainContact = new CANNON.ContactMaterial(
             this.carBodyMaterial,
             this.terrainMaterial,
             {
                 friction: 0.1, // Low friction for body
                 restitution: 0.3 // Some bounciness
             }
         );
         this.world.addContactMaterial(bodyTerrainContact);
         console.log('Physics materials and contacts setup complete.');

        // Create environment
        this.createSky();
        console.log('Sky created.');
        this.createTerrain(this.terrainMaterial);
        console.log('Terrain created.');
        this.createRoads();
        console.log('Roads created.');
        this.createCar(this.carBodyMaterial, this.wheelMaterial);
        console.log('Car created.');
        this.createLights();
        console.log('Lights created.');
        this.createWater();
        console.log('Water created.');
        this.createAtmosphere();
        console.log('Atmosphere created.');

        // Setup controls
        this.setupControls();
        console.log('Controls setup complete.');

        // Start animation loop
        this.animate();
        console.log('Animation loop started.');

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        console.log('Window resize listener added.');

        // Remove loading message - This will now be handled in main.js
        // console.log('Attempting to hide loading element with ID #loading.');
        // const loadingElement = document.querySelector('#loading');
        // if (loadingElement) {
        //     console.log('Loading element with ID #loading found.', loadingElement);
        //     loadingElement.style.display = 'none';
        //     console.log('Loading element display set to none.');
        // } else {
        //     console.log('Loading element with ID #loading not found.');
        // }

         const canvas = this.renderer.domElement;
         canvas.style.display = 'block'; // Ensure canvas is visible
         console.log('Canvas display set to block.', canvas);
         console.log('Game init() called - End');
    }

    createSky() {
        // Remove existing procedural sky
        if (this.sky) {
            this.scene.remove(this.sky);
            this.sky = null;
        }

        // Create a realistic skybox
        const skyboxGeometry = new THREE.BoxGeometry(10000, 10000, 10000);

        // Load cubemap textures (you need to provide these files)
        const loader = new THREE.CubeTextureLoader();
        loader.setPath('/textures/skybox/'); // Assuming skybox textures are in public/textures/skybox/

        const textureCube = loader.load([
            'px.jpg', 'nx.jpg',
            'py.jpg', 'ny.jpg',
            'pz.jpg', 'nz.jpg'
        ], () => {
             console.log('Skybox textures loaded.');
        }, undefined, (error) => {
            console.error('Error loading skybox textures:', error);
            // Fallback or error handling can go here
        });

        // Create a shader material for the skybox
        const skyboxMaterial = new THREE.ShaderMaterial({
            uniforms: {
                'tCube': { type: 't', value: textureCube }
            },
            vertexShader: `
                varying vec3 vWorldDirection;
                void main() {
                    vWorldDirection = transformDirection( position, modelMatrix );
                    #include <begin_vertex>
                    #include <project_vertex>
                }
            `,
            fragmentShader: `
                uniform samplerCube tCube;
                varying vec3 vWorldDirection;

                void main() {
                    gl_FragColor = vec4( textureCube( tCube, vec3( -vWorldDirection.x, vWorldDirection.y, vWorldDirection.z ) ).rgb, 1.0 );
                }
            `,
            side: THREE.BackSide,
            depthWrite: false // Important for skybox
        });

        this.skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
        this.scene.add(this.skybox);

        console.log('Skybox created.');

        // Adjust scene lighting to match the skybox (basic ambient light adjustment)
        if (this.ambientLight) {
            this.ambientLight.color.set(0xc0c0c0); // Adjust ambient light color based on typical sky color
            this.ambientLight.intensity = 0.5; // Adjust intensity
        }
        // Directional light would ideally match the sun direction in the skybox textures
    }

    createTerrain(terrainMaterial) {
        const size = 20000;
        const resolution = 512;
        const heightScale = 500;

        // Create terrain geometry
        const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
        geometry.rotateX(-Math.PI / 2);
        geometry.computeBoundingSphere(); // Compute bounding sphere for frustum culling
        geometry.computeTangents(); // Compute tangents for normal mapping

        // Generate height map with multiple octaves of noise
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i];
            const z = vertices[i + 2];
            
            let height = 0;
            // Base terrain - match visual noise scale
            height += this.noise(x * 0.0001, z * 0.0001) * heightScale;
            // Medium detail - match visual noise scale
            height += this.noise(x * 0.0002, z * 0.0002) * heightScale * 0.5;
            // Fine detail - match visual noise scale
            height += this.noise(x * 0.0004, z * 0.0004) * heightScale * 0.25;
            // Very fine detail - add visual noise scale for consistency
            height += this.noise(x * 0.0008, z * 0.0008) * heightScale * 0.125;
            
            vertices[i + 1] = height;
        }

        geometry.computeVertexNormals();

        // Create terrain material with better textures using a shader for blending
        const textureLoader = new THREE.TextureLoader();
        const textureRepeat = 100; // Adjust repeat based on terrain size and texture size

        const grassTexture = textureLoader.load('/textures/grass.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });
        const dirtTexture = textureLoader.load('/textures/dirt.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });
        const rockTexture = textureLoader.load('/textures/rock.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });

        // Load normal and roughness maps
        const grassNormalMap = textureLoader.load('/textures/grass_normal.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });
        const dirtNormalMap = textureLoader.load('/textures/dirt_normal.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });
        const rockNormalMap = textureLoader.load('/textures/rock_normal.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });

        const grassRoughnessMap = textureLoader.load('/textures/grass_roughness.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });
        const dirtRoughnessMap = textureLoader.load('/textures/dirt_roughness.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });
        const rockRoughnessMap = textureLoader.load('/textures/rock_roughness.jpg', (texture) => { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(textureRepeat, textureRepeat); });

        const terrainShader = {
            uniforms: {
                grassTexture: { value: grassTexture },
                dirtTexture: { value: dirtTexture },
                rockTexture: { value: rockTexture },
                grassNormalMap: { value: grassNormalMap },
                dirtNormalMap: { value: dirtNormalMap },
                rockNormalMap: { value: rockNormalMap },
                grassRoughnessMap: { value: grassRoughnessMap },
                dirtRoughnessMap: { value: dirtRoughnessMap },
                rockRoughnessMap: { value: rockRoughnessMap },
                // Define height ranges for blending (these will need tuning)
                lowHeight: { value: 20 }, // Adjusted low height
                midHeight: { value: 80 }, // Adjusted mid height
                highHeight: { value: 200 }, // Adjusted high height
                // Add light and material properties uniforms if needed

                // Uniforms for lighting and camera (manually updated)
                directionalLights: { value: new THREE.Vector3() }, // Add back and initialize
                directionalLightColor: { value: new THREE.Color() }, // Add back and initialize
                ambientLightColor: { value: new THREE.Color(0xffffff) }, // Add back and initialize
                viewPosition: { value: new THREE.Vector3() }, // Add back and initialize

                // Uniforms for fog (manually updated)
                fogDensity: { value: 0.0002 }, // Add and initialize with default fog density
                fogColor: { value: new THREE.Color(0x87CEEB) }, // Add and initialize with default fog color
            },
            vertexShader: `
                varying vec2 vUv;
                varying float vHeight;
                attribute vec4 tangent; // Uncomment tangent attribute
                varying vec3 vNormal;
                varying vec3 vTangent;
                varying vec3 vBitangent;

                void main() {
                    vUv = uv;
                    vHeight = position.y;
                    // Pass normal and tangent if needed for lighting
                    vNormal = normal;
                    vTangent = tangent.xyz;
                    // Calculate bitangent
                    vBitangent = cross(normal, tangent.xyz) * tangent.w;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D grassTexture;
                uniform sampler2D dirtTexture;
                uniform sampler2D rockTexture;
                uniform sampler2D grassNormalMap;
                uniform sampler2D dirtNormalMap;
                uniform sampler2D rockNormalMap;
                uniform sampler2D grassRoughnessMap;
                uniform sampler2D dirtRoughnessMap;
                uniform sampler2D rockRoughnessMap;
                uniform float lowHeight;
                uniform float midHeight;
                uniform float highHeight;

                // Uniforms for lighting and camera (manually updated)
                uniform vec3 directionalLights;
                uniform vec3 directionalLightColor;
                uniform vec3 ambientLightColor;

                // Camera position (for view direction calculation)
                uniform vec3 viewPosition;

                // Uniforms for fog
                uniform float fogDensity;
                uniform vec3 fogColor;

                varying vec2 vUv;
                varying float vHeight;
                varying vec3 vNormal;
                varying vec3 vTangent;
                varying vec3 vBitangent;

                // PBR related uniforms (simplified, can be expanded)
                // uniform vec3 albedo; // Albedo is provided by blended texture
                // uniform float metalness; // Terrain is typically non-metallic
                // uniform float roughness; // Roughness is provided by blended texture

                void main() {
                    // Sample base textures
                    vec4 grassColor = texture2D(grassTexture, vUv);
                    vec4 dirtColor = texture2D(dirtTexture, vUv);
                    vec4 rockColor = texture2D(rockTexture, vUv);

                    // Sample normal maps (values will be in tangent space if tangents are calculated in vertex shader)
                    vec3 grassNormal = texture2D(grassNormalMap, vUv).rgb * 2.0 - 1.0;
                    vec3 dirtNormal = texture2D(dirtNormalMap, vUv).rgb * 2.0 - 1.0;
                    vec3 rockNormal = texture2D(rockNormalMap, vUv).rgb * 2.0 - 1.0;

                    // Sample roughness maps
                    float grassRoughness = texture2D(grassRoughnessMap, vUv).r;
                    float dirtRoughness = texture2D(dirtRoughnessMap, vUv).r;
                    float rockRoughness = texture2D(rockRoughnessMap, vUv).r;

                    // Simple height-based blending
                    float blend1 = smoothstep(lowHeight, midHeight, vHeight);
                    float blend2 = smoothstep(midHeight, highHeight, vHeight);

                    vec4 finalColor = mix(grassColor, dirtColor, blend1);
                    finalColor = mix(finalColor, rockColor, blend2);

                    // Blend normals and roughness based on the same blending factors
                    vec3 blendedNormal = mix(mix(grassNormal, dirtNormal, blend1), rockNormal, blend2);
                    // Transform blended normal from tangent space to world space
                    mat3 tbn = mat3(normalize(vTangent), normalize(vBitangent), normalize(vNormal));
                    vec3 worldNormal = normalize(tbn * blendedNormal);

                    float blendedRoughness = mix(mix(grassRoughness, dirtRoughness, blend1), rockRoughness, blend2);

                    // PBR Lighting Calculation (simplified)
                    vec3 N = worldNormal; // World space normal
                    vec3 V = normalize(viewPosition - gl_Position.xyz); // View direction
                    vec3 L = normalize(directionalLights); // Light direction
                    vec3 lightColor = directionalLightColor;

                    // Ambient term
                    vec3 ambient = ambientLightColor * finalColor.rgb;

                    // Diffuse term (Lambertian)
                    float NdotL = max(dot(N, L), 0.0);
                    vec3 diffuse = lightColor * finalColor.rgb * NdotL;

                    // Specular term (simplified GGX/Trowbridge-Reitz)
                    vec3 H = normalize(L + V); // Halfway vector
                    float NdotH = max(dot(N, H), 0.0);
                    float NdotV = max(dot(N, V), 0.0);
                    float HdotV = max(dot(H, V), 0.0);

                    // Geometric obstruction (G) - Schlick-GGX
                    float k = (blendedRoughness + 1.0) * (blendedRoughness + 1.0) / 8.0;
                    float G_V = NdotV / (NdotV * (1.0 - k) + k);
                    float G_L = NdotL / (NdotL * (1.0 - k) + k);
                    float G = G_V * G_L;

                    // Normal Distribution Function (D) - Trowbridge-Reitz GGX
                    float NdotH2 = NdotH * NdotH;
                    float alpha = blendedRoughness * blendedRoughness;
                    float alpha2 = alpha * alpha;
                    float denom = NdotH2 * (alpha2 - 1.0) + 1.0;
                    float D = alpha2 / (PI * denom * denom);

                    // Fresnel (F) - Schlick approximation
                    vec3 F0 = vec3(0.04); // Reflectivity at normal incidence for non-metals
                    vec3 F = F0 + (1.0 - F0) * pow(max(1.0 - HdotV, 0.0), 5.0);

                    // Specular BRDF
                    vec3 specular = (D * G * F) / max(4.0 * NdotL * NdotV, 0.001);

                    // Combine ambient, diffuse, and specular
                    vec3 finalLighting = ambient + diffuse + lightColor * specular;

                    // Apply fog
                    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * gl_FragCoord.z * gl_FragCoord.z );
                    gl_FragColor = vec4(mix(finalLighting, fogColor, fogFactor), finalColor.a);
                }

                // Define PI for shader
                #ifndef PI
                #define PI 3.14159265359
                #endif
            `,
        };

        const material = new THREE.ShaderMaterial({
            uniforms: terrainShader.uniforms,
            vertexShader: terrainShader.vertexShader,
            fragmentShader: terrainShader.fragmentShader,
            // Add lights, fog, and shadow support to the shader if needed
            // lights: true, // Disable automatic lighting uniform injection
            fog: false,   // Disable automatic fog uniform injection for this material
            // vertexTangents: true // Required if using tangent attribute in vertex shader
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.receiveShadow = true;
        // Enable casting shadows if the material supports it (requires shader modifications)
        // this.terrain.castShadow = true;
        this.scene.add(this.terrain);

        // Add trees and rocks
        this.addEnvironmentDetails();

        // Create physics body for terrain
        const shape = new CANNON.Heightfield(
            this.generateHeightfieldData(size, resolution, heightScale),
            { elementSize: size / resolution }
        );
        
        const terrainBody = new CANNON.Body({
            mass: 0,
            shape: shape,
            material: terrainMaterial
        });
        
        terrainBody.position.set(-size / 2, -heightScale / 2, -size / 2);
        this.world.addBody(terrainBody);
    }

    addEnvironmentDetails() {
        // Add trees (scattered)
        const treeCount = 500; // Reduce scattered trees slightly to focus on roadside
        const treeGeometry = new THREE.ConeGeometry(2, 5, 8);
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4d2926 });

        for (let i = 0; i < treeCount; i++) {
            const x = (Math.random() - 0.5) * 10000;
            const z = (Math.random() - 0.5) * 10000;
            const y = this.getTerrainHeightAt(x, z);

            // Avoid placing scattered trees too close to the road
            const distanceToRoad = this.getDistanceToRoad(x, z);
            if (distanceToRoad < 80) continue; // Increased threshold to keep scattered trees further away

            // Create tree group
            const tree = new THREE.Group();

            // Add trunk
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 1;
            trunk.castShadow = true;
            tree.add(trunk);

            // Add foliage
            const foliage = new THREE.Mesh(treeGeometry, treeMaterial);
            foliage.position.y = 4;
            foliage.castShadow = true;
            tree.add(foliage);

            // Position tree
            tree.position.set(x, y, z);
            this.scene.add(tree);
        }

        // Add rocks (scattered)
        const rockCount = 200; // Reduce scattered rocks slightly
        const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.1
        });

        for (let i = 0; i < rockCount; i++) {
            const x = (Math.random() - 0.5) * 10000;
            const z = (Math.random() - 0.5) * 10000;
            const y = this.getTerrainHeightAt(x, z);

            // Avoid placing scattered rocks too close to the road
            const distanceToRoad = this.getDistanceToRoad(x, z);
            if (distanceToRoad < 40) continue; // Increased threshold

            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(x, y, z);
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            rock.scale.set(
                0.5 + Math.random() * 1.5, // Smaller scattered rocks
                0.5 + Math.random() * 1.5,
                0.5 + Math.random() * 1.5
            );
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }

        // Add dense vegetation along the road (bushes)
        const roadsideVegetationCount = 10000; // Further increased vegetation density
        const bushGeometry = new THREE.SphereGeometry(1.5, 8, 8); // Simple bush geometry
        const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x4a7c40 }); // Bush color

        // Consider using instancing for roadside vegetation for performance
        const bushMesh = new THREE.InstancedMesh(bushGeometry, bushMaterial, roadsideVegetationCount);
        const dummyBush = new THREE.Object3D();

        if (this.roadPoints && this.roadPoints.length > 1) {
             for (let i = 0; i < roadsideVegetationCount; i++) {
                // Pick a random point along the road segment
                const roadPointIndex = Math.floor(Math.random() * (this.roadPoints.length - 1));
                const p1 = this.roadPoints[roadPointIndex];
                const p2 = this.roadPoints[roadPointIndex + 1];

                 const t = Math.random(); // Position along the segment
                 const position = new THREE.Vector3().copy(p1).lerp(p2, t);

                const segmentDirection = new THREE.Vector3().subVectors(p2, p1).normalize();
                const upVector = new THREE.Vector3(0, 1, 0);
                const perpendicular = new THREE.Vector3().crossVectors(segmentDirection, upVector).normalize();

                // Position the vegetation near the road barrier on both sides
                const side = Math.random() > 0.5 ? 1 : -1; // Randomly choose left or right side
                const offsetX = Math.random() * 4; // Distance away from the barrier (increased)
                const offsetZ = (Math.random() - 0.5) * 1.5; // Small random offset along road

                position.add(perpendicular.clone().multiplyScalar((RoadGenerator.roadWidth / 2) * side + 0.5 + offsetX));
                position.add(segmentDirection.clone().multiplyScalar(offsetZ));

                 const height = this.getTerrainHeightAt(position.x, position.z);
                 position.y = height + bushGeometry.parameters.radius * 0.3 + Math.random() * 0.3; // Place on terrain with slight offset and more randomness

                // Add some randomness to scale and rotation
                const scale = 0.5 + Math.random() * 1.0; // Varied scale (adjusted range)
                dummyBush.position.copy(position);
                dummyBush.scale.set(scale, scale, scale);
                dummyBush.rotation.set(0, Math.random() * Math.PI * 2, 0);
                dummyBush.updateMatrix();
                bushMesh.setMatrixAt(i, dummyBush.matrix);
             }
             bushMesh.instanceMatrix.needsUpdate = true;
             bushMesh.castShadow = true;
             bushMesh.receiveShadow = true;
             this.scene.add(bushMesh);
        } else {
             console.warn('Road points not available for roadside vegetation placement.');
        }

        // Add dense grass along the road edges using instancing
        const grassBladeCount = 40000; // Further increased grass density
        // Simple grass blade geometry (can be improved)
        const grassGeometry = new THREE.PlaneGeometry(0.5, 1);
        grassGeometry.translate(0, 0.5, 0); // Pivot at the bottom

        const grassMaterial = new THREE.MeshStandardMaterial({
            color: 0x55aa55, // Green color
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.1 // Discard pixels below this alpha
        });
        // Note: For more realistic grass, you'd use a texture with alpha and potentially a shader.

        const grassMesh = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassBladeCount);
        const dummyGrass = new THREE.Object3D();

         if (this.roadPoints && this.roadPoints.length > 1) {
             for (let i = 0; i < grassBladeCount; i++) {
                 // Pick a random point along the road segment
                const roadPointIndex = Math.floor(Math.random() * (this.roadPoints.length - 1));
                const p1 = this.roadPoints[roadPointIndex];
                const p2 = this.roadPoints[roadPointIndex + 1];

                 const t = Math.random(); // Position along the segment
                 const position = new THREE.Vector3().copy(p1).lerp(p2, t);

                const segmentDirection = new THREE.Vector3().subVectors(p2, p1).normalize();
                const upVector = new THREE.Vector3(0, 1, 0);
                const perpendicular = new THREE.Vector3().crossVectors(segmentDirection, upVector).normalize();

                // Position the grass right at the road edge/barrier
                const side = Math.random() > 0.5 ? 1 : -1; // Randomly choose left or right side
                const offsetX = Math.random() * 1.2; // Distance away from the road edge (increased)
                const offsetZ = (Math.random() - 0.5) * 0.3; // Small random offset along road

                position.add(perpendicular.clone().multiplyScalar((RoadGenerator.roadWidth / 2) * side + Math.random() * 1.0)); // Position right at the edge with increased random offset
                position.add(segmentDirection.clone().multiplyScalar(offsetZ));

                 const height = this.getTerrainHeightAt(position.x, position.z);
                 position.y = height; // Place directly on terrain surface

                 // Add some randomness to scale and rotation
                const scale = 0.3 + Math.random() * 0.5; // Varied scale for grass blades (adjusted range)
                dummyGrass.position.copy(position);
                dummyGrass.scale.set(scale, scale, scale);

                 // Align roughly upright with random rotation around Y and slight tilt
                 dummyGrass.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.6, Math.random() * Math.PI * 2, 0); // Tilt slightly and random Y rotation

                dummyGrass.updateMatrix();
                grassMesh.setMatrixAt(i, dummyGrass.matrix);
             }
             grassMesh.instanceMatrix.needsUpdate = true;
             grassMesh.castShadow = true;
             grassMesh.receiveShadow = true;
             this.scene.add(grassMesh);
        } else {
             console.warn('Road points not available for grass placement.');
        }

        // Add dense small plants/ground cover along the road edges using instancing
        const groundCoverCount = 60000; // Very high density for ground cover
        const groundCoverGeometry = new THREE.PlaneGeometry(0.3, 0.3); // Smaller geometry
        groundCoverGeometry.translate(0, 0.15, 0); // Pivot at the bottom

        const groundCoverMaterial = new THREE.MeshStandardMaterial({
            color: 0x7a9a51, // Different shade of green
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.1
        });

        const groundCoverMesh = new THREE.InstancedMesh(groundCoverGeometry, groundCoverMaterial, groundCoverCount);
        const dummyGroundCover = new THREE.Object3D();

         if (this.roadPoints && this.roadPoints.length > 1) {
             for (let i = 0; i < groundCoverCount; i++) {
                 // Pick a random point along the road segment
                const roadPointIndex = Math.floor(Math.random() * (this.roadPoints.length - 1));
                const p1 = this.roadPoints[roadPointIndex];
                const p2 = this.roadPoints[roadPointIndex + 1];

                 const t = Math.random(); // Position along the segment
                 const position = new THREE.Vector3().copy(p1).lerp(p2, t);

                const segmentDirection = new THREE.Vector3().subVectors(p2, p1).normalize();
                const upVector = new THREE.Vector3(0, 1, 0);
                const perpendicular = new THREE.Vector3().crossVectors(segmentDirection, upVector).normalize();

                // Position the ground cover very close to the road edge/barrier
                const side = Math.random() > 0.5 ? 1 : -1; // Randomly choose left or right side
                const offsetX = Math.random() * 0.5; // Very small distance away from the road edge
                const offsetZ = (Math.random() - 0.5) * 0.1; // Very small random offset along road

                position.add(perpendicular.clone().multiplyScalar((RoadGenerator.roadWidth / 2) * side + offsetX));
                position.add(segmentDirection.clone().multiplyScalar(offsetZ));

                 const height = this.getTerrainHeightAt(position.x, position.z);
                 position.y = height; // Place directly on terrain surface

                 // Add some randomness to scale and rotation
                const scale = 0.2 + Math.random() * 0.3; // Very small scale
                dummyGroundCover.position.copy(position);
                dummyGroundCover.scale.set(scale, scale, scale);

                 // Align roughly upright with random rotation around Y
                 dummyGroundCover.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, 0); // Slight tilt and random Y rotation

                dummyGroundCover.updateMatrix();
                groundCoverMesh.setMatrixAt(i, dummyGroundCover.matrix);
             }
             groundCoverMesh.instanceMatrix.needsUpdate = true;
             groundCoverMesh.castShadow = true;
             groundCoverMesh.receiveShadow = true;
             this.scene.add(groundCoverMesh);
        } else {
             console.warn('Road points not available for ground cover placement.');
        }
    }

    getTerrainHeightAt(x, z) {
        // Sample the height at the given x,z coordinates
        const size = 20000;
        const heightScale = 500;
        
        let height = 0;
        height += this.noise(x * 0.0001, z * 0.0001) * heightScale;
        height += this.noise(x * 0.0002, z * 0.0002) * heightScale * 0.5;
        height += this.noise(x * 0.0004, z * 0.0004) * heightScale * 0.25;
        height += this.noise(x * 0.0008, z * 0.0008) * heightScale * 0.125;
        
        return height;
    }

    getDistanceToRoad(x, z) {
        if (!this.roadPoints || this.roadPoints.length < 2) {
            return Infinity; // Return infinity if no road points are available
        }

        let minDistance = Infinity;
        const point = new THREE.Vector3(x, 0, z); // Ignore Y for distance calculation to road on the XZ plane

        for (let i = 0; i < this.roadPoints.length - 1; i++) {
            const p1 = new THREE.Vector3(this.roadPoints[i].x, 0, this.roadPoints[i].z);
            const p2 = new THREE.Vector3(this.roadPoints[i + 1].x, 0, this.roadPoints[i + 1].z);

            // Calculate distance to line segment (simplified)
            const l2 = p1.distanceToSquared(p2);
            if (l2 === 0) {
                minDistance = Math.min(minDistance, point.distanceTo(p1));
            } else {
                let t = ((point.x - p1.x) * (p2.x - p1.x) + (point.z - p1.z) * (p2.z - p1.z)) / l2;
                t = Math.max(0, Math.min(1, t));
                const projection = new THREE.Vector3(
                    p1.x + t * (p2.x - p1.x),
                    0,
                    p1.z + t * (p2.z - p1.z)
                );
                minDistance = Math.min(minDistance, point.distanceTo(projection));
            }
        }
        return minDistance;
    }

    generateHeightfieldData(size, resolution, heightScale) {
        const data = [];
        for (let i = 0; i < resolution; i++) {
            data[i] = [];
            for (let j = 0; j < resolution; j++) {
                const x = (i / resolution - 0.5) * size;
                const z = (j / resolution - 0.5) * size;
                
                let height = 0;
                // Base terrain - match visual noise scale
                height += this.noise(x * 0.0001, z * 0.0001) * heightScale;
                // Medium detail - match visual noise scale
                height += this.noise(x * 0.0002, z * 0.0002) * heightScale * 0.5;
                // Fine detail - match visual noise scale
                height += this.noise(x * 0.0004, z * 0.0004) * heightScale * 0.25;
                // Very fine detail - add visual noise scale for consistency
                height += this.noise(x * 0.0008, z * 0.0008) * heightScale * 0.125;
                
                data[i][j] = height;
            }
        }
        return data;
    }

    createRoads() {
        // Load road texture
        const textureLoader = new THREE.TextureLoader();
        const roadTexture = textureLoader.load('/textures/road.jpg', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1000);
            texture.anisotropy = 16; // Improve texture quality
        });

        // Create road material with better properties
        const roadMaterial = new THREE.MeshStandardMaterial({
            map: roadTexture,
            roughness: 0.8,
            metalness: 0.2,
            normalScale: new THREE.Vector2(1, 1)
        });

        this.roadGenerator = new RoadGenerator(this.scene, this.terrain, roadMaterial);
        
        // Generate a more interesting road layout
        const startPoint = new THREE.Vector3(0, 0, 0);
        const roadLength = 10000; // Shorter but more interesting road
        const curvature = 2.0; // More curved road

        // Generate road points with more natural curves
        this.roadPoints = this.roadGenerator.generateRoadPoints(startPoint, roadLength, curvature);
        
        // Create road geometry with better properties
        const roadGeometry = this.roadGenerator.createRoadGeometry(this.roadPoints);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        
        // Enable shadows
        road.receiveShadow = true;
        road.castShadow = true;
        
        // Add road to scene
        this.scene.add(road);
        this.roads = [road];

        // Add road markings
        this.addRoadMarkings(roadGeometry);

        // Add road barrier
        this.addRoadBarrier();

        console.log('Road created with improved properties.');
    }

    addRoadMarkings(roadGeometry) {
        // Create center line material
        const centerLineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1
        });

        // Create edge line material
        const edgeLineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5,
            metalness: 0.1
        });

        // Add center line
        const centerLineGeometry = new THREE.BufferGeometry();
        const centerLinePositions = [];
        const centerLineIndices = [];

        // Generate center line vertices and indices
        const vertices = roadGeometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 9) {
            const x = vertices[i];
            const y = vertices[i + 1] + 0.01; // Slightly above road
            const z = vertices[i + 2];
            
            centerLinePositions.push(x, y, z);
            if (i > 0) {
                centerLineIndices.push(i/3 - 1, i/3);
            }
        }

        centerLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(centerLinePositions, 3));
        centerLineGeometry.setIndex(centerLineIndices);

        const centerLine = new THREE.LineSegments(centerLineGeometry, centerLineMaterial);
        this.scene.add(centerLine);

        // Add edge lines (similar process for left and right edges)
        // ... (implement edge lines if needed)
    }

    addRoadBarrier() {
        if (!this.roadPoints || this.roadPoints.length < 2) {
            console.error('Road points not available for barrier generation.');
            return;
        }

        const barrierMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080, // Gray concrete color
            roughness: 0.6,
            metalness: 0.1
        });

        const barrierWidth = 0.5;
        const barrierHeight = 1.0;

        const barrierGeometry = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        let index = 0;

        for (let i = 0; i < this.roadPoints.length - 1; i++) {
            const p1 = this.roadPoints[i];
            const p2 = this.roadPoints[i + 1];

            // Get the direction of the road segment
            const segmentDirection = new THREE.Vector3().subVectors(p2, p1).normalize();
            const upVector = new THREE.Vector3(0, 1, 0);

            // Calculate the perpendicular vector (pointing away from the road center)
            const perpendicular = new THREE.Vector3().crossVectors(segmentDirection, upVector).normalize();

            // Define barrier vertices for this segment
            const v1 = new THREE.Vector3().copy(p1).add(perpendicular.clone().multiplyScalar(RoadGenerator.roadWidth / 2));
            const v2 = new THREE.Vector3().copy(p2).add(perpendicular.clone().multiplyScalar(RoadGenerator.roadWidth / 2));
            const v3 = new THREE.Vector3().copy(v1).add(upVector.clone().multiplyScalar(barrierHeight));
            const v4 = new THREE.Vector3().copy(v2).add(upVector.clone().multiplyScalar(barrierHeight));

            // Vertices for the side facing away from the road
            const v5 = new THREE.Vector3().copy(v1).add(perpendicular.clone().multiplyScalar(barrierWidth));
            const v6 = new THREE.Vector3().copy(v2).add(perpendicular.clone().multiplyScalar(barrierWidth));
            const v7 = new THREE.Vector3().copy(v3).add(perpendicular.clone().multiplyScalar(barrierWidth));
            const v8 = new THREE.Vector3().copy(v4).add(perpendicular.clone().multiplyScalar(barrierWidth));
            
            // Push positions for both sides and top
            positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v4.x, v4.y, v4.z, v3.x, v3.y, v3.z); // Side facing road
            positions.push(v5.x, v5.y, v5.z, v6.x, v6.y, v6.z, v8.x, v8.y, v8.z, v7.x, v7.y, v7.z); // Side facing away
            positions.push(v3.x, v3.y, v3.z, v4.x, v4.y, v4.z, v8.x, v8.y, v8.z, v7.x, v7.y, v7.z); // Top face

            // Calculate and push normals (simplified - should be per vertex for smooth shading)
            const sideNormal = perpendicular.clone().negate(); // Normal for side facing road
            const outerSideNormal = perpendicular.clone(); // Normal for side facing away
            const topNormal = upVector.clone(); // Normal for top face

            for(let j = 0; j < 4; j++) normals.push(sideNormal.x, sideNormal.y, sideNormal.z);
            for(let j = 0; j < 4; j++) normals.push(outerSideNormal.x, outerSideNormal.y, outerSideNormal.z);
            for(let j = 0; j < 4; j++) normals.push(topNormal.x, topNormal.y, topNormal.z);

            // Push UVs (simplified)
            uvs.push(0, 0, 1, 0, 1, 1, 0, 1); // Side facing road
            uvs.push(0, 0, 1, 0, 1, 1, 0, 1); // Side facing away
            uvs.push(0, 0, 1, 0, 1, 1, 0, 1); // Top face

            // Push indices
            indices.push(index, index + 1, index + 2, index, index + 2, index + 3); // Side facing road
            indices.push(index + 4, index + 5, index + 6, index + 4, index + 6, index + 7); // Side facing away
            indices.push(index + 8, index + 9, index + 10, index + 8, index + 10, index + 11); // Top face

            index += 12;
        }

        barrierGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        barrierGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        barrierGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        barrierGeometry.setIndex(indices);
        
        barrierGeometry.computeBoundingSphere();

        const barrierMesh = new THREE.Mesh(barrierGeometry, barrierMaterial);
        barrierMesh.castShadow = true;
        barrierMesh.receiveShadow = true;
        this.scene.add(barrierMesh);

        console.log('Road barrier added.');
    }

    createCar(carBodyMaterial, wheelMaterial) {
        // Get the starting position from the road generator
        const roadPoints = this.roadGenerator.getRoadPoints();
        if (!roadPoints || roadPoints.length < 2) {
            console.error('Road points not available for car placement.');
            return;
        }

        const startPoint = roadPoints[0];
        const nextPoint = roadPoints[1];
        const initialDirection = new THREE.Vector3().subVectors(nextPoint, startPoint).normalize();

        // Calculate initial rotation quaternion based on the direction
        const upVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), initialDirection);

        // Create the car at the starting road point with the calculated rotation
        const carPosition = new CANNON.Vec3(
            startPoint.x,
            startPoint.y + 1.0,
            startPoint.z
        );

        this.car = new Car(this.scene, this.world, carBodyMaterial, wheelMaterial, carPosition, quaternion);
        console.log('Car created at road start with position:', carPosition);
    }

    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.wheels = [];

        const wheelPositions = [
            [-1, -0.5, 1],  // Front left
            [1, -0.5, 1],   // Front right
            [-1, -0.5, -1], // Rear left
            [1, -0.5, -1]   // Rear right
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(...pos);
            wheel.rotation.z = Math.PI / 2;
            this.car.add(wheel);
            this.wheels.push(wheel);
        });
    }

    createLights() {
        // Ambient light with warmer color
        this.ambientLight = new THREE.AmbientLight(0xffffeb, 0.3);
        this.scene.add(this.ambientLight);

        // Main directional light (sun)
        this.directionalLight = new THREE.DirectionalLight(0xffffeb, 1.2);
        this.directionalLight.position.set(100, 200, 100);
        this.directionalLight.castShadow = true;

        // Improve shadow quality
        this.directionalLight.shadow.mapSize.width = 4096;
        this.directionalLight.shadow.mapSize.height = 4096;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 1000;
        this.directionalLight.shadow.camera.left = -200;
        this.directionalLight.shadow.camera.right = 200;
        this.directionalLight.shadow.camera.top = 200;
        this.directionalLight.shadow.camera.bottom = -200;
        this.directionalLight.shadow.bias = -0.0001;
        this.directionalLight.shadow.normalBias = 0.02;
        this.directionalLight.shadow.radius = 1.5;

        this.scene.add(this.directionalLight);

        // Add hemisphere light for better ambient lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffeb, 0x080820, 0.5);
        this.scene.add(hemisphereLight);
    }

    createWater() {
        const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
        this.water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                sunDirection: new THREE.Vector3(),
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                fog: this.scene.fog !== undefined
            }
        );
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -100;
        this.scene.add(this.water);
    }

    createAtmosphere() {
        // Create a more realistic fog
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0002);

        // Add sky gradient
        const skyGeometry = new THREE.SphereGeometry(10000, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xffffff) },
                offset: { value: 33 },
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
        this.scene.add(sky);

        // Add subtle atmospheric particles
        const particleCount = 2000;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            // Position particles in a sphere around the scene
            const radius = 5000 + Math.random() * 5000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = radius * Math.cos(phi);

            // Add subtle color variation
            colors[i] = 0.9 + Math.random() * 0.1;
            colors[i + 1] = 0.9 + Math.random() * 0.1;
            colors[i + 2] = 1.0;
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particleMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });

        this.atmosphericParticles = new THREE.Points(particles, particleMaterial);
        this.scene.add(this.atmosphericParticles);
    }

    updateWeather(deltaTime) {
        // Update weather effects
        switch (this.weather) {
            case 'rainy':
                // Add rain particles
                if (!this.rainParticles) {
                    this.createRainParticles();
                }
                this.updateRainParticles(deltaTime);
                break;
            case 'snowy':
                // Add snow particles
                if (!this.snowParticles) {
                    this.createSnowParticles();
                }
                this.updateSnowParticles(deltaTime);
                break;
            case 'foggy':
                // Increase fog density
                this.scene.fog.density = 0.05;
                break;
            default:
                // Clear weather
                this.scene.fog.density = 0.005;
                if (this.rainParticles) {
                    this.scene.remove(this.rainParticles);
                    this.rainParticles = null;
                }
                if (this.snowParticles) {
                    this.scene.remove(this.snowParticles);
                    this.snowParticles = null;
                }
                break;
        }
    }

    createRainParticles() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.1,
            transparent: true,
            opacity: 0.6
        });
        
        this.rainParticles = new THREE.Points(geometry, material);
        this.scene.add(this.rainParticles);
    }

    updateRainParticles(deltaTime) {
        const positions = this.rainParticles.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= 50 * deltaTime;
            
            if (positions[i + 1] < 0) {
                positions[i] = (Math.random() - 0.5) * 100;
                positions[i + 1] = 50;
                positions[i + 2] = (Math.random() - 0.5) * 100;
            }
        }
        
        this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    createSnowParticles() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = Math.random() * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.2,
            transparent: true,
            opacity: 0.8
        });
        
        this.snowParticles = new THREE.Points(geometry, material);
        this.scene.add(this.snowParticles);
    }

    updateSnowParticles(deltaTime) {
        const positions = this.snowParticles.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.1;
            positions[i + 1] -= 5 * deltaTime;
            positions[i + 2] += Math.cos(Date.now() * 0.001 + i) * 0.1;
            
            if (positions[i + 1] < 0) {
                positions[i] = (Math.random() - 0.5) * 100;
                positions[i + 1] = 50;
                positions[i + 2] = (Math.random() - 0.5) * 100;
            }
        }
        
        this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }

    updateTimeOfDay(deltaTime) {
        // Update time of day (24-hour cycle)
        this.timeOfDay = (this.timeOfDay + deltaTime * 0.1) % 24;
        
        // Calculate sun position (still useful for light direction)
        const sunAngle = (this.timeOfDay / 24) * Math.PI * 2;
        const sunHeight = Math.sin(sunAngle);
        const sunDistance = Math.cos(sunAngle);
        
        // Update sun position for directional light
        const sun = new THREE.Vector3(
            Math.cos(sunAngle) * 1000,
            sunHeight * 1000,
            Math.sin(sunAngle) * 1000
        );

        if (this.directionalLight) {
            this.directionalLight.position.copy(sun);
        }
        
        // Update skybox uniform if needed (our current skybox shader doesn't need this)
        // if (this.skybox && this.skybox.material && this.skybox.material.uniforms && this.skybox.material.uniforms.sunPosition) {
        //     this.skybox.material.uniforms.sunPosition.value.copy(sun);
        // }
        
        // Update lighting based on time of day
        const dayIntensity = Math.max(0, Math.min(1, (sunHeight + 0.2) / 0.4));
        if (this.ambientLight) {
             this.ambientLight.intensity = 0.3 * dayIntensity; // Adjusted base intensity to match new ambient light
        }
        if (this.directionalLight) {
             this.directionalLight.intensity = 1.2 * dayIntensity; // Adjusted base intensity to match new directional light
        }
        
        // Update fog based on time of day
        if (this.scene.fog) {
             if (this.timeOfDay > 19 || this.timeOfDay < 5) {
                 // Night time - darker fog
                 this.scene.fog.density = 0.02;
             } else if (this.timeOfDay > 6 && this.timeOfDay < 8) {
                 // Dawn - light fog
                 this.scene.fog.density = 0.01;
             } else if (this.timeOfDay > 17 && this.timeOfDay < 19) {
                 // Dusk - light fog
                 this.scene.fog.density = 0.01;
             } else {
                 // Day time - clear
                 this.scene.fog.density = 0.0002; // Adjusted to match base fog density
             }
        }
    }

    setupControls() {
        // Keyboard controls
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false,
            handbrake: false,
            camera: false
        };

        window.addEventListener('keydown', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w':
                    this.keys.forward = true;
                    break;
                case 's':
                    this.keys.backward = true;
                    break;
                case 'a':
                    this.keys.left = true;
                    break;
                case 'd':
                    this.keys.right = true;
                    break;
                case ' ':
                    this.keys.brake = true;
                    break;
                case 'shift':
                    this.keys.handbrake = true;
                    break;
                case 'c':
                    this.changeCamera();
                    break;
            }
        });

        window.addEventListener('keyup', (event) => {
            switch (event.key.toLowerCase()) {
                case 'w':
                    this.keys.forward = false;
                    break;
                case 's':
                    this.keys.backward = false;
                    break;
                case 'a':
                    this.keys.left = false;
                    break;
                case 'd':
                    this.keys.right = false;
                    break;
                case ' ':
                    this.keys.brake = false;
                    break;
                case 'shift':
                    this.keys.handbrake = false;
                    break;
            }
        });

        // Mouse controls for orbit camera
        this.mouse = new THREE.Vector2();
        this.mouseDown = false;
        this.cameraRotation = new THREE.Vector2(0, 0);

        window.addEventListener('mousedown', (event) => {
            this.mouseDown = true;
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        window.addEventListener('mouseup', () => {
            this.mouseDown = false;
        });

        window.addEventListener('mousemove', (event) => {
            if (this.mouseDown && this.cameraMode === 'orbit') {
                const newMouse = new THREE.Vector2(
                    (event.clientX / window.innerWidth) * 2 - 1,
                    -(event.clientY / window.innerHeight) * 2 + 1
                );
                this.cameraRotation.x += (newMouse.x - this.mouse.x) * 2;
                this.cameraRotation.y += (newMouse.y - this.mouse.y) * 2;
                this.cameraRotation.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.y));
                this.mouse.copy(newMouse);
            }
        });

        // Mouse wheel for zoom in orbit mode
        window.addEventListener('wheel', (event) => {
            if (this.cameraMode === 'orbit') {
                this.cameraDistance = Math.max(5, Math.min(50, this.cameraDistance - event.deltaY * 0.01));
            }
        });
    }

    updateCamera() {
        // Ensure car object and its visual body are initialized and have a valid quaternion
        if (!this.car || !this.car.body || !this.car.body.position || !this.car.body.quaternion || typeof this.car.body.quaternion.x === 'undefined') {
            console.warn('Car object or its visual body/quaternion not ready for camera update.');
            return; // Skip camera update if car is not ready or quaternion is invalid
        }

        const carPosition = this.car.body.position;
        const carRotation = this.car.body.quaternion; // Use quaternion for rotation

        switch (this.cameraMode) {
            case 'chase':
                // Chase camera follows behind the car
                const chaseOffset = new THREE.Vector3(0, 3, -8);
                chaseOffset.applyQuaternion(carRotation);
                this.camera.position.copy(carPosition).add(chaseOffset);
                this.camera.lookAt(carPosition);
                break;

            case 'cockpit':
                // Cockpit camera is inside the car
                const cockpitOffset = new THREE.Vector3(0, 1.5, 0.5);
                cockpitOffset.applyQuaternion(carRotation);
                this.camera.position.copy(carPosition).add(cockpitOffset);
                this.camera.quaternion.copy(carRotation);
                break;

            case 'orbit':
                // Orbit camera rotates around the car
                if (!this.cameraRotation || typeof this.cameraRotation.x === 'undefined' || typeof this.cameraRotation.y === 'undefined') {
                    console.warn('cameraRotation properties not ready for orbit mode.', this.cameraRotation);
                    // Optionally reset to a default valid state or return
                    this.cameraRotation = new THREE.Vector2(0, 0);
                    this.cameraDistance = 10; // Ensure distance is also valid
                }

                const orbitOffset = new THREE.Vector3(
                    Math.cos(this.cameraRotation.x) * Math.cos(this.cameraRotation.y),
                    Math.sin(this.cameraRotation.y),
                    Math.sin(this.cameraRotation.x) * Math.cos(this.cameraRotation.y)
                ).multiplyScalar(this.cameraDistance);
                this.camera.position.copy(carPosition).add(orbitOffset);
                this.camera.lookAt(carPosition);
                break;
        }

        // Add camera shake based on car speed and damage
        if (this.cameraMode !== 'orbit') {
            const shakeIntensity = Math.min(0.1, this.car.speed * 0.001 + this.car.damage * 0.01);
            this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * shakeIntensity;
            this.camera.position.z += (Math.random() - 0.5) * shakeIntensity;
        }
    }

    changeCamera() {
        const modes = ['chase', 'cockpit', 'orbit'];
        const currentIndex = modes.indexOf(this.cameraMode);
        this.cameraMode = modes[(currentIndex + 1) % modes.length];
        
        // Reset camera parameters when changing modes
        if (this.cameraMode === 'orbit') {
            this.cameraDistance = 10;
            this.cameraRotation.set(0, 0);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();

        // Update physics
        this.world.step(1/60);

        // Update road generator
        if (this.roadGenerator && this.car) {
            this.roadGenerator.update(this.car.getPosition());
        }

        // Update car
        this.car.update(deltaTime, this.keys);

        // Update camera
        this.updateCamera();

        // Update time of day
        this.updateTimeOfDay(deltaTime);

        // Update weather
        this.updateWeather(deltaTime);

        // Manually update lighting and view position uniforms for the terrain material
        if (this.terrain && this.terrain.material && this.terrain.material.uniforms) {
            const uniforms = this.terrain.material.uniforms;
            
            // Update directional light uniform
            if (this.directionalLight) {
                uniforms.directionalLights.value.copy(this.directionalLight.position);
                uniforms.directionalLightColor.value.copy(this.directionalLight.color);
            }

            // Update ambient light uniform
            if (this.ambientLight) {
                 uniforms.ambientLightColor.value.copy(this.ambientLight.color);
            }

            // Update view position uniform
            uniforms.viewPosition.value.copy(this.camera.position);

            // Update fog uniforms
            if (this.scene.fog) {
                uniforms.fogDensity.value = this.scene.fog.density;
                uniforms.fogColor.value.copy(this.scene.fog.color);
            }
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    // Placeholder methods for camera change and car reset
    resetCar() {
        console.log('Reset car');
        // Implement car reset logic here
    }

     setWeather(weatherType) {
         this.weather = weatherType;
         console.log('Weather set to:', this.weather);
         // Implement visual weather changes here
         if (this.weather === 'clear') {
             this.atmosphericParticles.visible = false;
         } else {
              this.atmosphericParticles.visible = true;
         }
     }
}

export { Game }; 