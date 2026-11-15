// Wires the page together: draws the map, follows the address hash, and
// moves the camera. The address is the single source of truth for the view.

import { NODES, GROUPS } from './data.js';
import { WORLDS, orientationFor, layoutNodes, nodeBounds, chipsFor, chipRect, padRect } from './layout.js';
import { fitRect, scaleBox, mixBox, easeInOut } from './camera.js';
import { parseRoute, parentHash, TABS } from './route.js';
import { buildScene } from './scene.js';
import { panelHtml } from './panel.js';
import { wireContactForm } from './contact.js';

const FLY_MS = 800;
const WORLD_PAD = 30;
const NODE_PAD = 36;
const SERVICE_PAD = 14;
const PANEL_GAP = 32;
const TAB_PULLBACK = 1.8;
const SITE_TITLE = 'Network map';

const svg = document.getElementById('scene');
const panel = document.getElementById('panel');
const bar = document.getElementById('bar');
const lightbox = document.getElementById('lightbox');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sidePanel = matchMedia('(min-width: 820px)');

let orientation = null;
let world = null;
let positions = null;
let camera = null;
let frame = 0;
let route = parseRoute(location.hash, NODES);

function viewport() {
  const box = svg.getBoundingClientRect();
  return { w: box.width, h: box.height };
}

// Redraws only when the screen changes between tall and wide.
function drawScene() {
  const size = viewport();
  const next = orientationFor(size.w, size.h);
  if (next === orientation) return;
  orientation = next;
  world = WORLDS[next];
  positions = layoutNodes(NODES, world);
  svg.innerHTML = buildScene(NODES, GROUPS, world, { pulses: !reducedMotion.matches });
  svg.dataset.shape = next;
}

// The part of the screen the top bar and the panel do not cover.
function freeArea(withPanel) {
  const size = viewport();
  const top = bar.offsetHeight / size.h;
  const free = { x: 0, y: top, w: 1, h: 1 - top };
  if (!withPanel) return free;
  if (sidePanel.matches) return { ...free, w: 1 - (panel.offsetWidth + PANEL_GAP) / size.w };
  return { ...free, h: free.h - panel.offsetHeight / size.h };
}

function targetRect() {
  const position = positions.get(route.node.id);
  const chips = chipsFor(route.node.services);
  // A service folded into the "+N more" chip has no chip of its own to zoom to.
  const index = route.service ? chips.findIndex((chip) => chip.id === route.service.id) : -1;
  if (index < 0) return padRect(nodeBounds(position, chips.length), NODE_PAD);
  return padRect(chipRect(position, index), SERVICE_PAD);
}

function cameraForRoute() {
  const whole = padRect({ x: 0, y: 0, w: world.w, h: world.h }, WORLD_PAD);
  const home = fitRect(whole, viewport(), freeArea(false));
  if (route.view === 'map') return home;
  if (TABS.includes(route.view)) return scaleBox(home, TAB_PULLBACK);
  return fitRect(targetRect(), viewport(), freeArea(true));
}

// The bar wraps on narrow screens, so CSS needs its real height.
function measureBar() {
  document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
}

function setCamera(box) {
  // The SVG has no size yet while the page is still laying out.
  if (!Number.isFinite(box.w) || box.w <= 0) return;
  camera = box;
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
}

function flyTo(box, jump) {
  cancelAnimationFrame(frame);
  if (jump || !camera || reducedMotion.matches) return setCamera(box);
  const from = camera;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / FLY_MS);
    setCamera(mixBox(from, box, easeInOut(t)));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}

function markSelected() {
  svg.querySelectorAll('.is-hot').forEach((el) => el.classList.remove('is-hot'));
  if (!route.node) return;
  const id = route.node.id;
  svg.querySelector(`.node[data-node="${id}"]`).classList.add('is-hot');
  svg.querySelector(`.link[data-to="${id}"]`)?.classList.add('is-hot');
  if (!route.service) return;
  svg.querySelector(`.chip[data-node="${id}"][data-service="${route.service.id}"]`)?.classList.add('is-hot');
}

function showTabs() {
  for (const tab of document.querySelectorAll('[data-tab]')) {
    if (tab.dataset.tab === route.view) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  for (const sheet of document.querySelectorAll('[data-sheet]')) {
    const open = sheet.dataset.sheet === route.view;
    sheet.classList.toggle('is-open', open);
    sheet.inert = !open;
  }
}

function showPanel() {
  const open = Boolean(route.node);
  if (open) panel.innerHTML = panelHtml(route);
  panel.classList.toggle('is-open', open);
  panel.inert = !open;
  if (open) panel.scrollTop = 0;
}

function pageTitle() {
  const name = route.service?.name || route.node?.name;
  if (name) return `${name} | ${SITE_TITLE}`;
  if (route.view === 'map') return SITE_TITLE;
  return `${route.view[0].toUpperCase()}${route.view.slice(1)} | ${SITE_TITLE}`;
}

// Keyboard users land on the thing that just opened, and back on the machine
// they left when they zoom out.
function moveFocus(previous) {
  if (route.node) return panel.focus({ preventScroll: true });
  const sheet = document.querySelector(`[data-sheet="${route.view}"] h1`);
  if (sheet) return sheet.focus({ preventScroll: true });
  if (previous.node) svg.querySelector(`.node[data-node="${previous.node.id}"]`).focus({ preventScroll: true });
}

function show({ jump = false, focus = false } = {}) {
  const previous = route;
  route = parseRoute(location.hash, NODES);
  document.body.dataset.view = route.view;
  document.title = pageTitle();
  showTabs();
  showPanel();
  markSelected();
  flyTo(cameraForRoute(), jump);
  if (focus) moveFocus(previous);
}

function hashForClick(target) {
  const node = target.closest('.node');
  if (!node) return parentHash(route);
  const id = node.dataset.node;
  const chip = target.closest('.chip');
  const zoomedHere = route.node && route.node.id === id;
  return chip?.dataset.service && zoomedHere ? `#${id}/${chip.dataset.service}` : `#${id}`;
}

function setNear(target, near) {
  const node = target.closest?.('.node');
  if (!node) return;
  svg.querySelector(`.link[data-to="${node.dataset.node}"]`)?.classList.toggle('is-near', near);
}

function openLightbox(shot) {
  const image = shot.querySelector('img');
  const large = lightbox.querySelector('img');
  large.src = image.src;
  large.alt = image.alt;
  lightbox.showModal();
}

svg.addEventListener('click', (event) => { location.hash = hashForClick(event.target); });
svg.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  location.hash = hashForClick(event.target);
});
svg.addEventListener('pointerover', (event) => setNear(event.target, true));
svg.addEventListener('pointerout', (event) => setNear(event.target, false));
svg.addEventListener('focusin', (event) => setNear(event.target, true));
svg.addEventListener('focusout', (event) => setNear(event.target, false));

panel.addEventListener('click', (event) => {
  const shot = event.target.closest('.shot');
  if (shot) openLightbox(shot);
});
lightbox.addEventListener('click', () => lightbox.close());

// A click beside the card on About, History or Contact zooms back out.
for (const sheet of document.querySelectorAll('[data-sheet]')) {
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) location.hash = parentHash(route);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !lightbox.open) location.hash = parentHash(route);
});
window.addEventListener('hashchange', () => show({ focus: true }));
window.addEventListener('resize', () => { measureBar(); drawScene(); show({ jump: true }); });

wireContactForm(document.getElementById('contact-form'));
measureBar();
drawScene();
show({ jump: true });
