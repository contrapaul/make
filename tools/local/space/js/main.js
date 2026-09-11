// Boot: screens, fixed-step game loop (60 Hz), camera rig, HUD, end flow.
import * as THREE from 'three';
import { wireScreens, showScreen, onScreen, showEnd, onEndButtons } from './screens.js';
import { createWorld } from './render/world.js';
import { createCameraRig } from './render/camera.js';
import { createInput } from './input.js';
import { createHud } from './render/hud.js';
import { createEffects } from './render/effects.js';
import { HULLS, TEAM_COLORS } from './data/hulls.js';
import { WEAPONS } from './data/weapons.js';
import { MAPS } from './data/maps.js';
import { createState, createShip, spawnJunk } from './sim/state.js';
import { spawnEnemies } from './sim/enemies.js';
import { step } from './sim/step.js';
import { summary } from './sim/stats.js';
import { loadShip } from './profile.js';

const TICK = 1 / 60;
const MAP = MAPS.skirmish;
// Seed chain: first game is the map seed (reproducible), every 'Again'/relaunch
// advances a deterministic LCG → same map, new seed.
let seed = MAP.seed;
const nextSeed = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);

let world = null;
let rig = null;
let input = null;
let hud = null;
let effects = null;
let state = null;
let raf = 0;
let lastT = 0;
let acc = 0;
let paused = false;
let overAt = 0;
let endShown = false;
let endRows = null;

const pauseEl = document.getElementById('pause');
pauseEl.querySelector('#pause-resume').addEventListener('click', () => setPaused(false));

function setPaused(p) {
  paused = p;
  pauseEl.hidden = !p;
  if (!p) lastT = performance.now();
}

function beginGame() {
  const profile = loadShip();
  const hull = HULLS[profile.hull] || HULLS.corvette;
  const s = seed;
  nextSeed();
  state = createState({ seed: s });
  const player = createShip(hull, {
    id: state.nextId++,
    team: 'blue',
    x: MAP.player.x,
    z: MAP.player.z,
    heading: MAP.player.heading,
    colors: profile.colors,
  });
  state.playerId = player.id;
  state.ships.push(player);
  spawnEnemies(state, MAP, hull);
  spawnJunk(state, MAP);
  hud = createHud(document.getElementById('hud'), hull, world.camera);
  input.sample(); // flush menu-time Esc/selection edges
  acc = 0;
  overAt = 0;
  endShown = false;
  endRows = null;
  lastT = performance.now();
  setPaused(false);
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dtReal = Math.min((now - lastT) / 1000, 0.25);
  lastT = now;
  const sample = input.sample();
  if (sample.pause) setPaused(!paused);
  if (!paused && !state.over) {
    acc += dtReal;
    while (acc >= TICK) {
      step(state, sample, TICK);
      acc -= TICK;
    }
    if (state.events.some((ev) => ev.kind === 'collision')) rig.shake();
  }
  const player = state.ships[0];
  rig.update(player, Math.max(dtReal, 1e-4));
  world.syncShips(state, sample.thrust);
  world.syncMissiles(state);
  world.syncChunks(state);
  effects.sync(state);
  hud.update(state, player);
  world.stars.position.copy(world.camera.position);
  world.speedStars.position.copy(world.camera.position);
  if (tuneLive) {
    tuneLive.ships = state.ships.filter((s) => s.alive).length;
    tuneLive.projectiles = state.projectiles.length;
    tuneLive.missiles = state.missiles.length;
    tuneLive.chunks = state.chunks.length;
  }
  world.renderer.render(world.scene, world.camera);

  // Game over: freeze the sim, hold 1.5 s (let wreckage tumble), then open
  // the stats dialog.
  if (state.over) {
    if (!overAt) {
      overAt = now;
      endRows = summary(state.stats);
    }
    if (now - overAt > 1500 && !endShown) {
      endShown = true;
      showEnd(state, endRows);
    }
  }
}

function start() {
  if (!world) {
    const canvas = document.getElementById('view');
    world = createWorld(THREE, canvas, TEAM_COLORS.blue);
    rig = createCameraRig(THREE, world.camera);
    rig.attach(canvas);
    const hull = HULLS[loadShip().hull] || HULLS.corvette;
    input = createInput(canvas, hull.hardpoints.map((hp) => hp.id));
    effects = createEffects(THREE, world.scene);
  }
  beginGame();
  world.resize();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

onEndButtons({
  again: start, // same map, new seed
  hangar: () => showScreen('hangar'),
});

// ?tune — live tuning panel (lil-gui), bound to the data objects. In-memory
// only: nothing here is persisted, and the sim stays pure/deterministic.
let tuneLive = null;
if (new URLSearchParams(location.search).has('tune')) {
  const { GUI } = await import('three/addons/libs/lil-gui.module.min.js');
  const gui = new GUI({ title: 'TUNE — not persisted' });
  const hull = HULLS.corvette;
  const hullF = gui.addFolder('corvette');
  hullF.add(hull, 'thrust', 50, 400, 5).name('thrust');
  hullF.add(hull, 'turnAccel', 0.5, 5, 0.1).name('turnAccel');
  hullF.add(hull, 'maxTurn', 0.2, 2, 0.05).name('maxTurn');
  hullF.add(hull, 'maxSpeed', 20, 200, 5).name('maxSpeed');
  hullF.add(hull, 'linearDamping', 0.1, 1, 0.01).name('linearDamping');
  hullF.add(hull, 'angularDamping', 0.5, 5, 0.1).name('angularDamping');
  hullF.add(hull, 'collisionK', 0.01, 0.3, 0.01).name('collisionK');
  for (const [name, wp] of Object.entries(WEAPONS)) {
    const f = gui.addFolder(name);
    f.add(wp, 'damage', 1, 500, 1).name('damage');
    if (wp.kind === 'gun') f.add(wp, 'rate', 1, 40, 1).name('rate (rounds/s)');
    else f.add(wp, 'reload', 0.2, 12, 0.1).name('reload (s)');
    f.add(wp, 'speed', 50, 600, 10).name('projSpeed');
    if (wp.range) f.add(wp, 'range', 100, 1000, 10).name('range');
  }
  tuneLive = { tick: '60 Hz · dt 1/60', ships: 0, projectiles: 0, missiles: 0, chunks: 0 };
  const liveF = gui.addFolder('live');
  liveF.add(tuneLive, 'tick').listen();
  liveF.add(tuneLive, 'ships').listen();
  liveF.add(tuneLive, 'projectiles').listen();
  liveF.add(tuneLive, 'missiles').listen();
  liveF.add(tuneLive, 'chunks').listen();
}

wireScreens();
showScreen('splash');
onScreen('game', start);
for (const name of ['splash', 'hangar', 'settings']) {
  onScreen(name, () => cancelAnimationFrame(raf));
}
