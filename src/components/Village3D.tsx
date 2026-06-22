'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CatAction, FacilityKind, GameState, PolicyAction, Weather } from '@/types/game';
import { FACILITY_COST, isFacilityKind } from '@/lib/engine/facilities';
import { tickInterest } from '@/lib/engine/loan';
import { roadKey } from '@/lib/engine/roads';
import {
  buildVillage,
  CAT_STYLES,
  DEFAULT_CAT_STYLE,
  GROUND,
  makeBanker,
  makeBankBuilding,
  makeCat,
  makeFacility,
  makeFurniture,
  makeGatherable,
  makeHouse,
  makeLever,
  makePlayerCat,
  makePlayerTent,
  makeRoadTile,
  makeSignpost,
  makeThermometers,
  makeTownHall,
  mapToWorld,
  TILE,
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
  fish: CSS2DObject;
  aura: THREE.Points;
  bubbleObj: CSS2DObject;
  bubbleSecEl: HTMLElement;
  lastBubbleSec: number;
  actionEl: HTMLElement;
  detailObj: CSS2DObject; // money/info card, shown only when the cat is clicked
  detailMoneyEl: HTMLElement;
  lastLabel: string;
  lastMoney: number;
}

/**
 * Build the floating name label for a cat (name + a tiny action caption). The
 * money is intentionally NOT here — it only appears on the click detail card —
 * and the label sits high above the (now bigger) cat so the body stays clear.
 */
function makeCatLabel(name: string): { label: CSS2DObject; actionEl: HTMLElement } {
  const root = document.createElement('div');
  root.className = 'cat-label';
  const nameEl = document.createElement('div');
  nameEl.className = 'cat-label-name';
  nameEl.textContent = name;
  const actionEl = document.createElement('div');
  actionEl.className = 'cat-label-action';
  root.append(nameEl, document.createElement('br'), actionEl);
  const label = new CSS2DObject(root);
  label.position.set(0, 3.7, 0); // well above the 1.9x cat (top ≈ 3.2)
  return { label, actionEl };
}

/** A small detail card (name + money) shown only when a cat is clicked. */
function makeCatDetail(name: string): { obj: CSS2DObject; moneyEl: HTMLElement } {
  const root = document.createElement('div');
  root.className = 'cat-detail';
  const nameEl = document.createElement('div');
  nameEl.className = 'cat-detail-name';
  nameEl.textContent = name;
  const moneyEl = document.createElement('div');
  moneyEl.className = 'cat-detail-money';
  root.append(nameEl, moneyEl);
  const obj = new CSS2DObject(root);
  obj.position.set(0, 4.5, 0); // above the name label
  obj.visible = false;
  return { obj, moneyEl };
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
    fogFar: 130,
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
    fogFar: 150,
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
    fogFar: 90,
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
    fogFar: 70,
  },
};

