// Tile size in pixels
const TILE_SIZE = 16;

// Map dimensions (tiles)
const MAP_W = 80;
const MAP_H = 80;

// Terrain types
const TERRAIN = {
    GRASS: 0,
    WATER: 1,
    ORE: 2,
    BASE_PAD: 3,
};

// Terrain colors
const TERRAIN_COLORS = {
    [TERRAIN.GRASS]: '#4a7c59',
    [TERRAIN.WATER]: '#2b6cb0',
    [TERRAIN.ORE]:   '#b8860b',
    [TERRAIN.BASE_PAD]: '#6b7280',
};