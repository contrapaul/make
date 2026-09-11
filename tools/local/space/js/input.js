// Keyboard + mouse → plain per-frame input object.
// thrust: -1|0|1 (W/S) · turn: -1|0|1 (A=left/D=right) · aim: -1|0|1 (Q/E)
// select: edge-triggered mount id (keys 1–4, hull hardpoint order)
// fire: held (Space or the fire mouse button — see settings lmbFires) · pause: edge (Esc)
import { getSettings } from './settings.js';

const fireButton = () => (getSettings().lmbFires ? 0 : 2);

export function createInput(canvas, mountIds) {
  const keys = new Set();
  let fireHeld = false;
  let selectPending = null;
  let pausePressed = false;

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { pausePressed = true; return; }
    if (k >= '1' && k <= '4' && mountIds) {
      selectPending = mountIds[Number(k) - 1];
      return;
    }
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); fireHeld = false; });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === fireButton()) fireHeld = true;
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === fireButton()) fireHeld = false;
  });

  const sample = () => {
    const out = {
      thrust: (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0),
      turn: (keys.has('a') ? 1 : 0) + (keys.has('d') ? -1 : 0),
      aim: (keys.has('q') ? 1 : 0) + (keys.has('e') ? -1 : 0),
      select: selectPending,
      fire: keys.has(' ') || fireHeld,
      pause: pausePressed,
    };
    selectPending = null;
    pausePressed = false;
    return out;
  };

  return { sample };
}
