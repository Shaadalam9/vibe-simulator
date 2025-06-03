import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';

export class Car {
    constructor(scene, world, carBodyMaterial, wheelMaterial, initialPosition, initialQuaternion) {
        this.scene = scene;
        this.world = world;
        this.carBodyMaterial = carBodyMaterial;
        this.wheelMaterial = wheelMaterial;
        this.initialPosition = initialPosition || new CANNON.Vec3(0, 200, 0);
        this.initialQuaternion = initialQuaternion || new CANNON.Quaternion();
        
        // Car properties
        this.maxSteerVal = 0.5;
        this.maxForce = 1500;
        this.brakeForce = 100;
        this.maxSpeed = 50;
        this.acceleration = 0.5;
        this.deceleration = 0.3;
        this.steeringSpeed = 0.05;
        this.currentSteering = 0;
        this.currentSpeed = 0;
        
        // Car state
        this.speed = 0;
        this.steering = 0;
        this.engineForce = 0;
        this.breakingForce = 0;
        this.damage = 0; // Initialize damage property
        
        this.init();
        this.setupSounds(); // Setup sounds after initialization
    }

    init() {
        // Create car body
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x4444ff,
            shininess: 100
        });
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.body.castShadow = true;
        this.scene.add(this.body);

        // Create car physics body
        const shape = new CANNON.Box(new CANNON.Vec3(1, 0.25, 2));
        this.physicsBody = new CANNON.Body({
            mass: 1500,
            position: this.initialPosition,
            shape: shape,
            material: this.carBodyMaterial,
            quaternion: this.initialQuaternion
        });
        this.world.addBody(this.physicsBody);

        // Create wheels
        this.createWheels();
        
        // Create vehicle
        this.createVehicle();

        // Initial sync of visual position
        this.body.position.copy(this.physicsBody.position);
        this.body.quaternion.copy(this.physicsBody.quaternion);

        // Add collision detection
        this.physicsBody.addEventListener('collide', (event) => {
            const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
            if (Math.abs(relativeVelocity) > 5) { // Threshold for significant impact
                this.damage += Math.abs(relativeVelocity) * 0.1; // Increase damage based on impact strength
                if (this.impactSound && !this.impactSound.isPlaying) {
                     this.impactSound.play();
                }
            }
        });
    }

    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.wheels = [];

        // Wheel positions relative to the car body center
        const wheelPositions = [
            { x: -1, y: -0.25, z: 1.5 },  // Front left
            { x: 1, y: -0.25, z: 1.5 },   // Front right
            { x: -1, y: -0.25, z: -1.5 }, // Rear left
            { x: 1, y: -0.25, z: -1.5 }   // Rear right
        ];

        wheelPositions.forEach(pos => {
            // Visual wheel
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.rotation.z = Math.PI / 2;
            this.scene.add(wheel); // Add wheels directly to scene
            this.wheels.push(wheel);

            // Physics wheel (placeholder, RaycastVehicle creates actual wheel physics bodies)
            // We still need a placeholder visual wheel to attach to the RaycastVehicle later
        });
    }

    createVehicle() {
        const options = {
            radius: 0.4,
            directionLocal: new CANNON.Vec3(0, -1, 0), // Wheel direction (downwards)
            suspensionStiffness: 50, // Increased stiffness
            suspensionRestLength: 0.5, // Adjusted rest length (increased)
            frictionSlip: 0.8, // Reduced friction slip
            dampingRelaxation: 3, // Adjusted damping
            dampingCompression: 4.5, // Adjusted damping
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(0, 0, 1), // Axle direction
            // Adjusted connection points to be slightly lower relative to the chassis bottom
            chassisConnectionPointLocal: new CANNON.Vec3(1, -0.3, 1),
            maxSuspensionTravel: 0.5, // Increased travel
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.physicsBody,
            indexRightAxis: 0,
            indexForwardAxis: 2,
            indexUpAxis: 1
        });

        // Add wheels with their connection points
        const wheelInfos = [
            { ...options, chassisConnectionPointLocal: new CANNON.Vec3(-1, -0.3, 1.5) },  // Front left
            { ...options, chassisConnectionPointLocal: new CANNON.Vec3(1, -0.3, 1.5) },   // Front right
            { ...options, chassisConnectionPointLocal: new CANNON.Vec3(-1, -0.3, -1.5) }, // Rear left
            { ...options, chassisConnectionPointLocal: new CANNON.Vec3(1, -0.3, -1.5) }   // Rear right
        ];

        wheelInfos.forEach(info => {
            this.vehicle.addWheel(info);
        });

        this.vehicle.addToWorld(this.world);

        // Get physics wheel bodies from the vehicle (needed for syncing visual wheels)
        this.wheelBodies = this.vehicle.wheelBodies;
    }

    setupSounds() {
        // Create audio listener
        this.listener = new THREE.AudioListener();
        this.scene.add(this.listener); // Add listener to the scene

        // Engine sound
        this.engineSound = new THREE.Audio(this.listener);
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('/sounds/engine.mp3', (buffer) => {
            this.engineSound.setBuffer(buffer);
            this.engineSound.setLoop(true);
            this.engineSound.setVolume(0.5);
            // Start playing on user interaction, e.g., first acceleration
        });

        // Impact sound
        this.impactSound = new THREE.Audio(this.listener);
        audioLoader.load('/sounds/impact.mp3', (buffer) => {
            this.impactSound.setBuffer(buffer);
            this.impactSound.setVolume(0.3);
        });

        // Tire screech sound
        this.tireSound = new THREE.Audio(this.listener);
        audioLoader.load('/sounds/tire-screech.mp3', (buffer) => {
            this.tireSound.setBuffer(buffer);
            this.tireSound.setLoop(true);
            this.tireSound.setVolume(0.2);
            // Start playing when tire slip occurs (this would require more advanced physics checks)
        });
    }

    update(deltaTime, controls) {
        // Update engine sound playback rate and volume based on speed
        if (this.engineSound && this.engineSound.isPlaying) {
            this.engineSound.setPlaybackRate(0.5 + Math.abs(this.speed) / 30);
            this.engineSound.setVolume(0.3 + Math.abs(this.speed) / 100);
        }

        // Calculate target speed based on controls
        let targetSpeed = 0;
        if (controls.forward) {
            targetSpeed = this.maxSpeed;
        } else if (controls.backward) {
            targetSpeed = -this.maxSpeed * 0.5; // Reverse is slower
        }

        // Gradually change current speed
        if (targetSpeed > this.currentSpeed) {
            this.currentSpeed = Math.min(targetSpeed, this.currentSpeed + this.acceleration);
        } else if (targetSpeed < this.currentSpeed) {
            this.currentSpeed = Math.max(targetSpeed, this.currentSpeed - this.deceleration);
        }

        // Apply engine force based on current speed
        this.engineForce = this.currentSpeed * this.maxForce / this.maxSpeed;
        this.vehicle.applyEngineForce(this.engineForce, 2);
        this.vehicle.applyEngineForce(this.engineForce, 3);

        // Calculate target steering
        let targetSteering = 0;
        if (controls.left) {
            targetSteering = -this.maxSteerVal;
        } else if (controls.right) {
            targetSteering = this.maxSteerVal;
        }

        // Gradually change current steering
        if (targetSteering > this.currentSteering) {
            this.currentSteering = Math.min(targetSteering, this.currentSteering + this.steeringSpeed);
        } else if (targetSteering < this.currentSteering) {
            this.currentSteering = Math.max(targetSteering, this.currentSteering - this.steeringSpeed);
        }

        // Apply steering to front wheels
        this.vehicle.setSteeringValue(this.currentSteering, 0);
        this.vehicle.setSteeringValue(this.currentSteering, 1);

        // Apply brake force to all wheels
        this.breakingForce = controls.brake ? this.brakeForce : 0;
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.setBrake(this.breakingForce, i);
        }
        
        // Handbrake (applies brake to rear wheels)
        const handbrakeForce = controls.handbrake ? this.brakeForce * 2 : 0;
        this.vehicle.setBrake(handbrakeForce, 2);
        this.vehicle.setBrake(handbrakeForce, 3);

        // Update visual position and rotation of car body
        this.body.position.copy(this.physicsBody.position);
        this.body.quaternion.copy(this.physicsBody.quaternion);

        // Update visual position and rotation of wheels
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const transform = this.vehicle.wheelInfos[i].worldTransform;
            this.wheels[i].position.copy(transform.position);
            this.wheels[i].quaternion.copy(transform.quaternion);
        }

        // Update speed
        this.speed = this.physicsBody.velocity.length();

        // Basic tire screech logic
        if ((controls.handbrake || Math.abs(this.currentSteering) > 0.3) && this.speed > 5) {
            if (this.tireSound && !this.tireSound.isPlaying) {
                this.tireSound.play();
            }
        } else {
            if (this.tireSound && this.tireSound.isPlaying) {
                this.tireSound.stop();
            }
        }

        // Start engine sound on first acceleration
        if (this.engineSound && !this.engineSound.isPlaying && (controls.forward || controls.backward)) {
            this.engineSound.play();
        }
    }

    getPosition() {
        return this.physicsBody.position;
    }

    getRotation() {
        return this.physicsBody.quaternion;
    }

    getDamage() {
        return this.damage;
    }

     reset() {
         this.physicsBody.position.copy(this.initialPosition);
         this.physicsBody.velocity.set(0, 0, 0);
         this.physicsBody.angularVelocity.set(0, 0, 0);
         this.physicsBody.quaternion.copy(this.initialQuaternion);
         this.damage = 0;
         this.vehicle.reset(); // Reset the RaycastVehicle
     }
}