import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';

export class Car {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.speed = 0;
        this.maxSpeed = 30; // Reduced for more realistic speeds
        this.acceleration = 0.3;
        this.deceleration = 0.2;
        this.brakeForce = 0.5;
        this.steeringAngle = 0;
        this.maxSteeringAngle = Math.PI / 4;
        this.steeringSpeed = 0.02;
        this.steeringReturn = 0.05;
        this.wheelBase = 2.5;
        this.wheelTrack = 1.8;
        this.wheelRadius = 0.4;
        this.handbrake = false;
        this.driftFactor = 0.95;
        this.groundFriction = 0.3;
        this.airFriction = 0.1;

        this.setupPhysics();
        this.createCarModel();
    }

    setupPhysics() {
        // Create car body with more realistic dimensions
        const shape = new CANNON.Box(new CANNON.Vec3(0.9, 0.5, 2.2));
        this.body = new CANNON.Body({
            mass: 1500,
            position: new CANNON.Vec3(0, 1, 0),
            shape: shape,
            material: new CANNON.Material('carMaterial'),
            linearDamping: 0.5,
            angularDamping: 0.5
        });

        // Add wheels with improved physics
        const wheelShape = new CANNON.Sphere(this.wheelRadius);
        const wheelMaterial = new CANNON.Material('wheelMaterial');
        const wheelOptions = {
            radius: this.wheelRadius,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 45,
            suspensionRestLength: 0.3,
            frictionSlip: 2.0,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(0, 0, 1),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        this.wheels = [];
        const wheelPositions = [
            [-this.wheelTrack/2, 0, this.wheelBase/2],  // Front left
            [this.wheelTrack/2, 0, this.wheelBase/2],   // Front right
            [-this.wheelTrack/2, 0, -this.wheelBase/2], // Rear left
            [this.wheelTrack/2, 0, -this.wheelBase/2]   // Rear right
        ];

        wheelPositions.forEach((pos, index) => {
            const wheel = new CANNON.Body({
                mass: 1,
                material: wheelMaterial,
                shape: wheelShape,
                position: new CANNON.Vec3(pos[0], pos[1], pos[2])
            });
            this.wheels.push(wheel);
            this.world.addBody(wheel);
        });

        this.world.addBody(this.body);
    }

    createCarModel() {
        // Create car body group
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);

        // Create car body
        const bodyGeometry = new THREE.BoxGeometry(1.8, 0.5, 4.4);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x4444ff,
            shininess: 100
        });
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bodyMesh.castShadow = true;
        this.mesh.add(bodyMesh);

        // Create cabin
        const cabinGeometry = new THREE.BoxGeometry(1.4, 0.5, 2);
        const cabinMaterial = new THREE.MeshPhongMaterial({
            color: 0x222222,
            shininess: 100
        });
        const cabinMesh = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabinMesh.position.set(0, 0.5, -0.2);
        cabinMesh.castShadow = true;
        this.mesh.add(cabinMesh);

        // Create wheels
        const wheelGeometry = new THREE.CylinderGeometry(
            this.wheelRadius,
            this.wheelRadius,
            0.3,
            32
        );
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.wheelMeshes = [];

        const wheelPositions = [
            [-this.wheelTrack/2, -0.25, this.wheelBase/2],  // Front left
            [this.wheelTrack/2, -0.25, this.wheelBase/2],   // Front right
            [-this.wheelTrack/2, -0.25, -this.wheelBase/2], // Rear left
            [this.wheelTrack/2, -0.25, -this.wheelBase/2]   // Rear right
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(...pos);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            this.mesh.add(wheel);
            this.wheelMeshes.push(wheel);
        });

        // Add headlights
        const headlightGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const headlightMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffcc,
            emissive: 0xffffcc,
            emissiveIntensity: 0.5
        });

        const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlight.position.set(-0.7, 0, 2.2);
        this.mesh.add(leftHeadlight);

        const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlight.position.set(0.7, 0, 2.2);
        this.mesh.add(rightHeadlight);

        // Add headlight spotlights
        const leftSpot = new THREE.SpotLight(0xffffcc, 1);
        leftSpot.position.set(-0.7, 0.5, 2.2);
        leftSpot.angle = Math.PI / 6;
        leftSpot.penumbra = 0.2;
        leftSpot.decay = 2;
        leftSpot.distance = 50;
        leftSpot.castShadow = true;
        this.mesh.add(leftSpot);

        const rightSpot = new THREE.SpotLight(0xffffcc, 1);
        rightSpot.position.set(0.7, 0.5, 2.2);
        rightSpot.angle = Math.PI / 6;
        rightSpot.penumbra = 0.2;
        rightSpot.decay = 2;
        rightSpot.distance = 50;
        rightSpot.castShadow = true;
        this.mesh.add(rightSpot);

        // Add brake lights
        const brakeLightGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const brakeLightMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });

        const leftBrakeLight = new THREE.Mesh(brakeLightGeometry, brakeLightMaterial);
        leftBrakeLight.position.set(-0.7, 0, -2.2);
        this.mesh.add(leftBrakeLight);

        const rightBrakeLight = new THREE.Mesh(brakeLightGeometry, brakeLightMaterial);
        rightBrakeLight.position.set(0.7, 0, -2.2);
        this.mesh.add(rightBrakeLight);
    }

    update(deltaTime, controls) {
        // Handle acceleration with improved physics
        if (controls.forward) {
            this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
        } else if (controls.backward) {
            this.speed = Math.max(this.speed - this.acceleration, -this.maxSpeed / 2);
        } else {
            this.speed *= (1 - this.deceleration);
        }

        // Handle braking
        if (controls.brake) {
            this.speed *= (1 - this.brakeForce);
            // Activate brake lights
            this.wheelMeshes[2].material.emissive.set(0xff0000);
            this.wheelMeshes[3].material.emissive.set(0xff0000);
        } else {
            // Deactivate brake lights
            this.wheelMeshes[2].material.emissive.set(0x000000);
            this.wheelMeshes[3].material.emissive.set(0x000000);
        }

        // Handle handbrake
        if (controls.handbrake) {
            this.handbrake = true;
            this.speed *= this.driftFactor;
        } else {
            this.handbrake = false;
        }

        // Handle steering with improved physics
        if (controls.left) {
            this.steeringAngle = Math.min(this.steeringAngle + this.steeringSpeed, this.maxSteeringAngle);
        } else if (controls.right) {
            this.steeringAngle = Math.max(this.steeringAngle - this.steeringSpeed, -this.maxSteeringAngle);
        } else {
            this.steeringAngle *= (1 - this.steeringReturn);
        }

        // Apply forces with improved physics
        const force = new CANNON.Vec3(0, 0, this.speed);
        force.applyQuaternion(this.body.quaternion);
        this.body.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));

        // Apply steering with improved handling
        if (Math.abs(this.speed) > 0.1) {
            const steeringForce = new CANNON.Vec3(0, this.steeringAngle * this.speed * 0.1, 0);
            if (this.handbrake) {
                steeringForce.multiply(1.5); // Increased steering during drift
            }
            this.body.applyLocalTorque(steeringForce);
        }

        // Apply friction
        const friction = this.handbrake ? this.airFriction : this.groundFriction;
        this.body.velocity.multiply(1 - friction);

        // Update wheel rotations
        this.wheelMeshes.forEach((wheel, index) => {
            wheel.rotation.x += this.speed * deltaTime;
            if (index < 2) { // Front wheels
                wheel.rotation.y = this.steeringAngle;
            }
        });

        // Update car mesh position and rotation
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }
} 