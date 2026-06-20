'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CatAction, GameState, PolicyAction, Weather } from '@/types/game';
import { isFacilityKind } from '@/lib/engine/facilities';
import { tickInterest } from '@/lib/engine/loan';
import {
  buildVillage,
  CAT_STYLES,
  DEFAULT_CAT_STYLE,
  GROUND,
  makeBanker,
  makeBankBuilding,
  makeCat,
  makeFacility,
  makeHouse,
  makeLever,
  makePlayerTent,
  makeSignpost,
  makeThermometers,
  makeTownHall,
  mapToWorld,
  worldToMap,
} from '@/lib/three/builders';

/** Clamp a number to [lo, hi]. */
function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** A click-through CSS2D control button (HTML, anchored in 3D). */
function ctlButton(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.className = `v3d-btn ${cls}`;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

/** Re-trigger the little "jump" pop animation on an element. */
function popJump(el: HTMLElement): void {
  el.classList.remove('v3d-jump');
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add('v3d-jump');
}

// Short Japanese caption per action, shown under each cat's name label.
const ACTION_LABEL: Record<CatAction, string> = {
  idle: 'ひま〜',
  working: 'はたらくニャ',
  sleeping: 'Zzz',
  eating: 'いただきます',
};

/** Per-cat runtime handles: the animated rig + cached parts and label DOM. */
interface CatRuntime {
  group: THREE.Group;
  rig: THREE.Object3D;
  head: THREE.Object3D;
  tail: THREE.Object3D;
  eyesOpen: THREE.Object3D | null;
  eyesClosed: THREE.Object3D | null;
  mouth: THREE.Object3D | null;
  headBaseY: number;
  phase: number;
  zzz: CSS2DObject;
  biz: CSS2DObject;
  actionEl: HTMLElement;
  moneyEl: HTMLElement;
  lastAction: CatAction | null;
  lastMoney: number;
}

/** Build the floating HTML label (name / action / money) for a cat. */
function makeCatLabel(name: string): {
  label: CSS2DObject;
  actionEl: HTMLElement;
  moneyEl: HTMLElement;
} {
  const root = document.createElement('div');
  root.className = 'cat-label';
  const nameEl = document.createElement('div');
  nameEl.className = 'cat-label-name';
  nameEl.textContent = name;
  const actionEl = document.createElement('div');
  actionEl.className = 'cat-label-action';
  const moneyEl = document.createElement('div');
  moneyEl.className = 'cat-label-money';
  root.append(nameEl, document.createElement('br'), actionEl, document.createElement('br'), moneyEl);
  const label = new CSS2DObject(root);
  label.position.set(0, 1.85, 0);
  return { label, actionEl, moneyEl };
}

/** Interpolate an angle toward a target along the shortest arc. */
function approachAngle(current: number, target: number, t: number): number {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, t);
}

// Per-weather lighting/atmosphere targets, lerped toward each frame so the
// village transitions smoothly rather than snapping. The sky is a vertical
// gradient (top -> bottom).
interface WeatherLook {
  skyTop: string;
  skyBottom: string;
  hemi: number; // hemisphere (ambient) intensity
  sunInt: number; // directional sun intensity
  sunColor: string;
  sunScale: number; // visible sun-disc size
  sunVisible: boolean;
  fog: string;
  fogFar: number;
}
const WEATHER_LOOK: Record<Weather, WeatherLook> = {
  normal: {
    skyTop: '#79b8ff',
    skyBottom: '#eaf6ff',
    hemi: 0.95,
    sunInt: 1.1,
    sunColor: '#fff4d6',
    sunScale: 1,
    sunVisible: true,
    fog: '#dcefff',
    fogFar: 60,
  },
  boom: {
    skyTop: '#5fb0ff',
    skyBottom: '#fff7d6',
    hemi: 1.2,
    sunInt: 1.7,
    sunColor: '#fff0a8',
    sunScale: 1.4,
    sunVisible: true,
    fog: '#eaf6ff',
    fogFar: 72,
  },
  hyperinflation: {
    skyTop: '#7c1d1d',
    skyBottom: '#ef8a45',
    hemi: 0.7,
    sunInt: 1.35,
    sunColor: '#ff7a3c',
    sunScale: 1.6,
    sunVisible: true,
    fog: '#8f2f1e',
    fogFar: 40,
  },
  depression: {
    skyTop: '#59616d',
    skyBottom: '#aab2bc',
    hemi: 0.5,
    sunInt: 0.35,
    sunColor: '#b3bbc6',
    sunScale: 1,
    sunVisible: false,
    fog: '#828b98',
    fogFar: 30,
  },
};

