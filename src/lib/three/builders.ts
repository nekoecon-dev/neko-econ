import * as THREE from 'three';
import type { FacilityKind, FurnitureKind, GatherKind } from '@/types/game';

// The playable ground is a GROUND x GROUND square centred on the origin (4x the
// original area). Cat / facility positions arrive as map percentages (0..100);
// mapToWorld converts them to world coordinates that stay inside the field.
export const GROUND = 48;
export const MAP_HALF = 20;

// One road grid tile is TILE world units across; cat/road cells snap to it.
export const TILE = 2;

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

// Matte = flat-shaded standard material (used for the scenery props).
function matte(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 });
}

// Toon = cel-shaded material, used for the cute cartoon cats.
function toon(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color });
}

// Unlit black, for crisp pupils / closed-eye crosses.
function ink(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: '#241c1c' });
}

/**
 * Wrap a mesh with a thick black cartoon outline: an inverted (back-side)
 * copy of the geometry, scaled up a touch, rendered behind the real mesh.
 */
function outlined(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  outlineScale = 1.08,
): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material));
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: '#241c1c', side: THREE.BackSide }),
  );
  outline.scale.setScalar(outlineScale);
  group.add(outline);
  return group;
}

/* ----------------------------- scenery ----------------------------- */

// A patchwork green palette for the grass vertex colours.
const GRASS = ['#7cc35a', '#74bd52', '#86cb63', '#6db04b', '#8ed06b'].map((c) => new THREE.Color(c));

/** Grassy ground: a subdivided plane tinted with random green patches. */
function makeGround(): THREE.Group {
  const group = new THREE.Group();

  const seg = 40;
  const geo = new THREE.PlaneGeometry(GROUND, GROUND, seg, seg);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = GRASS[Math.floor(Math.random() * GRASS.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const plane = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
  );
  plane.rotation.x = -Math.PI / 2;
  group.add(plane);

  // Scatter little darker-green grass tufts for texture.
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.4, 4);
  const tuftMat = matte('#5aa53f');
  for (let i = 0; i < 180; i++) {
    const tuft = new THREE.Mesh(tuftGeo, tuftMat);
    tuft.position.set((Math.random() - 0.5) * GROUND * 0.92, 0.18, (Math.random() - 0.5) * GROUND * 0.92);
    tuft.rotation.y = Math.random() * Math.PI;
    group.add(tuft);
  }

  return group;
}

/** A cute round tree: a short trunk topped with bulbous acorn-like foliage. */
export function makeTree(): THREE.Group {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.7, 7), matte('#9c6b3b'));
  trunk.position.y = 0.35;
  tree.add(trunk);

  const foliageMat = matte('#4fb35c');
  const big = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), foliageMat);
  big.position.y = 1.5;
  big.scale.set(1, 0.92, 1);
  tree.add(big);
  const small = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), matte('#5cc169'));
  small.position.set(0.3, 2.05, 0.1);
  tree.add(small);

  return tree;
}

/** A cottage: a cream box under a tall, steeply-pitched cute roof. */
export function makeHouse(roofColor: THREE.ColorRepresentation): THREE.Group {
  const house = new THREE.Group();

  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), matte('#f6e3b8'));
  walls.position.y = 0.7;
  house.add(walls);

  // Tall 4-sided cone = a steep pyramid roof.
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.9, 4), matte(roofColor));
  roof.position.y = 2.35;
  roof.rotation.y = Math.PI / 4;
  house.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.1), matte('#7c4a23'));
  door.position.set(0, 0.4, 0.92);
  house.add(door);

  return house;
}

// Cheerful flower-petal colours.
const FLOWER_COLORS: THREE.ColorRepresentation[] = ['#ff8fab', '#ffd23f', '#ffffff', '#b497ff', '#ff7a59'];

/** A tiny five-petal flower with a yellow centre. */
function makeFlower(color: THREE.ColorRepresentation): THREE.Group {
  const flower = new THREE.Group();
  const petalGeo = new THREE.SphereGeometry(0.09, 6, 6);
  const petalMat = matte(color);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(Math.cos(a) * 0.11, 0.12, Math.sin(a) * 0.11);
    petal.scale.set(1, 0.5, 1);
    flower.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), matte('#ffd23f'));
  center.position.y = 0.14;
  flower.add(center);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4), matte('#4f9d4c'));
  stem.position.y = 0.05;
  flower.add(stem);
  return flower;
}

