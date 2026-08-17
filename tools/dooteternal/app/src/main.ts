import * as THREE from 'three';
import level01 from '../levels/level_01.json';
import level02 from '../levels/level_02.json';
import { CameraRig } from './core/CameraRig';
import { CollisionSystem } from './core/CollisionSystem';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { buildLevel, type LevelData } from './core/LevelLoader';
import { keyColor } from './core/PlaceholderAssets';
import { PlayerController } from './core/PlayerController';
import { BREATH, PLAYER } from './data/constants';
import { AudioManager } from './systems/AudioManager';
import { BlastSystem } from './systems/BlastSystem';
import { BreathSystem } from './systems/BreathSystem';
import { DecalSystem } from './systems/DecalSystem';
import { DoorKeySystem } from './systems/DoorKeySystem';
import { EnemySystem } from './systems/EnemySystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { PlayerHealth } from './systems/PlayerHealth';
import { ProjectileSystem, type PlayerTarget } from './systems/ProjectileSystem';
import { ViewModel } from './systems/ViewModel';
import { WeaponSystem, WEAPON_ORDER } from './systems/WeaponSystem';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const hud = document.querySelector<HTMLPreElement>('#hud')!;
const lockHint = document.querySelector<HTMLDivElement>('#lock-hint')!;
const statusBar = document.querySelector<HTMLDivElement>('#status')!;
const breathFill = document.querySelector<HTMLDivElement>('#breath-fill')!;
const hpFill = document.querySelector<HTMLDivElement>('#hp-fill')!;
const weaponName = document.querySelector<HTMLDivElement>('#weapon-name')!;
const keysEl = document.querySelector<HTMLDivElement>('#keys')!;
const damageFlash = document.querySelector<HTMLDivElement>('#damage-flash')!;
const banner = document.querySelector<HTMLDivElement>('#banner')!;

/** Descent order. Phase 5 replaces this with the overworld map. */
const LEVELS = [level01 as LevelData, level02 as LevelData];

// Persistent across levels: the renderer, view, input and audio.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x05040a);

const rig = new CameraRig();
const input = new InputManager(canvas);
const audio = new AudioManager();
const viewModel = new ViewModel(WEAPON_ORDER[0]);
rig.camera.add(viewModel.sprite);

input.onLockChange = (locked) => {
  lockHint.hidden = locked;
};

// An AudioContext can only start from a gesture — the same click that locks.
canvas.addEventListener('click', () => audio.unlock());

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
  tick(dt: number): void;
  dispose(): void;
}

let world: World;
let levelIndex = 0;
/** Set during a tick, acted on after it, so nothing is rebuilt mid-frame. */
let pendingLoad: number | null = null;

function createWorld(level: LevelData, selectedWeapon: string): World {
  const scene = new THREE.Scene();
  const levelGroup = buildLevel(level);
  scene.add(levelGroup);

  const collision = new CollisionSystem(level);
  const player = new PlayerController(level.start, collision);
  const health = new PlayerHealth();
  const breath = new BreathSystem();

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

  const doorKeys = new DoorKeySystem(level, collision, audio, () => {
    banner.hidden = false;
    banner.textContent = `${level.name.toUpperCase()} CLEARED`;
    pendingLoad = (levelIndex + 1) % LEVELS.length;
  });

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

    tick(dt: number): void {
      player.update(dt, input);
      rig.follow(player.position, player.yaw, player.pitch, dt);

      const active = input.locked || forced.fire;
      const firePressed = (input.consumeFirePressed() && active) || forced.fire;
      const fireHeld = (input.firing && active) || forced.fire;
      if (input.isDown('KeyR')) breath.requestManualRecharge();
      selectWeapons(weapon);

      rig.camera.getWorldDirection(aim);
      const fired = weapon.update(dt, firePressed, fireHeld, player.position, aim);
      breath.update(dt, fireHeld);

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

      if (health.dead && pendingLoad === null) {
        banner.hidden = false;
        banner.textContent = 'YOU DIED';
        pendingLoad = levelIndex;
      }

      renderer.render(scene, rig.camera);
    },

    dispose(): void {
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

function loadLevel(index: number): void {
  const carriedWeapon = world?.weapon.current.id ?? WEAPON_ORDER[0];
  world?.dispose();

  levelIndex = index;
  world = createWorld(LEVELS[index]!, carriedWeapon);
  pendingLoad = null;

  window.setTimeout(() => {
    banner.hidden = true;
  }, 1200);
}

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

loadLevel(0);
resize();
window.addEventListener('resize', resize);

function tick(dt: number): void {
  world.tick(dt);
  updateHud();

  if (pendingLoad !== null) loadLevel(pendingLoad);
}

const loop = new GameLoop(tick);

function updateHud(): void {
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
    'DOOT ETERNAL — phase 4',
    `level     ${level.name} (${level.id})`,
    `pos       ${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)}   cell ${cell.x},${cell.y}`,
    `hp        ${health.hp}/${PLAYER.maxHp}${health.immune ? '  (immune)' : ''}`,
    `breath    ${breath.breath.toFixed(1)}/${BREATH.max}${breath.recharging ? '  ↑' : ''}`,
    `weapon    ${weapon.current.id}   spread ${weapon.spreadRadians.toFixed(3)} rad`,
    `enemies   ${enemies.aliveCount} alive, ${enemies.corpseCount} down`,
    `keys      ${held.join(', ') || 'none'}   ${doorKeys.remainingKeys} left to find`,
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
        world.weapon.update(0, true, true, world.player.position, rig.camera.getWorldDirection(new THREE.Vector3())),
      holdFire: (held: boolean) => {
        forced.fire = held;
      },
      aimAt: (x: number, z: number) => {
        world.player.yaw = Math.atan2(x - world.player.position.x, -(z - world.player.position.z));
        world.player.pitch = 0;
      },
      loadLevel,
      levels: LEVELS,
      get world() {
        return world;
      },
      audio,
    },
  });
}
