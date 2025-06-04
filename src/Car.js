import * as THREE from "three"; import * as CANNON from "cannon-es/dist/cannon-es.js";

export class Car {
    constructor(scene, world, bodyMaterial, wheelMaterial, position, quaternion) {
        this.scene = scene;
        this.world = world;
        this.bodyMaterial = bodyMaterial;
        this.wheelMaterial = wheelMaterial;
        this.position = position;
        this.quaternion = quaternion;
        
        // Car properties
        this.maxSpeed = 50; // Reduced for more realistic speeds
        this.acceleration = 10;
        this.brakingForce = 20;
        this.handbrakeForce = 30;
        this.steeringSpeed = 2.5;
        this.maxSteeringAngle = Math.PI / 4;
        this.currentSteeringAngle = 0;
        this.speed = 0;
        this.damage = 0;
        
        // Create car body
        this.createBody();
        
        // Create wheels
        this.createWheels();
        
        // Create vehicle
        this.createVehicle();
    }

    createBody() {
        // Create car group
        this.car = new THREE.Group();

        // Car body
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
        const bodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a1a,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        this.car.add(body);

        // Car roof
        const roofGeometry = new THREE.BoxGeometry(1.5, 0.4, 2);
        const roofMaterial = new THREE.MeshPhongMaterial({
            color: 0x2a2a2a,
            metalness: 0.8,
            roughness: 0.2
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 1.2;
        roof.position.z = -0.5;
        roof.castShadow = true;
        this.car.add(roof);

        // Windows
        const windowGeometry = new THREE.BoxGeometry(1.4, 0.3, 1.8);
        const windowMaterial = new THREE.MeshPhongMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.3,
            metalness: 0.9,
            roughness: 0.1
        });
        const windows = new THREE.Mesh(windowGeometry, windowMaterial);
        windows.position.y = 0.85;
        windows.position.z = -0.5;
        this.car.add(windows);

        // Add car details
        this.addCarDetails();
    }

