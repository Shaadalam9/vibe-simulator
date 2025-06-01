import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Car {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.maxSteerVal = 0.5; // Maximum steering angle in radians
        this.maxEngineForce = 1500; // Increased engine force for better acceleration
        this.maxBrakeForce = 500000; // Adjusted brake force
        this.steeringIncrement = 0.04; // Faster steering
        this.steeringDecceleration = 0.1; // Slower steering return
        this.engineForce = 0;
        this.brakeForce = 0;
        this.steeringValue = 0; // Current steering value

        // Wheel options for realistic behavior
        this.wheelOptions = {
            radius: 0.35, // Adjusted wheel radius
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30, // Softer suspension
            suspensionRestLength: 0.3, // Adjusted rest length
            frictionSlip: 1.5, // Reduced friction slip for less drifting
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(0, 0, 1),
            chassisConnectionPointLocal: new CANNON.Vec3(-1, 0, 1.2), // Adjusted connection points
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        this.wheels = [];
        this.vehicle = null; // CANNON vehicle

        this.createCar();
    }

    createCar() {
        // Create car body physics
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.3, 2)); // Adjusted chassis size
        const chassisBody = new CANNON.Body({
            mass: 1500, // Car mass
            position: new CANNON.Vec3(0, 1, 0),
            shape: chassisShape,
            linearDamping: 0.1, // Reduced linear damping
            angularDamping: 0.1 // Reduced angular damping
        });
        this.world.addBody(chassisBody);

        // Create the CANNON vehicle
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: chassisBody,
        });

        // Add wheels
        const axlewidth = 1; // Distance between left and right wheels
        const back = -1.2; // Z position of back wheels
        const front = 1.3; // Z position of front wheels

        this.wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(-axlewidth / 2, 0, front);
        this.vehicle.addWheel(this.wheelOptions);

        this.wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(axlewidth / 2, 0, front);
        this.vehicle.addWheel(this.wheelOptions);

        this.wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(-axlewidth / 2, 0, back);
        this.vehicle.addWheel(this.wheelOptions);

        this.wheelOptions.chassisConnectionPointLocal = new CANNON.Vec3(axlewidth / 2, 0, back);
        this.vehicle.addWheel(this.wheelOptions);

        this.vehicle.addToWorld(this.world);

        // Create visible car mesh (simple box for now)
        const bodyGeometry = new THREE.BoxGeometry(2, 0.6, 4.2); // Adjusted mesh size
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        // Create visible wheel meshes
        const wheelGeometry = new THREE.CylinderGeometry(this.wheelOptions.radius, this.wheelOptions.radius, 0.3, 32);
        wheelGeometry.rotateZ(Math.PI / 2);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheelMesh.castShadow = true;
            this.scene.add(wheelMesh);
            this.wheels.push(wheelMesh);
        }
    }

    update(deltaTime, controls) {
        // Update steering
        if (controls.left) {
            this.steeringValue += this.steeringIncrement;
        } else if (controls.right) {
            this.steeringValue -= this.steeringIncrement;
        } else {
            // Gradually return steering to center
            if (this.steeringValue > 0) {
                this.steeringValue -= this.steeringDecceleration;
                this.steeringValue = Math.max(0, this.steeringValue);
            } else if (this.steeringValue < 0) {
                this.steeringValue += this.steeringDecceleration;
                this.steeringValue = Math.min(0, this.steeringValue);
            }
        }

        // Clamp steering value
        this.steeringValue = Math.max(-this.maxSteerVal, Math.min(this.maxSteerVal, this.steeringValue));

        // Apply steering to front wheels
        this.vehicle.setSteeringValue(this.steeringValue, 0); // Front left
        this.vehicle.setSteeringValue(this.steeringValue, 1); // Front right

        // Update engine and brake force
        this.engineForce = 0;
        this.brakeForce = 0;

        if (controls.forward) {
            this.engineForce = this.maxEngineForce;
        } else if (controls.backward) {
            this.engineForce = -this.maxEngineForce * 0.5; // Slower reverse
        }

        if (controls.brake) {
            this.brakeForce = this.maxBrakeForce;
        } else if (controls.handbrake) {
            this.brakeForce = this.maxBrakeForce * 0.5; // Partial brake for handbrake
            this.engineForce = 0; // Cut engine power on handbrake
        }

        // Apply engine and brake force to wheels
        this.vehicle.applyEngineForce(this.engineForce, 2); // Rear left
        this.vehicle.applyEngineForce(this.engineForce, 3); // Rear right

        this.vehicle.setBrake(this.brakeForce, 0); // Front left
        this.vehicle.setBrake(this.brakeForce, 1); // Front right
        this.vehicle.setBrake(this.brakeForce, 2); // Rear left
        this.vehicle.setBrake(this.brakeForce, 3); // Rear right

        // Update mesh positions and rotations from physics bodies
        this.mesh.position.copy(this.vehicle.chassisBody.position);
        this.mesh.quaternion.copy(this.vehicle.chassisBody.quaternion);

        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const wheel = this.wheels[i];
            const wheelTransform = this.vehicle.wheelInfos[i].worldTransform;
            wheel.position.copy(wheelTransform.position);
            wheel.quaternion.copy(wheelTransform.quaternion);
        }
    }
} 