import * as THREE from 'three';
import type { FacilityKind } from '@/types/game';

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

/** Inverse of mapToWorld: world (x, z) back to a clamped 0..100 map (x, y). */
export function worldToMap(x: number, z: number): { x: number; y: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    x: clamp((x / MAP_HALF) * 50 + 50, 5, 90),
    y: clamp((z / MAP_HALF) * 50 + 50, 5, 85),
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

// Per-cat appearance: base coat, eye colour, fur pattern, and the secondary /
// tertiary colours that pattern uses. Keyed by cat id.
export type CatPattern = 'plain' | 'spotted' | 'calico' | 'tabby';
export interface CatStyle {
  coat: THREE.ColorRepresentation;
  eye: THREE.ColorRepresentation; // iris/sclera colour (pupil is always dark)
  pattern: CatPattern;
  secondary?: THREE.ColorRepresentation;
  tertiary?: THREE.ColorRepresentation;
}
export const CAT_STYLES: Record<string, CatStyle> = {
  '1': { coat: '#fcfdff', eye: '#2b2b2b', pattern: 'plain' }, // シロ: pure white
  '2': { coat: '#3b3f47', eye: '#ffd23f', pattern: 'plain' }, // クロ: dark grey + yellow eyes
  '3': { coat: '#fb923c', eye: '#2b2b2b', pattern: 'spotted', secondary: '#ffffff' }, // タマ: orange + white
  '4': {
    coat: '#fbf4ea',
    eye: '#2b2b2b',
    pattern: 'calico',
    secondary: '#f59330',
    tertiary: '#3a3a3a',
  }, // ミケ: white + orange + black (calico)
  '5': { coat: '#dd8a3e', eye: '#2b2b2b', pattern: 'tabby', secondary: '#9a5a26' }, // チャトラ: brown tabby
};
export const DEFAULT_CAT_STYLE: CatStyle = { coat: '#fcd34d', eye: '#2b2b2b', pattern: 'plain' };

/** A flattened "patch" of fur laid just over a surface (no z-fighting). */
function furPatch(
  color: THREE.ColorRepresentation,
  pos: [number, number, number],
  scale: [number, number, number],
): THREE.Mesh {
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), matte(color));
  patch.position.set(...pos);
  patch.scale.set(...scale);
  return patch;
}

/**
 * A low-poly cat facing +Z. The returned group's only child is a "rig" group
 * holding every body part (big head, tall pointed ears, expressive eyes, a long
 * curved tail) — the render loop bobs/rolls the rig while the outer group does
 * the walking and turning, and pattern decorations colour the fur.
 */
export function makeCat(style: CatStyle): THREE.Group {
  const cat = new THREE.Group();
  const rig = new THREE.Group();
  rig.name = 'rig';
  cat.add(rig);

  const coat = matte(style.coat);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.95), coat);
  body.position.y = 0.34;
  rig.add(body);

  // Head ~1.5x the body width (0.9 dia vs 0.62 body).
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), coat);
  head.name = 'head';
  head.position.set(0, 0.74, 0.42);
  rig.add(head);

  // Tall, sharply pointed ears.
  const earGeo = new THREE.ConeGeometry(0.16, 0.44, 4);
  const earL = new THREE.Mesh(earGeo, coat);
  earL.position.set(-0.23, 1.05, 0.4);
  earL.rotation.set(-0.1, 0, 0.14);
  rig.add(earL);
  const earR = new THREE.Mesh(earGeo, coat);
  earR.position.set(0.23, 1.05, 0.4);
  earR.rotation.set(-0.1, 0, -0.14);
  rig.add(earR);

  // Long curved tail (a tube swept along a rising S-curve).
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.4, -0.5),
    new THREE.Vector3(0, 0.75, -0.78),
    new THREE.Vector3(0.18, 1.05, -0.74),
    new THREE.Vector3(0.42, 1.18, -0.52),
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.075, 5, false), coat);
  tail.name = 'tail';
  rig.add(tail);

  // Eyes: a coloured sclera/iris disc with a dark pupil in front.
  const scleraGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const scleraMat = new THREE.MeshStandardMaterial({ color: style.eye });
  const pupilGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a' });
  for (const sx of [-0.17, 0.17]) {
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    sclera.position.set(sx, 0.78, 0.78);
    rig.add(sclera);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(sx, 0.78, 0.84);
    rig.add(pupil);
  }

  // Tiny pink nose.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 4), matte('#f7a8b8'));
  nose.position.set(0, 0.68, 0.86);
  nose.rotation.x = Math.PI / 2;
  rig.add(nose);

  // Fur pattern decorations.
  if (style.pattern === 'spotted' && style.secondary) {
    rig.add(furPatch(style.secondary, [0.06, 0.58, -0.12], [0.34, 0.12, 0.42]));
    rig.add(furPatch(style.secondary, [-0.2, 0.95, 0.42], [0.22, 0.2, 0.22]));
  } else if (style.pattern === 'calico') {
    if (style.secondary) {
      rig.add(furPatch(style.secondary, [0.22, 0.58, -0.05], [0.28, 0.14, 0.5]));
      rig.add(furPatch(style.secondary, [0.22, 0.92, 0.34], [0.22, 0.2, 0.24]));
    }
    if (style.tertiary) {
      rig.add(furPatch(style.tertiary, [-0.22, 0.6, 0.18], [0.26, 0.14, 0.4]));
      rig.add(furPatch(style.tertiary, [-0.2, 0.96, 0.36], [0.2, 0.18, 0.22]));
    }
  } else if (style.pattern === 'tabby' && style.secondary) {
    const stripeMat = matte(style.secondary);
    for (const sz of [0.18, -0.02, -0.22]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.07), stripeMat);
      stripe.position.set(0, 0.58, sz);
      rig.add(stripe);
    }
    // a stripe across the forehead too
    const browStripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.07), stripeMat);
    browStripe.position.set(0, 0.92, 0.5);
    rig.add(browStripe);
  }

  return cat;
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

/**
 * A low-poly building for a placed public-works facility:
 * - soupFactory: a grey factory box with a chimney
 * - matatabiPark: a small green patch with a tree and a sign
 * - fishingPond: a little blue pond with a wooden dock
 */
export function makeFacility(kind: FacilityKind): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'soupFactory') {
    const building = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.6), matte('#9aa3ad'));
    building.position.y = 0.65;
    group.add(building);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 1.7), matte('#6d7782'));
    roof.position.y = 1.4;
    group.add(roof);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.0, 8), matte('#5b636d'));
    chimney.position.set(0.5, 1.7, 0.4);
    group.add(chimney);
  } else if (kind === 'matatabiPark') {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1.6, 18), matte('#9bd36a'));
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = 0.04;
    group.add(patch);
    const tree = makeTree();
    tree.scale.setScalar(0.7);
    group.add(tree);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.08), matte('#3f9d4c'));
    sign.position.set(0.9, 0.7, 0.4);
    group.add(sign);
  } else {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 20),
      new THREE.MeshStandardMaterial({ color: '#3f97d6', roughness: 0.3 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.04;
    group.add(water);
    const dock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 1.4), matte('#8a5a2b'));
    dock.position.set(0.7, 0.16, 0);
    group.add(dock);
  }

  return group;
}

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