/**
 * The village soup pot (its emotional symbol): a dark cylinder pot brimming
 * with an orange soup dome.
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

  const soup = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), matte('#e8842c'));
  soup.scale.y = 0.4;
  soup.position.y = 1.05;
  soup.name = 'soup';
  pot.add(soup);

  // A little cooking flame at the pot's base. Its scale is driven by life mode
  // (the fire grows once the shop opens / soup is made). Named 'potFire'.
  const fire = new THREE.Group();
  fire.name = 'potFire';
  const flameOuter = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.7, 8),
    new THREE.MeshBasicMaterial({ color: '#ff7a1a' }),
  );
  flameOuter.position.y = 0.35;
  fire.add(flameOuter);
  const flameInner = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.42, 8),
    new THREE.MeshBasicMaterial({ color: '#ffd23f' }),
  );
  flameInner.position.y = 0.28;
  fire.add(flameInner);
  fire.position.set(0, 0.05, 0.85);
  fire.scale.setScalar(0.001); // hidden until life mode grows it
  pot.add(fire);

  return pot;
}

/* --------------------------- spatial UI props --------------------------- */

/** A wooden signpost (two posts + a board). The board face is where a CSS2D
 *  label is anchored; `boardY` is the board's local height. */
export function makeSignpost(): THREE.Group {
  const sign = new THREE.Group();
  const postMat = matte('#8a5a2b');
  for (const px of [-0.5, 0.5]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), postMat);
    post.position.set(px, 0.8, 0);
    sign.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.1), matte('#b9823f'));
  board.position.y = 1.5;
  sign.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.94, 0.06), matte('#6b4423'));
  frame.position.set(0, 1.5, -0.03);
  sign.add(frame);
  return sign;
}

/** The ネコ銀行 building: a stone box with a pediment and coin emblem. */
export function makeBankBuilding(): THREE.Group {
  const bank = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 2.0), matte('#dfe3ea'));
  walls.position.y = 1.0;
  bank.add(walls);
  // columns
  const colMat = matte('#f2f4f8');
  for (const cx of [-0.9, -0.3, 0.3, 0.9]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 8), colMat);
    col.position.set(cx, 0.9, 1.05);
    bank.add(col);
  }
  // pediment (triangular roof)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 3), matte('#c2a76a'));
  roof.position.y = 2.45;
  roof.rotation.y = Math.PI / 2;
  bank.add(roof);
  // gold coin emblem
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16), matte('#f1c84b'));
  coin.position.set(0, 1.3, 1.06);
  coin.rotation.x = Math.PI / 2;
  bank.add(coin);
  return bank;
}

/** The 役場 (town hall): a brick box with a little clock tower. */
export function makeTownHall(): THREE.Group {
  const hall = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.0), matte('#e7c9a0'));
  walls.position.y = 0.9;
  hall.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.0, 4), matte('#7c8a5a'));
  roof.position.y = 2.3;
  roof.rotation.y = Math.PI / 4;
  hall.add(roof);
  // clock tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.7), matte('#efd9b8'));
  tower.position.set(0, 2.6, 0);
  hall.add(tower);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.7, 4), matte('#7c8a5a'));
  towerRoof.position.set(0, 3.55, 0);
  towerRoof.rotation.y = Math.PI / 4;
  hall.add(towerRoof);
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14), matte('#ffffff'));
  clock.position.set(0, 2.7, 0.36);
  clock.rotation.x = Math.PI / 2;
  hall.add(clock);
  return hall;
}

/**
 * A clickable policy lever: a base box with a tilting handle. The handle mesh
 * is named 'handle' so the render loop can tilt it to reflect the current value.
 */
export function makeLever(accent: THREE.ColorRepresentation): THREE.Group {
  const lever = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), matte('#6b4423'));
  base.position.y = 0.15;
  lever.add(base);
  const pivot = new THREE.Group();
  pivot.name = 'handle';
  pivot.position.y = 0.3;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8), matte('#9c6b3b'));
  stick.position.y = 0.45;
  pivot.add(stick);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), matte(accent));
  knob.position.y = 0.9;
  pivot.add(knob);
  lever.add(pivot);
  return lever;
}

/**
 * A three-column "thermometer" gauge board. Each column has a tube and a
 * coloured fill mesh (named fill0/fill1/fill2) whose vertical scale the render
 * loop drives from an economic metric.
 */