/** A big inverted sphere with a vertical gradient shader for the sky. */
function makeSkyDome(): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color('#79b8ff') },
      bottomColor: { value: new THREE.Color('#eaf6ff') },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vPos;
      void main() {
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, smoothstep(0.0, 1.0, h)), 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), material);
  return { mesh, material };
}

/** A cloud of falling/rising particles (confetti, rain, embers). */
function makeParticles(count: number, color: string, size: number, opacity: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * GROUND;
    positions[i * 3 + 1] = Math.random() * 14;
    positions[i * 3 + 2] = (Math.random() - 0.5) * GROUND;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  return points;
}

/** Animate a particle cloud vertically, wrapping it within the 0..14 band. */
function driftParticles(points: THREE.Points, dy: number): void {
  const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < attr.count; i++) {
    let y = attr.getY(i) + dy;
    if (y < 0) y += 14;
    else if (y > 14) y -= 14;
    attr.setY(i, y);
  }
  attr.needsUpdate = true;
}

/**
 * The 3D village. A single Three.js scene rendered into a canvas, with an
 * Animal-Crossing-style 45° look-down camera. The React game state is mirrored
 * into a ref so the requestAnimationFrame loop can read the latest values
 * without re-running the (one-time) scene setup.
 */
export default function Village3D({
  state,
  dispatch,
  onOpenLoan,
}: {
  state: GameState;
  dispatch: (action: PolicyAction) => void;
  onOpenLoan: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const dispatchRef = useRef(dispatch);
  const onOpenLoanRef = useRef(onOpenLoan);

  // Mirror the latest state/dispatch for the loop + drop handler (the scene is
  // only set up once).
  useEffect(() => {
    stateRef.current = state;
    dispatchRef.current = dispatch;
    onOpenLoanRef.current = onOpenLoan;
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 1;
    let height = mount.clientHeight || 1;

    const scene = new THREE.Scene();

    // Gradient sky dome (its colours are lerped by the weather each frame).
    const { mesh: skyDome, material: skyMat } = makeSkyDome();
    scene.add(skyDome);

    // 45° isometric-style look-down camera.
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);
    camera.position.set(13, 13, 13);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // cap for mobile
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    // Separate DOM layer for the cats' HTML name labels (CSS2DRenderer),
    // overlaid on the canvas and click-through.
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    mount.appendChild(labelRenderer.domElement);

    // Soft daytime lighting: sky/ground hemisphere fill + a warm sun.
    const hemi = new THREE.HemisphereLight('#ffffff', '#6f9a3f', 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4d6', 1.1);
    sun.position.set(8, 16, 6);
    scene.add(sun);

    // Visible sun disc (unlit) up in the sky.
    const sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ffe680' }),
    );
    sunDisc.position.set(-11, 12, -9);
    scene.add(sunDisc);

    scene.fog = new THREE.Fog('#cfecff', 12, 60);

    // Weather particle clouds (only the active one is shown + animated).
    const confetti = makeParticles(160, '#ffd54a', 0.3, 0.95); // boom
    const rain = makeParticles(320, '#a6bcd4', 0.12, 0.7); // depression
    const embers = makeParticles(120, '#ff7a3c', 0.22, 0.85); // hyperinflation
    scene.add(confetti, rain, embers);

    // Reusable scratch colours for per-frame lerping (no per-frame allocation).
    const skyTopTarget = new THREE.Color();
    const skyBottomTarget = new THREE.Color();
    const sunColorTarget = new THREE.Color();
    const fogTarget = new THREE.Color();

    const village = buildVillage();
    scene.add(village);

    // ---- Spatial UI: info/controls embedded in 3D objects, refreshed each
    // frame by the `updaters` list (they read the latest state via stateRef). ----
    const updaters: Array<() => void> = [];

    // Soup price signboard next to the pot (red when rising, green when falling).
    const soupSign = makeSignpost();
    soupSign.position.set(2.2, 0, 1.9);
    soupSign.rotation.y = -0.5;
    scene.add(soupSign);
    {
      const root = document.createElement('div');
      root.className = 'v3d-panel';
      const val = document.createElement('div');
      val.className = 'v3d-val';
      root.appendChild(val);
      const obj = new CSS2DObject(root);
      obj.position.set(0, 1.5, 0.12);
      soupSign.add(obj);
      let last = -1;
      updaters.push(() => {
        const e = stateRef.current.economy;
        if (e.soupPrice !== last) {
          val.textContent = `🍲 ${e.soupPrice} CC`;
          last = e.soupPrice;
        }
        val.style.color =
          e.inflationRate > 0 ? '#dc2626' : e.inflationRate < 0 ? '#16a34a' : '#1f2937';
      });
    }

    // ネコ銀行 building + interest lever.
    const bank = makeBankBuilding();
    bank.position.set(-9.5, 0, 4.2);
    bank.rotation.y = 0.5;
    scene.add(bank);
    {
      const root = document.createElement('div');
      root.className = 'v3d-panel';
      const title = document.createElement('div');
      title.className = 'v3d-title';
      title.textContent = '🏦 ネコ銀行';
      const rate = document.createElement('div');
      rate.className = 'v3d-val';
      const loan = document.createElement('div');
      loan.className = 'v3d-sub';
      root.append(title, rate, loan);
      const obj = new CSS2DObject(root);
      obj.position.set(0, 3.5, 0);
      bank.add(obj);

      const lever = makeLever('#10b981');
      lever.position.set(-9.3, 0, 6.4);
      lever.rotation.y = 0.5;
      scene.add(lever);
      const handle = lever.getObjectByName('handle') ?? null;
      const ctlRoot = document.createElement('div');
      ctlRoot.className = 'v3d-panel';
      const ctlTitle = document.createElement('div');
      ctlTitle.className = 'v3d-title';
      ctlTitle.textContent = '⚙️ 金利レバー';
      const row = document.createElement('div');
      row.className = 'v3d-btnrow';
      row.append(
        ctlButton('▼ -1%', 'v3d-btn-down', () =>
          dispatchRef.current({
            type: 'SET_INTEREST_RATE',
            value: clampNum(stateRef.current.policy.interestRate - 1, 0, 20),
          }),
        ),
        ctlButton('+1% ▲', 'v3d-btn-up', () =>
          dispatchRef.current({
            type: 'SET_INTEREST_RATE',
            value: clampNum(stateRef.current.policy.interestRate + 1, 0, 20),
          }),
        ),
      );
      ctlRoot.append(ctlTitle, row);
      const ctlObj = new CSS2DObject(ctlRoot);
      ctlObj.position.set(0, 1.7, 0);
      lever.add(ctlObj);

      let lastRate = -1;
      let lastLoan = '';
      updaters.push(() => {
        const s = stateRef.current;
        const r = s.policy.interestRate;
        if (r !== lastRate) {
          rate.textContent = `金利: ${r}%`;
          popJump(rate);
          if (handle) handle.rotation.z = -0.5 + (r / 20) * 1.0;
          lastRate = r;
        }
        const interest = tickInterest(s.player.loan, r);
        const txt = `ローン ${Math.round(s.player.loan)} / 利息 ${interest}`;
        if (txt !== lastLoan) {
          loan.textContent = txt;
          lastLoan = txt;
        }
      });
    }

    // 役場 (town hall) + tax lever + currency-issue button.
    const hall = makeTownHall();
    hall.position.set(9.5, 0, 4.2);
    hall.rotation.y = -0.5;
    scene.add(hall);
    {
      const root = document.createElement('div');
      root.className = 'v3d-panel';
      const title = document.createElement('div');
      title.className = 'v3d-title';
      title.textContent = '🏛️ 役場';
      const tax = document.createElement('div');
      tax.className = 'v3d-val';
      const row = document.createElement('div');
      row.className = 'v3d-btnrow';
      row.append(
        ctlButton('💴 +100CC', 'v3d-btn-cash', () =>
          dispatchRef.current({ type: 'ISSUE_CURRENCY', amount: 100 }),
        ),
      );
      root.append(title, tax, row);
      const obj = new CSS2DObject(root);
      obj.position.set(0, 4.2, 0);
      hall.add(obj);

      const lever = makeLever('#ef4444');
      lever.position.set(9.3, 0, 6.4);
      lever.rotation.y = -0.5;
      scene.add(lever);
      const handle = lever.getObjectByName('handle') ?? null;
      const ctlRoot = document.createElement('div');
      ctlRoot.className = 'v3d-panel';
      const ctlTitle = document.createElement('div');
      ctlTitle.className = 'v3d-title';
      ctlTitle.textContent = '⚙️ 税率レバー';
      const ctlrow = document.createElement('div');
      ctlrow.className = 'v3d-btnrow';
      ctlrow.append(
        ctlButton('▼ -5%', 'v3d-btn-down', () =>
          dispatchRef.current({
            type: 'SET_TAX_RATE',
            value: clampNum(stateRef.current.policy.taxRate - 5, 0, 50),
          }),
        ),
        ctlButton('+5% ▲', 'v3d-btn-up', () =>
          dispatchRef.current({
            type: 'SET_TAX_RATE',
            value: clampNum(stateRef.current.policy.taxRate + 5, 0, 50),
          }),
        ),
      );
      ctlRoot.append(ctlTitle, ctlrow);
      const ctlObj = new CSS2DObject(ctlRoot);
      ctlObj.position.set(0, 1.7, 0);
      lever.add(ctlObj);

      let lastTax = -1;
      updaters.push(() => {
        const r = stateRef.current.policy.taxRate;
        if (r !== lastTax) {
          tax.textContent = `税率: ${r}%`;
          popJump(tax);
          if (handle) handle.rotation.z = -0.5 + (r / 50) * 1.0;
          lastTax = r;
        }
      });
    }

    // Inflation/economy "thermometer" gauges at the back of the field.
    const thermo = makeThermometers();
    thermo.position.set(0, 0, -10);
    scene.add(thermo);
    {
      const fills = [0, 1, 2].map((i) => thermo.getObjectByName(`fill${i}`) ?? null);
      const makeGauge = (cx: number, title: string): HTMLElement => {
        const root = document.createElement('div');
        root.className = 'v3d-panel';
        const t = document.createElement('div');
        t.className = 'v3d-title';
        t.textContent = title;
        const v = document.createElement('div');
        v.className = 'v3d-val';
        root.append(t, v);
        const obj = new CSS2DObject(root);
        obj.position.set(cx, 4.0, 0);
        thermo.add(obj);
        return v;
      };
      const unV = makeGauge(-1.1, '😿失業');
      const inV = makeGauge(0, '📈インフレ');
      const giV = makeGauge(1.1, '⚖️格差');
      const H = 3;
      updaters.push(() => {
        const e = stateRef.current.economy;
        if (fills[0]) fills[0].scale.y = clampNum(e.unemploymentRate / 100, 0.02, 1) * H;
        if (fills[1]) fills[1].scale.y = clampNum(e.inflationRate / 30, 0.02, 1) * H;
        if (fills[2]) fills[2].scale.y = clampNum(e.gini, 0.02, 1) * H;
        unV.textContent = `${e.unemploymentRate}%`;
        inV.textContent = `${e.inflationRate >= 0 ? '+' : ''}${e.inflationRate}%`;
        giV.textContent = e.gini.toFixed(2);
      });
    }

    // Player's dwelling (tent while in debt, house once paid off) + たぬきち
    // banker NPC that shows the loan balance and opens the repayment popup.
    const tent = makePlayerTent();
    tent.position.set(-2.6, 0, 8.6);
    scene.add(tent);
    const playerHouse = makeHouse('#dc2626');
    playerHouse.scale.setScalar(0.7);
    playerHouse.position.set(-2.6, 0, 8.6);
    playerHouse.visible = false;
    scene.add(playerHouse);

    const banker = makeBanker();
    banker.position.set(-0.9, 0, 8.9);
    banker.rotation.y = 2.6;
    scene.add(banker);
    {
      const root = document.createElement('div');
      root.className = 'v3d-panel';
      const title = document.createElement('div');
      title.className = 'v3d-title';
      title.textContent = '🦝 ネコ銀行 たぬきち';
      const balance = document.createElement('div');
      balance.className = 'v3d-val';
      const interestEl = document.createElement('div');
      interestEl.className = 'v3d-sub';
      const row = document.createElement('div');
      row.className = 'v3d-btnrow';
      row.append(ctlButton('💰 返済する', 'v3d-btn-loan', () => onOpenLoanRef.current()));
      root.append(title, balance, interestEl, row);
      const obj = new CSS2DObject(root);
      obj.position.set(0, 2.4, 0);
      banker.add(obj);

      let lastLoan = -1;
      let lastInterest = -1;
      updaters.push(() => {
        const s = stateRef.current;
        const loanLeft = Math.round(s.player.loan);
        const paid = loanLeft <= 0;
        tent.visible = !paid;
        playerHouse.visible = paid;
        if (loanLeft !== lastLoan) {
          balance.textContent = paid ? '完済！マイホーム🎉' : `借金残高: ${loanLeft} CC`;
          balance.style.color = paid ? '#16a34a' : '#1f2937';
          lastLoan = loanLeft;
        }
        const interest = tickInterest(s.player.loan, s.policy.interestRate);
        if (interest !== lastInterest) {
          interestEl.textContent = paid ? '' : `月利: ${interest} CC`;
          // Jump + flash red when the interest climbs (e.g. the rate lever rises).
          if (interest > lastInterest && lastInterest >= 0) popJump(interestEl);
          interestEl.style.color = interest > 0 ? '#dc2626' : '#6b4423';
          lastInterest = interest;
        }
      });
    }

    // Spawn one cat per id (stable), each with a phase offset (so idle bobbing
    // isn't synchronised), an HTML name label, and a floating Zzz puff.
    const catLayer = new THREE.Group();
    const catRuntimes = new Map<string, CatRuntime>();
    stateRef.current.cats.forEach((cat, i) => {
      const group = makeCat(CAT_STYLES[cat.id] ?? DEFAULT_CAT_STYLE);
      const w = mapToWorld(cat.x, cat.y);
      group.position.set(w.x, 0, w.z);

      const rig = group.getObjectByName('rig') ?? group;
      const head = group.getObjectByName('head') ?? rig;
      const tail = group.getObjectByName('tail') ?? rig;
      const eyesOpen = group.getObjectByName('eyesOpen') ?? null;
      const eyesClosed = group.getObjectByName('eyesClosed') ?? null;
      const mouth = group.getObjectByName('mouth') ?? null;

      const { label, actionEl, moneyEl } = makeCatLabel(cat.name);
      group.add(label);

      // A 💤 puff shown only while sleeping.
      const zzzEl = document.createElement('div');
      zzzEl.className = 'cat-zzz';
      zzzEl.textContent = '💤';
      const zzz = new CSS2DObject(zzzEl);
      zzz.position.set(0.4, 1.7, 0);
      zzz.visible = false;
      group.add(zzz);

      // A spinning 💼 shown only while the cat is running a company.
      const bizEl = document.createElement('div');
      bizEl.className = 'cat-biz';
      bizEl.textContent = '💼';
      const biz = new CSS2DObject(bizEl);
      biz.position.set(0, 2.35, 0);
      biz.visible = false;
      group.add(biz);

      catRuntimes.set(cat.id, {
        group,
        rig,
        head,
        tail,
        eyesOpen,
        eyesClosed,
        mouth,
        headBaseY: head.position.y,
        phase: i * 1.3,
        zzz,
        biz,
        actionEl,
        moneyEl,
        lastAction: null,
        lastMoney: Number.NaN,
      });
      catLayer.add(group);
    });
    scene.add(catLayer);

    // Placed public-works facilities are synced incrementally in the loop.
    const facilityLayer = new THREE.Group();
    scene.add(facilityLayer);
    const placedMeshes = new Map<string, THREE.Group>();

    // Drag-and-drop: a building card dropped from the panel raycasts the ground
    // to find where it landed, then dispatches PLACE_FACILITY at that map spot.
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    const hitPoint = new THREE.Vector3();
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer?.getData('text/plain');
      if (!kind || !isFacilityKind(kind)) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      const map = worldToMap(hitPoint.x, hitPoint.z);
      dispatchRef.current({ type: 'PLACE_FACILITY', kind, x: map.x, y: map.y });
    };
    mount.addEventListener('dragover', onDragOver);
    mount.addEventListener('drop', onDrop);

    // Click the banker NPC to open the loan repayment popup.
    const onCanvasClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.intersectObject(banker, true).length > 0) {
        onOpenLoanRef.current();
      }
    };
    renderer.domElement.addEventListener('click', onCanvasClick);

    let raf = 0;
    const clock = new THREE.Clock();
    const render = () => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      const weather = stateRef.current.weather.current;

      // Ease the sky, sun and fog toward the current weather's look.
      const look = WEATHER_LOOK[weather];
      const k = Math.min(1, dt * 1.6);
      skyMat.uniforms.topColor.value.lerp(skyTopTarget.set(look.skyTop), k);
      skyMat.uniforms.bottomColor.value.lerp(skyBottomTarget.set(look.skyBottom), k);
      scene.fog?.color.lerp(fogTarget.set(look.fog), k);
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.far += (look.fogFar - scene.fog.far) * k;
      }
      hemi.intensity += (look.hemi - hemi.intensity) * k;
      sun.intensity += (look.sunInt - sun.intensity) * k;
      sun.color.lerp(sunColorTarget.set(look.sunColor), k);
      const sunMat = sunDisc.material as THREE.MeshBasicMaterial;
      sunMat.color.lerp(sunColorTarget, k);
      sunDisc.visible = look.sunVisible;
      const scale = sunDisc.scale.x + (look.sunScale - sunDisc.scale.x) * k;
      sunDisc.scale.setScalar(scale);

      // Weather particles: show + animate only the relevant cloud.
      confetti.visible = weather === 'boom';
      rain.visible = weather === 'depression';
      embers.visible = weather === 'hyperinflation';
      if (confetti.visible) driftParticles(confetti, -dt * 2.2);
      if (rain.visible) driftParticles(rain, -dt * 9);
      if (embers.visible) driftParticles(embers, dt * 3);

      // Add a mesh for any newly placed facility.
      for (const p of stateRef.current.placements) {
        if (placedMeshes.has(p.id)) continue;
        const facility = makeFacility(p.kind);
        const w = mapToWorld(p.x, p.y);
        facility.position.set(w.x, 0, w.z);
        placedMeshes.set(p.id, facility);
        facilityLayer.add(facility);
      }

      const shiver = weather === 'depression';

      for (const cat of stateRef.current.cats) {
        const rt = catRuntimes.get(cat.id);
        if (!rt) continue;
        const { group, rig, head, tail, phase } = rt;

        // Target ground position: normally the cat's map spot, but when eating
        // it walks up to a ring around the central soup pot.
        const w = mapToWorld(cat.x, cat.y);
        let tx = w.x;
        let tz = w.z;
        if (cat.action === 'eating') {
          const len = Math.hypot(w.x, w.z) || 1;
          tx = (w.x / len) * 2.2;
          tz = (w.z / len) * 2.2;
        }

        const prevX = group.position.x;
        const prevZ = group.position.z;
        // Sleeping cats walk slowly to a stop; others stroll at a normal pace.
        const moveRate = cat.action === 'sleeping' ? 0.6 : 2;
        group.position.x += (tx - prevX) * Math.min(1, dt * moveRate);
        group.position.z += (tz - prevZ) * Math.min(1, dt * moveRate);

        // Face the direction of travel.
        const vx = group.position.x - prevX;
        const vz = group.position.z - prevZ;
        if (Math.hypot(vx, vz) > 0.0008) {
          group.rotation.y = approachAngle(group.rotation.y, Math.atan2(vx, vz), dt * 5);
        }

        // Constant gentle "breathing" bob on top of the action animation.
        const breathing = Math.sin(t * 1.6 + phase) * 0.03;

        // Action animation, applied to the rig/head/tail (the outer group keeps
        // walking + turning, so the label stays upright above the cat):
        //  working  -> bounces up and down (ぴょんぴょん)
        //  sleeping -> rolls onto its side, eyes become × , 💤 rises
        //  eating   -> dips its head + works its mouth (パクパク)
        //  idle     -> looks around (キョロキョロ) and swishes the tail
        let bobY = 0;
        let rollZ = 0;
        let pitchX = 0;
        let tailSwing = 0;
        let headTurn = 0;
        let headDip = 0;
        let mouthY = 0.5; // resting mouth scale
        switch (cat.action) {
          case 'working':
            bobY = Math.abs(Math.sin(t * 9 + phase)) * 0.24;
            pitchX = Math.sin(t * 9 + phase) * 0.1;
            break;
          case 'sleeping':
            bobY = -0.06;
            rollZ = Math.PI / 2;
            break;
          case 'eating':
            bobY = Math.sin(t * 3 + phase) * 0.02;
            headDip = -Math.abs(Math.sin(t * 5 + phase)) * 0.14;
            mouthY = 0.5 + Math.abs(Math.sin(t * 9 + phase)) * 1.0;
            break;
          default:
            bobY = Math.sin(t * 2 + phase) * 0.04;
            tailSwing = Math.sin(t * 2.2 + phase) * 0.5;
            headTurn = Math.sin(t * 1.1 + phase) * 0.5;
        }
        rig.position.y += (breathing + bobY - rig.position.y) * Math.min(1, dt * 6);
        rig.rotation.z += (rollZ - rig.rotation.z) * Math.min(1, dt * 4);
        rig.rotation.x += (pitchX - rig.rotation.x) * Math.min(1, dt * 8);
        tail.rotation.y += (tailSwing - tail.rotation.y) * Math.min(1, dt * 5);
        head.rotation.y += (headTurn - head.rotation.y) * Math.min(1, dt * 4);
        head.position.y += (rt.headBaseY + headDip - head.position.y) * Math.min(1, dt * 8);
        if (rt.mouth) rt.mouth.scale.y += (mouthY - rt.mouth.scale.y) * Math.min(1, dt * 10);

        // Eyes: open normally, crossed (×) while sleeping.
        const asleep = cat.action === 'sleeping';
        if (rt.eyesOpen) rt.eyesOpen.visible = !asleep;
        if (rt.eyesClosed) rt.eyesClosed.visible = asleep;

        // Floating status emojis.
        rt.zzz.visible = asleep;
        rt.biz.visible = cat.company !== null;

        // Depression: cats shiver in the cold.
        if (shiver) {
          group.position.x += (Math.random() - 0.5) * 0.04;
          group.position.z += (Math.random() - 0.5) * 0.04;
        }

        // Refresh the label text only when it actually changes.
        if (rt.lastAction !== cat.action) {
          rt.actionEl.textContent = ACTION_LABEL[cat.action];
          rt.lastAction = cat.action;
        }
        const money = Math.round(cat.money);
        if (rt.lastMoney !== money) {
          rt.moneyEl.textContent = `${money} CC`;
          rt.lastMoney = money;
        }
      }

      // Refresh all the embedded spatial-UI labels/gauges.
      for (const u of updaters) u();

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    const onResize = () => {
      width = mount.clientWidth || 1;
      height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      labelRenderer.setSize(width, height);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      mount.removeEventListener('dragover', onDragOver);
      mount.removeEventListener('drop', onDrop);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of materials) m.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      if (labelRenderer.domElement.parentNode === mount) {
        mount.removeChild(labelRenderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="relative h-full w-full" />;
}
