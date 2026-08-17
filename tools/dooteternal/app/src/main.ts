import * as THREE from 'three';
import level01 from '../levels/level_01.json';
import level02 from '../levels/level_02.json';
import { CameraRig } from './core/CameraRig';
import { CollisionSystem } from './core/CollisionSystem';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { preloadImages } from './core/ImageAssets';
import { buildLevel, type LevelData } from './core/LevelLoader';
import { keyColor } from './core/PlaceholderAssets';
import { PlayerController } from './core/PlayerController';
import { BREATH, PLAYER } from './data/constants';
import { AudioManager, BREATH_LOOP_FILE, BREATH_LOOP_ID } from './systems/AudioManager';
import { BlastSystem } from './systems/BlastSystem';
import { BreathSystem } from './systems/BreathSystem';
import { DecalSystem } from './systems/DecalSystem';
import { DoorKeySystem } from './systems/DoorKeySystem';
import { EnemySystem } from './systems/EnemySystem';
import { OverworldMap } from './systems/OverworldMap';
import { ParticleSystem } from './systems/ParticleSystem';
import { PauseMenu } from './systems/PauseMenu';
import { PlayerHealth } from './systems/PlayerHealth';
import { completeLevel } from './systems/Progress';
import { ProjectileSystem, type PlayerTarget } from './systems/ProjectileSystem';
import { browserStorage, SaveSystem, type LevelState } from './systems/SaveSystem';
import { ViewModel } from './systems/ViewModel';
import { WeaponSystem, WEAPON_ORDER } from './systems/WeaponSystem';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const hud = document.querySelector<HTMLPreElement>('#hud')!;
const statusBar = document.querySelector<HTMLDivElement>('#status')!;
const breathFill = document.querySelector<HTMLDivElement>('#breath-fill')!;
const hpFill = document.querySelector<HTMLDivElement>('#hp-fill')!;
const weaponName = document.querySelector<HTMLDivElement>('#weapon-name')!;
const keysEl = document.querySelector<HTMLDivElement>('#keys')!;
const damageFlash = document.querySelector<HTMLDivElement>('#damage-flash')!;
const banner = document.querySelector<HTMLDivElement>('#banner')!;
const crosshair = document.querySelector<HTMLDivElement>('#crosshair')!;

const LEVELS: Record<string, LevelData> = {
  level_01: level01 as LevelData,
  level_02: level02 as LevelData,
};

/** How often mid-level state is written while playing (plans.md §16). */
const AUTOSAVE_SECONDS = 5;

type Mode = 'overworld' | 'playing' | 'paused';

const save = new SaveSystem(browserStorage());

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x05040a);

const rig = new CameraRig();
const input = new InputManager(canvas, save.settings);
const audio = new AudioManager(save.settings);
const viewModel = new ViewModel(WEAPON_ORDER[0]);
rig.camera.add(viewModel.sprite);

const overworldMap = new OverworldMap((levelId) => enterLevel(levelId));
const pauseMenu = new PauseMenu(save.settings, {
  onResume: () => resume(),
  onRestart: () => enterLevel(currentLevelId, { fresh: true }),
  onReturnToMap: () => showOverworld(),
  onSettingsChanged: () => {
    audio.applySettings(save.settings);
    save.save();
  },
});

let mode: Mode = 'overworld';
let world: World | null = null;
let currentLevelId = save.progress.currentLevelId;
/** Set during a tick, acted on after it, so nothing is rebuilt mid-frame. */
let pending: { kind: 'restart' } | { kind: 'cleared'; levelId: string } | null = null;
let secondsSinceSave = 0;

/** Everything rebuilt when a level loads. */
interface World {
  level: LevelData;
  scene: THREE.Scene;
  player: PlayerController;
  health: PlayerHealth;
  breath: BreathSystem;
  weapon: WeaponSystem;
  enemies: EnemySystem;
  projectiles: ProjectileSystem;
  particles: ParticleSystem;
  decals: DecalSystem;
  blasts: BlastSystem;
  doorKeys: DoorKeySystem;
  update(dt: number): void;
  /** Stops held-fire and breathing loops — pausing, leaving, dying. */
  silence(): void;
  render(): void;
  snapshot(): LevelState;
  dispose(): void;
}

