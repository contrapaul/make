// Orbit camera rig locked to the player ship. Right/middle-drag orbits
// (LMB is fire, see input.js), wheel zooms. Sensitivity + Y-invert come
// from settings.
import { getSettings } from '../settings.js';

const YAW_SENS = 0.005;
const PITCH_SENS = 0.005;
const PITCH_MIN = 0.15;
const PITCH_MAX = 1.45;
const DIST_MIN = 60;
const DIST_MAX = 500;
const FOLLOW_K = 8; // exponential lerp rate for the follow target
const FOLLOW_K_TURNING = 5; // slower while hard-turning → slight camera lag
const SHAKE_S = 0.3; // collision shake duration
const SHAKE_MAX = 1.5; // …and max offset in world units

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
      if (e.button !== 1 && e.button !== 2) return; // LMB is fire (see input.js)
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

  let shakeLeft = 0; // seconds of shake remaining
  rig.shake = () => {
    shakeLeft = Math.max(shakeLeft, SHAKE_S);
  };

  // target: { x, z } ship position (y ignored — world is the XZ plane).
  const update = (targetPos, dt) => {
    const turning = Math.abs(targetPos.angVel || 0) > 0.5;
    const k = 1 - Math.exp(-(turning ? FOLLOW_K_TURNING : FOLLOW_K) * dt);
    target.x += (targetPos.x - target.x) * k;
    target.z += (targetPos.z - target.z) * k;
    const cp = Math.cos(rig.pitch);
    camera.position.set(
      target.x + rig.dist * cp * Math.sin(rig.yaw),
      rig.dist * Math.sin(rig.pitch),
      target.z + rig.dist * cp * Math.cos(rig.yaw)
    );
    if (shakeLeft > 0) {
      shakeLeft = Math.max(0, shakeLeft - dt);
      const s = SHAKE_MAX * (shakeLeft / SHAKE_S);
      const t = performance.now() * 0.001;
      // deterministic wobble (sin, not RNG) — render-side only
      camera.position.x += Math.sin(t * 61) * s;
      camera.position.y += Math.sin(t * 47 + 2) * s;
      camera.position.z += Math.sin(t * 53 + 4) * s;
    }
    camera.lookAt(target.x, 0, target.z);
  };

  rig.attach = attach;
  rig.update = update;
  return rig;
}