    addCarDetails() {
        // Add windshield
        const windshieldGeometry = new THREE.BoxGeometry(1.8, 0.8, 1.5);
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            metalness: 0,
            roughness: 0,
            transmission: 0.9,
            transparent: true,
            opacity: 0.3
        });
        
        const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
        windshield.position.set(0, 0.65, -0.5);
        windshield.castShadow = true;
        this.car.add(windshield);
        
        // Add headlights
        const headlightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffcc,
            emissive: 0xffffcc,
            emissiveIntensity: 0.5
        });
        
        const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlight.position.set(-0.8, 0.3, 2);
        this.car.add(leftHeadlight);
        
        const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlight.position.set(0.8, 0.3, 2);
        this.car.add(rightHeadlight);
        
        // Add taillights
        const taillightGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.1);
        const taillightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        
        const leftTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
        leftTaillight.position.set(-0.8, 0.3, -2);
        this.car.add(leftTaillight);
        
        const rightTaillight = new THREE.Mesh(taillightGeometry, taillightMaterial);
        rightTaillight.position.set(0.8, 0.3, -2);
        this.car.add(rightTaillight);
    }

    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        
        const wheelPositions = [
            [-1, 0.4, 1.2],  // Front left
            [1, 0.4, 1.2],   // Front right
            [-1, 0.4, -1.2], // Rear left
            [1, 0.4, -1.2]   // Rear right
        ];

        this.wheels = [];
        wheelPositions.forEach(position => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(...position);
            wheel.castShadow = true;
            this.wheels.push(wheel);
            this.car.add(wheel);
        });
    }

    createVehicle() {
        // Create car physics body
        const shape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
        this.physicsBody = new CANNON.Body({
            mass: 1500,
            position: new CANNON.Vec3(this.position.x, this.position.y, this.position.z),
            shape: shape,
            material: this.bodyMaterial
        });
        this.physicsBody.quaternion.copy(this.quaternion);
        this.world.addBody(this.physicsBody);
        
        // Create vehicle
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.physicsBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2
        });
        
        // Add wheels with improved physics properties
        const wheelOptions = {
            radius: 0.4,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 45,
            suspensionRestLength: 0.2,
            frictionSlip: 5,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };
        
        const axleWidth = 1.6;
        const wheelBase = 1.5;
        
        // Add wheels with proper positioning
        this.vehicle.addWheel({
            ...wheelOptions,
            chassisConnectionPointLocal: new CANNON.Vec3(-axleWidth/2, -0.3, wheelBase)
        });
        this.vehicle.addWheel({
            ...wheelOptions,
            chassisConnectionPointLocal: new CANNON.Vec3(axleWidth/2, -0.3, wheelBase)
        });
        this.vehicle.addWheel({
            ...wheelOptions,
            chassisConnectionPointLocal: new CANNON.Vec3(-axleWidth/2, -0.3, -wheelBase)
        });
        this.vehicle.addWheel({
            ...wheelOptions,
            chassisConnectionPointLocal: new CANNON.Vec3(axleWidth/2, -0.3, -wheelBase)
        });
        
        this.vehicle.addToWorld(this.world);
    }

    update(deltaTime, keys) {
        // Update car physics
        this.updatePhysics(deltaTime, keys);
        
        // Update visual representation
        this.updateVisuals();
        
        // Update damage based on collisions
        this.updateDamage();
    }

    updatePhysics(deltaTime, keys) {
        // Get current speed
        const velocity = this.physicsBody.velocity;
        this.speed = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );
        
        // Handle acceleration and braking
        if (keys.forward) {
            this.vehicle.applyEngineForce(this.acceleration * 1000, 2);
            this.vehicle.applyEngineForce(this.acceleration * 1000, 3);
        } else if (keys.backward) {
            this.vehicle.applyEngineForce(-this.acceleration * 1000, 2);
            this.vehicle.applyEngineForce(-this.acceleration * 1000, 3);
        } else {
            this.vehicle.applyEngineForce(0, 2);
            this.vehicle.applyEngineForce(0, 3);
        }
        
        // Handle steering
        if (keys.left) {
            this.currentSteeringAngle = Math.min(
                this.currentSteeringAngle + this.steeringSpeed * deltaTime,
                this.maxSteeringAngle
            );
        } else if (keys.right) {
            this.currentSteeringAngle = Math.max(
                this.currentSteeringAngle - this.steeringSpeed * deltaTime,
                -this.maxSteeringAngle
            );
        } else {
            // Return steering to center
            if (this.currentSteeringAngle > 0) {
                this.currentSteeringAngle = Math.max(0, this.currentSteeringAngle - this.steeringSpeed * deltaTime);
            } else if (this.currentSteeringAngle < 0) {
                this.currentSteeringAngle = Math.min(0, this.currentSteeringAngle + this.steeringSpeed * deltaTime);
            }
        }
        
        // Apply steering angle
        this.vehicle.setSteeringValue(this.currentSteeringAngle, 0);
        this.vehicle.setSteeringValue(this.currentSteeringAngle, 1);
        
        // Handle braking
        if (keys.brake) {
            this.vehicle.setBrake(this.brakingForce, 0);
            this.vehicle.setBrake(this.brakingForce, 1);
            this.vehicle.setBrake(this.brakingForce, 2);
            this.vehicle.setBrake(this.brakingForce, 3);
        } else if (keys.handbrake) {
            this.vehicle.setBrake(this.handbrakeForce, 2);
            this.vehicle.setBrake(this.handbrakeForce, 3);
        } else {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(0, 2);
            this.vehicle.setBrake(0, 3);
        }
    }

    updateVisuals() {
        // Update car body position and rotation
        this.car.position.copy(this.physicsBody.position);
        this.car.quaternion.copy(this.physicsBody.quaternion);
        
        // Update wheel rotations
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const transform = this.vehicle.wheelInfos[i].worldTransform;
            
            this.wheels[i].position.copy(transform.position);
            this.wheels[i].quaternion.copy(transform.quaternion);
        }
    }

    updateDamage() {
        // Calculate damage based on collisions
        const velocity = this.physicsBody.velocity;
        const impact = Math.sqrt(
            velocity.x * velocity.x +
            velocity.y * velocity.y +
            velocity.z * velocity.z
        );
        
        if (impact > 10) {
            this.damage += (impact - 10) * 0.01;
            this.damage = Math.min(this.damage, 1);
        }
    }

    getPosition() {
        return this.physicsBody.position;
    }

    getSpeed() {
        return this.speed;
    }

    getDamage() {
        return this.damage;
    }
}
