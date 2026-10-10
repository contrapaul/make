import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// Control panel, keyboard shortcuts, help overlay.
// `select(meshOrNull)` is provided by main.js (handles highlight + HUD).
// Returns the `view` flags object so main.js can drive camera-follow.
export function setupUI({ app, planetsGroup, rings, select }) {
  const gui = new GUI({ title: 'Orbital Playground' });
  const view = {
    orbits: true,
    wireframe: false,
    follow: false,
  };

  gui.add(app.clock, 'speed', 0, 10);
  gui.add(app.clock, 'paused');
  gui.add(view, 'orbits').onChange((v) => rings.forEach((r) => { r.visible = v; }));
  gui.add(view, 'wireframe').onChange((v) => {
    for (const m of planetsGroup.children) m.material.wireframe = v;
  });
  gui.add(view, 'follow');

  function resetCamera() {
    app.camera.position.set(0, 20, 40);
    app.controls.target.set(0, 0, 0);
  }
  gui.add({ resetCamera }, 'resetCamera');

  function syncGui() {
    for (const c of gui.controllers) c.updateDisplay();
  }

  const help = document.getElementById('help');

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === ' ') {
      e.preventDefault();
      app.clock.paused = !app.clock.paused;
      syncGui();
    } else if (e.key === 'r' || e.key === 'R') {
      resetCamera();
    } else if (e.key === 'Escape') {
      select(null);
    } else if (e.key === '?') {
      help.hidden = !help.hidden;
    } else if (e.key >= '1' && e.key <= '6') {
      select(planetsGroup.children[Number(e.key) - 1]);
    }
  });

  return view;
}
