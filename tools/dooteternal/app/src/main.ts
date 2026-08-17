import * as THREE from 'three';
import levelJson from '../levels/level_01.json';
import { CameraRig } from './core/CameraRig';
import { CollisionSystem } from './core/CollisionSystem';
import { GameLoop } from './core/GameLoop';
import { InputManager } from './core/InputManager';
import { buildLevel, type LevelData } from './core/LevelLoader';
import { PlayerController } from './core/PlayerController';

const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const hud = document.querySelector<HTMLPreElement>('#hud')!;
const lockHint = document.querySelector<HTMLDivElement>('#lock-hint')!;

const level = levelJson as LevelData;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x05040a);

const scene = new THREE.Scene();
scene.add(buildLevel(level));

const collision = new CollisionSystem(level);
const player = new PlayerController(level.start, collision);
const rig = new CameraRig();
const input = new InputManager(canvas);

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

const loop = new GameLoop((dt) => {
  player.update(dt, input);
  rig.follow(player.position, player.yaw, player.pitch);
  renderer.render(scene, rig.camera);
  updateHud();
});

function updateHud(): void {
  const cell = player.cell;
  const yawDegrees = Math.round(((player.yaw * 180) / Math.PI) % 360);

  hud.textContent = [
    'DOOT ETERNAL — phase 1',
    `level     ${level.name} (${level.id})`,
    `pos       ${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)}   cell ${cell.x},${cell.y}`,
    `yaw       ${yawDegrees}°   pitch ${Math.round((player.pitch * 180) / Math.PI)}°`,
    `fps       ${loop.fps}`,
  ].join('\n');
}

loop.start();
