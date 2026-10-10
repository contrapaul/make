// Keyboard + mouse state tracking
const Input = {
    keys: {},
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    dragStartX: null,
    dragStartY: null,
};

window.addEventListener('keydown', (e) => {
    if (!Input.keys[e.key.toLowerCase()]) e.preventDefault();
    Input.keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup',   (e) => { Input.keys[e.key.toLowerCase()] = false; });

// Note: mousedown/mouseup for selection are handled in game.js

window.addEventListener('mousemove', (e) => {
    if (e.target.id !== 'game') return;
    Input.mouseX = e.clientX;
    Input.mouseY = e.clientY;
});