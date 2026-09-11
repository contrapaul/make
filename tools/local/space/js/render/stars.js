// Starfield: points on a spherical shell. Render-side only (Math.random ok here —
// never in js/sim). Adapted from ../3d/js/scene.js; shell scaled up for the
// 2000-wide arena.
export function buildStars(THREE, { count = 4000, rMin = 4000, rMax = 6000 } = {}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = rMin + Math.random() * (rMax - rMin);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 12, sizeAttenuation: true, color: 0xdde6ff })
  );
}
