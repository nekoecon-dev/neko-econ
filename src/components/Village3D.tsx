'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GameState } from '@/types/game';
import {
  buildVillage,
  CAT_COLORS,
  DEFAULT_CAT_COLOR,
  makeCat,
  mapToWorld,
} from '@/lib/three/builders';

/** Interpolate an angle toward a target along the shortest arc. */
function approachAngle(current: number, target: number, t: number): number {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, t);
}

/**
 * The 3D village. A single Three.js scene rendered into a canvas, with an
 * Animal-Crossing-style 45° look-down camera. The React game state is mirrored
 * into a ref so the requestAnimationFrame loop can read the latest values
 * without re-running the (one-time) scene setup.
 */
export default function Village3D({ state }: { state: GameState }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);

  // Mirror the latest state for the animation loop (never re-init the scene).
  useEffect(() => {
    stateRef.current = state;
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

    // Soft daytime lighting: sky/ground hemisphere fill + a warm sun.
    const hemi = new THREE.HemisphereLight('#ffffff', '#6f9a3f', 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4d6', 1.1);
    sun.position.set(8, 16, 6);
    scene.add(sun);

    const village = buildVillage();
    scene.add(village);

    // Spawn one mesh per cat (ids are stable), each with a phase offset so
    // their idle bobbing isn't synchronised.
    const catLayer = new THREE.Group();
    const catMeshes = new Map<string, THREE.Group>();
    const catPhase = new Map<string, number>();
    stateRef.current.cats.forEach((cat, i) => {
      const mesh = makeCat(CAT_COLORS[cat.id] ?? DEFAULT_CAT_COLOR);
      const w = mapToWorld(cat.x, cat.y);
      mesh.position.set(w.x, 0, w.z);
      catMeshes.set(cat.id, mesh);
      catPhase.set(cat.id, i * 1.3);
      catLayer.add(mesh);
    });
    scene.add(catLayer);

    let raf = 0;
    const clock = new THREE.Clock();
    const render = () => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      for (const cat of stateRef.current.cats) {
        const mesh = catMeshes.get(cat.id);
        if (!mesh) continue;
        const phase = catPhase.get(cat.id) ?? 0;

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

        const prevX = mesh.position.x;
        const prevZ = mesh.position.z;
        // Sleeping cats walk slowly to a stop; others stroll at a normal pace.
        const moveRate = cat.action === 'sleeping' ? 0.6 : 2;
        mesh.position.x += (tx - prevX) * Math.min(1, dt * moveRate);
        mesh.position.z += (tz - prevZ) * Math.min(1, dt * moveRate);

        // Face the direction of travel.
        const vx = mesh.position.x - prevX;
        const vz = mesh.position.z - prevZ;
        if (Math.hypot(vx, vz) > 0.0008) {
          mesh.rotation.y = approachAngle(mesh.rotation.y, Math.atan2(vx, vz), dt * 5);
        }

        // Action animation: working bobs, sleeping rolls onto its side, eating
        // and idle gently sway.
        let targetY = 0;
        let targetRollZ = 0;
        switch (cat.action) {
          case 'working':
            targetY = Math.abs(Math.sin(t * 6 + phase)) * 0.18;
            break;
          case 'sleeping':
            targetY = -0.05;
            targetRollZ = Math.PI / 2;
            break;
          case 'eating':
            targetY = Math.sin(t * 3 + phase) * 0.04;
            break;
          default:
            targetY = Math.sin(t * 2 + phase) * 0.05;
        }
        mesh.position.y += (targetY - mesh.position.y) * Math.min(1, dt * 6);
        mesh.rotation.z += (targetRollZ - mesh.rotation.z) * Math.min(1, dt * 4);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    const onResize = () => {
      width = mount.clientWidth || 1;
      height = mount.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of materials) m.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}
