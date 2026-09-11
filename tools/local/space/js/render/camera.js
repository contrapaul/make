// Orbit camera rig locked to the player ship. Drag orbits (which button
// depends on the lmbFires setting), wheel zooms. Sensitivity + Y-invert
// come from settings.
import { getSettings } from '../settings.js';

const YAW_SENS = 0.005;
const PITCH_SENS = 0.005;
const PITCH_MIN = 0.15;
const PITCH_MAX = 1.45;
const DIST_MIN = 60;
const DIST_MAX = 500;
const FOLLOW_K = 8; // exponential lerp rate for the follow target

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createCameraRig(THREE, camera) {
  const rig = { yaw: 0, pitch: 0.6, dist: 200 };
  const target = new THREE.Vector3(); // smoothed follow point
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const attach = (canvas) => {
    canvas.addEventListener('pointerdown', (e) => {
      const orbit = getSettings().lmbFires ? e.button >= 1 : e.button === 0 || e.button === 1;
      if (!orbit) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const s = getSettings();
      const sign = s.invertY ? -1 : 1;
      rig.yaw -= (e.clientX - lastX) * YAW_SENS * s.camSens;
      rig.pitch = clamp(rig.pitch + (e.clientY - lastY) * PITCH_SENS * s.camSens * sign, PITCH_MIN, PITCH_MAX);
      lastX = e.clientX;
      lastY = e.clientY;
    });
    const stop = () => { dragging = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      rig.dist = clamp(rig.dist * Math.exp(e.deltaY * 0.001), DIST_MIN, DIST_MAX);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  // target: { x, z } ship position (y ignored — world is the XZ plane).
  const update = (targetPos, dt) => {
    const k = 1 - Math.exp(-FOLLOW_K * dt);
    target.x += (targetPos.x - target.x) * k;
    target.z += (targetPos.z - target.z) * k;
    const cp = Math.cos(rig.pitch);
    camera.position.set(
      target.x + rig.dist * cp * Math.sin(rig.yaw),
      rig.dist * Math.sin(rig.pitch),
      target.z + rig.dist * cp * Math.cos(rig.yaw)
    );
    camera.lookAt(target.x, 0, target.z);
  };

  rig.attach = attach;
  rig.update = update;
  return rig;
}
