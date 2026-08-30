# RTS Tech Demo — Actionable Build Plan

## Goal
A single-player tech demo of an old-school RTS (Command & Conquer / Red Alert style), playable in a browser. No multiplayer.

---

## Phase 0 — Project Skeleton
**Deliverable:** A blank HTML page with canvas, dev server running, and a render loop that clears the screen each frame.

### Steps
1. Create `index.html` with `<canvas id="game">`, inline CSS to fill viewport, and a `<script src="main.js"></script>` tag.
2. In `main.js`, set up:
   - Canvas context (`ctx = canvas.getContext('2d')`)
   - Resize handler that sets `canvas.width/height` to window size
   - `requestAnimationFrame` loop calling `update(dt)` then `render()`
3. Verify: blank dark screen, no errors in console.
4. Create folder structure:
   ```
   /local/
     index.html
     main.js
     css/game.css
     js/
       constants.js      # tile size, map dimensions, colors
       input.js          # keyboard + mouse state
       camera.js         # pan/zoom transform
       renderer.js       # draw calls
       game.js           # core loop, systems orchestration
       map.js            # terrain grid data
       entities.js       # unit/building base classes
       ai.js             # opponent logic
   ```
5. Add `constants.js` with:
   - `TILE_SIZE = 16`
   - `MAP_W = 80`, `MAP_H = 80`
   - Color palette: grass, water, ore, base pad

**Verify:** Canvas renders a solid color each frame. Resize window — canvas follows.

---

## Phase 1 — Map & Camera
**Deliverable:** A tile map rendered on-screen with pan (WASD/arrows) and zoom (+/-).

