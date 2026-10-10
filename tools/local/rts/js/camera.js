// Camera: pan + zoom over the tile map
const Camera = {
    x: 0,
    y: 0,
    zoom: 1.0,
    minZoom: 0.5,
    maxZoom: 2.0,
};

// Track which keys were pressed this frame (prevents repeated triggers)
let prevKeys = {};

function updateCamera(dt) {
    const panSpeed = 300 * dt; // pixels per second

    if (Input.keys['w'] || Input.keys['arrowup'])    Camera.y -= panSpeed;
    if (Input.keys['s'] || Input.keys['arrowdown'])  Camera.y += panSpeed;
    if (Input.keys['a'] || Input.keys['arrowleft'])  Camera.x -= panSpeed;
    if (Input.keys['d'] || Input.keys['arrowright']) Camera.x += panSpeed;

    // Zoom — fire once per key press, not every frame while held
    const zoomIn = Input.keys['='] || Input.keys['+'];
    const zoomOut = Input.keys['-'] || Input.keys['_'];
    if (zoomIn && !prevKeys.zoomIn) {
        Camera.zoom = Math.min(Camera.maxZoom, Camera.zoom + 0.1);
    }
    if (zoomOut && !prevKeys.zoomOut) {
        Camera.zoom = Math.max(Camera.minZoom, Camera.zoom - 0.1);
    }

    // Clamp to map bounds
    const maxX = MAP_W * TILE_SIZE - (window.innerWidth / Camera.zoom);
    const maxY = MAP_H * TILE_SIZE - (window.innerHeight / Camera.zoom);
    Camera.x = Math.max(0, Math.min(Camera.x, maxX));
    Camera.y = Math.max(0, Math.min(Camera.y, maxY));

    // Save current key state for next frame comparison
    prevKeys = { zoomIn: !!zoomIn, zoomOut: !!zoomOut };
}