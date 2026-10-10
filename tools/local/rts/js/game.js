// Core game state and orchestration
const Game = {
    running: false,
    units: new Map(), // id -> Unit
    buildings: new Map(), // id -> Building
    currency: { 0: 200, 1: 200 }, // starting currency per side
};

function initGame() {
    initMap();
    placeRefineries();
    spawnInitialUnits();
}

// Place a refinery on each side's base pad
function placeRefineries() {
    const playerRefinery = new Building('REFINERY', 0, 8, 8);
    Game.buildings.set(playerRefinery.id, playerRefinery);

    const aiRefinery = new Building('REFINERY', 1, MAP_W - 10 + 4, MAP_H - 10 + 4);
    Game.buildings.set(aiRefinery.id, aiRefinery);
}

// Get refinery position for a side
function getRefineryPos(side) {
    const r = side === 0 ? { x: 8, y: 8 } : { x: MAP_W - 6, y: MAP_H - 6 };
    return r;
}

// Spawn initial units on each side's base pad
function spawnInitialUnits() {
    const playerBase = { x: 6, y: 6 };
    const aiBase = { x: MAP_W - 10, y: MAP_H - 10 };

    // Player (side 0): 3 workers, 2 infantry, 1 tank
    spawnUnit('WORKER', 0, playerBase.x + 1, playerBase.y + 1);
    spawnUnit('WORKER', 0, playerBase.x + 2, playerBase.y + 1);
    spawnUnit('WORKER', 0, playerBase.x + 3, playerBase.y + 1);
    spawnUnit('INFANTRY', 0, playerBase.x + 1, playerBase.y + 3);
    spawnUnit('INFANTRY', 0, playerBase.x + 2, playerBase.y + 3);
    spawnUnit('TANK', 0, playerBase.x + 4, playerBase.y + 3);

    // AI (side 1): same composition
    spawnUnit('WORKER', 1, aiBase.x + 1, aiBase.y + 1);
    spawnUnit('WORKER', 1, aiBase.x + 2, aiBase.y + 1);
    spawnUnit('WORKER', 1, aiBase.x + 3, aiBase.y + 1);
    spawnUnit('INFANTRY', 1, aiBase.x + 1, aiBase.y + 3);
    spawnUnit('INFANTRY', 1, aiBase.x + 2, aiBase.y + 3);
    spawnUnit('TANK', 1, aiBase.x + 4, aiBase.y + 3);
}

function spawnUnit(type, side, x, y) {
    const unit = new Unit(type, side, x, y);
    Game.units.set(unit.id, unit);
}

// --- Selection state ---
let selectionBox = null; // { sx, sy, ex, ey } in screen pixels
let isDragging = false;

function update(dt) {
    if (!Game.running) return;
    updateCamera(dt);
    AI.tick(dt);
    updateSelection();
    updateWorkerAI(dt);
    updateMovement(dt);
}

// Handle selection from mouse input
function updateSelection() {
    // If dragging, build the selection box
    if (isDragging && Input.mouseDown) {
        const dx = Input.mouseX - Input.dragStartX;
        const dy = Input.mouseY - Input.dragStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            selectionBox = {
                sx: Input.dragStartX,
                sy: Input.dragStartY,
                ex: Input.mouseX,
                ey: Input.mouseY,
            };
        }
    }
}

// Worker AI state machine
function updateWorkerAI(dt) {
    for (const unit of Game.units.values()) {
        if (unit.type !== 'WORKER') continue;

        switch (unit.workerState) {
            case WORKER_STATE.IDLE:
                // Find nearest ore field with remaining ore
                const field = findNearestOreField(unit.x, unit.y);
                if (field) {
                    unit.gatherTarget = { x: field.x + 1.5, y: field.y + 1.5 };
                    unit.targetX = unit.gatherTarget.x;
                    unit.targetY = unit.gatherTarget.y;
                    unit.workerState = WORKER_STATE.GATHERING;
                }
                break;

            case WORKER_STATE.GATHERING:
                // Check if reached ore field
                const dxG = unit.gatherTarget.x - unit.x;
                const dyG = unit.gatherTarget.y - unit.y;
                if (Math.sqrt(dxG * dxG + dyG * dyG) < 0.5) {
                    // Gather ore from the field
                    const field = findNearestOreField(unit.x, unit.y);
                    if (field && field.ore > 0) {
                        const takeAmount = Math.min(field.ore, unit.maxCargo - unit.cargo);
                        unit.cargo += takeAmount;
                        field.ore -= takeAmount;

                        // If field depleted, turn tiles to grass
                        if (field.ore <= 0) {
                            for (let dy2 = 0; dy2 < field.size; dy2++)
                                for (let dx2 = 0; dx2 < field.size; dx2++) {
                                    const tx = field.x + dx2, ty = field.y + dy2;
                                    if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H)
                                        MapData.tiles[ty][tx] = TERRAIN.GRASS;
                                }
                        }
                    }

                    // Now carry ore back to refinery
                    const refineryPos = getRefineryPos(unit.side);
                    unit.targetX = refineryPos.x + 1.5;
                    unit.targetY = refineryPos.y + 1.5;
                    unit.workerState = WORKER_STATE.CARRYING;
                }
                break;

            case WORKER_STATE.CARRYING:
                // Check if reached refinery
                const refineryPos2 = getRefineryPos(unit.side);
                const dxR = (refineryPos2.x + 1.5) - unit.x;
                const dyR = (refineryPos2.y + 1.5) - unit.y;
                if (Math.sqrt(dxR * dxR + dyR * dyR) < 0.8) {
                    // Deliver ore → convert to currency
                    Game.currency[unit.side] += Math.floor(unit.cargo * 0.5);
                    unit.cargo = 0;
                    delete unit.targetX;
                    delete unit.targetY;
                    unit.workerState = WORKER_STATE.IDLE;
                }
                break;
        }
    }
}

