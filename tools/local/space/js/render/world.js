// World: scene, camera, renderer, grid plane, star shell, entity meshes.
// Ships, missiles and chunks sync from state; meshes created on demand and
// removed when the entity is gone.
import { buildStars } from './stars.js';
import { buildShip, buildMissile, buildChunk } from './shipMesh.js';
import { HULLS, TEAM_COLORS } from '../data/hulls.js';
import { getSettings } from '../settings.js';

export function createWorld(THREE, canvas, defaultColors) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(getSettings().pixelRatio || Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  const ambient = new THREE.AmbientLight(0x8899bb, 0.8);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(1, 2, 0.5);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(60, 1, 1, 20000);
  camera.position.set(0, 160, 260);
  camera.lookAt(0, 0, 0);

  const grid = new THREE.GridHelper(2000, 40, 0x223355, 0x111a2e);
  grid.position.y = 0;
  scene.add(grid);

  const stars = buildStars(THREE, { count: 4000, rMin: 4000, rMax: 6000 });
  scene.add(stars);

  const shipMeshes = new Map();
  const syncShips = (state) => {
    const alive = new Set();
    for (const ship of state.ships) {
      if (!ship.alive) continue;
      alive.add(ship.id);
      let mesh = shipMeshes.get(ship.id);
      if (!mesh) {
        const hull = HULLS[ship.hull];
        const colors = ship.colors || TEAM_COLORS[ship.team] || defaultColors;
        mesh = buildShip(THREE, hull, colors);
        scene.add(mesh);
        shipMeshes.set(ship.id, mesh);
      }
      mesh.position.set(ship.x, 0, ship.z);
      mesh.rotation.y = -ship.heading;
      const mounts = mesh.userData.mounts;
      for (const id in mounts) {
        if (id === 'lance') continue; // near-static: ±5° arc, rotation not visible
        mounts[id].rotation.y = -ship.mounts[id].aim;
      }
    }
    for (const [id, mesh] of shipMeshes) {
      if (!alive.has(id)) {
        scene.remove(mesh);
        shipMeshes.delete(id);
      }
    }
  };

  const missileMeshes = new Map();
  const syncMissiles = (state) => {
    const alive = new Set();
    for (const m of state.missiles) {
      alive.add(m.id);
      let mesh = missileMeshes.get(m.id);
      if (!mesh) {
        mesh = buildMissile(THREE);
        scene.add(mesh);
        missileMeshes.set(m.id, mesh);
      }
      mesh.position.set(m.x, 0, m.z);
      mesh.rotation.y = -Math.atan2(m.vz, m.vx);
    }
    for (const [id, mesh] of missileMeshes) {
      if (!alive.has(id)) {
        scene.remove(mesh);
        missileMeshes.delete(id);
      }
    }
  };

  const chunkMeshes = new Map();
  const syncChunks = (state) => {
    const alive = new Set();
    for (const c of state.chunks) {
      alive.add(c.id);
      let mesh = chunkMeshes.get(c.id);
      if (!mesh) {
        mesh = buildChunk(THREE, c);
        scene.add(mesh);
        chunkMeshes.set(c.id, mesh);
      }
      mesh.position.set(c.x, 0, c.z);
      mesh.rotation.y = c.rot;
      mesh.rotation.x = c.rot * 0.6; // cheap tumble
    }
    for (const [id, mesh] of chunkMeshes) {
      if (!alive.has(id)) {
        scene.remove(mesh);
        chunkMeshes.delete(id);
      }
    }
  };

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(getSettings().pixelRatio || Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
  };
  resize();
  window.addEventListener('resize', resize);

  return { scene, camera, renderer, stars, resize, syncShips, syncMissiles, syncChunks };
}