function createWorld(level: LevelData, restored: LevelState | null, selectedWeapon: string): World {
  const scene = new THREE.Scene();
  const levelGroup = buildLevel(level);
  scene.add(levelGroup);

  const collision = new CollisionSystem(level);
  const player = new PlayerController(level.start, collision);
  const health = new PlayerHealth();
  const breath = new BreathSystem();

  if (restored) {
    player.position.set(restored.playerPosition.x, PLAYER.eyeHeight, restored.playerPosition.y);
    player.yaw = (restored.playerPosition.yawDegrees * Math.PI) / 180;
    breath.set(restored.breath);
  }

  const playerTarget: PlayerTarget = {
    position: player.position,
    radiusMeters: PLAYER.radius,
    damage: (amount) => health.damage(amount),
  };

  const particles = new ParticleSystem();
  const decals = new DecalSystem(levelGroup);

  const enemies = new EnemySystem(
    level,
    particles,
    decals,
    {
      // Referenced lazily: blasts needs enemies, so one of the two comes second.
      ring: (centre, radius, color, seconds) =>
        blasts.spawn({ centre, maxRadiusMeters: radius, expansionSeconds: seconds, color }),
      shake: (intensity) => rig.shake(intensity),
    },
    collision,
    playerTarget,
    { spawn: (spawn) => projectiles.spawn(spawn) },
    { spawn: (spec) => blasts.spawn(spec) },
    restored?.killedEnemyIds ?? [],
  );

  const blasts = new BlastSystem((target, centre, radius, damageAt, alreadyHit, weaponId) => {
    if (target === 'enemies') {
      enemies.damageSphere(centre, radius, damageAt, alreadyHit, weaponId);
      return;
    }

    if (alreadyHit.has('player')) return;

    const distance = Math.hypot(player.position.x - centre.x, player.position.z - centre.z);
    if (distance > radius) return;
    // A shockwave shouldn't reach through a wall (plans.md §20).
    if (!collision.hasLineOfSight(centre, player.position)) return;

    alreadyHit.add('player');
    health.damage(damageAt(Math.max(0, distance)));
  });

  const projectiles = new ProjectileSystem(collision, enemies, playerTarget);
  const weapon = new WeaponSystem(projectiles, blasts, breath, audio, collision);
  weapon.select(selectedWeapon);

  const doorKeys = new DoorKeySystem(
    level,
    collision,
    audio,
    () => {
      pending = { kind: 'cleared', levelId: level.id };
    },
    { keysCollected: restored?.keysCollected, doorsOpened: restored?.doorsOpened },
  );

  // Save the moment progress is made, per §16's list of triggers.
  enemies.onKill = () => saveLevelState();
  doorKeys.onProgress = () => saveLevelState();

  scene.add(
    rig.camera,
    enemies.group,
    projectiles.group,
    particles.mesh,
    decals.group,
    blasts.group,
    doorKeys.group,
  );

  const aim = new THREE.Vector3();
  let breathLoopPlaying = false;

  /** The breathing loop from §5: audible only while breath is refilling. */
  function updateBreathAudio(): void {
    if (breath.recharging === breathLoopPlaying) return;

    breathLoopPlaying = breath.recharging;
    if (breathLoopPlaying) audio.startLoop(BREATH_LOOP_ID, BREATH_LOOP_FILE);
    else audio.stopLoop(BREATH_LOOP_ID, 0.1);
  }

  return {
    level,
    scene,
    player,
    health,
    breath,
    weapon,
    enemies,
    projectiles,
    particles,
    decals,
    blasts,
    doorKeys,

    update(dt: number): void {
      player.update(dt, input);
      rig.follow(player.position, player.yaw, player.pitch, dt);

      const firePressed = input.consumeFirePressed() || forced.fire;
      const fireHeld = input.firing || forced.fire;
      if (input.isDown('KeyR')) breath.requestManualRecharge();
      selectWeapons(weapon);

      rig.camera.getWorldDirection(aim);
      const fired = weapon.update(dt, firePressed, fireHeld, player.position, aim);
      breath.update(dt, fireHeld);
      updateBreathAudio();

      if (fired) viewModel.recoil();
      viewModel.setWeapon(weapon.current.id);
      viewModel.setStarved(weapon.starved);
      viewModel.update(dt);

      enemies.update(dt);
      doorKeys.update(dt, player.position);
      projectiles.update(dt);
      blasts.update(dt, rig.camera.quaternion);
      particles.update(dt, rig.camera.quaternion);

      if (health.justHurt) {
        audio.playOne('audio/sfx/player_hurt.ogg');
        damageFlash.style.opacity = '0.55';
      } else {
        damageFlash.style.opacity = '0';
      }

      health.update(dt);

      if (health.dead && pending === null) pending = { kind: 'restart' };
    },

    render(): void {
      renderer.render(scene, rig.camera);
    },

    snapshot(): LevelState {
      return {
        levelId: level.id,
        breath: breath.breath,
        keysCollected: doorKeys.heldKeys,
        doorsOpened: doorKeys.openedDoorIds,
        killedEnemyIds: enemies.killedIds,
        playerPosition: {
          x: player.position.x,
          y: player.position.z,
          yawDegrees: (player.yaw * 180) / Math.PI,
        },
      };
    },

    silence(): void {
      weapon.holster();
      if (breathLoopPlaying) {
        audio.stopLoop(BREATH_LOOP_ID, 0.1);
        breathLoopPlaying = false;
      }
    },

    dispose(): void {
      this.silence();

      // The camera and its view model outlive the level, so lift them out first.
      scene.remove(rig.camera);

      scene.traverse((object) => {
        const mesh = object as Partial<THREE.Mesh> & Partial<THREE.Sprite>;
        mesh.geometry?.dispose();

        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        for (const entry of Array.isArray(material) ? material : [material]) {
          const map = (entry as THREE.MeshBasicMaterial | undefined)?.map;
          map?.dispose();
          entry?.dispose();
        }
      });
    },
  };
}

