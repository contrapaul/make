// Draw the map tiles and grid overlay
function renderMap(ctx) {
    const ts = TILE_SIZE * Camera.zoom;

    for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
            const terrain = MapData.tiles[y][x];
            ctx.fillStyle = TERRAIN_COLORS[terrain];
            ctx.fillRect(
                Camera.x * Camera.zoom + x * ts,
                Camera.y * Camera.zoom + y * ts,
                ts, ts
            );
        }
    }

    // Grid overlay (thin lines)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= MAP_W; x++) {
        const px = Camera.x * Camera.zoom + x * ts;
        ctx.beginPath();
        ctx.moveTo(px, Camera.y * Camera.zoom);
        ctx.lineTo(px, Camera.y * Camera.zoom + MAP_H * ts);
        ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y++) {
        const py = Camera.y * Camera.zoom + y * ts;
        ctx.beginPath();
        ctx.moveTo(Camera.x * Camera.zoom, py);
        ctx.lineTo(Camera.x * Camera.zoom + MAP_W * ts, py);
        ctx.stroke();
    }

    // Ore field counters (small text on ore tiles)
    for (const field of MapData.oreFields) {
        if (field.ore <= 0) continue;
        const sx = (field.x + 1.5) * ts + Camera.x * Camera.zoom;
        const sy = (field.y + 1.5) * ts + Camera.y * Camera.zoom;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `${Math.max(8, 9 * Camera.zoom)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(field.ore), sx, sy);
    }
}

// Draw buildings as colored rectangles with labels
function renderBuildings(ctx) {
    const ts = TILE_SIZE * Camera.zoom;

    for (const building of Game.buildings.values()) {
        const bx = building.x * ts + Camera.x * Camera.zoom;
        const by = building.y * ts + Camera.y * Camera.zoom;
        const bw = 2 * ts; // buildings are 2x2 tiles
        const bh = 2 * ts;

        // Building body
        ctx.fillStyle = building.side === 0 ? '#3b82f6' : '#ef4444';
        ctx.fillRect(bx, by, bw, bh);

        // Border
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);

        // Label
        const labelY = by + bh / 2 + 5 * Camera.zoom;
        ctx.fillStyle = 'white';
        ctx.font = `${Math.max(8, 9 * Camera.zoom)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(building.type.substring(0, 4), bx + bw / 2, labelY);
    }
}

// Draw units as colored circles with HP bars and selection rings
function renderUnits(ctx) {
    const ts = TILE_SIZE * Camera.zoom;

    for (const unit of Game.units.values()) {
        // Screen position (center of tile)
        const sx = (unit.x + 0.5) * ts + Camera.x * Camera.zoom;
        const sy = (unit.y + 0.5) * ts + Camera.y * Camera.zoom;

        const r = UNIT_STATS[unit.type].radius * Camera.zoom;

        // Unit body
        ctx.fillStyle = unit.side === 0 ? '#4ade80' : '#ef4444';
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

        // Selection ring
        if (unit.selected) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        // HP bar above unit
        const barW = r * 2.5;
        const barH = 3 * Camera.zoom;
        const hpRatio = unit.hp / unit.maxHp;
        const barX = sx - barW / 2;
        const barY = sy - r - barH - 4;

        // Bar background (dark)
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(barX, barY, barW, barH);

        // HP fill
        ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);

        // Cargo indicator for workers carrying ore (small yellow dot)
        if (unit.type === 'WORKER' && unit.cargo > 0) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(sx + r * 0.6, sy - r * 0.6, 2 * Camera.zoom, 0, Math.PI * 2);
            ctx.fill();
        }

        // Carrying line: from worker to refinery (visual feedback)
        if (unit.type === 'WORKER' && unit.workerState === WORKER_STATE.CARRYING) {
            const refineryPos = getRefineryPos(unit.side);
            const rx = (refineryPos.x + 1.5) * ts + Camera.x * Camera.zoom;
            const ry = (refineryPos.y + 1.5) * ts + Camera.y * Camera.zoom;

            ctx.strokeStyle = 'rgba(251,191,36,0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(rx, ry);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

// Draw the selection box (click-drag rectangle)
function renderSelectionBox(ctx) {
    if (!selectionBox) return;

    const minX = Math.min(selectionBox.sx, selectionBox.ex);
    const minY = Math.min(selectionBox.sy, selectionBox.ey);
    const w = Math.abs(selectionBox.ex - selectionBox.sx);
    const h = Math.abs(selectionBox.ey - selectionBox.sy);

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(minX, minY, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(minX, minY, w, h);
}

// Draw HUD: currency display top-left
function renderHUD(ctx) {
    const padding = 10;
    const fontSize = Math.max(14, 16 * Camera.zoom);

    // Background panel
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(padding - 2, padding - 2, 180, fontSize + 10);

    // Currency text
    ctx.fillStyle = '#fbbf24';
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(`Ore: ${Game.currency[0]}`, padding, padding + fontSize - 2);
}