export function makeThermometers(): THREE.Group {
  const board = new THREE.Group();
  const H = 3;
  const cols: [number, THREE.ColorRepresentation][] = [
    [-1.1, '#ef5b5b'], // unemployment
    [0, '#f59e3b'], // inflation
    [1.1, '#9b6cf0'], // gini
  ];
  cols.forEach(([cx, color], i) => {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, H, 12),
      new THREE.MeshStandardMaterial({ color: '#eef1f6', transparent: true, opacity: 0.5 }),
    );
    tube.position.set(cx, H / 2 + 0.4, 0);
    board.add(tube);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), matte(color));
    bulb.position.set(cx, 0.4, 0);
    board.add(bulb);
    // fill grows upward from the bulb (geometry base at local y=0).
    const fillGeo = new THREE.CylinderGeometry(0.15, 0.15, 1, 10).translate(0, 0.5, 0);
    const fill = new THREE.Mesh(fillGeo, matte(color));
    fill.name = `fill${i}`;
    fill.position.set(cx, 0.5, 0);
    fill.scale.y = 0.02;
    board.add(fill);
  });
  // back panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 0.2), matte('#cfd6e0'));
  panel.position.set(0, 2.2, -0.3);
  board.add(panel);
  return board;
}

/* ------------------------------- cats ------------------------------- */

// Per-cat appearance: coat, big-eye colour, cheek colour, fur pattern, and the
// secondary / tertiary colours the pattern uses. Keyed by cat id.
export type CatPattern = 'plain' | 'belly' | 'calico' | 'tabby';
export interface CatStyle {
  coat: THREE.ColorRepresentation;
  eye: THREE.ColorRepresentation;
  cheek: THREE.ColorRepresentation;
  pattern: CatPattern;
  secondary?: THREE.ColorRepresentation;
  tertiary?: THREE.ColorRepresentation;
}
export const CAT_STYLES: Record<string, CatStyle> = {
  '1': { coat: '#fcfdff', eye: '#3aa0ff', cheek: '#ffb3c1', pattern: 'plain' }, // シロ: white, blue eyes
  '2': { coat: '#2f333b', eye: '#ffd23f', cheek: '#ffffff', pattern: 'plain' }, // クロ: black, yellow eyes
  '3': { coat: '#fb923c', eye: '#5bc46a', cheek: '#ffb3c1', pattern: 'belly', secondary: '#ffffff' }, // タマ: orange + white belly, green eyes
  '4': {
    coat: '#fbf4ea',
    eye: '#3aa0ff',
    cheek: '#ffb3c1',
    pattern: 'calico',
    secondary: '#f59330',
    tertiary: '#33312f',
  }, // ミケ: calico, blue eyes
  '5': { coat: '#b5793a', eye: '#f0a830', cheek: '#ffb3c1', pattern: 'tabby', secondary: '#7c4a23' }, // チャトラ: brown tabby, amber eyes
};
export const DEFAULT_CAT_STYLE: CatStyle = {
  coat: '#fcd34d',
  eye: '#3aa0ff',
  cheek: '#ffb3c1',
  pattern: 'plain',
};

/** One big round eye (white + coloured iris + dark pupil + shine). */
function makeEye(eyeColor: THREE.ColorRepresentation): THREE.Group {
  const eye = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), toon('#ffffff'));
  eye.add(white);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), toon(eyeColor));
  iris.position.z = 0.1;
  eye.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), ink());
  pupil.position.z = 0.16;
  eye.add(pupil);
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  );
  shine.position.set(0.05, 0.06, 0.2);
  eye.add(shine);
  return eye;
}

/** A closed "×" eye for sleeping (two crossed black bars). */
function makeClosedEye(): THREE.Group {
  const g = new THREE.Group();
  const barGeo = new THREE.BoxGeometry(0.22, 0.045, 0.045);
  for (const rot of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(barGeo, ink());
    bar.rotation.z = rot;
    g.add(bar);
  }
  return g;
}

/** A flattened patch of fur laid just over the coat (for spots/patches). */
function furPatch(
  color: THREE.ColorRepresentation,
  pos: [number, number, number],
  scale: [number, number, number],
): THREE.Mesh {
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), toon(color));
  patch.position.set(...pos);
  patch.scale.set(...scale);
  return patch;
}

/**
 * An Animal-Crossing-style deformed cat: an enormous head (~2x the tiny body),
 * short stubby legs, huge round eyes, big pointed ears, a pink nose, blush
 * cheeks, and a fluffy ball-chain tail. Cel-shaded with thick black outlines.
 *
 * Named parts the render loop animates: outer group (walk/turn), 'rig' (bob /
 * roll / hop), 'head' (turn / dip), 'tail' (swish), 'eyesOpen' / 'eyesClosed'
 * (toggle when sleeping), 'mouth' (パクパク while eating).
 */
