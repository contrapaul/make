import * as THREE from 'three';

/**
 * Procedurally generated stand-in art, per plans.md §21. The tech demo ships no
 * image files: every texture here is drawn to a canvas at boot. Real PNGs can
 * replace these one at a time without touching call sites.
 *
 * Patterns are drawn to tile seamlessly — edge lines are drawn on one side only,
 * since the neighbouring copy supplies the other.
 */

const TILE_SIZE = 256;

/** Draw into an offscreen canvas and hand back a texture ready for a material. */
export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d')!);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Radial gold particle — the hit/blood particle from plans.md §9. */
export function goldParticleTexture(): THREE.CanvasTexture {
  return canvasTexture(64, (ctx) => {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 230, 120, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 180, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 120, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Hell wall: dark vertical stripes with gold staff lines across them. */
function wallTexture(): THREE.CanvasTexture {
  return canvasTexture(TILE_SIZE, (ctx) => {
    ctx.fillStyle = '#33161f';
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const stripeWidth = TILE_SIZE / 8;
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#45202c' : '#2a1219';
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, TILE_SIZE);
    }

    // Five staff lines, gold and slightly translucent.
    ctx.strokeStyle = 'rgba(255, 200, 60, 0.55)';
    ctx.lineWidth = 2;
    for (let line = 0; line < 5; line += 1) {
      const y = TILE_SIZE * 0.28 + line * (TILE_SIZE * 0.075);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(TILE_SIZE, y);
      ctx.stroke();
    }
  });
}

/** Stage floor: dark tiles with a faint gold grid. */
function floorTexture(): THREE.CanvasTexture {
  return canvasTexture(TILE_SIZE, (ctx) => {
    ctx.fillStyle = '#221e2b';
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    ctx.fillStyle = '#2d2838';
    ctx.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);

    ctx.strokeStyle = 'rgba(255, 190, 70, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(TILE_SIZE, 0.5);
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, TILE_SIZE);
    ctx.stroke();
  });
}

/** Void ceiling: near-black with scattered glowing notes. */
function ceilingTexture(): THREE.CanvasTexture {
  return canvasTexture(TILE_SIZE, (ctx) => {
    ctx.fillStyle = '#08060d';
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    for (let i = 0; i < 24; i += 1) {
      const x = Math.random() * TILE_SIZE;
      const y = Math.random() * TILE_SIZE;
      const radius = 1 + Math.random() * 2.5;

      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      glow.addColorStop(0, 'rgba(255, 214, 120, 0.85)');
      glow.addColorStop(1, 'rgba(255, 160, 40, 0)');

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/**
 * Texture IDs levels refer to, standing in for the textures.json map in
 * plans.md §13. Levels name an ID, never a path, so swapping in real files later
 * is a change here and nowhere else.
 */
const TEXTURE_FACTORIES: Record<string, () => THREE.CanvasTexture> = {
  wall_hell: wallTexture,
  floor_music: floorTexture,
  ceil_void: ceilingTexture,
};

export function placeholderTexture(id: string): THREE.CanvasTexture {
  const factory = TEXTURE_FACTORIES[id];
  if (!factory) {
    throw new Error(`Unknown texture id "${id}". Known ids: ${Object.keys(TEXTURE_FACTORIES).join(', ')}`);
  }

  return factory();
}