// Life-mode skies: a gentle morning / day / evening cycle plus a grey rainy
// look. Keyed `rainy` or `sunny-<time>`.
// fogFar is kept short so the unopened outer districts mist out around the
// playable centre.
const LIFE_LOOKS: Record<string, WeatherLook> = {
  'sunny-morning': {
    skyTop: '#8fc7ff', skyBottom: '#ffe9d6', hemi: 1.0, sunInt: 1.0,
    sunColor: '#fff0cf', sunScale: 1.1, sunVisible: true, fog: '#d3deec', fogFar: 52,
  },
  'sunny-day': {
    skyTop: '#79b8ff', skyBottom: '#eaf6ff', hemi: 0.95, sunInt: 1.1,
    sunColor: '#fff4d6', sunScale: 1, sunVisible: true, fog: '#c9d9e8', fogFar: 54,
  },
  'sunny-evening': {
    skyTop: '#6a4ea0', skyBottom: '#ffb06a', hemi: 0.8, sunInt: 0.9,
    sunColor: '#ff9e57', sunScale: 1.5, sunVisible: true, fog: '#caa179', fogFar: 44,
  },
  rainy: {
    skyTop: '#6b7480', skyBottom: '#aeb8c2', hemi: 0.6, sunInt: 0.4,
    sunColor: '#b9c1cb', sunScale: 1, sunVisible: false, fog: '#8a94a0', fogFar: 38,
  },
};
function lifeLookKey(weather: 'sunny' | 'rainy', time: 'morning' | 'day' | 'evening'): string {
  return weather === 'rainy' ? 'rainy' : `sunny-${time}`;
}

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
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(160, 24, 16), material);
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
  pendingFacility,
  onPlaced,
  roadMode,
  onTalkMike = () => {},
  onTalkTanuki = () => {},
  onTalkTama = () => {},
}: {
  state: GameState;
  dispatch: (action: PolicyAction) => void;
  onOpenLoan: () => void;
  pendingFacility: FacilityKind | null;
  onPlaced: () => void;
  roadMode: boolean;
  onTalkMike?: () => void; // life mode: clicked ミケ
  onTalkTanuki?: () => void; // life mode: clicked たぬきち
  onTalkTama?: () => void; // life mode: clicked タマ
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const dispatchRef = useRef(dispatch);
  const onOpenLoanRef = useRef(onOpenLoan);
  const pendingRef = useRef(pendingFacility);
  const onPlacedRef = useRef(onPlaced);
  const roadModeRef = useRef(roadMode);
  const onTalkMikeRef = useRef(onTalkMike);
  const onTalkTanukiRef = useRef(onTalkTanuki);
  const onTalkTamaRef = useRef(onTalkTama);

  // Mirror the latest state/dispatch for the loop + drop handler (the scene is
  // only set up once).
  useEffect(() => {
    stateRef.current = state;
    dispatchRef.current = dispatch;
    onOpenLoanRef.current = onOpenLoan;
    pendingRef.current = pendingFacility;
    onPlacedRef.current = onPlaced;
    roadModeRef.current = roadMode;
    onTalkMikeRef.current = onTalkMike;
    onTalkTanukiRef.current = onTalkTanuki;
    onTalkTamaRef.current = onTalkTama;
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

    // 45° isometric-style look-down camera. Life mode zooms ~30% closer so the
    // village centre fills the frame; economy mode stays pulled back.
    const lifeBoot = stateRef.current.life.active;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 300);
    const camDist = lifeBoot ? 19 : 27;
    camera.position.set(camDist, camDist, camDist);
    camera.lookAt(0, 2, 0);

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
    sunDisc.position.set(-22, 26, -18);
    sunDisc.scale.setScalar(1.8);
    scene.add(sunDisc);

    // Life mode pulls the fog in close so the outer districts fade into mist —
    // they read as not-yet-opened areas around the playable centre.
    scene.fog = new THREE.Fog('#cfecff', lifeBoot ? 30 : 30, lifeBoot ? 52 : 130);

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
    // The soup pot + its cooking flame (life mode grows the fire / glows it).
    const soupPot = village.getObjectByName('soupPot') ?? null;
    const potFire = village.getObjectByName('potFire') ?? null;

    // ---- Spatial UI: info/controls embedded in 3D objects, refreshed each
    // frame by the `updaters` list (they read the latest state via stateRef). ----
    const updaters: Array<() => void> = [];

    // Soup price signboard by the central plaza (red when rising, green falling).
    const soupSign = makeSignpost();
    soupSign.position.set(5.5, 0, 5.5);
    soupSign.rotation.y = -0.7;
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
        const s = stateRef.current;
        const e = s.economy;
        if (e.soupPrice !== last) {
          val.textContent = `🍲 ${e.soupPrice} CC`;
          last = e.soupPrice;
        }
        val.style.color =
          e.inflationRate > 0 ? '#dc2626' : e.inflationRate < 0 ? '#16a34a' : '#1f2937';
        // Keep the opening screen minimal: the price label appears after the
        // tutorial (and never in life mode); the physical signpost stays.
        obj.visible = !s.tutorial.active && !s.life.active;
      });
    }

    // ネコ銀行 building + interest lever (left edge).
    const bank = makeBankBuilding();
    bank.position.set(-20, 0, -4);
    bank.rotation.y = 0.4;
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
      lever.position.set(-17.5, 0, -4);
      lever.rotation.y = 0.4;
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
        // The 金利 lever + rate panel stay hidden until the village unlocks
        // (level 2, granted at the tutorial's repayment).
        const unlocked = s.villageLevel >= 2;
        lever.visible = unlocked;
        obj.visible = unlocked;
        ctlObj.visible = unlocked;
      });
    }

    // 役場 (town hall) + tax lever + currency-issue button (right edge).
    const hall = makeTownHall();
    hall.position.set(20, 0, 2);
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
      lever.position.set(17.5, 0, 2);
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
        const s = stateRef.current;
        const r = s.policy.taxRate;
        if (r !== lastTax) {
          tax.textContent = `税率: ${r}%`;
          popJump(tax);
          if (handle) handle.rotation.z = -0.5 + (r / 50) * 1.0;
          lastTax = r;
        }
        // The whole 役場 (tax lever + 通貨発行) stays hidden until level 2.
        const unlocked = s.villageLevel >= 2;
        hall.visible = unlocked;
        lever.visible = unlocked;
        obj.visible = unlocked;
        ctlObj.visible = unlocked;
      });
    }

    // Inflation/economy "thermometer" gauges at the back of the field.
    const thermo = makeThermometers();
    thermo.position.set(0, 0, -21);
    scene.add(thermo);
    {
      const fills = [0, 1, 2].map((i) => thermo.getObjectByName(`fill${i}`) ?? null);
      const gaugeObjs: CSS2DObject[] = [];
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
        gaugeObjs.push(obj);
        return v;
      };
      const unV = makeGauge(-1.1, '😿失業');
      const inV = makeGauge(0, '📈インフレ');
      const giV = makeGauge(1.1, '⚖️格差');
      const H = 3;
      updaters.push(() => {
        const s = stateRef.current;
        const e = s.economy;
        if (fills[0]) fills[0].scale.y = clampNum(e.unemploymentRate / 100, 0.02, 1) * H;
        if (fills[1]) fills[1].scale.y = clampNum(e.inflationRate / 30, 0.02, 1) * H;
        if (fills[2]) fills[2].scale.y = clampNum(e.gini, 0.02, 1) * H;
        unV.textContent = `${e.unemploymentRate}%`;
        inV.textContent = `${e.inflationRate >= 0 ? '+' : ''}${e.inflationRate}%`;
        giV.textContent = e.gini.toFixed(2);
        // The economy gauges (インフレ etc.) are hidden until level 2.
        const unlocked = s.villageLevel >= 2;
        thermo.visible = unlocked;
        for (const g of gaugeObjs) g.visible = unlocked;
      });
    }

    // Player's dwelling (tent while in debt, house once paid off) + たぬきち
    // banker NPC that shows the loan balance and opens the repayment popup.
    const tent = makePlayerTent();
    tent.position.set(-20, 0, 8);
    scene.add(tent);
    const playerHouse = makeHouse('#dc2626');
    playerHouse.scale.setScalar(0.8);
    playerHouse.position.set(-20, 0, 8);
    playerHouse.visible = false;
    scene.add(playerHouse);

    const banker = makeBanker();
    banker.position.set(-17.4, 0, 8.5);
    banker.rotation.y = 2.4;
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
      obj.position.set(0, 4.6, 0); // clear of the bigger banker cat
      banker.add(obj);

      let lastLoan = -1;
      let lastInterest = -1;
      updaters.push(() => {
        const s = stateRef.current;
        const loanLeft = Math.round(s.player.loan);
        const paid = loanLeft <= 0;
        // Life mode: always the cosy tent (where furniture is placed), and the
        // banker's loan panel is hidden (たぬきち's shop is a React panel instead).
        tent.visible = s.life.active ? true : !paid;
        playerHouse.visible = s.life.active ? false : paid;
        obj.visible = !s.life.active;
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
        // During the tutorial the repayment is driven by the guided 返済 step, so
        // hide the banker's free 返済 button (the 借金残高 still shows on the map).
        // The 月利 line is also tutorial-noise, so hide it until unlocked.
        const tut = s.tutorial.active;
        row.style.display = tut ? 'none' : '';
        interestEl.style.display = tut ? 'none' : '';
      });
    }

    // Spawn one cat per id (stable), each with a phase offset (so idle bobbing
    // isn't synchronised), an HTML name label, and a floating Zzz puff. New cats
    // that join later (e.g. シロ after the tutorial repayment) are spawned
    // incrementally by the render loop via this same helper.
    const catLayer = new THREE.Group();
    const catRuntimes = new Map<string, CatRuntime>();
    let selectedCatId: string | null = null; // cat whose detail card is open
    const spawnCat = (cat: GameState['cats'][number], i: number) => {
      const group = makeCat(CAT_STYLES[cat.id] ?? DEFAULT_CAT_STYLE);
      const w = mapToWorld(cat.x, cat.y);
      group.position.set(w.x, 0, w.z);

      const rig = group.getObjectByName('rig') ?? group;
      const head = group.getObjectByName('head') ?? rig;
      const tail = group.getObjectByName('tail') ?? rig;
      const eyesOpen = group.getObjectByName('eyesOpen') ?? null;
      const eyesClosed = group.getObjectByName('eyesClosed') ?? null;
      const mouth = group.getObjectByName('mouth') ?? null;

      group.userData.catId = cat.id; // for click-to-select (detail card)
      group.renderOrder = 2; // cats draw over ground-level props

      const { label, actionEl } = makeCatLabel(cat.name);
      group.add(label);

      // Money/info card — hidden until the cat is clicked.
      const { obj: detailObj, moneyEl: detailMoneyEl } = makeCatDetail(cat.name);
      group.add(detailObj);

      // A 💤 puff shown only while sleeping.
      const zzzEl = document.createElement('div');
      zzzEl.className = 'cat-zzz';
      zzzEl.textContent = '💤';
      const zzz = new CSS2DObject(zzzEl);
      zzz.position.set(0.7, 3.4, 0);
      zzz.visible = false;
      group.add(zzz);

      // A spinning 💼 shown only while the cat is running a company.
      const bizEl = document.createElement('div');
      bizEl.className = 'cat-biz';
      bizEl.textContent = '💼';
      const biz = new CSS2DObject(bizEl);
      biz.position.set(0, 4.1, 0);
      biz.visible = false;
      group.add(biz);

      // A 🎣 shown when this cat is fishing at a nearby pond.
      const fishEl = document.createElement('div');
      fishEl.className = 'cat-fish';
      fishEl.textContent = '🎣';
      const fish = new CSS2DObject(fishEl);
      fish.position.set(0.8, 1.9, 0);
      fish.visible = false;
      group.add(fish);

      // Golden bubble aura (a ring of sparkles) + blinking "💰 BUBBLE!" label.
      const auraN = 26;
      const auraPos = new Float32Array(auraN * 3);
      for (let a = 0; a < auraN; a++) {
        const ang = (a / auraN) * Math.PI * 2;
        const r = 0.85 + Math.random() * 0.25;
        auraPos[a * 3] = Math.cos(ang) * r;
        auraPos[a * 3 + 1] = Math.random() * 1.4;
        auraPos[a * 3 + 2] = Math.sin(ang) * r;
      }
      const auraGeo = new THREE.BufferGeometry();
      auraGeo.setAttribute('position', new THREE.BufferAttribute(auraPos, 3));
      const aura = new THREE.Points(
        auraGeo,
        new THREE.PointsMaterial({
          color: '#ffd24a',
          size: 0.2,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      aura.position.y = 0.5;
      aura.visible = false;
      group.add(aura);

      const bubbleRoot = document.createElement('div');
      bubbleRoot.className = 'cat-bubble';
      const bubbleTitle = document.createElement('div');
      bubbleTitle.className = 'cat-bubble-title';
      bubbleTitle.textContent = '💰 BUBBLE!';
      const bubbleSecEl = document.createElement('div');
      bubbleSecEl.className = 'cat-bubble-sec';
      bubbleRoot.append(bubbleTitle, bubbleSecEl);
      const bubbleObj = new CSS2DObject(bubbleRoot);
      bubbleObj.position.set(0, 5.1, 0); // top of the stack: bubble → name → cat
      bubbleObj.visible = false;
      group.add(bubbleObj);

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
        fish,
        aura,
        bubbleObj,
        bubbleSecEl,
        lastBubbleSec: -1,
        actionEl,
        detailObj,
        detailMoneyEl,
        lastLabel: '',
        lastMoney: Number.NaN,
      });
      catLayer.add(group);
    };
    stateRef.current.cats.forEach((cat, i) => spawnCat(cat, i));
    scene.add(catLayer);

    // Placed public-works facilities are synced incrementally in the loop.
    const facilityLayer = new THREE.Group();
    scene.add(facilityLayer);
    const placedMeshes = new Map<string, THREE.Group>();

    // Laid road tiles (cobblestone groups), synced incrementally in the loop.
    const roadLayer = new THREE.Group();
    scene.add(roadLayer);
    const roadMeshes = new Map<string, THREE.Object3D>();

    // ---- Life mode: player avatar + gatherables + furniture + visitors -------
    const playerAvatar = makePlayerCat();
    {
      const w = mapToWorld(stateRef.current.life.playerX, stateRef.current.life.playerY);
      playerAvatar.position.set(w.x, 0, w.z);
    }
    playerAvatar.visible = stateRef.current.life.active;
    scene.add(playerAvatar);
    const playerRig = playerAvatar.getObjectByName('rig') ?? playerAvatar;
    let playerYaw = 0;
    let lastLifeFxId = 0; // last life.fx.id we played a one-shot effect for

    const itemLayer = new THREE.Group();
    scene.add(itemLayer);
    const itemMeshes = new Map<string, THREE.Group>();

    const furnitureLayer = new THREE.Group();
    scene.add(furnitureLayer);
    const furnitureMeshes = new Map<string, THREE.Group>();

    const visitorLayer = new THREE.Group();
    scene.add(visitorLayer);
    const visitorMeshes = new Map<string, THREE.Group>();

    // Dispose every geometry/material under a group.
    const disposeGroup = (g: THREE.Object3D) => {
      g.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) m.dispose();
        }
      });
    };

    // A short-lived burst of sparkle particles at a placement spot.
    interface Sparkle {
      points: THREE.Points;
      vel: Float32Array;
      life: number;
      max: number;
    }
    const sparkles: Sparkle[] = [];
    const spawnSparkle = (x: number, z: number) => {
      const n = 40;
      const pos = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = x;
        pos[i * 3 + 1] = 0.4;
        pos[i * 3 + 2] = z;
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 2;
        vel[i * 3] = Math.cos(a) * sp;
        vel[i * 3 + 1] = 2.5 + Math.random() * 2.5;
        vel[i * 3 + 2] = Math.sin(a) * sp;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: '#ffe14a',
        size: 0.35,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      sparkles.push({ points, vel, life: 1, max: 1 });
    };

    // Ghost preview of the facility being placed (follows the cursor).
    let ghost: THREE.Group | null = null;
    let ghostKind: FacilityKind | null = null;
    const pointerNDC = new THREE.Vector2();

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

    // Move the placement ghost to follow the cursor over the ground.
    const onPointerMove = (e: MouseEvent) => {
      if (!ghost) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        ghost.position.set(hitPoint.x, 0, hitPoint.z);
      }
    };
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // Click: in placement mode, drop the pending facility where clicked (with a
    // sparkle); otherwise, clicking the banker NPC opens the loan popup.
    const onCanvasClick = (e: MouseEvent) => {
      if (roadModeRef.current) return; // road mode handles its own press-drag
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);

      // Which cat (if any) was clicked — drives the click-only money detail card.
      const pickCatId = (): string | null => {
        const hit = raycaster.intersectObjects(catLayer.children, true)[0];
        if (!hit) return null;
        let node: THREE.Object3D | null = hit.object;
        while (node && node.parent !== catLayer) node = node.parent;
        return (node?.userData.catId as string | undefined) ?? null;
      };

      // ---- Life mode: gather / talk / place furniture / walk -----------------
      if (stateRef.current.life.active) {
        // 1) pick up a gatherable item
        const itemHit = raycaster.intersectObjects(itemLayer.children, true)[0];
        if (itemHit) {
          let node: THREE.Object3D | null = itemHit.object;
          while (node && node.parent !== itemLayer) node = node.parent;
          const id = node?.userData.itemId as string | undefined;
          if (id) {
            dispatchRef.current({ type: 'LIFE_GATHER', id });
            return;
          }
        }
        // 2) talk to ミケ (id '4'), タマ (id '3') or たぬきち (banker)
        const mike = catRuntimes.get('4')?.group;
        if (mike && raycaster.intersectObject(mike, true).length > 0) {
          selectedCatId = null;
          onTalkMikeRef.current();
          return;
        }
        const tama = catRuntimes.get('3')?.group;
        if (tama && raycaster.intersectObject(tama, true).length > 0) {
          selectedCatId = null;
          onTalkTamaRef.current();
          return;
        }
        if (raycaster.intersectObject(banker, true).length > 0) {
          selectedCatId = null;
          onTalkTanukiRef.current();
          return;
        }
        // 3) click another cat (タマ etc.) to peek at its detail card
        const lifeCatId = pickCatId();
        if (lifeCatId) {
          selectedCatId = selectedCatId === lifeCatId ? null : lifeCatId;
          return;
        }
        // 4) ground click: drop the held furniture, else walk the avatar there
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          selectedCatId = null;
          const map = worldToMap(hitPoint.x, hitPoint.z);
          if (stateRef.current.life.placing) {
            dispatchRef.current({ type: 'LIFE_PLACE_FURNITURE', x: map.x, y: map.y });
          } else {
            dispatchRef.current({ type: 'LIFE_MOVE', x: map.x, y: map.y });
          }
        }
        return;
      }

      const pending = pendingRef.current;
      if (pending) {
        if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
          const map = worldToMap(hitPoint.x, hitPoint.z);
          if (stateRef.current.player.cash >= FACILITY_COST[pending]) {
            // The sparkle is spawned by the placement-sync loop when the new
            // facility mesh appears, so every placement gets one.
            dispatchRef.current({ type: 'PLACE_FACILITY', kind: pending, x: map.x, y: map.y });
          }
          onPlacedRef.current();
        }
        return;
      }

      if (raycaster.intersectObject(banker, true).length > 0) {
        selectedCatId = null;
        onOpenLoanRef.current();
        return;
      }

      // Click a cat to open its money detail card (toggle); empty ground closes it.
      const clickedCatId = pickCatId();
      selectedCatId = clickedCatId && clickedCatId !== selectedCatId ? clickedCatId : null;
    };
    renderer.domElement.addEventListener('click', onCanvasClick);

    // Road laying: in road mode, press-and-drag over the ground to pave tiles
    // (snapped to the grid). A per-stroke key guard avoids redundant dispatches.
    let layingRoad = false;
    let lastRoadKey = '';
    const layRoadAt = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      const gx = Math.round(hitPoint.x / TILE);
      const gz = Math.round(hitPoint.z / TILE);
      const key = roadKey(gx, gz);
      if (key === lastRoadKey) return;
      lastRoadKey = key;
      dispatchRef.current({ type: 'LAY_ROAD', gx, gz });
    };
    const onRoadDown = (e: PointerEvent) => {
      if (!roadModeRef.current) return;
      layingRoad = true;
      lastRoadKey = '';
      layRoadAt(e.clientX, e.clientY);
    };
    const onRoadMove = (e: PointerEvent) => {
      if (!roadModeRef.current || !layingRoad) return;
      layRoadAt(e.clientX, e.clientY);
    };
    const onRoadUp = () => {
      layingRoad = false;
    };
    renderer.domElement.addEventListener('pointerdown', onRoadDown);
    renderer.domElement.addEventListener('pointermove', onRoadMove);
    window.addEventListener('pointerup', onRoadUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const render = () => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      const nowMs = Date.now();
      const life = stateRef.current.life;
      const weather = stateRef.current.weather.current;

      // Ease the sky, sun and fog toward the current look — life mode uses its
      // own morning/day/evening + rain cycle.
      const look = life.active
        ? LIFE_LOOKS[lifeLookKey(life.weather, life.time)]
        : WEATHER_LOOK[weather];
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

      // Weather particles: show + animate only the relevant cloud (life mode
      // only ever rains).
      confetti.visible = !life.active && weather === 'boom';
      rain.visible = life.active ? life.weather === 'rainy' : weather === 'depression';
      embers.visible = !life.active && weather === 'hyperinflation';
      if (confetti.visible) driftParticles(confetti, -dt * 2.2);
      if (rain.visible) driftParticles(rain, -dt * 9);
      if (embers.visible) driftParticles(embers, dt * 3);

      // Spawn a rig for any cat that has joined the village since setup (e.g.
      // シロ moving in after the tutorial repayment).
      for (const cat of stateRef.current.cats) {
        if (!catRuntimes.has(cat.id)) {
          spawnCat(cat, catRuntimes.size);
          const rt = catRuntimes.get(cat.id);
          if (rt) {
            const w = mapToWorld(cat.x, cat.y);
            rt.group.position.set(w.x, 0, w.z);
            spawnSparkle(w.x, w.z); // little welcome puff
          }
        }
      }

      // Add a mesh for any newly placed facility (with a celebratory sparkle).
      for (const p of stateRef.current.placements) {
        if (placedMeshes.has(p.id)) continue;
        const facility = makeFacility(p.kind);
        const w = mapToWorld(p.x, p.y);
        facility.position.set(w.x, 0, w.z);
        placedMeshes.set(p.id, facility);
        facilityLayer.add(facility);
        spawnSparkle(w.x, w.z);
      }

      // Sync laid road tiles, and build a lookup of paved cells for the cats.
      const roadSet = new Set<string>();
      for (const r of stateRef.current.roads) {
        const key = roadKey(r.gx, r.gz);
        roadSet.add(key);
        if (roadMeshes.has(key)) continue;
        const tile = makeRoadTile();
        tile.position.set(r.gx * TILE, 0.05, r.gz * TILE);
        roadMeshes.set(key, tile);
        roadLayer.add(tile);
      }

      // ---- Life mode: avatar + items + furniture + visitors + effects --------
      playerAvatar.visible = life.active;
      if (life.active) {
        // Sync gatherable items; a removed item (picked up) leaves a sparkle.
        const liveItemIds = new Set(life.items.map((i) => i.id));
        for (const [id, mesh] of itemMeshes) {
          if (!liveItemIds.has(id)) {
            spawnSparkle(mesh.position.x, mesh.position.z);
            itemLayer.remove(mesh);
            disposeGroup(mesh);
            itemMeshes.delete(id);
          }
        }
        for (const item of life.items) {
          if (itemMeshes.has(item.id)) continue;
          const mesh = makeGatherable(item.kind);
          const w = mapToWorld(item.x, item.y);
          mesh.position.set(w.x, 0, w.z);
          mesh.userData.itemId = item.id;
          itemMeshes.set(item.id, mesh);
          itemLayer.add(mesh);
        }
        // Gatherables bob + spin gently so they read as collectable.
        for (const mesh of itemMeshes.values()) {
          mesh.rotation.y += dt * 1.2;
          mesh.position.y = 0.45 + Math.sin(t * 2 + mesh.position.x) * 0.18;
        }

        // Sync placed furniture.
        for (const f of life.furniture) {
          if (furnitureMeshes.has(f.id)) continue;
          const mesh = makeFurniture(f.kind);
          const w = mapToWorld(f.x, f.y);
          mesh.position.set(w.x, 0, w.z);
          furnitureMeshes.set(f.id, mesh);
          furnitureLayer.add(mesh);
          spawnSparkle(w.x, w.z);
        }

        // Sync visiting cats (simple idle rigs that sway in place).
        for (const v of life.visitors) {
          if (visitorMeshes.has(v.id)) continue;
          const mesh = makeCat(DEFAULT_CAT_STYLE);
          const w = mapToWorld(v.x, v.y);
          mesh.position.set(w.x, 0, w.z);
          visitorMeshes.set(v.id, mesh);
          visitorLayer.add(mesh);
          spawnSparkle(w.x, w.z);
        }
        for (const mesh of visitorMeshes.values()) {
          mesh.rotation.y = Math.sin(t * 0.8 + mesh.position.x) * 0.5;
        }

        // Walk the avatar toward its target map spot, facing the travel dir.
        const target = mapToWorld(life.playerX, life.playerY);
        const px = playerAvatar.position.x;
        const pz = playerAvatar.position.z;
        const vx = target.x - px;
        const vz = target.z - pz;
        const dist = Math.hypot(vx, vz);
        if (dist > 0.05) {
          const step = Math.min(1, dt * 2.5);
          playerAvatar.position.x += vx * step;
          playerAvatar.position.z += vz * step;
          playerYaw = approachAngle(playerYaw, Math.atan2(vx, vz), dt * 6);
          playerRig.position.y = Math.abs(Math.sin(t * 9)) * 0.12; // little trot
        } else {
          playerRig.position.y += (0 - playerRig.position.y) * Math.min(1, dt * 6);
        }
        playerAvatar.rotation.y = playerYaw;

        // The pot fire grows with the shop / soups made.
        if (potFire) {
          const grow = life.shopOpen ? 1 : 0.0;
          const targetScale = grow * (0.7 + Math.min(life.soupsMade, 4) * 0.12);
          const flick = 1 + Math.sin(t * 12) * 0.08;
          const cur = potFire.scale.x;
          potFire.scale.setScalar(cur + (Math.max(0.001, targetScale * flick) - cur) * Math.min(1, dt * 4));
        }

        // One-shot celebration effects (soup glow / construction / fireworks).
        if (life.fx.id !== lastLifeFxId && life.fx.kind) {
          lastLifeFxId = life.fx.id;
          const w = mapToWorld(life.fx.x, life.fx.y);
          if (life.fx.kind === 'soup') {
            for (let s = 0; s < 3; s++) spawnSparkle(w.x + (Math.random() - 0.5) * 2, w.z + (Math.random() - 0.5) * 2);
          } else if (life.fx.kind === 'construct') {
            for (let s = 0; s < 4; s++) spawnSparkle(w.x + (Math.random() - 0.5) * 2.4, w.z + (Math.random() - 0.5) * 2.4);
          } else {
            // fireworks: bursts scattered across the plaza
            for (let s = 0; s < 8; s++) spawnSparkle((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
          }
        }
        // Soup pot gently glows/pulses for a moment after a soup effect.
        if (soupPot) {
          const since = life.fx.kind === 'soup' ? 1 : 0;
          const pulse = since ? 1 + Math.sin(t * 8) * 0.04 : 1;
          soupPot.scale.setScalar(2.4 * pulse); // 2.4 is the village's base pot scale
        }
      }

      // Rebuild the translucent placement ghost when the pending kind changes.
      const pendingKind = pendingRef.current;
      if (pendingKind !== ghostKind) {
        if (ghost) {
          scene.remove(ghost);
          disposeGroup(ghost);
          ghost = null;
        }
        if (pendingKind) {
          ghost = makeFacility(pendingKind);
          ghost.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              for (const m of mats) {
                m.transparent = true;
                m.opacity = 0.5;
              }
            }
          });
          scene.add(ghost);
        }
        ghostKind = pendingKind;
      }
      if (ghost) ghost.scale.setScalar(1 + Math.sin(t * 5) * 0.05);

      // Advance any sparkle bursts (gravity + fade), removing finished ones.
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i];
        sp.life -= dt;
        const attr = sp.points.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let j = 0; j < attr.count; j++) {
          sp.vel[j * 3 + 1] -= 6 * dt; // gravity
          attr.setX(j, attr.getX(j) + sp.vel[j * 3] * dt);
          attr.setY(j, Math.max(0, attr.getY(j) + sp.vel[j * 3 + 1] * dt));
          attr.setZ(j, attr.getZ(j) + sp.vel[j * 3 + 2] * dt);
        }
        attr.needsUpdate = true;
        (sp.points.material as THREE.PointsMaterial).opacity = Math.max(0, sp.life / sp.max);
        if (sp.life <= 0) {
          scene.remove(sp.points);
          disposeGroup(sp.points);
          sparkles.splice(i, 1);
        }
      }

      // Precompute facility influence on cats: collect facility world positions,
      // and pick the single nearest cat to each pond (it will go fishing). The
      // radius is 3 road tiles, matching the engine's AREA_BUFF_RADIUS.
      const REACTION_RADIUS = TILE * 3;
      const factories: { x: number; z: number }[] = [];
      const parks: { x: number; z: number }[] = [];
      const ponds: { x: number; z: number }[] = [];
      for (const p of stateRef.current.placements) {
        const w = mapToWorld(p.x, p.y);
        if (p.kind === 'soupFactory') factories.push(w);
        else if (p.kind === 'matatabiPark') parks.push(w);
        else ponds.push(w);
      }
      const fishingCats = new Set<string>();
      for (const pond of ponds) {
        let bestId: string | null = null;
        let bestD = Infinity;
        for (const c of stateRef.current.cats) {
          const cw = mapToWorld(c.x, c.y);
          const d = Math.hypot(cw.x - pond.x, cw.z - pond.z);
          if (d < bestD) {
            bestD = d;
            bestId = c.id;
          }
        }
        if (bestId) fishingCats.add(bestId);
      }

      const shiver = weather === 'depression';

      for (const cat of stateRef.current.cats) {
        const rt = catRuntimes.get(cat.id);
        if (!rt) continue;
        const { group, rig, head, tail, phase } = rt;
        const w = mapToWorld(cat.x, cat.y);

        // Facility reactions: a nearby soup factory puts idle cats to work and
        // pulls them toward it; a matatabi park makes cats spin happily; the
        // nearest cat to a pond goes fishing.
        const fishing = fishingCats.has(cat.id);
        let factoryPull: { x: number; z: number } | null = null;
        let happy = false;
        let labelText = ACTION_LABEL[cat.action];
        if (fishing) {
          labelText = '釣りするニャ';
        } else {
          let nearType: 'factory' | 'park' | null = null;
          let nearX = 0;
          let nearZ = 0;
          let nearD = REACTION_RADIUS;
          for (const f of factories) {
            const d = Math.hypot(w.x - f.x, w.z - f.z);
            if (d < nearD) {
              nearD = d;
              nearType = 'factory';
              nearX = f.x;
              nearZ = f.z;
            }
          }
          for (const pk of parks) {
            const d = Math.hypot(w.x - pk.x, w.z - pk.z);
            if (d < nearD) {
              nearD = d;
              nearType = 'park';
              nearX = pk.x;
              nearZ = pk.z;
            }
          }
          if (nearType === 'factory' && cat.action === 'idle') {
            factoryPull = { x: nearX, z: nearZ };
            labelText = 'はたらくニャ';
          } else if (nearType === 'park') {
            happy = true;
            labelText = 'しあわせニャ〜';
          }
        }

        // Target ground position: normally the cat's map spot, but when eating
        // it walks up to a ring around the soup pot, and a factory pulls idle
        // cats toward itself.
        let tx = w.x;
        let tz = w.z;
        if (cat.action === 'eating') {
          const len = Math.hypot(w.x, w.z) || 1;
          tx = (w.x / len) * 2.2;
          tz = (w.z / len) * 2.2;
        } else if (factoryPull) {
          tx = factoryPull.x;
          tz = factoryPull.z;
        }

        const prevX = group.position.x;
        const prevZ = group.position.z;
        // Sleeping cats walk slowly to a stop; others stroll at a normal pace —
        // and cats on a road move twice as fast.
        const onRoad = roadSet.has(roadKey(Math.round(w.x / TILE), Math.round(w.z / TILE)));
        const moveRate = (cat.action === 'sleeping' ? 0.6 : 2) * (onRoad ? 2 : 1);
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
        // Fishing: cast the "rod" by pitching up and down.
        if (fishing) pitchX = Math.sin(t * 6 + phase) * 0.25;

        rig.position.y += (breathing + bobY - rig.position.y) * Math.min(1, dt * 6);
        rig.rotation.z += (rollZ - rig.rotation.z) * Math.min(1, dt * 4);
        rig.rotation.x += (pitchX - rig.rotation.x) * Math.min(1, dt * 8);
        tail.rotation.y += (tailSwing - tail.rotation.y) * Math.min(1, dt * 5);
        head.rotation.y += (headTurn - head.rotation.y) * Math.min(1, dt * 4);
        head.position.y += (rt.headBaseY + headDip - head.position.y) * Math.min(1, dt * 8);
        if (rt.mouth) rt.mouth.scale.y += (mouthY - rt.mouth.scale.y) * Math.min(1, dt * 10);

        // Happy at a matatabi park: spin in place.
        if (happy) group.rotation.y += dt * 3.5;

        // Eyes: open normally, crossed (×) while sleeping.
        const asleep = cat.action === 'sleeping';
        if (rt.eyesOpen) rt.eyesOpen.visible = !asleep;
        if (rt.eyesClosed) rt.eyesClosed.visible = asleep;

        // Floating status emojis.
        rt.zzz.visible = asleep;
        rt.biz.visible = cat.company !== null;
        rt.fish.visible = fishing;

        // News-driven stock bubble: golden aura + blinking "💰 BUBBLE!" + countdown.
        const bub = stateRef.current.bubbles[cat.id];
        const bubbling = bub !== undefined && nowMs < bub.until;
        rt.aura.visible = bubbling;
        rt.bubbleObj.visible = bubbling;
        if (bubbling) {
          rt.aura.rotation.y += dt * 3;
          const sec = Math.max(0, Math.ceil((bub.until - nowMs) / 1000));
          if (sec !== rt.lastBubbleSec) {
            rt.bubbleSecEl.textContent = `残り${sec}秒`;
            rt.lastBubbleSec = sec;
          }
        }

        // Depression: cats shiver in the cold.
        if (shiver) {
          group.position.x += (Math.random() - 0.5) * 0.04;
          group.position.z += (Math.random() - 0.5) * 0.04;
        }

        // Refresh the label text only when it actually changes.
        if (rt.lastLabel !== labelText) {
          rt.actionEl.textContent = labelText;
          rt.lastLabel = labelText;
        }

        // Money detail card: only the clicked cat shows it (refreshed lazily).
        const selected = selectedCatId === cat.id;
        if (rt.detailObj.visible !== selected) rt.detailObj.visible = selected;
        if (selected) {
          const money = Math.round(cat.money);
          if (rt.lastMoney !== money) {
            rt.detailMoneyEl.textContent = `${money} CC`;
            rt.lastMoney = money;
          }
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
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onRoadDown);
      renderer.domElement.removeEventListener('pointermove', onRoadMove);
      window.removeEventListener('pointerup', onRoadUp);
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
