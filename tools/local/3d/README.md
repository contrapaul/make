# Orbital Playground

Interactive 3D demo: a glowing sun, six procedural planets on tilted orbit
rings, a starfield, orbit camera, click-to-inspect, control panel, keyboard
shortcuts. three.js r186 (vendored) — no build step, no npm packages, no
assets; everything is procedural.

## Run it (ES modules need HTTP, not `file://`)

```bash
cd tools/local          # so the URL is /3d/
python3 -m http.server 8000
# open http://localhost:8000/3d/
```

## Controls

Click a planet to select it (glow + HUD details) · drag/scroll to orbit and
zoom · **Space** pause/resume · **R** reset camera · **1–6** select planet by
index · **Esc** deselect · **?** toggle help overlay.

The lil-gui panel (top-right) adds: speed slider, paused, orbits on/off,
wireframe, follow-selected, reset camera.

## Files

- `index.html` — canvas, HUD, help overlay, importmap
- `css/style.css`
- `js/main.js` — renderer, camera, controls, loop, selection, follow
- `js/sim.js` — pure orbital math + planet data (unit-tested, no three)
- `js/scene.js` — sun / planets / rings / starfield
- `js/pick.js` — raycast click selection · `js/ui.js` — gui, keyboard, help
- `test/sim.test.mjs` · `vendor/three/` — pinned three.js 0.186.0 (do not edit)

## Extend

- **Add a planet:** append one `{name, radius, orbit, period, color, tilt}`
  object to `PLANETS` in `js/sim.js`. Nothing else to touch.
- **Bump three.js:** re-run the M0 curl block in `3D.md` with the new version
  into `vendor/three/`, then check the console for API changes.