// Move units toward their target tiles
function updateMovement(dt) {
    for (const unit of Game.units.values()) {
        if (!unit.targetX && !unit.targetY) continue;

        const dx = unit.targetX - unit.x;
        const dy = unit.targetY - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.1) {
            // Reached target — snap to tile center and clear
            unit.x = unit.targetX;
            unit.y = unit.targetY;
            delete unit.targetX;
            delete unit.targetY;
            continue;
        }

        const moveAmount = unit.speed * dt;
        unit.x += (dx / dist) * Math.min(moveAmount, dist);
        unit.y += (dy / dist) * Math.min(moveAmount, dist);
    }
}

// Convert screen pixel to tile coords
function screenToTile(px, py) {
    const ts = TILE_SIZE * Camera.zoom;
    const tx = Math.floor((px - Camera.x * Camera.zoom) / ts);
    const ty = Math.floor((py - Camera.y * Camera.zoom) / ts);
    return { x: tx, y: ty };
}

// Check if a unit is inside a screen-rect selection box
function unitInBox(unit, box) {
    const ts = TILE_SIZE * Camera.zoom;
    const ux = (unit.x + 0.5) * ts + Camera.x * Camera.zoom;
    const uy = (unit.y + 0.5) * ts + Camera.y * Camera.zoom;

    const minX = Math.min(box.sx, box.ex);
    const maxX = Math.max(box.sx, box.ex);
    const minY = Math.min(box.sy, box.ey);
    const maxY = Math.max(box.sy, box.ey);

    return ux >= minX && ux <= maxX && uy >= minY && uy <= maxY;
}

// Handle left click (selection)
function handleLeftClick() {
    // If we were dragging and built a selection box, select units inside it
    if (isDragging && selectionBox) {
        for (const unit of Game.units.values()) {
            if (unit.side !== 0) continue; // only select player units
            unit.selected = unitInBox(unit, selectionBox);
        }
        selectionBox = null;
        isDragging = false;
    } else {
        // Single click — deselect all
        for (const unit of Game.units.values()) unit.selected = false;
    }
}

// Handle right click (move selected units)
function handleRightClick() {
    const tile = screenToTile(Input.mouseX, Input.mouseY);
    let fanIndex = 0;

    for (const unit of Game.units.values()) {
        if (!unit.selected || unit.side !== 0) continue;

        // Fan out slightly to avoid stacking
        const offsetX = (fanIndex % 3 - 1) * 0.5;
        const offsetY = Math.floor(fanIndex / 3) * 0.5;
        fanIndex++;

        unit.targetX = tile.x + offsetX;
        unit.targetY = tile.y + offsetY;
    }
}

// Mouse event handlers for selection
window.addEventListener('mousedown', (e) => {
    if (e.target.id !== 'game') return;
    Input.mouseDown = true;
    isDragging = false;
    selectionBox = null;
    Input.dragStartX = e.clientX;
    Input.dragStartY = e.clientY;
});

window.addEventListener('mouseup', (e) => {
    if (e.target.id !== 'game') return;
    Input.mouseDown = false;
    if (e.button === 0) handleLeftClick(); // left click
    if (e.button === 2) handleRightClick(); // right click
});

// Prevent context menu on right-click
window.addEventListener('contextmenu', (e) => {
    if (e.target.id === 'game') e.preventDefault();
});

function render(ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderMap(ctx);
    renderBuildings(ctx);
    renderUnits(ctx);
    renderSelectionBox(ctx);
    renderHUD(ctx);
}