function saveLevelState(): void {
  if (!world) return;

  save.setLevelState(world.snapshot());
  secondsSinceSave = 0;
}

/** Loads a level and starts playing it. `fresh` discards any saved mid-level state. */
function enterLevel(levelId: string, options: { fresh?: boolean } = {}): void {
  const level = LEVELS[levelId];
  if (!level) return;

  const carriedWeapon = world?.weapon.current.id ?? WEAPON_ORDER[0];
  world?.dispose();

  const restored =
    !options.fresh && save.data.levelState?.levelId === levelId ? save.data.levelState : null;

  currentLevelId = levelId;
  world = createWorld(level, restored, carriedWeapon);
  pending = null;

  save.setProgress({ ...save.progress, currentLevelId: levelId });
  if (options.fresh) saveLevelState();

  overworldMap.hide();
  setMode('playing');
  resize();
}

function showOverworld(): void {
  if (world) saveLevelState();

  pauseMenu.hide();
  overworldMap.show(save.progress);
  setMode('overworld');
}

/** Requests pointer lock; the browser only grants it from a gesture. */
function resume(): void {
  pauseMenu.hide();
  setMode('playing');
  audio.unlock();
  void Promise.resolve(canvas.requestPointerLock()).catch(() => {
    // Refused right after ESC — fall back to the menu rather than silent limbo.
    pause();
  });
}

function pause(): void {
  if (mode !== 'playing') return;

  setMode('paused');
  pauseMenu.show();
  world?.silence();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  if (world) saveLevelState();
}

function setMode(next: Mode): void {
  mode = next;
  const playing = next === 'playing';

  crosshair.hidden = !playing;
  statusBar.hidden = !playing;
  hud.hidden = !playing;
  if (!playing) damageFlash.style.opacity = '0';
}

// Losing pointer lock mid-game is a pause (plans.md §17).
input.onLockChange = (locked) => {
  if (!locked && mode === 'playing') pause();
};

canvas.addEventListener('click', () => {
  audio.unlock();
  if (mode === 'playing' && document.pointerLockElement !== canvas) resume();
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyP' && event.code !== 'Escape') return;
  if (mode === 'playing') pause();
  else if (mode === 'paused') resume();
});

function selectWeapons(weapon: WeaponSystem): void {
  WEAPON_ORDER.forEach((id, index) => {
    if (input.isDown(`Digit${index + 1}`)) weapon.select(id);
  });

  const cycle = input.consumeWeaponCycle();
  if (cycle !== 0) weapon.cycle(cycle);
}

function resize(): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  rig.resize(width, height);
}

/** Flipped only by the dev handle below, so held fire can be simulated. */
const forced = { fire: false };

resize();
window.addEventListener('resize', resize);

// Any supplied art is probed before the first level builds, so textures are
// picked up on the first frame rather than popping in afterwards. Missing files
// are the normal case and leave the procedural stand-ins in place.
const art = await preloadImages();

