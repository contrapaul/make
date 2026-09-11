// Screens: one <section data-screen> visible at a time, plus hangar preview,
// settings form, and the end-of-game stats dialog.
import * as THREE from 'three';
import { HULLS } from './data/hulls.js';
import { buildShip } from './render/shipMesh.js';
import { loadShip, saveShip } from './profile.js';
import { getSettings, saveSettings, resetSettings } from './settings.js';
import { summary } from './sim/stats.js';

const listeners = new Map();
let current = null;

export function showScreen(name) {
  const sections = document.querySelectorAll('[data-screen]');
  for (const el of sections) el.hidden = el.dataset.screen !== name;
  const from = current;
  current = name;
  if (from === name) return;
  const fns = listeners.get(name) || [];
  for (const fn of fns) fn({ from });
}

export function onScreen(name, fn) {
  if (!listeners.has(name)) listeners.set(name, []);
  listeners.get(name).push(fn);
}

export function currentScreen() {
  return current;
}

export function wireScreens() {
  for (const btn of document.querySelectorAll('button[data-go]')) {
    btn.addEventListener('click', () => showScreen(btn.dataset.go));
  }
  wireHangar();
  wireSettings();
}

// ---- Hangar: small rotating preview + profile controls --------------------

let hangar = null;
let hangarRaf = 0;

function ensureHangar() {
  if (hangar) return hangar;
  const canvas = document.getElementById('hangar-view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(320, 220, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x8899bb, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(1, 2, 0.5);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(45, 320 / 220, 1, 500);
  camera.position.set(0, 12, 48);
  camera.lookAt(0, 0, 0);
  hangar = { renderer, scene, camera, group: null, last: 0 };
  return hangar;
}

function buildHangarShip() {
  const h = ensureHangar();
  const profile = loadShip();
  const hull = HULLS[profile.hull] || HULLS.corvette;
  if (h.group) h.scene.remove(h.group);
  h.group = buildShip(THREE, hull, profile.colors);
  h.group.position.y = -2;
  h.scene.add(h.group);
  const list = document.getElementById('hardpoint-list');
  list.innerHTML = hull.hardpoints
    .map((hp) => `<li>${hp.id} — <b>${hp.weapon}</b> · arc ±${Math.round(hp.arcHalf * 57.3)}°</li>`)
    .join('');
}

function hangarFrame(now) {
  hangarRaf = requestAnimationFrame(hangarFrame);
  const dt = Math.min((now - (hangar.last || now)) / 1000, 0.1);
  hangar.last = now;
  if (hangar.group) hangar.group.rotation.y += dt * 0.4;
  hangar.renderer.render(hangar.scene, hangar.camera);
}

function wireHangar() {
  const $ = (id) => document.getElementById(id);
  for (const key of ['primary', 'accent', 'glow']) {
    const el = $('col-' + key);
    el.value = loadShip().colors[key];
    el.addEventListener('input', () => {
      saveShip({ colors: { [key]: el.value } });
      buildHangarShip();
    });
  }
  const name = $('ship-name');
  name.value = loadShip().name;
  name.addEventListener('input', () => saveShip({ name: name.value }));
  $('ship-hull').addEventListener('change', (e) => {
    saveShip({ hull: e.target.value });
    buildHangarShip();
  });
  onScreen('hangar', () => {
    buildHangarShip();
    hangar.last = performance.now();
    cancelAnimationFrame(hangarRaf);
    hangarRaf = requestAnimationFrame(hangarFrame);
  });
  for (const s of ['splash', 'settings', 'game', 'end']) onScreen(s, () => cancelAnimationFrame(hangarRaf));
}

// ---- Settings form ---------------------------------------------------------

function wireSettings() {
  const $ = (id) => document.getElementById(id);
  const apply = () => {
    const s = getSettings();
    $('set-sens').value = String(s.camSens);
    $('set-invert').checked = !!s.invertY;
    $('set-lmb').checked = !!s.lmbFires;
    $('set-quality').value = String(s.pixelRatio);
    $('set-dmg').checked = !!s.damageNumbers;
  };
  apply();
  $('set-sens').addEventListener('input', (e) => saveSettings({ camSens: Number(e.target.value) }));
  $('set-invert').addEventListener('change', (e) => saveSettings({ invertY: e.target.checked }));
  $('set-lmb').addEventListener('change', (e) => saveSettings({ lmbFires: e.target.checked }));
  $('set-quality').addEventListener('change', (e) => saveSettings({ pixelRatio: Number(e.target.value) }));
  $('set-dmg').addEventListener('change', (e) => saveSettings({ damageNumbers: e.target.checked }));
  $('set-reset').addEventListener('click', () => {
    resetSettings();
    apply();
  });
}

// ---- End dialog ------------------------------------------------------------

// main.js registers these (Again must re-run the game boot, which only
// main.js knows — showScreen('game') is a no-op when already on that screen).
let endHandlers = null;
export function onEndButtons(handlers) {
  endHandlers = handlers;
}

export function showEnd(state, rows) {
  const player = state.ships.find((s) => s.id === state.playerId);
  const win = !!(player && player.alive);
  const d = document.getElementById('end-dialog');
  d.innerHTML =
    `<h2 class="${win ? 'win' : 'lost'}">${win ? 'VICTORY' : 'SHIP LOST'}</h2>` +
    `<table class="stats">` +
    (rows || summary(state.stats)).map((r) => `<tr><td>${r.label}</td><td>${r.value}</td></tr>`).join('') +
    '</table>' +
    '<div class="end-buttons"><button id="end-again">Again</button><button id="end-hangar">Hangar</button></div>';
  d.showModal();
  document.getElementById('end-again').addEventListener('click', () => {
    d.close();
    if (endHandlers && endHandlers.again) endHandlers.again();
    else showScreen('game');
  });
  document.getElementById('end-hangar').addEventListener('click', () => {
    d.close();
    if (endHandlers && endHandlers.hangar) endHandlers.hangar();
    else showScreen('hangar');
  });
}