export function makeCat(style: CatStyle): THREE.Group {
  const cat = new THREE.Group();
  const rig = new THREE.Group();
  rig.name = 'rig';
  cat.add(rig);

  const coatColor = style.coat;

  // Tiny rounded body.
  const body = outlined(new THREE.SphereGeometry(0.5, 16, 14), toon(coatColor));
  body.scale.set(0.72, 0.64, 0.8);
  body.position.y = 0.34;
  rig.add(body);

  // Short, fat legs.
  const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.18, 8);
  const legMat = toon(coatColor);
  for (const [lx, lz] of [
    [-0.18, 0.16],
    [0.18, 0.16],
    [-0.18, -0.16],
    [0.18, -0.16],
  ]) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.09, lz);
    rig.add(leg);
  }

  // Belly patch (タマ).
  if (style.pattern === 'belly' && style.secondary) {
    rig.add(furPatch(style.secondary, [0, 0.28, 0.28], [0.34, 0.34, 0.18]));
  } else if (style.pattern === 'calico') {
    if (style.secondary) rig.add(furPatch(style.secondary, [0.2, 0.42, 0.05], [0.26, 0.2, 0.34]));
    if (style.tertiary) rig.add(furPatch(style.tertiary, [-0.18, 0.5, -0.1], [0.24, 0.18, 0.3]));
  } else if (style.pattern === 'tabby' && style.secondary) {
    const stripeMat = toon(style.secondary);
    for (const sz of [0.16, -0.04, -0.22]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.06), stripeMat);
      stripe.position.set(0, 0.5, sz);
      rig.add(stripe);
    }
  }

  // Fluffy ball-chain tail.
  const tail = new THREE.Group();
  tail.name = 'tail';
  const tailPts: [number, number, number, number][] = [
    [0, 0.34, -0.42, 0.2],
    [0.12, 0.58, -0.6, 0.18],
    [0.28, 0.82, -0.62, 0.15],
    [0.44, 1.0, -0.48, 0.12],
  ];
  const tailMat = toon(coatColor);
  for (const [bx, by, bz, r] of tailPts) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), tailMat);
    ball.position.set(bx, by, bz);
    tail.add(ball);
  }
  rig.add(tail);

  // ---- The giant head (everything below is relative to the head centre) ----
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 0.92, 0.12);
  rig.add(head);

  const headBall = outlined(new THREE.SphereGeometry(0.58, 18, 16), toon(coatColor));
  head.add(headBall);

  // Tabby forehead stripes.
  if (style.pattern === 'tabby' && style.secondary) {
    const browMat = toon(style.secondary);
    for (const bx of [-0.16, 0, 0.16]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.06), browMat);
      brow.position.set(bx, 0.42, 0.42);
      head.add(brow);
    }
  } else if (style.pattern === 'calico' && style.tertiary) {
    head.add(furPatch(style.tertiary, [-0.26, 0.28, 0.32], [0.28, 0.28, 0.18]));
  }

  // Big pointed ears (outlined) with pink inner ears.
  for (const sx of [-1, 1]) {
    const ear = outlined(new THREE.ConeGeometry(0.26, 0.5, 4), toon(coatColor));
    ear.position.set(sx * 0.34, 0.52, 0.04);
    ear.rotation.z = sx * -0.18;
    head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), toon('#f7a8b8'));
    inner.position.set(sx * 0.34, 0.5, 0.12);
    inner.rotation.z = sx * -0.18;
    head.add(inner);
  }

  // Huge round eyes (open) + crossed eyes (closed, hidden until sleeping).
  const eyesOpen = new THREE.Group();
  eyesOpen.name = 'eyesOpen';
  const eyesClosed = new THREE.Group();
  eyesClosed.name = 'eyesClosed';
  eyesClosed.visible = false;
  for (const sx of [-1, 1]) {
    const eye = makeEye(style.eye);
    eye.position.set(sx * 0.24, 0.06, 0.46);
    eyesOpen.add(eye);
    const closed = makeClosedEye();
    closed.position.set(sx * 0.24, 0.06, 0.57);
    eyesClosed.add(closed);
  }
  head.add(eyesOpen, eyesClosed);

  // Blush cheeks.
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), toon(style.cheek));
    cheek.position.set(sx * 0.42, -0.14, 0.42);
    cheek.scale.set(1, 0.7, 0.5);
    head.add(cheek);
  }

  // Little pink nose.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon('#ff7a9c'));
  nose.position.set(0, -0.04, 0.58);
  nose.scale.set(1.2, 0.9, 0.8);
  head.add(nose);

  // Mouth (パクパク target while eating).
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), ink());
  mouth.name = 'mouth';
  mouth.position.set(0, -0.2, 0.54);
  mouth.scale.set(1, 0.5, 0.5);
  head.add(mouth);

  return cat;
}