// A save mid-level resumes there; otherwise start on the map.
if (save.data.levelState && LEVELS[save.data.levelState.levelId]) {
  enterLevel(save.data.levelState.levelId);
  pause();
} else {
  showOverworld();
}

function tick(dt: number): void {
  if (mode === 'playing' && world) {
    world.update(dt);
    world.render();
    updateHud();

    secondsSinceSave += dt;
    if (secondsSinceSave >= AUTOSAVE_SECONDS) saveLevelState();

    if (pending) applyPending();
    return;
  }

  // Paused: keep the last frame on screen behind the menu.
  world?.render();
}

function applyPending(): void {
  const action = pending;
  pending = null;
  if (!action) return;

  if (action.kind === 'restart') {
    banner.hidden = false;
    banner.textContent = 'YOU DIED';
    window.setTimeout(() => {
      banner.hidden = true;
    }, 1200);

    enterLevel(currentLevelId, { fresh: true });
    return;
  }

  // Level cleared: mark it, unlock what follows, and show the descent again.
  save.setProgress(completeLevel(save.progress, action.levelId));
  save.setLevelState(null);

  banner.hidden = false;
  banner.textContent = `${LEVELS[action.levelId]!.name.toUpperCase()} CLEARED`;
  window.setTimeout(() => {
    banner.hidden = true;
  }, 1600);

  world?.dispose();
  world = null;
  overworldMap.show(save.progress);
  setMode('overworld');
}

const loop = new GameLoop(tick);

function updateHud(): void {
  if (!world) return;
  const { breath, weapon, health, player, enemies, projectiles, particles, decals, blasts, doorKeys, level } = world;

  breathFill.style.width = `${(breath.breath / BREATH.max) * 100}%`;
  hpFill.style.width = `${(health.hp / PLAYER.maxHp) * 100}%`;
  statusBar.classList.toggle('recharging', breath.recharging);
  statusBar.classList.toggle('starved', weapon.starved);
  weaponName.textContent = weapon.current.name.toUpperCase();

  const held = doorKeys.heldKeys;
  if (keysEl.childElementCount !== held.length) {
    keysEl.replaceChildren(
      ...held.map((color) => {
        const dot = document.createElement('div');
        dot.className = 'key';
        dot.style.color = keyColor(color);
        return dot;
      }),
    );
  }

  const cell = player.cell;
  hud.textContent = [
    'DOOT ETERNAL — phase 5',
    `level     ${level.name} (${level.id})`,
    `pos       ${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)}   cell ${cell.x},${cell.y}`,
    `hp        ${health.hp}/${PLAYER.maxHp}${health.immune ? '  (immune)' : ''}`,
    `breath    ${breath.breath.toFixed(1)}/${BREATH.max}${breath.recharging ? '  ↑' : ''}`,
    `weapon    ${weapon.current.id}   spread ${weapon.spreadRadians.toFixed(3)} rad`,
    `enemies   ${enemies.aliveCount} alive, ${enemies.corpseCount} down`,
    `keys      ${held.join(', ') || 'none'}   ${doorKeys.remainingKeys} left to find`,
    `cleared   ${save.progress.completedLevels.join(', ') || 'none'}`,
    `effects   ${projectiles.activeCount} shots, ${blasts.activeCount} blasts, ${particles.activeCount} particles, ${decals.count} decals`,
    `fps       ${loop.fps}`,
  ].join('\n');
}

loop.start();

if (import.meta.env.DEV) {
  // Dev-only handle for driving the game from the console: pointer lock needs a
  // focused window, which automated verification never has. `tick` advances the
  // world by an exact delta so effects can be stepped frame by frame.
  // import.meta.env.DEV is false in a production build, so this is stripped out.
  Object.assign(window, {
    doot: {
      tick,
      fire: () =>
        world?.weapon.update(0, true, true, world.player.position, rig.camera.getWorldDirection(new THREE.Vector3())),
      holdFire: (held: boolean) => {
        forced.fire = held;
      },
      aimAt: (x: number, z: number) => {
        if (!world) return;
        world.player.yaw = Math.atan2(x - world.player.position.x, -(z - world.player.position.z));
        world.player.pitch = 0;
      },
      enterLevel,
      showOverworld,
      pause,
      resume,
      save,
      audio,
      art,
      get mode() {
        return mode;
      },
      get world() {
        return world;
      },
    },
  });
}
