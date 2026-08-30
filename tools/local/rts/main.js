// Entry point — render loop
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let lastTime = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

initGame();
Game.running = true;

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100ms
    lastTime = timestamp;

    update(dt);
    render(ctx);

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);