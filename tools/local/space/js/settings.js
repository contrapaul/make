// Player settings — localStorage['space.settings'].
// Single source of truth: everything reads getSettings().
const KEY = 'space.settings';

export const DEFAULT_SETTINGS = {
  camSens: 1, // camera sensitivity multiplier (0.5–2)
  invertY: false, // invert camera pitch
  lmbFires: true, // left mouse fires (false: left orbits, right fires)
  pixelRatio: 1, // 1 | 1.5 | 2
  damageNumbers: false,
};

export function getSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    saved = {};
  }
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