/** たぬきち-style banker cat: a brown cat with a head leaf and a gold coin. */
export function makeBanker(): THREE.Group {
  const banker = makeCat({
    coat: '#8a6a44',
    eye: '#2b2b2b',
    cheek: '#e9d4b3',
    pattern: 'plain',
  });
  const head = banker.getObjectByName('head');
  if (head) {
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), toon('#efe2cd'));
    muzzle.position.set(0, -0.12, 0.46);
    muzzle.scale.set(0.34, 0.26, 0.16);
    head.add(muzzle);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 4), toon('#5cc169'));
    leaf.position.set(0, 0.66, 0);
    leaf.rotation.x = 0.3;
    head.add(leaf);
  }
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 14), toon('#f1c84b'));
  coin.position.set(0, 0.5, 0.42);
  coin.rotation.x = Math.PI / 2;
  banker.add(coin);
  banker.scale.setScalar(1.15);
  return banker;
}

/** The player's tent (shown while in debt). */
export function makePlayerTent(): THREE.Group {
  const tent = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.5, 4), matte('#e2762e'));
  body.position.y = 0.75;
  body.rotation.y = Math.PI / 4;
  tent.add(body);
  const door = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 3), matte('#7c2d12'));
  door.position.set(0, 0.5, 0.74);
  door.rotation.x = Math.PI;
  tent.add(door);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), matte('#6b4423'));
  pole.position.y = 1.6;
  tent.add(pole);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.02), matte('#ef4444'));
  flag.position.set(0.18, 1.72, 0);
  tent.add(flag);
  return tent;
}

/* ----------------------------- facilities ----------------------------- */

// Scenery spread across the larger (48x48) field.
const TREE_SPOTS: [number, number][] = [
  [-18, -15],
  [-14, 10],
  [16, -14],
  [15, 13],
  [-20, 4],
  [7, -18],
  [19, 7],
  [-9, 17],
  [11, 18],
  [18, -7],
  [-16, -7],
  [6, 14],
  [-21, 14],
  [21, -16],
];
const HOUSE_SPOTS: [number, number, THREE.ColorRepresentation][] = [
  [-11, 13, '#d9534f'],
  [13, -10, '#4f7fd9'],
  [10, 16, '#d99a4f'],
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

// Soft warm-grey palette for the cobblestones, so each stone reads slightly
// differently.
const COBBLE_COLORS = ['#c8c2b6', '#b9b2a4', '#d2ccc0', '#aea796'];

/**
 * A single cute 石畳 (cobblestone) road tile (TILE x TILE), laid flat on the
 * grass: a pale mortar base studded with a 3x3 grid of little rounded stones.
 */
export function makeRoadTile(): THREE.Group {
  const tile = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(TILE, 0.08, TILE),
    matte('#9a8f7d'), // mortar between the stones
  );
  base.position.y = 0.04;
  tile.add(base);

  const stoneGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const step = TILE / 3;
  let i = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const stone = new THREE.Mesh(stoneGeo, matte(COBBLE_COLORS[i % COBBLE_COLORS.length]));
      stone.position.set(
        (c - 1) * step + (((r + c) % 2) - 0.5) * 0.06,
        0.1,
        (r - 1) * step,
      );
      stone.scale.set(1, 0.42, 1); // flattened pebble
      tile.add(stone);
      i++;
    }
  }

  return tile;
}

/* --------------------------- life-mode props --------------------------- */

