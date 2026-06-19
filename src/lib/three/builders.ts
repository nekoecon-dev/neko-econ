import * as THREE from 'three';

// The playable ground is a GROUND x GROUND square centred on the origin. Cat /
// facility positions arrive as map percentages (0..100); mapToWorld converts
// them to world coordinates that stay comfortably inside the field.
export const GROUND = 24;
export const MAP_HALF = 10;

/** Convert a 0..100 map percentage (x, y) to world (x, z) coordinates. */
export function mapToWorld(x: number, y: number): { x: number; z: number } {
  return {
    x: ((x - 50) / 50) * MAP_HALF,
    z: ((y - 50) / 50) * MAP_HALF,
  };
}

// Low-poly = flat shading + tiny segment counts. A shared helper keeps every
// material faceted and matte for the Animal-Crossing look.
function matte(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 });
}

/** Green grid grassland: a flat green plane with a darker grid overlaid. */
function makeGround(): THREE.Group {
  const group = new THREE.Group();

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND), matte('#7cc35a'));
  plane.rotation.x = -Math.PI / 2;
  group.add(plane);

  const grid = new THREE.GridHelper(GROUND, GROUND, '#5fa044', '#6bb14e');
  grid.position.y = 0.02;
  const gridMat = grid.material as THREE.Material;
  gridMat.transparent = true;
  gridMat.opacity = 0.5;
  group.add(grid);

  return group;
}

/** A single low-poly tree: a brown trunk topped by two green cones. */
export function makeTree(): THREE.Group {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 6), matte('#8a5a2b'));
  trunk.position.y = 0.45;
  tree.add(trunk);

  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.3, 7), matte('#3f9d4c'));
  lower.position.y = 1.35;
  tree.add(lower);

  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.1, 7), matte('#4fb35c'));
  upper.position.y = 2.05;
  tree.add(upper);

  return tree;
}

/** A cottage: a cream box with a pyramid roof and a little door. */
export function makeHouse(roofColor: THREE.ColorRepresentation): THREE.Group {
  const house = new THREE.Group();

  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), matte('#f6e3b8'));
  walls.position.y = 0.7;
  house.add(walls);

  // A 4-sided cone is a pyramid roof; rotate so the faces line up with the box.
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.1, 4), matte(roofColor));
  roof.position.y = 1.95;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.1), matte('#7c4a23'));
  door.position.set(0, 0.4, 0.92);
  house.add(door);

  return house;
}

/**
 * The village soup pot (its emotional symbol): a dark cylinder pot brimming
 * with an orange soup dome. Returned meshes are tagged so the render loop can
 * later recolour/scale the fire by economic mood.
 */
export function makeSoupPot(): THREE.Group {
  const pot = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 1.1, 12), matte('#3a3a40'));
  body.position.y = 0.55;
  pot.add(body);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 6, 16), matte('#55555c'));
  rim.position.y = 1.1;
  rim.rotation.x = Math.PI / 2;
  pot.add(rim);

  // Soup: a flattened sphere sitting in the pot's mouth.
  const soup = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), matte('#e8842c'));
  soup.scale.y = 0.4;
  soup.position.y = 1.05;
  soup.name = 'soup';
  pot.add(soup);

  return pot;
}

/** A still pond: a flat blue disc resting just above the grass. */
function makePond(): THREE.Mesh {
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 24),
    new THREE.MeshStandardMaterial({ color: '#4aa6e0', roughness: 0.3, metalness: 0.1 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.y = 0.03;
  return pond;
}

// Fixed scenery layout (deterministic — no Math.random, stable across reloads).
const TREE_SPOTS: [number, number][] = [
  [-9, -8],
  [-7, 6],
  [9, -7],
  [8, 7],
  [-10, 1],
  [4, -9],
  [10, 3],
];
const HOUSE_SPOTS: [number, number, THREE.ColorRepresentation][] = [
  [-6, -6, '#d9534f'],
  [6, -5, '#4f7fd9'],
  [-5, 7, '#d99a4f'],
];

/** Assemble the whole static village (ground, trees, houses, pond, soup pot). */
export function buildVillage(): THREE.Group {
  const village = new THREE.Group();
  village.add(makeGround());

  for (const [x, z] of TREE_SPOTS) {
    const tree = makeTree();
    tree.position.set(x, 0, z);
    village.add(tree);
  }

  for (const [x, z, color] of HOUSE_SPOTS) {
    const house = makeHouse(color);
    house.position.set(x, 0, z);
    village.add(house);
  }

  const pond = makePond();
  pond.position.set(-7, 0.03, -2);
  village.add(pond);

  const pot = makeSoupPot();
  pot.position.set(0, 0, 0);
  pot.name = 'soupPot';
  village.add(pot);

  return village;
}
