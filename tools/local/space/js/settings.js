// Player settings — localStorage['space.settings'].
// Single source of truth: everything reads getSettings().
const KEY = 'space.settings';

export const DEFAULT_SETTINGS = {
  camSens: 1, // camera sensitivity multiplier (0.5–2)
  invertY: false, // invert camera pitch
  pixelRatio: 1, // 1 | 1.5 | 2
  damageNumbers: true, // M7.5: hit visibility was a complaint; opt-out now
};

export function getSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    saved = {};
  }
  // Note: older profiles may carry a 'lmbFires' key — it is simply never read
  // (LMB always fires now), so it is inert.
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function resetSettings() {
  localStorage.removeItem(KEY);
  return { ...DEFAULT_SETTINGS };
}