/** A gatherable item resting on the ground (mushroom / fish / wood / flower). */
export function makeGatherable(kind: GatherKind): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'mushroom') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 8), matte('#f3ead2'));
    stem.position.y = 0.15;
    g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), matte('#e0463a'));
    cap.scale.set(1, 0.66, 1);
    cap.position.y = 0.34;
    g.add(cap);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), matte('#fff7e6'));
      dot.position.set(Math.cos(a) * 0.16, 0.4, Math.sin(a) * 0.16);
      g.add(dot);
    }
  } else if (kind === 'fish') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), matte('#5fb6e6'));
    body.scale.set(1.5, 0.7, 0.5);
    body.position.y = 0.22;
    g.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 4), matte('#4aa0d6'));
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.4, 0.22, 0);
    g.add(tail);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), ink());
    eye.position.set(0.28, 0.27, 0.12);
    g.add(eye);
  } else if (kind === 'wood') {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 10), matte('#9c6b3b'));
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.16;
    g.add(log);
    for (const ex of [-0.35, 0.35]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 10), matte('#c79a5e'));
      cap.rotation.z = Math.PI / 2;
      cap.position.set(ex, 0.16, 0);
      g.add(cap);
    }
  } else {
    g.add(makeFlower(FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)]));
    g.scale.setScalar(1.6);
  }

  return g;
}

/** A piece of furniture the player buys at たぬきち's and places by their tent. */
export function makeFurniture(kind: FurnitureKind): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'chair') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), matte('#c77d4a'));
    seat.position.y = 0.4;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.12), matte('#b96d3c'));
    back.position.set(0, 0.65, -0.24);
    g.add(back);
    for (const [lx, lz] of [[-0.24, 0.24], [0.24, 0.24], [-0.24, -0.24], [0.24, -0.24]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), matte('#8a5a2b'));
      leg.position.set(lx, 0.2, lz);
      g.add(leg);
    }
  } else if (kind === 'lamp') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.1, 12), matte('#6b4423'));
    base.position.y = 0.05;
    g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), matte('#9c6b3b'));
    pole.position.y = 0.55;
    g.add(pole);
    const shade = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#ffe9a8' }),
    );
    shade.position.y = 1.1;
    g.add(shade);
  } else if (kind === 'rug') {
    const rug = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.9), matte('#d96d8a'));
    rug.position.y = 0.03;
    g.add(rug);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55), matte('#f2c14e'));
    inner.position.y = 0.05;
    g.add(inner);
  } else if (kind === 'plant') {
    const potMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.34, 10), matte('#c77d4a'));
    potMesh.position.y = 0.17;
    g.add(potMesh);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), matte('#4fb35c'));
    leaf.position.y = 0.55;
    g.add(leaf);
    const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), matte('#5cc169'));
    leaf2.position.set(0.16, 0.74, 0.06);
    g.add(leaf2);
  } else {
    // statue: a little stone cat on a pedestal
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), matte('#b9b2a4'));
    base.position.y = 0.15;
    g.add(base);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), matte('#cfc9bd'));
    body.scale.set(0.8, 0.9, 0.8);
    body.position.y = 0.5;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), matte('#cfc9bd'));
    head.position.y = 0.85;
    g.add(head);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), matte('#cfc9bd'));
      ear.position.set(sx * 0.13, 1.02, 0);
      g.add(ear);
    }
  }

  return g;
}

/** The player's own avatar: a cat with a jaunty green cap so it stands out. */
export function makePlayerCat(): THREE.Group {
  const cat = makeCat({ coat: '#9ad0ff', eye: '#2b6cb0', cheek: '#ffb3c1', pattern: 'plain' });
  const head = cat.getObjectByName('head');
  if (head) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), matte('#2fae6a'));
    cap.position.y = 0.5;
    head.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 14), matte('#258a55'));
    brim.position.set(0, 0.5, 0.16);
    head.add(brim);
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

/** Assemble the whole static village (ground, trees, houses, pond, pot, flowers). */
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
  pond.position.set(-10, 0.03, -13);
  village.add(pond);

  // Central plaza: a big stone disc under the giant soup pot.
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(6, 32),
    new THREE.MeshStandardMaterial({ color: '#d8cdb8', roughness: 1 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.03;
  village.add(plaza);

  const pot = makeSoupPot();
  pot.scale.setScalar(2.4); // 巨大スープ鍋
  pot.position.set(0, 0, 0);
  pot.name = 'soupPot';
  village.add(pot);

  // Scatter little flowers around the meadow (away from the central plaza).
  for (let i = 0; i < 64; i++) {
    const fx = (Math.random() - 0.5) * GROUND * 0.92;
    const fz = (Math.random() - 0.5) * GROUND * 0.92;
    if (Math.hypot(fx, fz) < 6.5) continue; // keep the plaza area clear
    const flower = makeFlower(FLOWER_COLORS[i % FLOWER_COLORS.length]);
    flower.position.set(fx, 0, fz);
    village.add(flower);
  }

  return village;
}
