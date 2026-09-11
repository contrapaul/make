import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildScene } from './scene.js';
import { createClock, describe, planetPosition } from './sim.js';
import { setupPicking } from './pick.js';
import { setupUI } from './ui.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Perf guard: low-core machines get a lower pixel ratio.
const pixelRatio = navigator.hardwareConcurrency <= 4 ? 1.0 : 1.5;
renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatio));

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
camera.position.set(0, 20, 40);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 200;

const { scene, sun, planets, rings } = buildScene(THREE);
const clock = createClock();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion) clock.speed = 0.25;
const threeClock = new THREE.Clock();

export const app = { clock, scene, camera, renderer, controls };

// --- Selection / HUD -------------------------------------------------------
const hud = document.getElementById('hud');
const FOOTER = 'three.js r186 · procedural, no assets';
const DEFAULT_HUD = 'Click a planet · drag to orbit · scroll to zoom · ? for help';
const selection = { mesh: null };

function setHud(body) {
  hud.textContent = body + '\n' + FOOTER;
}
setHud(DEFAULT_HUD);

function select(mesh) {
  for (const m of planets.children) m.material.emissive.setHex(0x000000);
  selection.mesh = mesh;
  if (mesh) {
    mesh.material.emissive.setHex(mesh.userData.planet.color).multiplyScalar(0.5);
    setHud(describe(mesh.userData.planet));
  } else {
    setHud(DEFAULT_HUD);
  }
}

// --- Picking + UI ----------------------------------------------------------
const view = setupUI({ app, planetsGroup: planets, rings, select });
setupPicking({ renderer, camera, planetsGroup: planets, onSelect: select });

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function frame() {
  requestAnimationFrame(frame);
  const dt = threeClock.getDelta();
  clock.advance(dt);

  for (const mesh of planets.children) {
    const planet = mesh.userData.planet;
    const pos = planetPosition(planet, clock.t);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.rotation.y += dt * 0.5;
  }

  if (!reducedMotion) {
    sun.scale.setScalar(1 + 0.02 * Math.sin(clock.t * 2));
  }

  if (view.follow && selection.mesh) {
    controls.target.copy(selection.mesh.position);
  }
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
