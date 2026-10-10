// Player ship profile — localStorage['space.ship'].
// Colors are CSS hex strings (three.js accepts them directly).
import { HULLS } from './data/hulls.js';

const KEY = 'space.ship';

export const DEFAULT_SHIP = {
  name: 'Corvette',
  hull: 'corvette',
  colors: { primary: '#8fa8c8', accent: '#3fa9ff', glow: '#59d8ff' },
};

export function loadShip() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    saved = {};
  }
  return {
    name: saved.name ?? DEFAULT_SHIP.name,
    hull: saved.hull && HULLS[saved.hull] ? saved.hull : DEFAULT_SHIP.hull,
    colors: { ...DEFAULT_SHIP.colors, ...(saved.colors || {}) },
  };
}

export function saveShip(patch) {
  const cur = loadShip();
  const next = {
    name: patch.name ?? cur.name,
    hull: patch.hull && HULLS[patch.hull] ? patch.hull : cur.hull,
    colors: { ...cur.colors, ...(patch.colors || {}) },
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
