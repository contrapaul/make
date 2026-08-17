import * as THREE from 'three';
import levelJson from '../levels/level_01.json';
import { CameraRig } from './core/CameraRig';
import { CollisionSystem } from './core/CollisionSystem';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { buildLevel, type LevelData } from './core/LevelLoader';
import { PlayerController } from './core/PlayerController';
import { BREATH } from './data/constants';
import { AudioManager } from './systems/AudioManager';
import { BlastSystem } from './systems/BlastSystem';
import { BreathSystem } from './systems/BreathSystem';
import { DecalSystem } from './systems/DecalSystem';
import { EnemySystem } from './systems/EnemySystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { ProjectileSystem } from './systems/ProjectileSystem';
import { ViewModel } from './systems/ViewModel';
import { WeaponSystem, WEAPON_ORDER } from './systems/WeaponSystem';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const hud = document.querySelector<HTMLPreElement>('#hud')!;
const lockHint = document.querySelector<HTMLDivElement>('#lock-hint')!;
const status = document.querySelector<HTMLDivElement>('#status')!;
const breathFill = document.querySelector<HTMLDivElement>('#breath-fill')!;
const weaponName = document.querySelector<HTMLDivElement>('#weapon-name')!;

const level = levelJson as LevelData;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x05040a);

const scene = new THREE.Scene();
const levelGroup = buildLevel(level);
scene.add(levelGroup);

const collision = new CollisionSystem(level);
const player = new PlayerController(level.start, collision);
const rig = new CameraRig();
const input = new InputManager(canvas);
const audio = new AudioManager();

const particles = new ParticleSystem();
const decals = new DecalSystem(levelGroup);
const enemies = new EnemySystem(level, particles, decals, {
  // Referenced lazily: blasts needs enemies, so one of the two must come second.
  ring: (centre, radius, color, seconds) =>
    blasts.spawn({ centre, maxRadiusMeters: radius, expansionSeconds: seconds, color }),
  shake: (intensity) => rig.shake(intensity),
});
const blasts = new BlastSystem((centre, radius, damageAt, alreadyHit, weaponId) =>
  enemies.damageSphere(centre, radius, damageAt, alreadyHit, weaponId),
);
const projectiles = new ProjectileSystem(collision, enemies);
const breath = new BreathSystem();
const weapon = new WeaponSystem(projectiles, blasts, breath, audio, collision);
const viewModel = new ViewModel(weapon.current.id);

// The camera joins the scene so the view model, its child, renders with it.
rig.camera.add(viewModel.sprite);
scene.add(rig.camera, enemies.group, projectiles.group, particles.mesh, decals.group, blasts.group);

input.onLockChange = (locked) => {
  lockHint.hidden = locked;
};

// An AudioContext can only start from a gesture — the same click that locks.
canvas.addEventListener('click', () => audio.unlock());

function resize(): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  rig.resize(width, height);
}

resize();
window.addEventListener('resize', resize);

const aim = new THREE.Vector3();

function selectWeapons(): void {
  WEAPON_ORDER.forEach((id, index) => {
    if (input.isDown(`Digit${index + 1}`)) weapon.select(id);
  });

  const cycle = input.consumeWeaponCycle();
  if (cycle !== 0) weapon.cycle(cycle);
}

/** Flipped only by the dev handle below, so held fire can be simulated. */
const forced = { fire: false };

function tick(dt: number): void {
  player.update(dt, input);
  rig.follow(player.position, player.yaw, player.pitch, dt);

  const active = input.locked || forced.fire;
  const firePressed = (input.consumeFirePressed() && active) || forced.fire;
  if (input.isDown('KeyR')) breath.requestManualRecharge();
  selectWeapons();

  rig.camera.getWorldDirection(aim);
  const fireHeld = (input.firing && active) || forced.fire;
  const fired = weapon.update(dt, firePressed, fireHeld, player.position, aim);
  breath.update(dt, fireHeld);

  if (fired) viewModel.recoil();
  viewModel.setWeapon(weapon.current.id);
  viewModel.setStarved(weapon.starved);
  viewModel.update(dt);

  projectiles.update(dt);
  blasts.update(dt, rig.camera.quaternion);
  particles.update(dt, rig.camera.quaternion);

  renderer.render(scene, rig.camera);
  updateHud();
}

const loop = new GameLoop(tick);

function updateHud(): void {
  breathFill.style.width = `${(breath.breath / BREATH.max) * 100}%`;
  status.classList.toggle('recharging', breath.recharging);
  status.classList.toggle('starved', weapon.starved);
  weaponName.textContent = weapon.current.name.toUpperCase();

  const cell = player.cell;
  hud.textContent = [
    'DOOT ETERNAL — phase 3',
    `level     ${level.name} (${level.id})`,
    `pos       ${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)}   cell ${cell.x},${cell.y}`,
    `breath    ${breath.breath.toFixed(1)}/${BREATH.max}${breath.recharging ? '  ↑' : ''}`,
    `weapon    ${weapon.current.id}   spread ${weapon.spreadRadians.toFixed(3)} rad`,
    `enemies   ${enemies.aliveCount} alive, ${enemies.corpseCount} down`,
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
      fire: () => weapon.update(0, true, true, player.position, rig.camera.getWorldDirection(aim)),
      holdFire: (held: boolean) => {
        forced.fire = held;
      },
      aimAt: (x: number, z: number) => {
        player.yaw = Math.atan2(x - player.position.x, -(z - player.position.z));
        player.pitch = 0;
      },
      level,
      player,
      breath,
      weapon,
      enemies,
      projectiles,
      particles,
      decals,
      blasts,
      viewModel,
      audio,
    },
  });
}