### Steps
1. In `map.js`, define a 2D array of terrain types:
   - `0 = grass` (default)
   - `1 = water` (impassable, blue)
   - `2 = ore field` (yellow/brown patches)
   - `3 = base pad` (gray rectangle for each side's starting area)
2. Hardcode a simple map: two base pads on opposite corners, ore fields scattered between them, water obstacles in the middle.
3. In `renderer.js`, write `drawMap(ctx, camera)`: iterate tiles, draw colored rects at `(x * TILE_SIZE + cam.x, y * TILE_SIZE + cam.y)` scaled by `cam.zoom`.
4. In `camera.js`, define:
   - `Camera { x: number, y: number, zoom: number }`
   - `pan(dx, dy)`: clamped to map bounds
   - `zoomIn() / zoomOut()`: clamp between 0.5x and 2x
5. In `input.js`, track keyboard state (WASD/arrows for pan, +/- for zoom). Feed into camera each frame.
6. Wire it all: `update()` reads input → moves camera; `render()` calls `drawMap(ctx, camera)`.
7. Draw a grid overlay (thin lines between tiles) to verify alignment.

**Verify:** Pan around the map smoothly. Zoom in/out. Grid lines align with tile edges. Water is blue, ore is yellow-brown, base pads are gray rectangles.

---

## Phase 2 — Entities & Selection
**Deliverable:** Place a few units on the map. Click to select them; selection box via click-drag.

### Steps
1. In `entities.js`, define:
   - `Entity { id, x, y, type }` base class (x/y in tile coords)
   - `Unit extends Entity { hp, maxHp, speed, selected: bool }`
   - `Building extends Entity { hp, maxHp, side, buildingType }`
2. Define unit types in `constants.js`:
   - `WORKER`: speed 1.5, hp 30
   - `INFANTRY`: speed 1.0, hp 40
   - `TANK`: speed 0.6, hp 120
3. In `game.js`, create a unit registry: `Map<string, Unit>`.
4. Spawn initial units on each side's base pad:
   - Player (side 0): 3 workers, 2 infantry, 1 tank
   - AI (side 1): same composition
5. In `renderer.js`, draw units as colored circles with HP bars above them:
   - Player = green, AI = red
   - Circle radius proportional to unit size (worker small, tank large)
6. Selection system in `input.js` + `game.js`:
   - Left-click on empty tile: deselect all
   - Click-drag: create selection box; units inside get selected
   - Single click on a unit: select that unit only
   - Draw selection ring around selected units (white outline)
7. Right-click on ground: move selected units to that tile.
8. Movement logic in `game.js`:
   - Each frame, move each unit toward its target by `speed * dt`
   - Units stop when they reach the target tile
   - Multiple selected units fan out slightly (avoid stacking)

**Verify:** Click-drag selects multiple units. Right-click moves them to a new tile. HP bars visible above each unit.

---

## Phase 3 — Economy: Workers, Ore Fields & Refinery
**Deliverable:** Workers gather ore from fields and deliver it to the refinery, converting to currency.

### Steps
1. Add `currency` field to player state in `game.js`: `{ playerCurrency: number, aiCurrency: number }`
2. Define building types in `constants.js`:
   - `REFINERY`: cost 0 (pre-built), converts ore → currency at rate X/sec
3. Place a refinery on each side's base pad.
4. Worker behavior state machine in `entities.js`:
   ```
   IDLE → GATHERING (walk to nearest ore field) → CARRYING (walk back to refinery)
         → DELIVERED (drop ore, reset to IDLE)
   ```
5. Ore fields: each has a finite amount of ore (e.g., 100 units). When depleted, the tile becomes grass.
6. Worker capacity: carries up to 20 ore per trip.
7. Refinery logic: when worker arrives with ore, add `ore * 0.5` to currency pool.
8. In `renderer.js`, draw ore fields as yellow-brown tiles with a small ore icon or counter.
9. Draw a line from carrying workers back toward their refinery (visual feedback).
10. Add currency display to HUD: top-left corner, monospace font showing current amount.

**Verify:** Workers autonomously walk to ore fields, gather ore, return to refinery, and currency increases over time. Ore field depletes after enough trips.

---

## Phase 4 — Building Placement
**Deliverable:** Player can spend currency to build structures on valid tiles near their base.

### Steps
1. Define building types in `constants.js`:
   - `BARRACKS`: cost 50, trains infantry
   - `FACTORY`: cost 100, builds vehicles
   - `TURRET`: cost 30, defensive weapon
   - `WALL`: cost 10, blocks movement and attacks
2. Building placement rules:
   - Must be on grass tile adjacent to an existing building (or base pad)
   - Cannot overlap other buildings or water
   - Show a ghost preview when hovering with valid placement
3. In `game.js`, add build mode: clicking a "build" button enters placement mode.
4. Build UI in HUD bottom panel:
   - Buttons for each building type showing cost and name
   - Disabled (grayed out) if player can't afford it
5. Placement flow:
   - Click build button → enter placement mode, show ghost on cursor tile
   - Left-click valid tile → deduct currency, place building
   - Right-click or Esc → cancel placement
6. Buildings are static entities with HP. Draw them as colored rectangles with icons.
7. Add a "build queue" — buildings take time to construct (e.g., 3 seconds). Show progress bar on the ghost during construction.
8. After construction completes, building becomes active and can be selected/used.

**Verify:** Player builds barracks next to refinery, spends currency, sees construction progress, then uses it.

---

## Phase 5 — Unit Training & Combat
**Deliverable:** Buildings produce units; units attack enemies with range-based combat.

### Steps
1. Add training logic:
   - Select a barracks → bottom panel shows "Train Infantry" button (cost 20)
   - Clicking spawns an infantry unit at the building's tile
   - Training takes time (e.g., 4 seconds); show progress bar on building
   - Factory works similarly for tanks (cost 80, longer train time)
2. Combat system:
   - Each unit has: `attackRange`, `damage`, `fireRate` (seconds between shots)
   - Right-click an enemy unit → selected units target it and fire when in range
   - Units auto-fire at enemies within range if they have no other order
3. Projectile rendering: draw a small line or dot from attacker to target.
4. HP damage: subtract `damage` on hit; dead units are removed from registry.
5. Turret behavior: automatically fires at nearest enemy in range, 360° coverage.
6. Wall behavior: blocks movement and absorbs attacks (high HP, no attack).
7. Add death effects: small explosion sprite or flash when unit dies.

**Verify:** Train infantry from barracks, right-click AI units to attack, watch them fire and die. Turret auto-defends against approaching enemies.

---

## Phase 6 — Rule-Based AI Opponent
**Deliverable:** AI opponent builds economy, trains units, and attacks the player base.

### Steps
1. In `ai.js`, define a state machine:
   ```
   PHASE_BUILD_ECONOMY → PHASE_EXPAND_MILITARY → PHASE_ATTACK
   ```
2. Economy phase (first ~30 seconds):
   - AI workers gather ore autonomously (same logic as player)
   - Build refinery if not present, then barracks and factory
3. Military phase:
   - Train units at a steady rate based on available currency
   - Priority: infantry first, then tanks once factory is built
4. Attack phase:
   - Group trained units into waves (e.g., 5 infantry + 1 tank)
   - Send wave toward player base via right-click equivalent
   - After each wave departs, wait for more units to train before next wave
5. Reactive behavior:
   - If AI currency is low → pause training, focus economy
   - If AI buildings are under attack → build turrets near threatened area
6. AI runs on a tick (e.g., every 1 second) rather than per-frame.
7. Log AI decisions to console for debugging: "AI built barracks", "AI sent wave of 5 infantry".

**Verify:** AI builds its base, trains units, and periodically sends attack waves toward the player's base.

---

## Phase 7 — HUD Polish & Minimap
**Deliverable:** Complete UI with minimap, selection info panel, and action buttons.

### Steps
1. Top bar (CSS overlay on canvas):
   - Currency counter (left)
   - Unit count summary: "Infantry: 3 | Tanks: 1" (center)
   - Game timer (right)
2. Bottom panel:
   - Context-sensitive action buttons based on selected entity
   - No selection → build menu
   - Building selected → train/build options
   - Units selected → info display only
3. Minimap in bottom-right corner:
   - Small canvas showing full map at 1/8 scale
   - Colored dots for units (green = player, red = AI)
   - White rectangle showing current camera viewport
4. Selection box visual: semi-transparent white rectangle during click-drag.
5. Add a "Game Over" overlay when either base is destroyed:
   - Victory or Defeat text
   - Restart button that reloads the page
6. Keyboard shortcuts: `B` = barracks, `F` = factory, etc.
7. Sound effects on key events (build complete, unit dies, currency earned) using Web Audio API with simple oscillator tones if no audio files are available yet.

**Verify:** Full HUD visible and functional. Minimap updates in real time. Game over screen appears when a base is destroyed.

---

## Phase 8 — Juice & Polish (Stretch)
**Deliverable:** Visual feedback, sound, and feel improvements.

### Steps
1. Explosion particles on unit death (small expanding circles with fade-out).
2. Screen shake on large explosions or base destruction.
3. Unit selection ring pulses gently.
4. Building construction progress bar animates smoothly.
5. Add music loop (simple chiptune via Web Audio API oscillators, or a short MP3).
6. Terrain variety: add trees/rocks as decorative tiles that block movement but don't look like buildings.
7. Unit idle animations: slight bobbing or rotation when not moving.
8. Fog of war: only show terrain within camera range (optional, may be too much for tech demo).

---

## Phase 9 — Testing & Tuning
**Deliverable:** Playtested and balanced demo ready to share.

### Steps
1. Balance pass:
   - Adjust unit costs, HP, damage so neither side is trivially dominant
   - Time-to-victory should be ~20-30 minutes for a skilled player
2. Edge cases:
   - What happens when all ore fields are depleted? (Add a second wave of ore or a trickle income)
   - What if player has no workers? (Can't gather — game over scenario, acceptable)
   - Prevent building placement on water or outside map bounds
3. Performance check: ensure 60fps with ~50 units on screen.
4. Mobile responsiveness: touch controls for pan/select/move (optional).
5. Final pass: fix visual glitches, align HUD elements, test in Chrome/Firefox/Safari.
