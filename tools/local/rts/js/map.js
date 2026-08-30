// Generate a simple map with two base pads, ore fields, and water obstacles
const MapData = {
    tiles: [],
    oreFields: [], // { x, y, ore } — finite ore per field
};

function initMap() {
    // Fill with grass
    for (let y = 0; y < MAP_H; y++) {
        MapData.tiles[y] = [];
        for (let x = 0; x < MAP_W; x++) {
            MapData.tiles[y][x] = TERRAIN.GRASS;
        }
    }

    // Player base pad (top-left corner)
    const playerBaseX = 4, playerBaseY = 4;
    for (let y = playerBaseY; y < playerBaseY + 8; y++)
        for (let x = playerBaseX; x < playerBaseX + 8; x++)
            MapData.tiles[y][x] = TERRAIN.BASE_PAD;

    // AI base pad (bottom-right corner)
    const aiBaseX = MAP_W - 12, aiBaseY = MAP_H - 12;
    for (let y = aiBaseY; y < aiBaseY + 8; y++)
        for (let x = aiBaseX; x < aiBaseX + 8; x++)
            MapData.tiles[y][x] = TERRAIN.BASE_PAD;

    // Water obstacles in the middle
    const waterStartX = 30, waterEndX = 50;
    for (let y = 20; y < 60; y++) {
        for (let x = waterStartX; x < waterEndX; x++) {
            if (Math.random() < 0.4) MapData.tiles[y][x] = TERRAIN.WATER;
        }
    }

    // Ore fields scattered around
    const oreFieldPositions = [
        { x: 15, y: 20 },
        { x: 60, y: 15 },
        { x: 35, y: 40 },
        { x: 20, y: 60 },
        { x: 55, y: 55 },
    ];
    for (const field of oreFieldPositions) {
        const size = 4;
        for (let dy = 0; dy < size; dy++)
            for (let dx = 0; dx < size; dx++) {
                const tx = field.x + dx, ty = field.y + dy;
                if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H)
                    MapData.tiles[ty][tx] = TERRAIN.ORE;
            }
        // Register ore field with finite ore
        MapData.oreFields.push({ x: field.x, y: field.y, size: size, ore: 100 });
    }
}

function getTerrain(x, y) {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return TERRAIN.WATER;
    return MapData.tiles[y][x];
}

// Find nearest ore field with remaining ore for a given side
function findNearestOreField(x, y) {
    let best = null, bestDist = Infinity;
    for (const field of MapData.oreFields) {
        if (field.ore <= 0) continue;
        const dx = field.x - x, dy = field.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) { bestDist = dist; best = field; }
    }
    return best;
}