
import * as THREE from 'three';

function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Create the scene
const scene = new THREE.Scene();

// Create the camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Create the renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create the ground plane
const geometry = new THREE.PlaneGeometry(500, 500);
const material = new THREE.MeshBasicMaterial({ color: 0x228B22, side: THREE.DoubleSide }); // green grass
const plane = new THREE.Mesh(geometry, material);
plane.rotation.x = Math.PI / 2;
scene.add(plane);

// Set the camera position
camera.position.set(0, 50, 100);
camera.lookAt(0, 0, 0);

// --- ADD THE CAR ---

// Create a car (simple red cube)
const car = new THREE.Mesh(
  new THREE.BoxGeometry(4, 2, 2), // wider rectangle
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
car.position.y = 1; // sit slightly above the ground
scene.add(car);

// Keyboard controls
const keys = {};

document.addEventListener('keydown', (event) => {
  keys[event.key] = true;
});

document.addEventListener('keyup', (event) => {
  keys[event.key] = false;
});

// Animate everything
function animate() {
  requestAnimationFrame(animate);

  if (keys['ArrowUp']) {
    car.position.z -= 0.5;
  }
  if (keys['ArrowDown']) {
    car.position.z += 0.5;
  }
  if (keys['ArrowLeft']) {
    car.rotation.y += 0.05;
  }
  if (keys['ArrowRight']) {
    car.rotation.y -= 0.05;
  }

  renderer.render(scene, camera);
}
animate();

// Create buildings with repeatable positions
let seed = 42;

for (let i = 0; i < 100; i++) {
  const buildingGeometry = new THREE.BoxGeometry(
    seededRandom(seed++) * 10 + 10,
    seededRandom(seed++) * 50 + 10,
    seededRandom(seed++) * 10 + 10
  );
  const buildingMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

  building.position.x = seededRandom(seed++) * 400 - 200;
  building.position.z = seededRandom(seed++) * 400 - 200;
  building.position.y = building.geometry.parameters.height / 2;

  scene.add(building);
}
// Add a big main horizontal road
const mainRoadGeometry = new THREE.PlaneGeometry(500, 40);
const mainRoad = new THREE.Mesh(mainRoadGeometry, roadMaterial);
mainRoad.rotation.x = Math.PI / 2;
mainRoad.position.z = 0; // center
mainRoad.position.y = 0.02; // slightly above others
scene.add(mainRoad);

// Create trees randomly across the city
for (let i = 0; i < 100; i++) {
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.2, 2);
  const trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);

  const leavesGeometry = new THREE.SphereGeometry(1.5, 8, 8);
  const leavesMaterial = new THREE.MeshBasicMaterial({ color: 0x228B22 });
  const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);

  const tree = new THREE.Group();
  tree.add(trunk);
  leaves.position.y = 2;
  tree.add(leaves);

  // Spread trees across the whole map
  tree.position.x = Math.random() * 400 - 200;
  tree.position.z = Math.random() * 400 - 200;
  tree.position.y = 0;

  scene.add(tree);
}

  
    
 // Create streetlights
for (let i = 0; i < 30; i++) { // create 30 streetlights
    // Pole
    const poleGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5);
    const poleMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc }); // light gray
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  
    // Lamp (small sphere)
    const lampGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // yellow
    const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
  
    // Group pole + lamp
    const streetlight = new THREE.Group();
    streetlight.add(pole);
    lamp.position.y = 2.7; // place lamp on top of pole
    streetlight.add(lamp);
  
    // Randomly position streetlights left or right of road
    const side = Math.random() > 0.5 ? 1 : -1;
    streetlight.position.x = side * (10 + Math.random() * 5); // 10–15 meters away from center
    streetlight.position.z = Math.random() * 500 - 250; // spread along the road
    streetlight.position.y = 2.5; // half of pole height
  
    scene.add(streetlight);
  }
  