import * as THREE from 'three';
import levelJson from '../levels/level_01.json';
import { CameraRig } from './core/CameraRig';
import { CollisionSystem } from './core/CollisionSystem';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { buildLevel, type LevelData } from './core/LevelLoader';
import { PlayerController } from './core/PlayerController';
import { BREATH } from './data/constants';
import { BreathSystem } from './systems/BreathSystem';
import { DecalSystem } from './systems/DecalSystem';
import { EnemySystem } from './systems/EnemySystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { ProjectileSystem } from './systems/ProjectileSystem';
import { WeaponSystem } from './systems/WeaponSystem';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const hud = document.querySelector<HTMLPreElement>('#hud')!;
const lockHint = document.querySelector<HTMLDivElement>('#lock-hint')!;

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

const particles = new ParticleSystem();
const decals = new DecalSystem(levelGroup);
const enemies = new EnemySystem(level, particles, decals);
const projectiles = new ProjectileSystem(collision, enemies);
const breath = new BreathSystem();
const weapon = new WeaponSystem(projectiles, breath);

scene.add(enemies.group, projectiles.group, particles.mesh, decals.group);

input.onLockChange = (locked) => {
  lockHint.hidden = locked;
};

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

function tick(dt: number): void {
  player.update(dt, input);
  rig.follow(player.position, player.yaw, player.pitch);

  const firePressed = input.consumeFirePressed() && input.locked;
  if (input.isDown('KeyR')) breath.requestManualRecharge();

  rig.camera.getWorldDirection(aim);
  weapon.update(dt, firePressed, player.position, aim);
  breath.update(dt, input.firing && input.locked);

  projectiles.update(dt);
  particles.update(dt, rig.camera.quaternion);

  renderer.render(scene, rig.camera);
  updateHud();
}

const loop = new GameLoop(tick);

function updateHud(): void {
  const cell = player.cell;
  const filled = Math.round((breath.breath / BREATH.max) * 20);
  const bar = `${'█'.repeat(filled)}${'·'.repeat(20 - filled)}`;

  hud.textContent = [
    'DOOT ETERNAL — phase 2',
    `level     ${level.name} (${level.id})`,
    `pos       ${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)}   cell ${cell.x},${cell.y}`,
    `breath    ${bar} ${breath.breath.toFixed(1)}/${BREATH.max}${breath.recharging ? '  ↑ recharging' : ''}`,
    `weapon    ${weapon.current.name}${weapon.starved ? '  (out of breath)' : ''}`,
    `enemies   ${enemies.aliveCount} alive, ${enemies.corpseCount} down`,
    `effects   ${projectiles.activeCount} shots, ${particles.activeCount} particles, ${decals.count} decals`,
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
      fire: () => weapon.update(0, true, player.position, rig.camera.getWorldDirection(aim)),
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
    },
  });
}
