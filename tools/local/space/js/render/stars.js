// Starfield: points on a spherical shell. Render-side only (Math.random ok here —
// never in js/sim). Adapted from ../3d/js/scene.js; shell scaled up for the
// 2000-wide arena.
// Weighted palette: mostly white-blue, a minority of orange/red/purple so
// patches of space read as variety (owner note, round 1).
const HUES = [
  [0.70, 0.87, 1.0], //  white-blue #dde6ff
  [1.0, 0.60, 0.35], //  orange   #ff9a5a
  [1.0, 0.42, 0.42], //  red-pink #ff6a6a
  [0.69, 0.48, 1.0], //  purple   #b07aff
];
const HUE_CUTS = [0.7, 0.85, 0.95, 1.0];

export function buildStars(THREE, { count = 4000, rMin = 4000, rMax = 6000 } = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = rMin + Math.random() * (rMax - rMin);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);
    const pick = Math.random();
    const hue = HUES[HUE_CUTS.findIndex((c) => pick < c)];
    const b = 0.7 + Math.random() * 0.3; // brightness jitter
    colors[i * 3] = hue[0] * b;
    colors[i * 3 + 1] = hue[1] * b;
    colors[i * 3 + 2] = hue[2] * b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 12, sizeAttenuation: true, vertexColors: true })
  );
}
