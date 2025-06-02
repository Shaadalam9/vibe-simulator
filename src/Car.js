import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';

export class Car {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.maxSteerVal = 0.5;
        this.maxForce = 1000;
        this.brakeForce = 1000000;
        
        // Car state
        this.speed = 0;
        this.steering = 0;
        this.engineForce = 0;
        this.breakingForce = 0;
        
        this.init();
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
            position: new CANNON.Vec3(0, 1, 0),
            shape: shape,
            material: new CANNON.Material('carMaterial')
        });
        this.world.addBody(this.physicsBody);

        // Create wheels
        this.createWheels();
        
        // Create vehicle
        this.createVehicle();
    }

    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        this.wheels = [];
        this.wheelBodies = [];

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
            this.body.add(wheel);
            this.wheels.push(wheel);

            // Physics wheel
            const wheelShape = new CANNON.Sphere(0.4);
            const wheelBody = new CANNON.Body({
                mass: 1,
                position: new CANNON.Vec3(pos.x, pos.y, pos.z),
                shape: wheelShape,
                material: new CANNON.Material('wheelMaterial')
            });
            this.wheelBodies.push(wheelBody);
            this.world.addBody(wheelBody);
        });
    }

    createVehicle() {
        const options = {
            radius: 0.4,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 1.5,
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

        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.physicsBody,
            indexRightAxis: 0,
            indexForwardAxis: 2,
            indexUpAxis: 1
        });

        const wheelOptions = [
            { ...options, chassisConnectionPointLocal: new CANNON.Vec3(-1, 0, 1.5) },  // Front left
            { ...options, chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1.5) },   // Front right
            { ...options, chassisConnectionPointLocal: new CANNON.Vec3(-1, 0, -1.5) }, // Rear left
            { ...options, chassisConnectionPointLocal: new CANNON.Vec3(1, 0, -1.5) }   // Rear right
        ];

        wheelOptions.forEach(options => {
            this.vehicle.addWheel(options);
        });

        this.vehicle.addToWorld(this.world);
    }

    update(deltaTime, controls) {
        // Update steering
        this.steering = THREE.MathUtils.lerp(
            this.steering,
            controls.left ? -this.maxSteerVal : controls.right ? this.maxSteerVal : 0,
            deltaTime * 5
        );

        // Update engine force
        const targetEngineForce = controls.forward ? this.maxForce : controls.backward ? -this.maxForce : 0;
        this.engineForce = THREE.MathUtils.lerp(this.engineForce, targetEngineForce, deltaTime * 5);

        // Update braking
        this.breakingForce = (controls.forward && controls.backward) ? this.brakeForce : 0;

        // Apply forces to wheels
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.applyEngineForce(this.engineForce, i);
            this.vehicle.setSteeringValue(this.steering, i);
            this.vehicle.setBrake(this.breakingForce, i);
        }

        // Update vehicle
        this.vehicle.update(deltaTime);

        // Update visual position and rotation
        this.body.position.copy(this.physicsBody.position);
        this.body.quaternion.copy(this.physicsBody.quaternion);

        // Update wheel positions and rotations
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const transform = this.vehicle.wheelInfos[i].worldTransform;
            this.wheels[i].position.copy(transform.position);
            this.wheels[i].quaternion.copy(transform.quaternion);
        }

        // Update speed
        this.speed = this.physicsBody.velocity.length();
    }

    getPosition() {
        return this.physicsBody.position;
    }

    getRotation() {
        return this.physicsBody.quaternion;
    }
}