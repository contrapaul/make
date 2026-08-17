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
 * Enemy stand-in (plans.md §21): labelled body with the weak point drawn where
 * the data says it is. weakPointFromTop is the weak point's height expressed as
 * a fraction down the sprite, so art and hitbox cannot drift apart.
 */
export function enemyTexture(label: string, bodyColor: string, weakPointFromTop: number): THREE.CanvasTexture {
  return canvasTexture(128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#2a0d16';
    ctx.lineWidth = 3;
    roundedRect(ctx, 24, 10, 80, 108, 16);
    ctx.fill();
    ctx.stroke();

    // Radius stays small enough that a weak point near the top still fits.
    const weakY = 128 * weakPointFromTop;
    const weakRadius = 14;
    const glow = ctx.createRadialGradient(64, weakY, 0, 64, weakY, weakRadius);
    glow.addColorStop(0, 'rgba(255, 244, 190, 1)');
    glow.addColorStop(0.45, 'rgba(255, 205, 60, 0.95)');
    glow.addColorStop(1, 'rgba(255, 160, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(64, weakY, weakRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, 64, 112);
  });
}

/** Corpse stand-in: the body darkened, weak point spent, no label. */
export function corpseTexture(bodyColor: string): THREE.CanvasTexture {
  return canvasTexture(128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = '#1b0810';
    ctx.lineWidth = 3;
    roundedRect(ctx, 10, 62, 108, 54, 18);
    ctx.fill();
    ctx.stroke();

    // Gold residue pooling where it fell.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#c08a20';
    for (let i = 0; i < 6; i += 1) {
      const x = 24 + Math.random() * 80;
      const y = 96 + Math.random() * 18;
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + Math.random() * 9, 2 + Math.random() * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Trumpet projectile: a gold music note (plans.md §11.3). */
export function noteTexture(): THREE.CanvasTexture {
  return canvasTexture(64, (ctx) => {
    ctx.clearRect(0, 0, 64, 64);

    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, 'rgba(255, 240, 170, 0.85)');
    glow.addColorStop(1, 'rgba(255, 170, 30, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);

    ctx.fillStyle = '#fffbe6';
    ctx.beginPath();
    ctx.ellipse(26, 42, 13, 10, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(36, 14, 5, 30);
    ctx.beginPath();
    ctx.moveTo(41, 14);
    ctx.quadraticCurveTo(54, 18, 50, 30);
    ctx.quadraticCurveTo(50, 21, 41, 22);
    ctx.fill();
  });
}

/** One of several gold splats, per plans.md §9 — overlapping blobs. */
export function splatTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);

    const blobs = 8 + Math.floor(Math.random() * 13);
    for (let i = 0; i < blobs; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() ** 0.7 * 78;
      const x = 128 + Math.cos(angle) * spread;
      const y = 128 + Math.sin(angle) * spread;
      const radius = 14 + Math.random() * 44;

      const blob = ctx.createRadialGradient(x, y, 0, x, y, radius);
      blob.addColorStop(0, 'rgba(255, 214, 90, 0.95)');
      blob.addColorStop(0.6, 'rgba(226, 164, 24, 0.7)');
      blob.addColorStop(1, 'rgba(168, 108, 0, 0)');

      ctx.fillStyle = blob;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Key colours, shared by keys and the doors they open (plans.md §11.5). */
export const KEY_COLORS: Record<string, string> = {
  red: '#ff4a4a',
  blue: '#4aa8ff',
  green: '#4aff7a',
};

export function keyColor(color: string): string {
  return KEY_COLORS[color] ?? '#ffffff';
}

/** Music-note key, drawn in its own colour with a glow behind it. */
export function keyTexture(color: string): THREE.CanvasTexture {
  const hex = keyColor(color);

  return canvasTexture(128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);

    const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
    glow.addColorStop(0, `${hex}cc`);
    glow.addColorStop(1, `${hex}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.ellipse(48, 88, 22, 17, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(65, 26, 8, 62);
    ctx.beginPath();
    ctx.moveTo(73, 26);
    ctx.quadraticCurveTo(100, 33, 92, 56);
    ctx.quadraticCurveTo(92, 39, 73, 41);
    ctx.fill();
  });
}

/** Locked door panel: dark metal with a note-shaped lock in the key's colour. */
export function doorTexture(color: string): THREE.CanvasTexture {
  const hex = keyColor(color);

  return canvasTexture(256, (ctx) => {
    ctx.fillStyle = '#241820';
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#4a3040';
    ctx.lineWidth = 6;
    for (let band = 1; band < 4; band += 1) {
      ctx.beginPath();
      ctx.moveTo(0, band * 64);
      ctx.lineTo(256, band * 64);
      ctx.stroke();
    }

    ctx.strokeStyle = hex;
    ctx.lineWidth = 8;
    ctx.strokeRect(28, 28, 200, 200);

    // Note-shaped lock, so colour is not the only cue.
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.ellipse(104, 168, 30, 23, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(128, 78, 11, 90);
  });
}

/** Exit portal: a bright churn of gold that reads as a way out. */
export function portalTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);

    const glow = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
    glow.addColorStop(0, 'rgba(255, 255, 235, 0.95)');
    glow.addColorStop(0.45, 'rgba(255, 206, 90, 0.7)');
    glow.addColorStop(1, 'rgba(255, 150, 20, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(255, 244, 200, 0.8)';
    ctx.lineWidth = 5;
    for (let arm = 0; arm < 5; arm += 1) {
      const angle = (arm / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(128, 128, 52 + arm * 8, angle, angle + Math.PI * 0.7);
      ctx.stroke();
    }
  });
}

/**
 * First-person weapon shapes, plans.md §21: simple instruments angled in from
 * the lower right, muzzle pointing toward the centre of the screen.
 */
export function viewModelTexture(weaponId: string): THREE.CanvasTexture {
  return canvasTexture(256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#3a2408';

    switch (weaponId) {
      case 'tuba': {
        // Big brass loop with a wide upward bell.
        ctx.strokeStyle = '#c8901c';
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.arc(150, 150, 66, Math.PI * 0.15, Math.PI * 1.75);
        ctx.stroke();

        ctx.fillStyle = '#e8b53c';
        ctx.beginPath();
        ctx.ellipse(96, 74, 52, 30, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#6b4a0c';
        ctx.stroke();
        break;
      }

      case 'saxophone': {
        // Curved tube hooking up to a flared bell.
        ctx.strokeStyle = '#dca92c';
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(214, 236);
        ctx.quadraticCurveTo(150, 190, 148, 120);
        ctx.quadraticCurveTo(146, 62, 96, 60);
        ctx.stroke();

        ctx.fillStyle = '#f0c451';
        ctx.beginPath();
        ctx.ellipse(78, 56, 34, 22, -0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#7a5410';
        for (let key = 0; key < 5; key += 1) {
          ctx.beginPath();
          ctx.arc(168 - key * 6, 190 - key * 26, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'electric_guitar': {
        // Angular body, neck toward the centre, strings along it.
        ctx.fillStyle = '#7a3ad6';
        ctx.beginPath();
        ctx.moveTo(232, 250);
        ctx.lineTo(140, 214);
        ctx.lineTo(158, 150);
        ctx.lineTo(250, 186);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2a1150';
        ctx.stroke();

        ctx.fillStyle = '#c9a24a';
        ctx.save();
        ctx.translate(158, 150);
        ctx.rotate(-0.38);
        ctx.fillRect(-14, -108, 28, 116);
        ctx.restore();

        ctx.strokeStyle = 'rgba(255, 240, 190, 0.9)';
        ctx.lineWidth = 1.5;
        for (let string = 0; string < 4; string += 1) {
          ctx.beginPath();
          ctx.moveTo(146 + string * 6, 152);
          ctx.lineTo(104 + string * 6, 56);
          ctx.stroke();
        }
        break;
      }

      default: {
        // Trumpet: straight gold tube with a bell and three valves.
        ctx.fillStyle = '#d9a52a';
        ctx.save();
        ctx.translate(190, 200);
        ctx.rotate(-0.62);
        ctx.fillRect(-18, -132, 36, 140);
        ctx.restore();

        ctx.fillStyle = '#f2c451';
        ctx.beginPath();
        ctx.ellipse(104, 74, 46, 34, -0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6b4a0c';
        ctx.stroke();

        ctx.fillStyle = '#8a5f10';
        for (let valve = 0; valve < 3; valve += 1) {
          ctx.beginPath();
          ctx.arc(186 - valve * 22, 178 - valve * 12, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
