'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CatAction, GameState, PolicyAction, Weather } from '@/types/game';
import { isFacilityKind } from '@/lib/engine/facilities';
import {
  buildVillage,
  CAT_STYLES,
  DEFAULT_CAT_STYLE,
  GROUND,
  makeCat,
  makeFacility,
  mapToWorld,
  worldToMap,
} from '@/lib/three/builders';

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
  headBaseY: number;
  phase: number;
  zzz: CSS2DObject;
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
// village transitions smoothly rather than snapping.
interface WeatherLook {
  sky: string;
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
    sky: '#bfe6ff',
    hemi: 0.95,
    sunInt: 1.1,
    sunColor: '#fff4d6',
    sunScale: 1,
    sunVisible: true,
    fog: '#cfecff',
    fogFar: 60,
  },
  boom: {
    sky: '#9fd8ff',
    hemi: 1.2,
    sunInt: 1.7,
    sunColor: '#fff0a8',
    sunScale: 1.4,
    sunVisible: true,
    fog: '#dff2ff',
    fogFar: 72,
  },
  hyperinflation: {
    sky: '#bd4a30',
    hemi: 0.7,
    sunInt: 1.35,
    sunColor: '#ff7a3c',
    sunScale: 1.6,
    sunVisible: true,
    fog: '#8f2f1e',
    fogFar: 40,
  },
  depression: {
    sky: '#8b94a1',
    hemi: 0.5,
    sunInt: 0.35,
    sunColor: '#b3bbc6',
    sunScale: 1,
    sunVisible: false,
    fog: '#828b98',
    fogFar: 30,
  },
};

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
}: {
  state: GameState;
  dispatch: (action: PolicyAction) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const dispatchRef = useRef(dispatch);

  // Mirror the latest state/dispatch for the loop + drop handler (the scene is
  // only set up once).
  useEffect(() => {
    stateRef.current = state;
    dispatchRef.current = dispatch;
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 1;
    let height = mount.clientHeight || 1;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#bfe6ff');

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
    const skyTarget = new THREE.Color();
    const sunColorTarget = new THREE.Color();
    const fogTarget = new THREE.Color();

    const village = buildVillage();
    scene.add(village);

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

      const { label, actionEl, moneyEl } = makeCatLabel(cat.name);
      group.add(label);

      // A 💤 puff shown only while sleeping.
      const zzzEl = document.createElement('div');
      zzzEl.className = 'cat-zzz';
      zzzEl.textContent = '💤';
      const zzz = new CSS2DObject(zzzEl);
      zzz.position.set(0.35, 1.5, 0);
      zzz.visible = false;
      group.add(zzz);

      catRuntimes.set(cat.id, {
        group,
        rig,
        head,
        tail,
        headBaseY: head.position.y,
        phase: i * 1.3,
        zzz,
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

    let raf = 0;
    const clock = new THREE.Clock();
    const render = () => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      const weather = stateRef.current.weather.current;

      // Ease the sky, sun and fog toward the current weather's look.
      const look = WEATHER_LOOK[weather];
      const k = Math.min(1, dt * 1.6);
      (scene.background as THREE.Color).lerp(skyTarget.set(look.sky), k);
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

        // Action animation, applied to the rig/head/tail (the outer group keeps
        // walking + turning, so the label stays upright above the cat):
        //  working  -> hops up/down + pitches forward (ピョコピョコ)
        //  sleeping -> rolls fully onto its side
        //  eating   -> dips its head toward the pot
        //  idle     -> sways gently while the tail swishes side to side
        let bobY = 0;
        let rollZ = 0;
        let pitchX = 0;
        let tailSwing = 0;
        let headDip = 0;
        switch (cat.action) {
          case 'working':
            bobY = Math.abs(Math.sin(t * 8 + phase)) * 0.16;
            pitchX = Math.sin(t * 8 + phase) * 0.18;
            break;
          case 'sleeping':
            bobY = -0.05;
            rollZ = Math.PI / 2;
            break;
          case 'eating':
            bobY = Math.sin(t * 3 + phase) * 0.03;
            headDip = -Math.abs(Math.sin(t * 5 + phase)) * 0.14;
            break;
          default:
            bobY = Math.sin(t * 2 + phase) * 0.05;
            tailSwing = Math.sin(t * 2.2 + phase) * 0.5;
        }
        rig.position.y += (bobY - rig.position.y) * Math.min(1, dt * 6);
        rig.rotation.z += (rollZ - rig.rotation.z) * Math.min(1, dt * 4);
        rig.rotation.x += (pitchX - rig.rotation.x) * Math.min(1, dt * 8);
        tail.rotation.y += (tailSwing - tail.rotation.y) * Math.min(1, dt * 5);
        head.position.y += (rt.headBaseY + headDip - head.position.y) * Math.min(1, dt * 8);

        // Zzz puff only while sleeping.
        rt.zzz.visible = cat.action === 'sleeping';

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
