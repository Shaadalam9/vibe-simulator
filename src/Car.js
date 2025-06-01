import * as THREE from 'three';
import * as CANNON from 'cannon-es/dist/cannon-es.js';

export class Car {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.maxSteerVal = 0.5;
        this.maxForce = 1000;
        this.brakeForce = 1000000;
        this.steeringSpeed = 0.03;
        this.steeringResetSpeed = 0.1;
        this.steeringVal = 0;
        this.engineForce = 0;
        this.breakingForce = 0;
        this.wheelOptions = {
            radius: 0.5,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 5,
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

        this.createCar();
    }

    createCar() {
        // Create car body
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x2c3e50 });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);

        // Create car body physics
        const shape = new CANNON.Box(new CANNON.Vec3(1, 0.25, 2));
        this.body = new CANNON.Body({ mass: 1500 });
        this.body.addShape(shape);
        this.body.position.set(0, 1, 0);
        this.body.angularDamping = 0.1;
        this.world.addBody(this.body);

        // Create wheels
        this.wheels = [];
        const wheelPositions = [
            { x: -1, y: 0, z: -1.5 },
            { x: 1, y: 0, z: -1.5 },
            { x: -1, y: 0, z: 1.5 },
            { x: 1, y: 0, z: 1.5 }
        ];

        wheelPositions.forEach(position => {
            const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
            wheelGeometry.rotateZ(Math.PI / 2);
            const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.castShadow = true;
            this.scene.add(wheel);
            this.wheels.push(wheel);

            const wheelBody = new CANNON.Body({ mass: 1 });
            const wheelShape = new CANNON.Sphere(0.4);
            wheelBody.addShape(wheelShape);
            wheelBody.position.set(position.x, position.y, position.z);
            this.world.addBody(wheelBody);

            const constraint = new CANNON.PointToPointConstraint(
                this.body,
                new CANNON.Vec3(position.x, position.y, position.z),
                wheelBody,
                new CANNON.Vec3(0, 0, 0)
            );
            this.world.addConstraint(constraint);
        });
    }

    update(deltaTime, controls) {
        // Update steering
        if (controls.left) {
            this.steeringVal = Math.max(this.steeringVal - this.steeringSpeed, -this.maxSteerVal);
        } else if (controls.right) {
            this.steeringVal = Math.min(this.steeringVal + this.steeringSpeed, this.maxSteerVal);
        } else {
            // Gradually reset steering when no input
            if (this.steeringVal > 0) {
                this.steeringVal = Math.max(0, this.steeringVal - this.steeringResetSpeed);
            } else if (this.steeringVal < 0) {
                this.steeringVal = Math.min(0, this.steeringVal + this.steeringResetSpeed);
            }
        }

        // Update engine force
        if (controls.forward) {
            this.engineForce = this.maxForce;
        } else if (controls.backward) {
            this.engineForce = -this.maxForce * 0.5; // Slower reverse
        } else {
            this.engineForce = 0;
        }

        // Update brake force
        this.breakingForce = controls.brake ? this.brakeForce : 0;

        // Apply forces to wheels
        this.wheels.forEach((wheel, index) => {
            const wheelBody = this.world.bodies[this.world.bodies.indexOf(this.body) + 1 + index];
            if (wheelBody) {
                // Apply engine force
                const force = new CANNON.Vec3(0, 0, this.engineForce);
                force.applyQuaternion(this.body.quaternion);
                wheelBody.applyLocalForce(force, new CANNON.Vec3(0, 0, 0));

                // Apply brake force
                if (this.breakingForce > 0) {
                    const brakeForce = new CANNON.Vec3(0, 0, -this.breakingForce);
                    brakeForce.applyQuaternion(this.body.quaternion);
                    wheelBody.applyLocalForce(brakeForce, new CANNON.Vec3(0, 0, 0));
                }

                // Apply steering
                if (index < 2) { // Only front wheels steer
                    const steerForce = new CANNON.Vec3(this.steeringVal * 1000, 0, 0);
                    steerForce.applyQuaternion(this.body.quaternion);
                    wheelBody.applyLocalForce(steerForce, new CANNON.Vec3(0, 0, 0));
                }
            }
        });

        // Update mesh positions
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);

        this.wheels.forEach((wheel, index) => {
            const wheelBody = this.world.bodies[this.world.bodies.indexOf(this.body) + 1 + index];
            if (wheelBody) {
                wheel.position.copy(wheelBody.position);
                wheel.quaternion.copy(wheelBody.quaternion);
            }
        });
    }
} 